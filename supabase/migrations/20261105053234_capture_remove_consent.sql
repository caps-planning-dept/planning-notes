-- 캡처 신청에서 동의 체크를 없앤다. 나머지 검증은 그대로 유지한다.

drop function public.submit_capture_application(text, text, text, text, text, text, date[], text, text, text[], text, boolean);

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
  applicant_other_activity text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  round public.capture_rounds;
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

revoke all on function public.submit_capture_application(text, text, text, text, text, text, date[], text, text, text[], text) from public;
grant execute on function public.submit_capture_application(text, text, text, text, text, text, date[], text, text, text[], text) to anon, authenticated;
