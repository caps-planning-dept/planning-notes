-- 관리자가 문의를 지울 수 있게 한다. 시험 문의나 처리한 문의를 정리하기 위해 필요하다.
-- 일반 멤버는 자기 문의도 지울 수 없다.
grant delete on public.inquiries to authenticated;

create policy "관리자는 문의를 삭제한다" on public.inquiries
  for delete to authenticated using (private.is_admin(workspace_id));
