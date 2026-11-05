/** 로그인 후 돌아갈 경로를 사이트 안의 경로로만 제한한다. */
export function safeRedirectPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  return path;
}
