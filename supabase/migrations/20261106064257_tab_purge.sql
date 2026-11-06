-- 관리자가 휴지통에 있는 탭을 바로 영구 삭제할 수 있게 한다.
-- 쓰고 있는 탭은 관리자도 바로 지울 수 없고, 일반 멤버는 휴지통의 탭도 지울 수 없다.
-- 하위 탭, 노트, 캡처 회차와 신청은 외래 키로 함께 지워지고, 연결된 일정은 연결만 끊긴다.
grant delete on public.tabs to authenticated;

create policy "관리자는 휴지통의 탭을 삭제한다" on public.tabs
  for delete to authenticated
  using (deleted_at is not null and private.is_admin(workspace_id));
