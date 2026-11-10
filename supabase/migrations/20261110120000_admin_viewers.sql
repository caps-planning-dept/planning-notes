-- 관리자도 열람자에서 뺄 수 있게 한다.
-- 1. 관리자도 "지정한 멤버만"인 탭은 열람자로 들어 있어야 본다. 볼 수 있는 탭의 설정은 여전히 바꾼다.
-- 2. 지금 "지정한 멤버만"인 탭에는 모든 관리자를 열람자로 넣어, 적용 직후 보이던 탭이 사라지지 않게 한다.
-- 3. 탭을 "지정한 멤버만"으로 바꾸는 사람은 자동으로 열람자가 된다(바꾸자마자 못 보는 일을 막는다).
-- 4. 관리자가 만든 캡처 탭은 만든 관리자를 열람자로 넣는다.
-- 5. 아무도 볼 수 없는 탭이 생기지 않게, "지정한 멤버만"인 탭의 마지막 설정 가능자(관리자 포함)는
--    넘긴 뒤에만 빠질 수 있다.

-- 기존 탭 ------------------------------------------------------------------

insert into public.tab_viewers (tab_id, user_id)
select t.id, m.user_id
from public.tabs t
join public.workspace_members m on m.workspace_id = t.workspace_id and m.role = 'admin'
where t.viewers_only
on conflict do nothing;

-- 권한 확인 함수 -------------------------------------------------------------

create or replace function private.can_see_tab(target_tab uuid)
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
      and not exists (
        select 1 from chain c
        where c.viewers_only
          and not exists (
            select 1 from public.tab_viewers v
            where v.tab_id = c.id and v.user_id = (select auth.uid())
          )
      )
  );
$$;

-- 캡처 신청 삭제에 쓰인다. 볼 수 없는 캡처 탭의 신청은 관리자도 지우지 못한다.
create or replace function private.is_tab_admin(target_tab uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_see_tab(target_tab) and exists (
    select 1 from public.tabs t
    join public.workspace_members m on m.workspace_id = t.workspace_id
    where t.id = target_tab and m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

-- 열람자 줄이 하나도 없는 탭: 방금 만들어 아직 만든 사람 줄이 들어가기 전인 탭이다.
-- (만든 사람 줄은 행을 넣은 뒤에 들어가므로, insert ... returning 때는 아직 없다.)
create function private.tab_has_viewers(target_tab uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tab_viewers v where v.tab_id = target_tab);
$$;

revoke all on function private.tab_has_viewers(uuid) from public, anon;
grant execute on function private.tab_has_viewers(uuid) to authenticated;

drop policy "볼 수 있는 멤버는 탭을 본다" on public.tabs;
create policy "볼 수 있는 멤버는 탭을 본다" on public.tabs
  for select to authenticated
  using (
    private.is_member(workspace_id)
    and (
      not viewers_only
      or private.is_tab_viewer(id)
      or (created_by = (select auth.uid()) and not private.tab_has_viewers(id))
    )
    and (parent_id is null or private.can_see_tab(parent_id))
  );

-- 새 탭과 설정 바꾸기 ----------------------------------------------------------

create or replace function private.handle_new_tab_viewer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.tab_viewers (tab_id, user_id, can_manage)
    values (new.id, new.created_by, new.template <> 'capture')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace function private.check_viewers_only_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if not private.can_manage_tab(old.id) then
    raise exception '이 탭의 열람자 설정을 바꿀 권한이 없습니다';
  end if;
  if new.viewers_only then
    insert into public.tab_viewers (tab_id, user_id)
    values (new.id, (select auth.uid()))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- 마지막 설정 가능자 지키기 -----------------------------------------------------
-- 설정 가능자: 열람자 줄이 있고, 관리자이거나 설정 가능(캡처 탭 제외)인 사람.

create or replace function private.keep_tab_manager()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_workspace uuid;
  target_template text;
  target_viewers_only boolean;
  old_is_admin boolean;
begin
  if tg_op = 'UPDATE' and (not old.can_manage or new.can_manage) then
    return new;
  end if;
  select workspace_id, template, viewers_only
  into target_workspace, target_template, target_viewers_only
  from public.tabs where id = old.tab_id;
  -- 탭 영구 삭제, 예약 작업, 멤버 내보내기(멤버 줄이 먼저 지워짐)는 막지 않는다.
  if target_workspace is null or (select auth.uid()) is null then
    return coalesce(new, old);
  end if;
  select m.role = 'admin' into old_is_admin
  from public.workspace_members m
  where m.workspace_id = target_workspace and m.user_id = old.user_id;
  if old_is_admin is null then
    return coalesce(new, old);
  end if;
  -- 빠지는 사람이 설정 가능자가 아니거나, 관리자의 설정 권한 칸만 바뀌면 그대로 둔다.
  if not ((old.can_manage and target_template <> 'capture') or old_is_admin)
    or (tg_op = 'UPDATE' and old_is_admin) then
    return coalesce(new, old);
  end if;
  -- "모든 멤버" 탭은 관리자가 언제나 보므로 관리자의 작업은 막지 않는다.
  if not target_viewers_only and private.is_admin(target_workspace) then
    return coalesce(new, old);
  end if;
  if not exists (
    select 1 from public.tab_viewers v
    join public.workspace_members m on m.workspace_id = target_workspace and m.user_id = v.user_id
    where v.tab_id = old.tab_id
      and v.user_id <> old.user_id
      and ((v.can_manage and target_template <> 'capture') or m.role = 'admin')
  ) then
    raise exception '다른 사람에게 설정 권한을 넘긴 뒤에 뺄 수 있습니다';
  end if;
  return coalesce(new, old);
end;
$$;

-- "모든 멤버/지정한 멤버만" 바꾸기 ---------------------------------------------
-- 바꾸는 사람을 열람자로 먼저 넣은 뒤 다음 문장에서 바꾼다. 한 문장에서 하면 탭 보기 정책이
-- 방금 넣은 열람자 줄을 아직 보지 못해, 열람자가 아니던 관리자가 남의 탭을 바꿀 때 막힌다.
-- 호출한 사람의 권한(RLS)으로 실행한다.
create function public.set_tab_viewers_only(target_tab uuid, restricted boolean)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if restricted then
    insert into public.tab_viewers (tab_id, user_id)
    values (target_tab, (select auth.uid()))
    on conflict do nothing;
  end if;
  update public.tabs set viewers_only = restricted where id = target_tab;
  if not found then
    raise exception '이 탭의 열람자 설정을 바꿀 권한이 없습니다';
  end if;
end;
$$;

revoke all on function public.set_tab_viewers_only(uuid, boolean) from public, anon;
grant execute on function public.set_tab_viewers_only(uuid, boolean) to authenticated;
