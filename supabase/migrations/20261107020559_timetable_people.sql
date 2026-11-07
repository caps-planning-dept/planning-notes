-- 시간표에 사람을 이름으로 더한다. 앱 계정이 없는 부원도 넣을 수 있다.
-- 수업은 계정 대신 이 사람에 딸린다(timetable_entries.person_id).
-- 고치기: 그 이름을 더한 사람과 관리자. 보기: 탭을 볼 수 있는 멤버 모두.
--
-- 예전 수업 표 timetable_classes(계정별)는 비어 있고 앱에서 더 쓰지 않는다.
-- 지우는 SQL은 MCP 도구가 확인 창 없이 거절해서, 이번에는 더하기만 하고 나중에 정리한다.

create table public.timetable_people (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.tabs (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tab_id, name)
);
create index timetable_people_created_by_idx on public.timetable_people (created_by);

create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.tabs (id) on delete cascade,
  person_id uuid not null references public.timetable_people (id) on delete cascade,
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
create index timetable_entries_tab_id_idx on public.timetable_entries (tab_id);
create index timetable_entries_person_id_idx on public.timetable_entries (person_id);

-- 그 사람이 시간표 탭에 있고, 지금 사용자가 그 사람을 더한 본인이거나 워크스페이스 관리자인지 본다.
create function private.can_edit_timetable_person(target_person uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.timetable_people p
    join public.tabs t on t.id = p.tab_id
    join public.workspace_members me on me.workspace_id = t.workspace_id and me.user_id = (select auth.uid())
    where p.id = target_person
      and t.template = 'timetable'
      and (p.created_by = (select auth.uid()) or me.role = 'admin')
  );
$$;
revoke all on function private.can_edit_timetable_person(uuid) from public, anon;
grant execute on function private.can_edit_timetable_person(uuid) to authenticated;

-- 수업의 탭과 사람의 탭이 같은지 본다. 다른 탭의 사람에게 수업을 붙이지 못하게 한다.
create function private.person_in_tab(target_person uuid, target_tab uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.timetable_people p where p.id = target_person and p.tab_id = target_tab);
$$;
revoke all on function private.person_in_tab(uuid, uuid) from public, anon;
grant execute on function private.person_in_tab(uuid, uuid) to authenticated;

alter table public.timetable_people enable row level security;
grant select, delete on public.timetable_people to authenticated;
grant insert (tab_id, name) on public.timetable_people to authenticated;
grant update (name) on public.timetable_people to authenticated;

create policy "멤버는 시간표 사람을 본다" on public.timetable_people
  for select to authenticated using ((select private.can_access_tab(tab_id)));

create policy "멤버는 시간표에 사람을 더한다" on public.timetable_people
  for insert to authenticated with check (
    (select private.can_access_tab(tab_id))
    and created_by = (select auth.uid())
    and exists (select 1 from public.tabs t where t.id = tab_id and t.template = 'timetable')
  );

create policy "더한 사람과 관리자는 이름을 고친다" on public.timetable_people
  for update to authenticated
  using ((select private.can_edit_timetable_person(id)))
  with check ((select private.can_edit_timetable_person(id)));

create policy "더한 사람과 관리자는 사람을 지운다" on public.timetable_people
  for delete to authenticated using ((select private.can_edit_timetable_person(id)));

alter table public.timetable_entries enable row level security;
grant select, insert, delete on public.timetable_entries to authenticated;
grant update (day, start_minute, end_minute, title, place) on public.timetable_entries to authenticated;

create policy "멤버는 시간표 수업을 본다" on public.timetable_entries
  for select to authenticated using ((select private.can_access_tab(tab_id)));

create policy "더한 사람과 관리자는 수업을 넣는다" on public.timetable_entries
  for insert to authenticated with check (
    (select private.can_edit_timetable_person(person_id)) and (select private.person_in_tab(person_id, tab_id))
  );

create policy "더한 사람과 관리자는 수업을 고친다" on public.timetable_entries
  for update to authenticated
  using ((select private.can_edit_timetable_person(person_id)))
  with check ((select private.can_edit_timetable_person(person_id)));

create policy "더한 사람과 관리자는 수업을 지운다" on public.timetable_entries
  for delete to authenticated using ((select private.can_edit_timetable_person(person_id)));

alter publication supabase_realtime add table public.timetable_people, public.timetable_entries;
grant select on public.timetable_people, public.timetable_entries to service_role;
