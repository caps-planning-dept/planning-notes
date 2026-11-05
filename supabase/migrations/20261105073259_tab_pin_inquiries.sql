-- 탭 고정, 기능 추가 문의, 표시 이름 길이 제한

-- 고정한 시각을 저장한다. 비어 있으면 고정하지 않은 탭이다.
alter table public.tabs add column pinned_at timestamptz;

-- 멤버가 직접 이름을 바꾸므로 빈 이름과 지나치게 긴 이름을 막는다.
alter table public.profiles add constraint profiles_display_name_length
  check (char_length(trim(display_name)) between 1 and 50);

-- 문의는 작성자와 관리자만 본다. 처리 상태는 관리자만 바꾼다.
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 100),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
create index inquiries_workspace_id_idx on public.inquiries (workspace_id, created_at desc);
create index inquiries_author_id_idx on public.inquiries (author_id);

alter table public.inquiries enable row level security;

revoke all on public.inquiries from anon, authenticated;
grant select on public.inquiries to authenticated;
grant insert (workspace_id, title, body) on public.inquiries to authenticated;
grant update (status) on public.inquiries to authenticated;

create policy "작성자와 관리자는 문의를 본다" on public.inquiries
  for select to authenticated
  using (
    private.is_admin(workspace_id)
    or (author_id = (select auth.uid()) and private.is_member(workspace_id))
  );

create policy "멤버는 자기 이름으로 문의를 남긴다" on public.inquiries
  for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_member(workspace_id));

create policy "관리자는 문의 상태를 바꾼다" on public.inquiries
  for update to authenticated
  using (private.is_admin(workspace_id))
  with check (private.is_admin(workspace_id));
