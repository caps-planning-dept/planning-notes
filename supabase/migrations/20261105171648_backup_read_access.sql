-- 자동 백업이 대상 표를 읽을 수 있게 한다. 쓰기 권한과 캡처 표, 이메일 칸은 열지 않는다.

grant select on
  public.workspaces,
  public.workspace_members,
  public.tabs,
  public.notes,
  public.calendar_events,
  public.inquiries
to service_role;

grant select (id, display_name) on public.profiles to service_role;
