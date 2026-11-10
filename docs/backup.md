# 자동 백업

매일 한국 시간 오전 3시에 비공개 저장소 `caps-planning-dept/caps_planning-notes-backup`에 JSON 파일로 저장합니다.

## 범위

| 포함 | 제외 |
|---|---|
| 워크스페이스, 멤버 역할, 표시 이름 | 캡처 회차, 신청, 조, 열람자 |
| 탭, 노트 복사본, 일정, 문의 | 초대 링크, 멤버 이메일 |
| 회의록 답글 (Liveblocks) | 노트 원본의 동시 편집 기록 |

- 보관 기간은 30일입니다. 지난 폴더는 지우고 Git 기록도 남기지 않습니다.
- 캡처 신청 정보는 복구할 수 없습니다. 학번 등을 여러 곳에 남기지 않기 위한 결정입니다.
- 노트는 DB 복사본 기준이라 동시 편집 중 마지막 저장 전 내용은 빠질 수 있습니다.

## 설정

1. Organization에 비공개 저장소 `caps_planning-notes-backup`을 만듭니다.
2. [daily-backup.yml](backup/daily-backup.yml)을 그 저장소의 `.github/workflows/daily-backup.yml`로 복사합니다. 앱 저장소 이름이 다르면 `repository` 값을 고칩니다.
3. 저장소의 Settings → Secrets and variables → Actions에 값을 등록합니다.
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`: `service_role` 권한의 키입니다. 표 권한은 백업 대상을 읽는 것만 허용했지만([마이그레이션](../supabase/migrations/20261105171648_backup_read_access.sql)), 다른 권한이 있을 수 있으므로 이 저장소에만 넣습니다.
   - `LIVEBLOCKS_SECRET_KEY`: 운영용 키
4. Actions 탭에서 `Daily backup`을 직접 실행하고 `manifest.json`의 개수를 확인합니다.
5. 실패 알림을 받도록 GitHub 알림 설정을 확인합니다.

## 복구

자동 복구 도구는 없습니다. 필요한 날짜 폴더의 JSON을 보고 표별로 다시 넣습니다.

1. 백업 저장소에서 날짜 폴더의 JSON을 내려받습니다. 내려받은 파일은 이 저장소에 넣지 않습니다.
2. 부모가 먼저 들어가야 하므로 `workspaces` → `tabs`(상위 탭 먼저) → `tab_viewers`, `notes`, `calendar_events`, `inquiries` 순서로 넣습니다.
3. 행 하나는 `jsonb_populate_record`로 JSON을 그대로 표의 한 줄로 바꿔 넣습니다.

   ```sql
   insert into public.tabs
   select (jsonb_populate_record(null::public.tabs, $json${ 백업의 한 줄 }$json$::jsonb)).*;
   ```

4. 같은 `id`가 이미 있으면 넣지 않습니다. 지금 내용을 덮어쓸지는 따로 판단합니다.
5. 실제로 넣기 전에 아래 연습처럼 오류로 끝나는 `do` 블록 안에서 먼저 시험합니다.

주의할 점

- 노트 화면은 Liveblocks 방의 내용을 먼저 보여 줍니다. DB 복사본은 방이 비어 있을 때만 처음 내용으로 쓰입니다(추측: Liveblocks `initialContent` 동작 기준, 시험하지 않음). 방이 남아 있으면 방 내용이 보입니다.
- 답글(`note_threads.json`)은 Liveblocks API로 다시 만들어야 하며 연습하지 않았습니다.
- 멤버는 Google 로그인 계정(`auth.users`)이 있어야 다시 넣을 수 있습니다. 이메일은 백업에 없습니다.

### 연습 기록 (2026-11-06)

- 2026-11-06 백업에만 남아 있고 DB에서는 영구 삭제된 휴지통 탭 1개와 그 노트를 위 방법으로 다시 넣었습니다.
- 넣은 행을 백업과 비교해 탭과 노트 모두 일치했고(탭 개수 14 → 15), 마지막에 일부러 오류를 내서 모두 취소했습니다.
- 실행 뒤 탭 개수가 14개 그대로이고 해당 탭과 노트가 없는 것을 다시 확인했습니다.
