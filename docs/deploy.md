# 배포 준비 목록

실제 사용 전에 위에서부터 순서대로 진행합니다. 비밀 키 값은 이 문서에 적지 않습니다.

## 1. 저장소

- [x] 공개할 범위 결정: `AGENTS.md`, `docs/handoff.md`, `.mcp.json` 모두 공개
- [x] 회장단의 코드·로고 공개 확인
- [x] 공개 전 커밋 기록에 실제 이름과 비밀 값이 없는지 확인
- [x] `feature/capture`를 `main`에 합치기
- [x] GitHub Organization `caps-planning-dept` 만들기
- [x] Organization에 공개 저장소 `planning-notes`를 만들고 올리기

## 2. Vercel

- [ ] 저장소를 연결해 프로젝트 만들기 (Next.js 자동 인식, 별도 설정 파일 없음)
- [ ] 환경 변수 3개 등록: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `LIVEBLOCKS_SECRET_KEY`
- [ ] 첫 배포 후 주소 확정

## 3. 로그인

- [ ] Supabase Authentication의 Site URL을 배포 주소로 변경
- [ ] Supabase Redirect URLs에 `https://배포주소/auth/callback` 추가
- [ ] Google 콘솔의 승인된 도메인과 홈페이지 주소 입력
- [ ] 멤버가 테스트 사용자 없이 들어오도록 Google 앱 게시 (개인정보처리방침 주소 필요)

## 4. 운영 서비스

- [ ] Liveblocks 운영용 프로젝트를 만들고 `LIVEBLOCKS_SECRET_KEY` 교체
- [ ] Supabase MCP를 읽기 전용으로 변경
- [x] 자동 백업 코드 작성 (`scripts/backup.mjs`)
- [x] 백업 저장소 설정과 첫 실행 ([backup.md](backup.md))
- [ ] Liveblocks 운영 키로 바꾼 뒤 백업 저장소의 `LIVEBLOCKS_SECRET_KEY`도 교체
- [ ] 백업 복구 연습
- [x] 개인정보처리방침 페이지 초안 작성 (`/privacy`)
- [ ] 배포일에 맞춰 방침의 시행일 수정
- [ ] 신청 폼의 동의 방식 재검토 (현재 체크 없이 안내만 표시)

## 5. 데이터 정리

- [ ] 시험 탭 `두 계정 시험` 삭제, 휴지통 비우기
- [ ] 시험 문의 삭제
- [ ] `캡처 예시`, `캡처 시즌2`의 처리 결정 (가짜 신청 포함 여부 확인)
- [ ] 쓰지 않는 초대 링크 취소, 두 번째 계정 내보내기

## 6. 배포 후 확인

- [ ] 배포 주소에서 Google 로그인과 초대 가입
- [ ] 로그인하지 않은 상태로 공개 신청 폼 제출
- [ ] 동시 편집과 답글
- [ ] 실제 휴대폰 (카카오톡 내부 브라우저 안내 포함)
- [ ] 보안 헤더 확인, CSP 적용 여부 시험
