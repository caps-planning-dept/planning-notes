<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.


## 세션 이어가기

새 세션을 시작하면 먼저 `docs/handoff.md`를 읽고 현재 상태를 파악한다. 파일이 없으면 사용자에게 알린다.

사용자가 `갱신하자`라고 말하면 `docs/handoff.md`를 현재 상태로 고쳐 쓴다.

- 실제로 확인한 내용만 적는다. 추측은 `추측`이라고 표시한다.
- 지난 내용을 쌓지 않고 현재 상태로 덮어쓴다. 50줄 이내로 유지한다.
- 비밀 키, 신청 링크의 토큰, 실제 이름과 학번은 적지 않는다. 이 저장소는 공개될 수 있다.
- 갱신한 뒤 무엇이 바뀌었는지 한두 줄로 알린다. 사용자가 요청하지 않으면 커밋하지 않는다.

`docs/handoff.md`는 아래 형식을 따른다.

    # 인수인계 메모
    마지막 갱신: 날짜

    ## 현재 상태
    브랜치, 마지막 커밋, 커밋하지 않은 파일

    ## 끝난 일
    최근 작업 중 다음 작업에 필요한 것만

    ## 다음 할 일
    우선순위 순서로

    ## 주의할 점
    하면 안 되는 일, 아직 시험하지 않은 것

    ## 사용자가 해야 할 일
    직접 준비하거나 결정할 것


<!-- END:nextjs-agent-rules -->
