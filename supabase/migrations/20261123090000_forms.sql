-- 신청폼 탭: 질문을 직접 만드는 로그인 없는 신청 폼(종강총회 같은 행사 참가 신청)
-- 1. 질문은 짧은 답, 긴 답, 하나 고르기, 여러 개 고르기 네 종류이며 필수 여부를 정한다.
-- 2. 정원을 정하면 먼저 낸 순서대로 받고, 정원이 차면 더 받지 않는다(선착순).
-- 3. 신청자 개인정보가 있으므로 캡처처럼 관리자만 만들고, 언제나 "지정한 멤버만" 본다.
--    열람자 설정은 일반 탭처럼 관리자와 설정 가능자가 바꾼다.
-- 4. 익명은 아래 두 함수로만 폼을 읽고 제출한다. 응답 표는 익명에게 열지 않는다.
-- 더하기만 하는 변경이다(기존 탭의 검사 조건과 만들기 정책은 'form'을 더해 다시 만든다).

-- 탭 종류 ---------------------------------------------------------------

alter table public.tabs drop constraint tabs_template_check;
alter table public.tabs add constraint tabs_template_check
  check (template in ('note', 'calendar', 'capture', 'timetable', 'form'));

alter table public.tabs drop constraint tabs_capture_viewers_only;
alter table public.tabs add constraint tabs_capture_viewers_only
  check (template not in ('capture', 'form') or viewers_only);

create or replace function private.prepare_new_tab()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.template in ('capture', 'form') then
    new.viewers_only := true;
  end if;
  return new;
end;
$$;

drop policy "멤버는 탭을 만든다" on public.tabs;
create policy "멤버는 탭을 만든다" on public.tabs
  for insert to authenticated
  with check (
    private.is_member(workspace_id)
    and (template not in ('capture', 'form') or private.is_admin(workspace_id))
    and (parent_id is null or private.can_see_tab(parent_id))
  );

-- 표 ------------------------------------------------------------------

-- 질문 한 개: {"id": "...", "type": "short|long|single|multiple", "label": "...", "help": "...",
--              "required": true, "options": ["...", ...]}
create table public.form_settings (
  tab_id uuid primary key references public.tabs (id) on delete cascade,
  public_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  is_open boolean not null default false,
  closes_at timestamptz,
  capacity integer check (capacity between 1 and 2000),
  notice text not null default '' check (char_length(notice) <= 5000),
  questions jsonb not null default '[
    {"id": "name", "type": "short", "label": "이름", "help": "", "required": true, "options": []},
    {"id": "student-id", "type": "short", "label": "학번", "help": "", "required": true, "options": []},
    {"id": "major", "type": "short", "label": "전공", "help": "", "required": true, "options": []},
    {"id": "cohort", "type": "short", "label": "기수", "help": "", "required": true, "options": []}
  ]'::jsonb
    check (jsonb_typeof(questions) = 'array' and octet_length(questions::text) <= 50000)
);

-- 답: {"질문 id": "글" 또는 ["고른 항목", ...]}
create table public.form_responses (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.tabs (id) on delete cascade,
  answers jsonb not null
    check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 30000),
  created_at timestamptz not null default now()
);
create index form_responses_tab_id_idx on public.form_responses (tab_id, created_at);

-- 권한 ------------------------------------------------------------------

alter table public.form_settings enable row level security;
alter table public.form_responses enable row level security;

grant select on public.form_settings to authenticated;
grant update (is_open, closes_at, capacity, notice, questions) on public.form_settings to authenticated;
grant select, delete on public.form_responses to authenticated;
grant update (answers) on public.form_responses to authenticated;

create policy "열람자는 신청폼 설정을 본다" on public.form_settings
  for select to authenticated using (private.can_see_tab(tab_id));
create policy "열람자는 신청폼을 설정한다" on public.form_settings
  for update to authenticated
  using (private.can_see_tab(tab_id))
  with check (private.can_see_tab(tab_id));

create policy "열람자는 응답을 본다" on public.form_responses
  for select to authenticated using (private.can_see_tab(tab_id));
create policy "열람자는 응답을 고친다" on public.form_responses
  for update to authenticated
  using (private.can_see_tab(tab_id))
  with check (private.can_see_tab(tab_id));
create policy "열람자는 응답을 지운다" on public.form_responses
  for delete to authenticated using (private.can_see_tab(tab_id));

-- 신청폼 탭을 만들면 설정을 함께 만든다 ---------------------------------------

create function private.handle_new_form_tab()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.form_settings (tab_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_form_tab() from public, anon, authenticated;

create trigger on_form_tab_created
  after insert on public.tabs
  for each row when (new.template = 'form')
  execute function private.handle_new_form_tab();

-- 공개 신청 폼 ------------------------------------------------------------

-- 링크를 아는 사람에게 폼 구성만 돌려준다. 응답 내용은 포함하지 않는다.
create function public.get_form(token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title', t.title,
    'notice', s.notice,
    'questions', s.questions,
    'closesAt', s.closes_at,
    'isOpen', s.is_open and (s.closes_at is null or s.closes_at > now()),
    'isFull', s.capacity is not null
      and (select count(*) from public.form_responses r where r.tab_id = s.tab_id) >= s.capacity
  )
  from public.form_settings s
  join public.tabs t on t.id = s.tab_id
  where s.public_token = token and t.deleted_at is null and t.template = 'form';
$$;

-- 질문에 맞는 답만 골라 다듬어 저장한다. 오류 문구는 신청자에게 그대로 보인다.
create function public.submit_form_response(token text, answers jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  settings public.form_settings;
  question jsonb;
  question_id text;
  question_type text;
  question_label text;
  options jsonb;
  answer_value jsonb;
  text_value text;
  max_length integer;
  picked jsonb;
  cleaned jsonb := '{}'::jsonb;
begin
  if answers is null or jsonb_typeof(answers) <> 'object' then
    raise exception '답을 읽지 못했습니다.';
  end if;

  -- 정원 확인과 저장 사이에 다른 신청이 끼어들지 않게 설정 줄을 잠근다.
  select s.* into settings
  from public.form_settings s
  join public.tabs t on t.id = s.tab_id
  where s.public_token = token and t.deleted_at is null and t.template = 'form'
  for update of s;

  if settings.tab_id is null then
    raise exception '신청 링크를 찾을 수 없습니다.';
  end if;
  if not settings.is_open or (settings.closes_at is not null and settings.closes_at <= now()) then
    raise exception '신청이 마감되었습니다.';
  end if;
  if (select count(*) from public.form_responses r where r.tab_id = settings.tab_id)
      >= least(coalesce(settings.capacity, 2000), 2000) then
    raise exception '정원이 다 찼습니다.';
  end if;

  for question in select * from jsonb_array_elements(settings.questions) loop
    question_id := question->>'id';
    question_type := question->>'type';
    question_label := coalesce(nullif(question->>'label', ''), '질문');
    options := coalesce(question->'options', '[]'::jsonb);
    answer_value := answers->question_id;

    if question_type in ('short', 'long') then
      text_value := case when jsonb_typeof(answer_value) = 'string' then btrim(answer_value #>> '{}') else '' end;
      -- IF 조건 안에 CASE를 쓰면 PL/pgSQL이 CASE의 THEN을 IF의 THEN으로 읽으므로 따로 계산한다.
      max_length := case when question_type = 'short' then 300 else 3000 end;
      if char_length(text_value) > max_length then
        raise exception '"%"의 답이 너무 깁니다.', question_label;
      end if;
      if text_value = '' then
        if (question->>'required')::boolean then
          raise exception '"%"에 답해 주세요.', question_label;
        end if;
      else
        cleaned := cleaned || jsonb_build_object(question_id, text_value);
      end if;

    elsif question_type = 'single' then
      text_value := case when jsonb_typeof(answer_value) = 'string' then answer_value #>> '{}' else '' end;
      if text_value = '' then
        if (question->>'required')::boolean then
          raise exception '"%"에서 하나를 골라 주세요.', question_label;
        end if;
      elsif not options ? text_value then
        raise exception '"%"에서 고른 항목이 올바르지 않습니다.', question_label;
      else
        cleaned := cleaned || jsonb_build_object(question_id, text_value);
      end if;

    elsif question_type = 'multiple' then
      if answer_value is null or jsonb_typeof(answer_value) <> 'array' then
        answer_value := '[]'::jsonb;
      end if;
      if exists (
        select 1 from jsonb_array_elements(answer_value) as v(item) where not options @> jsonb_build_array(v.item)
      ) then
        raise exception '"%"에서 고른 항목이 올바르지 않습니다.', question_label;
      end if;
      -- 질문의 항목 순서대로, 겹치지 않게 남긴다.
      select coalesce(jsonb_agg(o.item order by o.position), '[]'::jsonb) into picked
      from jsonb_array_elements(options) with ordinality as o(item, position)
      where answer_value @> jsonb_build_array(o.item);
      if jsonb_array_length(picked) = 0 then
        if (question->>'required')::boolean then
          raise exception '"%"에서 하나 이상 골라 주세요.', question_label;
        end if;
      else
        cleaned := cleaned || jsonb_build_object(question_id, picked);
      end if;
    end if;
  end loop;

  insert into public.form_responses (tab_id, answers) values (settings.tab_id, cleaned);
end;
$$;

revoke all on function public.get_form(text) from public;
revoke all on function public.submit_form_response(text, jsonb) from public;
grant execute on function public.get_form(text) to anon, authenticated;
grant execute on function public.submit_form_response(text, jsonb) to anon, authenticated;

-- 실시간 반영 ------------------------------------------------------------

alter publication supabase_realtime add table public.form_settings, public.form_responses;
