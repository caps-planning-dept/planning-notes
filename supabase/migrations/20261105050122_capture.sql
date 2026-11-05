-- 캡처 활동: 회차 설정, 로그인 없는 신청, 지정 열람자, 조 편성
-- 신청자 표는 익명에게 열지 않고, 익명은 아래 두 함수로만 폼을 읽고 제출한다.

alter table public.tabs drop constraint tabs_template_check;
alter table public.tabs add constraint tabs_template_check
  check (template in ('note', 'calendar', 'capture'));

-- 표 ------------------------------------------------------------------

create table public.capture_rounds (
  tab_id uuid primary key references public.tabs (id) on delete cascade,
  public_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  is_open boolean not null default false,
  closes_at timestamptz,
  dates date[] not null default '{}',
  activities text[] not null default array['술', '맛집/카페탐방', '한강모임', '영화 관람', '방탈출', '보드게임']
);

create table public.capture_viewers (
  tab_id uuid not null references public.tabs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (tab_id, user_id)
);
create index capture_viewers_user_id_idx on public.capture_viewers (user_id);

create table public.capture_applications (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.tabs (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  student_id text not null check (student_id ~ '^[0-9]{6,12}$'),
  cohort text not null check (char_length(cohort) between 1 and 20),
  major text not null check (char_length(major) between 1 and 100),
  preferred_teammate text not null default '' check (char_length(preferred_teammate) <= 100),
  dates date[] not null check (cardinality(dates) > 0),
  participation text not null check (participation in ('1회', '2회', '3회 이상')),
  drinking text not null check (drinking in ('음주', '비음주', '상관없음')),
  activities text[] not null default '{}',
  other_activity text not null default '' check (char_length(other_activity) <= 200),
  created_at timestamptz not null default now()
);
create index capture_applications_tab_id_idx on public.capture_applications (tab_id, created_at);

create table public.capture_teams (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.tabs (id) on delete cascade,
  event_date date not null,
  activity text not null check (char_length(activity) between 1 and 100),
  application_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index capture_teams_tab_id_idx on public.capture_teams (tab_id);

-- 권한 ------------------------------------------------------------------

create function private.can_view_capture(target_tab uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tabs t
    join public.workspace_members m on m.workspace_id = t.workspace_id
    where t.id = target_tab and m.user_id = (select auth.uid()) and m.role = 'admin'
  ) or exists (
    select 1 from public.capture_viewers v
    join public.tabs t on t.id = v.tab_id
    join public.workspace_members m on m.workspace_id = t.workspace_id and m.user_id = v.user_id
    where v.tab_id = target_tab and v.user_id = (select auth.uid())
  );
$$;

create function private.is_tab_admin(target_tab uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tabs t
    join public.workspace_members m on m.workspace_id = t.workspace_id
    where t.id = target_tab and m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

revoke all on function private.can_view_capture(uuid) from public, anon;
revoke all on function private.is_tab_admin(uuid) from public, anon;
grant execute on function private.can_view_capture(uuid) to authenticated;
grant execute on function private.is_tab_admin(uuid) to authenticated;

-- 캡처 탭은 지정된 사람에게만 보이고, 관리자만 만들 수 있다.
drop policy "멤버는 탭을 본다" on public.tabs;
create policy "멤버는 탭을 본다" on public.tabs
  for select to authenticated
  using (private.is_member(workspace_id) and (template <> 'capture' or private.can_view_capture(id)));

drop policy "멤버는 탭을 만든다" on public.tabs;
create policy "멤버는 탭을 만든다" on public.tabs
  for insert to authenticated
  with check (
    private.is_member(workspace_id)
    and (template <> 'capture' or private.is_admin(workspace_id))
  );

drop policy "멤버는 탭을 수정한다" on public.tabs;
create policy "멤버는 탭을 수정한다" on public.tabs
  for update to authenticated
  using (private.is_member(workspace_id) and (template <> 'capture' or private.can_view_capture(id)))
  with check (private.is_member(workspace_id) and (template <> 'capture' or private.can_view_capture(id)));

alter table public.capture_rounds enable row level security;
alter table public.capture_viewers enable row level security;
alter table public.capture_applications enable row level security;
alter table public.capture_teams enable row level security;

grant select on public.capture_rounds to authenticated;
grant update (is_open, closes_at, dates, activities) on public.capture_rounds to authenticated;
grant select, insert, delete on public.capture_viewers to authenticated;
grant select, delete on public.capture_applications to authenticated;
grant select, insert, update, delete on public.capture_teams to authenticated;

create policy "열람자는 회차를 본다" on public.capture_rounds
  for select to authenticated using (private.can_view_capture(tab_id));
create policy "열람자는 회차를 설정한다" on public.capture_rounds
  for update to authenticated
  using (private.can_view_capture(tab_id))
  with check (private.can_view_capture(tab_id));

create policy "관리자는 열람자를 본다" on public.capture_viewers
  for select to authenticated using (private.is_tab_admin(tab_id));
create policy "관리자는 열람자를 지정한다" on public.capture_viewers
  for insert to authenticated with check (private.is_tab_admin(tab_id));
create policy "관리자는 열람자를 해제한다" on public.capture_viewers
  for delete to authenticated using (private.is_tab_admin(tab_id));

create policy "열람자는 신청을 본다" on public.capture_applications
  for select to authenticated using (private.can_view_capture(tab_id));
create policy "관리자는 신청을 삭제한다" on public.capture_applications
  for delete to authenticated using (private.is_tab_admin(tab_id));

create policy "열람자는 조를 본다" on public.capture_teams
  for select to authenticated using (private.can_view_capture(tab_id));
create policy "열람자는 조를 만든다" on public.capture_teams
  for insert to authenticated with check (private.can_view_capture(tab_id));
create policy "열람자는 조를 수정한다" on public.capture_teams
  for update to authenticated
  using (private.can_view_capture(tab_id))
  with check (private.can_view_capture(tab_id));
create policy "열람자는 조를 삭제한다" on public.capture_teams
  for delete to authenticated using (private.can_view_capture(tab_id));

-- 캡처 탭을 만들면 회차 설정을 함께 만든다 -----------------------------------

create function private.handle_new_capture_tab()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.capture_rounds (tab_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_capture_tab() from public, anon, authenticated;

create trigger on_capture_tab_created
  after insert on public.tabs
  for each row when (new.template = 'capture')
  execute function private.handle_new_capture_tab();

-- 공개 신청 폼 ------------------------------------------------------------

-- 링크를 아는 사람에게 폼 구성만 돌려준다. 신청 내용은 포함하지 않는다.
create function public.get_capture_form(token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title', t.title,
    'dates', r.dates,
    'activities', r.activities,
    'closesAt', r.closes_at,
    'isOpen', r.is_open and (r.closes_at is null or r.closes_at > now())
  )
  from public.capture_rounds r
  join public.tabs t on t.id = r.tab_id
  where r.public_token = token and t.deleted_at is null;
$$;

create function public.submit_capture_application(
  token text,
  applicant_name text,
  applicant_student_id text,
  applicant_cohort text,
  applicant_major text,
  applicant_teammate text,
  selected_dates date[],
  selected_participation text,
  selected_drinking text,
  selected_activities text[],
  applicant_other_activity text,
  consented boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  round public.capture_rounds;
begin
  if consented is not true then
    raise exception '개인정보 수집 동의가 필요합니다.';
  end if;

  select r.* into round
  from public.capture_rounds r
  join public.tabs t on t.id = r.tab_id
  where r.public_token = token and t.deleted_at is null;

  if round.tab_id is null then
    raise exception '신청 링크를 찾을 수 없습니다.';
  end if;
  if not round.is_open or (round.closes_at is not null and round.closes_at <= now()) then
    raise exception '신청이 마감되었습니다.';
  end if;
  if not (selected_dates <@ round.dates) or not (selected_activities <@ round.activities) then
    raise exception '선택한 항목이 올바르지 않습니다.';
  end if;
  if (select count(*) from public.capture_applications a where a.tab_id = round.tab_id) >= 2000 then
    raise exception '신청 가능한 수를 넘었습니다.';
  end if;

  insert into public.capture_applications (
    tab_id, name, student_id, cohort, major, preferred_teammate,
    dates, participation, drinking, activities, other_activity
  ) values (
    round.tab_id, trim(applicant_name), trim(applicant_student_id), trim(applicant_cohort),
    trim(applicant_major), trim(applicant_teammate), selected_dates, selected_participation,
    selected_drinking, selected_activities, trim(applicant_other_activity)
  );
end;
$$;

revoke all on function public.get_capture_form(text) from public;
revoke all on function public.submit_capture_application(text, text, text, text, text, text, date[], text, text, text[], text, boolean) from public;
grant execute on function public.get_capture_form(text) to anon, authenticated;
grant execute on function public.submit_capture_application(text, text, text, text, text, text, date[], text, text, text[], text, boolean) to anon, authenticated;

alter publication supabase_realtime add table
  public.capture_rounds,
  public.capture_applications,
  public.capture_teams;
