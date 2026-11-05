-- CAPS 기획부 앱의 기본 구조: 워크스페이스, 멤버, 초대, 탭, 노트, 일정
-- 원칙: 표는 기본으로 잠그고, 로그인한 멤버에게 필요한 권한만 연다.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- 표 ------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  last_sign_in_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_workspace_id_idx on public.invitations (workspace_id);
create index invitations_created_by_idx on public.invitations (created_by);

create table public.tabs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  parent_id uuid references public.tabs (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 200),
  template text not null check (template in ('note', 'calendar')),
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  deleted_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index tabs_workspace_id_idx on public.tabs (workspace_id);
create index tabs_parent_id_idx on public.tabs (parent_id);
create index tabs_created_by_idx on public.tabs (created_by);
create index tabs_deleted_at_idx on public.tabs (deleted_at) where deleted_at is not null;

create table public.notes (
  tab_id uuid primary key references public.tabs (id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null references public.tabs (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  start_date date not null,
  end_date date not null,
  event_time time,
  assignee text not null default '',
  memo text not null default '',
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  linked_tab_id uuid references public.tabs (id) on delete set null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index calendar_events_tab_id_idx on public.calendar_events (tab_id);
create index calendar_events_linked_tab_id_idx on public.calendar_events (linked_tab_id);
create index calendar_events_created_by_idx on public.calendar_events (created_by);

-- 권한 확인 함수 ---------------------------------------------------------
-- RLS 안에서 같은 표를 다시 조회할 때 생기는 재귀를 피하기 위해 비공개 스키마에 둔다.

create function private.is_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace and m.user_id = (select auth.uid())
  );
$$;

create function private.is_admin(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
  );
$$;

create function private.can_access_tab(target_tab uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tabs t
    join public.workspace_members m on m.workspace_id = t.workspace_id
    where t.id = target_tab and m.user_id = (select auth.uid())
  );
$$;

create function private.shares_workspace(target_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = target_user
  );
$$;

revoke all on function private.is_member(uuid) from public, anon;
revoke all on function private.is_admin(uuid) from public, anon;
revoke all on function private.can_access_tab(uuid) from public, anon;
revoke all on function private.shares_workspace(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;
grant execute on function private.can_access_tab(uuid) to authenticated;
grant execute on function private.shares_workspace(uuid) to authenticated;

-- 표 권한: 익명 사용자에게는 어떤 표도 열지 않는다 --------------------------

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invitations enable row level security;
alter table public.tabs enable row level security;
alter table public.notes enable row level security;
alter table public.calendar_events enable row level security;

grant select on public.workspaces to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, last_active_at) on public.profiles to authenticated;
grant select, delete on public.workspace_members to authenticated;
grant update (role) on public.workspace_members to authenticated;
grant select (id, workspace_id, created_by, expires_at, revoked_at, created_at) on public.invitations to authenticated;
grant insert (workspace_id, token_hash) on public.invitations to authenticated;
grant update (revoked_at) on public.invitations to authenticated;
grant select, insert, update on public.tabs to authenticated;
grant select, insert, update on public.notes to authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;

create policy "멤버는 자기 워크스페이스를 본다" on public.workspaces
  for select to authenticated using ((select private.is_member(id)));

create policy "같은 워크스페이스 멤버의 프로필을 본다" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_workspace(id));

create policy "자기 프로필만 수정한다" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "멤버는 멤버 목록을 본다" on public.workspace_members
  for select to authenticated using (private.is_member(workspace_id));

create policy "관리자는 다른 멤버의 역할을 바꾼다" on public.workspace_members
  for update to authenticated
  using (private.is_admin(workspace_id) and user_id <> (select auth.uid()))
  with check (private.is_admin(workspace_id) and user_id <> (select auth.uid()));

create policy "관리자는 다른 멤버를 내보낸다" on public.workspace_members
  for delete to authenticated
  using (private.is_admin(workspace_id) and user_id <> (select auth.uid()));

create policy "관리자는 초대를 본다" on public.invitations
  for select to authenticated using (private.is_admin(workspace_id));

create policy "관리자는 초대를 만든다" on public.invitations
  for insert to authenticated with check (private.is_admin(workspace_id));

create policy "관리자는 초대를 취소한다" on public.invitations
  for update to authenticated
  using (private.is_admin(workspace_id))
  with check (private.is_admin(workspace_id));

create policy "멤버는 탭을 본다" on public.tabs
  for select to authenticated using (private.is_member(workspace_id));

create policy "멤버는 탭을 만든다" on public.tabs
  for insert to authenticated with check (private.is_member(workspace_id));

create policy "멤버는 탭을 수정한다" on public.tabs
  for update to authenticated
  using (private.is_member(workspace_id))
  with check (private.is_member(workspace_id));

create policy "멤버는 노트를 본다" on public.notes
  for select to authenticated using (private.can_access_tab(tab_id));

create policy "멤버는 노트를 만든다" on public.notes
  for insert to authenticated with check (private.can_access_tab(tab_id));

create policy "멤버는 노트를 수정한다" on public.notes
  for update to authenticated
  using (private.can_access_tab(tab_id))
  with check (private.can_access_tab(tab_id));

create policy "멤버는 일정을 본다" on public.calendar_events
  for select to authenticated using (private.can_access_tab(tab_id));

create policy "멤버는 일정을 만든다" on public.calendar_events
  for insert to authenticated with check (private.can_access_tab(tab_id));

create policy "멤버는 일정을 수정한다" on public.calendar_events
  for update to authenticated
  using (private.can_access_tab(tab_id))
  with check (private.can_access_tab(tab_id));

create policy "멤버는 일정을 삭제한다" on public.calendar_events
  for delete to authenticated using (private.can_access_tab(tab_id));

-- 프로필과 최근 로그인 동기화 ----------------------------------------------

create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, last_sign_in_at)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    new.last_sign_in_at
  );
  return new;
end;
$$;

create function private.handle_user_sign_in()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set last_sign_in_at = new.last_sign_in_at where id = new.id;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.handle_user_sign_in() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger on_auth_user_signed_in
  after update of last_sign_in_at on auth.users
  for each row
  when (new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function private.handle_user_sign_in();

-- 초대 링크: 원문은 만들 때 한 번만 돌려주고 해시만 저장한다 -----------------

create function public.create_invitation(target_workspace uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.invitations (workspace_id, token_hash)
  values (target_workspace, encode(extensions.digest(raw_token, 'sha256'), 'hex'));
  return raw_token;
end;
$$;

-- 아직 멤버가 아닌 사람이 호출해야 하므로 security definer가 필요하다.
create function public.accept_invitation(raw_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  target_workspace uuid;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select i.workspace_id into target_workspace
  from public.invitations i
  where i.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
    and i.revoked_at is null
    and i.expires_at > now();

  if target_workspace is null then
    raise exception '초대 링크가 만료되었거나 취소되었습니다.';
  end if;

  insert into public.workspace_members (workspace_id, user_id)
  values (target_workspace, current_user_id)
  on conflict (workspace_id, user_id) do nothing;

  return target_workspace;
end;
$$;

revoke all on function public.create_invitation(uuid) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.create_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

-- 삭제 후 30일이 지난 탭을 매일 지운다 (한국 시간 오전 4시) --------------------

create function private.purge_trash()
returns void language sql security definer set search_path = '' as $$
  delete from public.tabs where deleted_at < now() - interval '30 days';
$$;

revoke all on function private.purge_trash() from public, anon, authenticated;

select cron.schedule('purge-trash', '0 19 * * *', 'select private.purge_trash()');

-- 실시간 반영 ------------------------------------------------------------

alter publication supabase_realtime add table
  public.tabs,
  public.notes,
  public.calendar_events,
  public.workspace_members,
  public.profiles;

-- 첫 워크스페이스 ----------------------------------------------------------

insert into public.workspaces (name) values ('CAPS 기획부');
