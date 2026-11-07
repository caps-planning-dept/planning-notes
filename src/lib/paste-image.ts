/**
 * 붙여넣기(Ctrl+V)와 끌어다 놓기로 받은 것에서 사진을 찾는다.
 *
 * 화면 캡처는 사진 파일로 오지만, 카카오톡이나 웹 페이지에서 복사한 사진은
 * 사진 대신 웹 문서(HTML) 안의 <img> 주소로만 올 때가 있다. 그때는 그 주소에서 사진을 받아 온다.
 */

/** 웹 문서 조각에서 첫 사진 주소를 꺼낸다. 읽을 수 있는 data:와 http(s) 주소만 돌려준다. */
export function imageSourceFromHtml(html: string): string | null {
  const match = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(html);
  const source = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").replace(/&amp;/g, "&").trim();
  if (/^data:image\//i.test(source) || /^https?:\/\//i.test(source)) return source;
  return null;
}

const TYPE_LABELS: Record<string, string> = {
  Files: "파일",
  "text/plain": "글",
  "text/html": "웹 문서",
  "text/uri-list": "주소",
  "text/rtf": "서식 있는 글",
};

/** 받은 형식을 사람이 읽을 수 있게 적는다. 사진을 찾지 못했을 때 원인을 알리는 데 쓴다. */
export function describeTypes(types: readonly string[]): string {
  if (types.length === 0) return "비어 있음";
  return [...new Set(types.map((type) => TYPE_LABELS[type] ?? type))].join(", ");
}

export const NO_IMAGE_HELP =
  "사진을 찾지 못했습니다. 카카오톡 사진이면 사진을 크게 연 화면을 Win+Shift+S로 캡처해 붙여넣거나, 사진을 저장한 뒤 '사진 고르기'로 넣어 주세요.";
