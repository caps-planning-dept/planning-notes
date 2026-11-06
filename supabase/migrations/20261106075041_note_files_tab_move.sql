-- 노트의 사진·파일 첨부와 탭 옮기기

-- 1. 노트 첨부 파일 버킷 --------------------------------------------------
--    비공개 버킷이라 주소를 알아도 볼 수 없고, 앱이 멤버에게만 1시간짜리 주소를 받아 준다.
--    경로의 첫 폴더가 탭 ID이므로, 그 탭의 노트를 볼 수 있는 사람만 파일을 보고 올린다.
--    숨은 캡처 탭의 파일도 탭 목록과 같은 기준(private.can_access_tab)으로 막힌다.
insert into storage.buckets (id, name, public, file_size_limit)
values ('note-files', 'note-files', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create function private.can_access_note_file(object_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  folder text := (storage.foldername(object_name))[1];
begin
  -- 형식이 틀린 경로는 uuid로 바꾸다 오류가 나지 않도록 먼저 거른다.
  if folder is null or folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.can_access_tab(folder::uuid);
end;
$$;

revoke all on function private.can_access_note_file(text) from public, anon;
grant execute on function private.can_access_note_file(text) to authenticated;

create policy "탭을 볼 수 있는 멤버는 노트 파일을 본다" on storage.objects
  for select to authenticated
  using (bucket_id = 'note-files' and private.can_access_note_file(name));

create policy "탭을 볼 수 있는 멤버는 노트 파일을 올린다" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'note-files' and private.can_access_note_file(name));

-- 수정과 삭제 정책은 두지 않는다. 올린 파일은 바꿀 수 없고, 다른 사람의 파일을 지울 수도 없다.

-- 2. 탭 옮기기 검사 -------------------------------------------------------
--    탭을 자기 자신이나 자기 하위 탭 아래로 옮기면 서로를 품는 고리가 생겨
--    사이드바가 끝없이 그려진다. 다른 워크스페이스의 탭 아래로도 옮길 수 없게 한다.
create function private.check_tab_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cursor_id uuid := new.parent_id;
  depth int := 0;
begin
  if new.parent_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.tabs where id = new.parent_id and workspace_id = new.workspace_id
  ) then
    raise exception '같은 워크스페이스의 탭 아래로만 옮길 수 있습니다';
  end if;
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception '탭을 자기 하위 탭 아래로 옮길 수 없습니다';
    end if;
    depth := depth + 1;
    if depth > 100 then
      raise exception '탭 단계가 너무 깊습니다';
    end if;
    select parent_id into cursor_id from public.tabs where id = cursor_id;
  end loop;
  return new;
end;
$$;

revoke all on function private.check_tab_parent() from public, anon, authenticated;

create trigger on_tab_parent_changed
  before insert or update of parent_id on public.tabs
  for each row
  execute function private.check_tab_parent();
