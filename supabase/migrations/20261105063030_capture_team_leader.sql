-- 조마다 조장과 메모(예: 음주 X)를 저장한다.
-- 기존 조는 첫 번째 사람을 조장으로 지정한다.

alter table public.capture_teams
  add column leader_application_id uuid,
  add column note text not null default '' check (char_length(note) <= 50);

update public.capture_teams
set leader_application_id = application_ids[1]
where cardinality(application_ids) > 0;
