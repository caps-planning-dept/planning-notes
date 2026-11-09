-- 캡처 시즌2 신청 폼: 제목 아래 공지, 활동 테마 1·2순위, 이벤트 상품(택1).
-- 시즌1 신청(희망 횟수, 음주 여부)은 그대로 남기고, 새 신청은 두 항목을 빈 값으로 저장한다.
-- 배포 전 사이트가 쓰는 이전 제출 함수는 그대로 두고 새 함수를 더한다.

-- 회차 설정 -------------------------------------------------------------

alter table public.capture_rounds
  add column notice text not null default '' check (char_length(notice) <= 5000),
  add column prizes text[] not null default '{}' check (cardinality(prizes) <= 20),
  add column prize_note text not null default '' check (char_length(prize_note) <= 500);

alter table public.capture_rounds
  alter column activities set default array['카페/디저트', '방탈출/보드게임', '맛집/술', '야외/관람 (한강모임, 영화관)'];

grant update (notice, prizes, prize_note) on public.capture_rounds to authenticated;

-- 신청 ------------------------------------------------------------------

alter table public.capture_applications
  drop constraint capture_applications_participation_check,
  drop constraint capture_applications_drinking_check;

alter table public.capture_applications
  add constraint capture_applications_participation_check
    check (participation in ('', '1회', '2회', '3회 이상')),
  add constraint capture_applications_drinking_check
    check (drinking in ('', '음주', '비음주', '상관없음')),
  add column first_choice text not null default '' check (char_length(first_choice) <= 100),
  add column second_choice text not null default '' check (char_length(second_choice) <= 100),
  add column prize text not null default '' check (char_length(prize) <= 100);

-- 공개 신청 폼 ------------------------------------------------------------

create or replace function public.get_capture_form(token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title', t.title,
    'notice', r.notice,
    'dates', r.dates,
    'activities', r.activities,
    'prizes', r.prizes,
    'prizeNote', r.prize_note,
    'closesAt', r.closes_at,
    'isOpen', r.is_open and (r.closes_at is null or r.closes_at > now())
  )
  from public.capture_rounds r
  join public.tabs t on t.id = r.tab_id
  where r.public_token = token and t.deleted_at is null;
$$;

-- 활동 테마가 2개 이상이면 서로 다른 1·2순위를, 1개면 1순위만 받는다.
-- 이벤트 상품은 고르지 않아도 되며, 목록에 없는 상품은 '기타: 내용'으로 받는다.
-- 1·2순위는 기존 화면의 활동 집계와 필터가 그대로 쓰도록 activities에도 순서대로 넣는다.
create function public.submit_capture_ranked_application(
  token text,
  applicant_name text,
  applicant_student_id text,
  applicant_cohort text,
  applicant_major text,
  applicant_teammate text,
  selected_dates date[],
  selected_first text,
  selected_second text,
  selected_prize text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  round public.capture_rounds;
  first_value text := coalesce(selected_first, '');
  second_value text := coalesce(selected_second, '');
  prize_value text := trim(coalesce(selected_prize, ''));
begin
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
  if not (selected_dates <@ round.dates) then
    raise exception '선택한 날짜가 올바르지 않습니다.';
  end if;

  if cardinality(round.activities) = 0 then
    first_value := '';
    second_value := '';
  elsif not (first_value = any(round.activities)) then
    raise exception '1순위 테마를 골라 주세요.';
  elsif cardinality(round.activities) = 1 then
    second_value := '';
  elsif not (second_value = any(round.activities)) or second_value = first_value then
    raise exception '1순위와 다른 2순위 테마를 골라 주세요.';
  end if;

  if prize_value <> '' and not (
    prize_value = any(round.prizes)
    or (cardinality(round.prizes) > 0 and prize_value like '기타: %' and char_length(prize_value) > 4)
  ) then
    raise exception '이벤트 상품이 올바르지 않습니다.';
  end if;

  if (select count(*) from public.capture_applications a
      where a.tab_id = round.tab_id and a.created_at > now() - interval '1 minute') >= 60 then
    raise exception '신청이 몰리고 있습니다. 잠시 뒤 다시 시도해 주세요.';
  end if;
  if (select count(*) from public.capture_applications a where a.tab_id = round.tab_id) >= 2000 then
    raise exception '신청 가능한 수를 넘었습니다.';
  end if;

  insert into public.capture_applications (
    tab_id, name, student_id, cohort, major, preferred_teammate, dates,
    participation, drinking, activities, first_choice, second_choice, prize
  ) values (
    round.tab_id, trim(applicant_name), trim(applicant_student_id), trim(applicant_cohort),
    trim(applicant_major), trim(applicant_teammate), selected_dates,
    '', '', array_remove(array[first_value, second_value], ''), first_value, second_value, prize_value
  );
end;
$$;

revoke all on function public.submit_capture_ranked_application(text, text, text, text, text, text, date[], text, text, text) from public;
grant execute on function public.submit_capture_ranked_application(text, text, text, text, text, text, date[], text, text, text) to anon, authenticated;
