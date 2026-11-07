-- 시간표 탭: 멤버마다 학교 수업을 요일·시간으로 넣고, 앱이 모두 겹쳐 비는 시간을 보여 준다.
-- 모든 멤버가 모든 사람의 수업 이름까지 본다(기존에 시간표 사진을 노트에 올리던 수준과 같다).
-- 고치기는 본인과 관리자만 한다.

alter table public.tabs drop constraint tabs_template_check;
alter table public.tabs add constraint tabs_template_check
  check (template in ('note', 'calendar', 'capture', 'timetable'));

create table public.timetable_classes (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.tabs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 0 = 월요일 … 6 = 일요일
  day smallint not null check (day between 0 and 6),
  -- 자정부터 센 분. 9:30 = 570
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  title text not null check (char_length(title) between 1 and 100),
  place text not null default '' check (char_length(place) <= 200),
  created_at timestamptz not null default now(),
  check (end_minute > start_minute)
);
create index timetable_classes_tab_id_idx on public.timetable_classes (tab_id);
create index timetable_classes_user_id_idx on public.timetable_classes (user_id);

-- 대상 사람이 탭의 워크스페이스 멤버이고, 지금 사용자가 본인이거나 그 워크스페이스 관리자인지 본다.
create function private.can_edit_timetable(target_tab uuid, target_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tabs t
    join public.workspace_members owner on owner.workspace_id = t.workspace_id and owner.user_id = target_user
    join public.workspace_members me on me.workspace_id = t.workspace_id and me.user_id = (select auth.uid())
    where t.id = target_tab
      and t.template = 'timetable'
      and (target_user = (select auth.uid()) or me.role = 'admin')
  );
$$;
revoke all on function private.can_edit_timetable(uuid, uuid) from public, anon;
grant execute on function private.can_edit_timetable(uuid, uuid) to authenticated;

alter table public.timetable_classes enable row level security;
grant select, insert, delete on public.timetable_classes to authenticated;
grant update (day, start_minute, end_minute, title, place) on public.timetable_classes to authenticated;

create policy "멤버는 시간표를 본다" on public.timetable_classes
  for select to authenticated using ((select private.can_access_tab(tab_id)));

create policy "본인과 관리자는 수업을 넣는다" on public.timetable_classes
  for insert to authenticated with check ((select private.can_edit_timetable(tab_id, user_id)));

create policy "본인과 관리자는 수업을 고친다" on public.timetable_classes
  for update to authenticated
  using ((select private.can_edit_timetable(tab_id, user_id)))
  with check ((select private.can_edit_timetable(tab_id, user_id)));

create policy "본인과 관리자는 수업을 지운다" on public.timetable_classes
  for delete to authenticated using ((select private.can_edit_timetable(tab_id, user_id)));

-- 다른 멤버 화면에 바로 보이게 한다.
alter publication supabase_realtime add table public.timetable_classes;

-- 자동 백업이 읽을 수 있게 한다.
grant select on public.timetable_classes to service_role;
