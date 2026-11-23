-- 신청폼 예시: 2026-2 CAPS 종강총회 신청 구글폼과 같은 내용의 신청폼 탭을 만듭니다.
-- 질문 5개(이름, 학번, 전공, 기수, 뒤풀이 참여 여부, 모두 필수), 선착순 40명, 12월 11일 23시 59분 마감.
-- 신청은 닫힌 채로 만듭니다. 앱의 "폼 설정"에서 "신청 열기"를 체크하면 링크로 신청을 받습니다.
-- 먼저 20261123090000_forms.sql을 적용해야 합니다. 지우려면 앱에서 이 탭을 휴지통으로 옮깁니다.

do $$
declare
  target_workspace uuid;
  creator uuid;
  new_tab uuid;
begin
  select id into target_workspace from public.workspaces where name = 'CAPS 기획부';
  -- 가장 먼저 들어온 관리자를 만든 사람으로 둡니다.
  select user_id into creator
  from public.workspace_members
  where workspace_id = target_workspace and role = 'admin'
  order by joined_at nulls last
  limit 1;

  insert into public.tabs (workspace_id, title, template, color, created_by)
  values (target_workspace, '2026-2 CAPS 종강총회 신청', 'form', '#e8590c', creator)
  returning id into new_tab;

  -- "지정한 멤버만" 탭이므로 관리자를 모두 열람자로 넣어 바로 보이게 합니다.
  insert into public.tab_viewers (tab_id, user_id)
  select new_tab, user_id
  from public.workspace_members
  where workspace_id = target_workspace and role = 'admin'
  on conflict do nothing;

  update public.form_settings
  set
    capacity = 40,
    closes_at = '2026-12-12 00:00:00+09',
    notice = E'📢 2026-2 CAPS 종강총회 공지📢\n\n'
      || E'2026년 2학기 종강을 맞이하여, 한 학기 마지막 행사인 종강총회를 진행합니다✨️\n\n'
      || E'🗓 일시: 12월 16일 수요일 18:00~\n'
      || E'📌 장소: 추후 공지 예정\n'
      || E'🍺 뒤풀이: 추후 공지 예정\n\n'
      || E'신청 기한:  ~ 12월 11일(일) 23시 59분\n\n'
      || E'🚨인원은 40명 제한으로, 선착순이며 조기마감 될 수 있습니다!\n\n'
      || E'한 학기의 마지막을 장식하는 행사인 만큼 CAPS 부원분들의 많은 참여 부탁드립니다😊',
    questions = '[
      {"id": "name", "type": "short", "label": "이름", "help": "", "required": true, "options": []},
      {"id": "student-id", "type": "short", "label": "학번 (ex. 2026XXXXXX)", "help": "", "required": true, "options": []},
      {"id": "major", "type": "short", "label": "전공 (ex. 컴퓨터AI학부)", "help": "", "required": true, "options": []},
      {"id": "cohort", "type": "short", "label": "기수 (가장 최근 기수는 40기입니다!)", "help": "", "required": true, "options": []},
      {"id": "party", "type": "single", "label": "뒤풀이 참여 여부", "help": "", "required": true,
       "options": ["종강총회만 참여", "뒤풀이만 참여 (19:00 예정)", "종강총회&뒤풀이 참여"]}
    ]'::jsonb
  where tab_id = new_tab;
end;
$$;
