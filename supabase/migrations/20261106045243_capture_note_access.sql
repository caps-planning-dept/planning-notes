-- 일반 멤버가 숨은 캡처 탭에 노트와 일정을 쓰거나 읽지 못하게 한다.
-- 2026-11-06 쓰기 권한 시험에서, 탭 목록은 캡처 탭을 숨기지만 노트·일정 권한 검사는
-- 워크스페이스 멤버인지만 확인하는 것을 찾았다. 탭 목록과 같은 기준으로 맞춘다.
create or replace function private.can_access_tab(target_tab uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tabs t
    join public.workspace_members m on m.workspace_id = t.workspace_id
    where t.id = target_tab
      and m.user_id = (select auth.uid())
      and (t.template <> 'capture' or private.can_view_capture(t.id))
  );
$$;
