-- 코드 리뷰와 보안 점검에서 찾은 문제를 고친다.

-- 1. 긴 Google 이름 때문에 가입이 실패하지 않게 이름을 다듬어 저장한다.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, last_sign_in_at)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 50), ''),
      nullif(left(trim(split_part(coalesce(new.email, ''), '@', 1)), 50), ''),
      '멤버'
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    new.last_sign_in_at
  );
  return new;
end;
$$;

-- 2. 앱에서 쓰는 칸만 멤버가 바꿀 수 있게 한다.
--    탭 종류를 바꿔 캡처 탭을 일반 탭으로 만들거나 작성자를 속이는 일을 막는다.
revoke insert, update on public.tabs from authenticated;
grant insert (id, workspace_id, parent_id, title, template, color) on public.tabs to authenticated;
grant update (parent_id, title, color, deleted_at, pinned_at) on public.tabs to authenticated;

-- 3. 상위 탭을 휴지통으로 옮기면, 옮긴 사람에게 보이지 않는 하위 캡처 탭도 함께 옮긴다.
--    그렇지 않으면 숨은 캡처 탭의 공개 신청 폼이 계속 열려 있게 된다.
create function private.cascade_tab_trash()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.tabs
  set deleted_at = new.deleted_at
  where parent_id = new.id and deleted_at is null;
  return new;
end;
$$;

revoke all on function private.cascade_tab_trash() from public, anon, authenticated;

create trigger on_tab_trashed
  after update of deleted_at on public.tabs
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function private.cascade_tab_trash();

-- 4. 내보낸 멤버가 다시 들어와도 학번을 볼 수 있는 열람 권한이 되살아나지 않게 한다.
create function private.clear_capture_viewers()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.capture_viewers v
  using public.tabs t
  where v.tab_id = t.id and t.workspace_id = old.workspace_id and v.user_id = old.user_id;
  return old;
end;
$$;

revoke all on function private.clear_capture_viewers() from public, anon, authenticated;

create trigger on_member_removed
  after delete on public.workspace_members
  for each row execute function private.clear_capture_viewers();

-- 5. 공개 신청 함수에 분당 제출 한도를 둔다. 자동 등록이 2000건 한도를 채워 신청을 막는 일을 늦춘다.
create or replace function public.submit_capture_application(
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
  if (select count(*) from public.capture_applications a
      where a.tab_id = round.tab_id and a.created_at > now() - interval '1 minute') >= 60 then
    raise exception '신청이 몰리고 있습니다. 잠시 뒤 다시 시도해 주세요.';
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

-- 6. Supabase 자동 RLS 함수는 DB가 내부적으로 실행하므로 외부 호출을 막는다.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
