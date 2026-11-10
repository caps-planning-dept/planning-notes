-- 모든 탭의 열람자 설정
-- 1. 탭마다 "모든 멤버" 또는 "지정한 멤버만" 볼 수 있게 한다. 관리자는 언제나 모든 탭을 본다.
-- 2. 상위 탭을 볼 수 없는 사람은 그 아래 하위 탭도 볼 수 없다.
-- 3. 열람자 설정은 관리자와 "설정 가능"인 사람(처음에는 탭을 만든 사람)이 바꾼다.
--    캡처 탭은 학번이 있어 언제나 "지정한 멤버만"이고, 설정은 관리자만 바꾼다.
-- 4. 누구나 자기를 열람자에서 뺄 수 있다. 다만 관리자가 아닌 마지막 설정 가능자는
--    다른 사람에게 설정 권한을 넘긴 뒤에만 빠질 수 있다.
-- 캡처 탭에만 있던 capture_viewers를 이 표로 옮기고 지운다.

-- 표 ------------------------------------------------------------------

alter table public.tabs add column viewers_only boolean not null default false;
update public.tabs set viewers_only = true where template = 'capture';
alter table public.tabs add constraint tabs_capture_viewers_only
  check (template <> 'capture' or viewers_only);

create table public.tab_viewers (
  tab_id uuid not null references public.tabs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  can_manage boolean not null default false,
  primary key (tab_id, user_id)
);
create index tab_viewers_user_id_idx on public.tab_viewers (user_id);

-- 지금 있는 탭: 만든 사람이 아직 멤버이면 설정 가능자로 넣는다. 캡처 탭은 관리자만 설정한다.
insert into public.tab_viewers (tab_id, user_id, can_manage)
select t.id, t.created_by, true
from public.tabs t
join public.workspace_members m on m.workspace_id = t.workspace_id and m.user_id = t.created_by
where t.template <> 'capture'
on conflict do nothing;

insert into public.tab_viewers (tab_id, user_id)
select v.tab_id, v.user_id from public.capture_viewers v
on conflict do nothing;

-- 권한 확인 함수 ---------------------------------------------------------

-- 자신과 모든 상위 탭 중 "지정한 멤버만"인 탭에 모두 열람자로 들어 있어야 볼 수 있다.
create function private.can_see_tab(target_tab uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  with recursive chain as (
    select t.id, t.parent_id, t.viewers_only, 0 as depth
    from public.tabs t where t.id = target_tab
    union all
    select p.id, p.parent_id, p.viewers_only, c.depth + 1
    from public.tabs p join chain c on p.id = c.parent_id
    where c.depth < 100
  )
  select exists (
    select 1
    from public.tabs t
    join public.workspace_members m on m.workspace_id = t.workspace_id
    where t.id = target_tab
      and m.user_id = (select auth.uid())
      and (
        m.role = 'admin'
        or not exists (
          select 1 from chain c
          where c.viewers_only
            and not exists (
              select 1 from public.tab_viewers v
              where v.tab_id = c.id and v.user_id = (select auth.uid())
            )
        )
      )
  );
$$;

create function private.can_manage_tab(target_tab uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_see_tab(target_tab) and (
    exists (
      select 1 from public.tabs t
      join public.workspace_members m on m.workspace_id = t.workspace_id
      where t.id = target_tab and m.user_id = (select auth.uid()) and m.role = 'admin'
    )
    or exists (
      select 1 from public.tab_viewers v
      join public.tabs t on t.id = v.tab_id
      where v.tab_id = target_tab
        and v.user_id = (select auth.uid())
        and v.can_manage
        and t.template <> 'capture'
    )
  );
$$;

revoke all on function private.can_see_tab(uuid) from public, anon;
revoke all on function private.can_manage_tab(uuid) from public, anon;
grant execute on function private.can_see_tab(uuid) to authenticated;
grant execute on function private.can_manage_tab(uuid) to authenticated;

-- 노트, 일정, 시간표, 첨부 파일, 캡처 정책이 쓰는 함수를 새 기준으로 바꾼다.
create or replace function private.can_access_tab(target_tab uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_see_tab(target_tab);
$$;

create or replace function private.can_view_capture(target_tab uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_see_tab(target_tab);
$$;

-- 탭 정책 ---------------------------------------------------------------

create function private.is_tab_viewer(target_tab uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tab_viewers v
    where v.tab_id = target_tab and v.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_tab_viewer(uuid) from public, anon;
grant execute on function private.is_tab_viewer(uuid) to authenticated;

-- 자기 행은 행의 값으로 직접 확인한다. can_see_tab(id)는 표를 다시 읽으므로
-- 방금 만든 탭을 같은 문장에서 돌려받을 때(insert ... returning) 행을 찾지 못한다.
drop policy "멤버는 탭을 본다" on public.tabs;
create policy "볼 수 있는 멤버는 탭을 본다" on public.tabs
  for select to authenticated
  using (
    private.is_member(workspace_id)
    and (
      private.is_admin(workspace_id)
      or (
        (not viewers_only or private.is_tab_viewer(id))
        and (parent_id is null or private.can_see_tab(parent_id))
      )
    )
  );

-- 볼 수 없는 탭 아래에는 하위 탭을 만들 수 없다.
drop policy "멤버는 탭을 만든다" on public.tabs;
create policy "멤버는 탭을 만든다" on public.tabs
  for insert to authenticated
  with check (
    private.is_member(workspace_id)
    and (template <> 'capture' or private.is_admin(workspace_id))
    and (parent_id is null or private.can_see_tab(parent_id))
  );

drop policy "멤버는 탭을 수정한다" on public.tabs;
create policy "볼 수 있는 멤버는 탭을 수정한다" on public.tabs
  for update to authenticated
  using (private.is_member(workspace_id) and private.can_see_tab(id))
  with check (
    private.is_member(workspace_id)
    and (parent_id is null or private.can_see_tab(parent_id))
  );

grant update (viewers_only) on public.tabs to authenticated;

-- 새 탭: 캡처 탭은 처음부터 "지정한 멤버만", 다른 탭은 만든 사람을 설정 가능자로 넣는다.
create function private.prepare_new_tab()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.template = 'capture' then
    new.viewers_only := true;
  end if;
  return new;
end;
$$;

create function private.handle_new_tab_viewer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.template <> 'capture' and new.created_by is not null then
    insert into public.tab_viewers (tab_id, user_id, can_manage)
    values (new.id, new.created_by, true)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- "모든 멤버/지정한 멤버만"은 설정 가능자만 바꾼다.
create function private.check_viewers_only_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not private.can_manage_tab(old.id) then
    raise exception '이 탭의 열람자 설정을 바꿀 권한이 없습니다';
  end if;
  return new;
end;
$$;

revoke all on function private.prepare_new_tab() from public, anon, authenticated;
revoke all on function private.handle_new_tab_viewer() from public, anon, authenticated;
revoke all on function private.check_viewers_only_change() from public, anon, authenticated;

create trigger on_tab_prepare
  before insert on public.tabs
  for each row execute function private.prepare_new_tab();

create trigger on_tab_created_viewer
  after insert on public.tabs
  for each row execute function private.handle_new_tab_viewer();

create trigger on_tab_viewers_only_changed
  before update of viewers_only on public.tabs
  for each row
  when (old.viewers_only is distinct from new.viewers_only)
  execute function private.check_viewers_only_change();

-- 열람자 표 정책 ---------------------------------------------------------

alter table public.tab_viewers enable row level security;

grant select, insert, delete on public.tab_viewers to authenticated;
grant update (can_manage) on public.tab_viewers to authenticated;

create policy "탭을 볼 수 있는 멤버는 열람자를 본다" on public.tab_viewers
  for select to authenticated using (private.can_see_tab(tab_id));

-- 같은 워크스페이스 멤버만 넣는다. 캡처 탭에는 설정 가능자를 두지 않는다.
create policy "설정 가능자는 열람자를 넣는다" on public.tab_viewers
  for insert to authenticated
  with check (
    private.can_manage_tab(tab_id)
    and exists (
      select 1 from public.tabs t
      join public.workspace_members m on m.workspace_id = t.workspace_id
      where t.id = tab_id and m.user_id = tab_viewers.user_id
        and (not tab_viewers.can_manage or t.template <> 'capture')
    )
  );

create policy "설정 가능자는 설정 권한을 바꾼다" on public.tab_viewers
  for update to authenticated
  using (private.can_manage_tab(tab_id))
  with check (
    private.can_manage_tab(tab_id)
    and exists (
      select 1 from public.tabs t
      where t.id = tab_id and (not tab_viewers.can_manage or t.template <> 'capture')
    )
  );

create policy "설정 가능자와 본인은 열람자에서 뺀다" on public.tab_viewers
  for delete to authenticated
  using (private.can_manage_tab(tab_id) or user_id = (select auth.uid()));

-- 관리자가 아닌 사람이 마지막 설정 가능자를 빼거나 권한을 거두려 하면 막는다.
-- 관리자의 작업(멤버 내보내기 포함), 탭 영구 삭제, 예약 작업은 막지 않는다.
create function private.keep_tab_manager()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_workspace uuid;
  target_template text;
begin
  if not old.can_manage or (tg_op = 'UPDATE' and new.can_manage) then
    return coalesce(new, old);
  end if;
  select workspace_id, template into target_workspace, target_template
  from public.tabs where id = old.tab_id;
  if target_workspace is null
    or target_template = 'capture'
    or (select auth.uid()) is null
    or private.is_admin(target_workspace) then
    return coalesce(new, old);
  end if;
  if not exists (
    select 1 from public.tab_viewers v
    join public.workspace_members m on m.workspace_id = target_workspace and m.user_id = v.user_id
    where v.tab_id = old.tab_id and v.can_manage and v.user_id <> old.user_id
  ) then
    raise exception '다른 사람에게 설정 권한을 넘긴 뒤에 뺄 수 있습니다';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.keep_tab_manager() from public, anon, authenticated;

create trigger on_tab_viewer_removed
  before delete or update of can_manage on public.tab_viewers
  for each row execute function private.keep_tab_manager();

-- 내보낸 멤버의 열람 권한을 지운다 (다시 들어와도 되살아나지 않게) ----------------

create or replace function private.clear_capture_viewers()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.tab_viewers v
  using public.tabs t
  where v.tab_id = t.id and t.workspace_id = old.workspace_id and v.user_id = old.user_id;
  return old;
end;
$$;

-- 옛 캡처 열람자 표 ------------------------------------------------------

drop table public.capture_viewers;

-- 실시간 반영 ------------------------------------------------------------

alter publication supabase_realtime add table public.tab_viewers;
