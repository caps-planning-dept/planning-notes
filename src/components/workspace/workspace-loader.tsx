"use client";

import dynamic from "next/dynamic";

// 지금은 브라우저 저장소를 읽으므로 서버에서 그리지 않는다. Supabase 연결 시 이 파일을 바꾼다.
export const WorkspaceLoader = dynamic(
  () => import("./workspace-app").then((module) => module.WorkspaceApp),
  { ssr: false },
);
