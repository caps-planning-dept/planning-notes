const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const TAB_LINK = new RegExp(`^#tab-(${UUID})$`, "i");

/** 노트 글자에 거는 탭 연결 주소. 페이지를 새로 열지 않도록 `#`으로 시작한다. */
export const tabLinkHref = (tabId: string) => `#tab-${tabId}`;

/** 탭 연결 주소에서 탭 ID를 꺼낸다. 탭 연결이 아니면 null을 돌려준다. */
export function tabIdFromHref(href: string | null | undefined): string | null {
  return href ? (TAB_LINK.exec(href)?.[1] ?? null) : null;
}

/** 노트 안 일반 링크는 웹 주소만 새 창으로 연다. `javascript:` 같은 주소는 열지 않는다. */
export function isWebHref(href: string | null | undefined): href is string {
  return Boolean(href && /^https?:\/\//i.test(href));
}
