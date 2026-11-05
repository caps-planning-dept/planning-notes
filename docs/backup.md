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
   - `SUPABASE_SECRET_KEY`: DB의 모든 권한을 가진 키이므로 이 저장소에만 넣습니다.
   - `LIVEBLOCKS_SECRET_KEY`: 운영용 키
4. Actions 탭에서 `Daily backup`을 직접 실행하고 `manifest.json`의 개수를 확인합니다.
5. 실패 알림을 받도록 GitHub 알림 설정을 확인합니다.

## 복구

자동 복구 도구는 없습니다. 필요한 날짜 폴더의 JSON을 보고 표별로 다시 넣습니다. 복구 연습은 아직 하지 않았습니다.
