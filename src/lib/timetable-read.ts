/** 시간표 사진을 읽을 때 AI에게 주는 지시와 답 형식. 서버 경로에서만 쓴다. */

export const READ_PROMPT = `이 사진은 대학생의 주간 수업 시간표(주로 에브리타임 앱 캡처)입니다.
사진에 있는 수업 칸을 모두 찾아 JSON으로 돌려주세요.

- day: 요일 한 글자 (월, 화, 수, 목, 금, 토, 일). 칸이 놓인 열의 머리글을 보세요.
- start, end: 24시간 형식 "HH:MM". 왼쪽 시간 눈금을 기준으로 칸의 위쪽·아래쪽 끝 위치로 정하세요.
  에브리타임은 오후 시간을 1, 2, 3…으로 적으므로 12 다음의 1은 13:00입니다.
  한 시간 칸의 절반이면 30분입니다. 가장 가까운 5분 단위로 맞추세요.
- title: 칸에 굵게 적힌 수업 이름. 줄바꿈으로 잘린 글자는 이어 붙이세요.
- place: 수업 이름 아래 적힌 강의실(있으면). 없으면 빈 문자열.

시간표가 아닌 사진이면 classes를 빈 배열로 돌려주세요. 사진에 없는 수업은 지어내지 마세요.`;

export const READ_SCHEMA = {
  type: "object",
  properties: {
    classes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "string", enum: ["월", "화", "수", "목", "금", "토", "일"] },
          start: { type: "string", description: "HH:MM (24시간)" },
          end: { type: "string", description: "HH:MM (24시간)" },
          title: { type: "string" },
          place: { type: "string" },
        },
        required: ["day", "start", "end", "title", "place"],
      },
    },
  },
  required: ["classes"],
} as const;

/** 사진을 보낼 수 있는 형식 */
export const READABLE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** base64로 바꾼 사진의 최대 길이. Vercel 요청 한도(4.5MB) 안에 들도록 한다. */
export const MAX_READ_BASE64_LENGTH = 4_000_000;

/**
 * AI의 답에서 JSON 글을 찾아 객체로 돌려준다.
 * 답의 모양이 바뀌어도 동작하도록, 그 안의 글 가운데 classes를 가진 JSON을 찾는다.
 */
export function findReadResult(response: unknown): unknown {
  const seen = new Set<unknown>();
  const stack: unknown[] = [response];
  while (stack.length > 0) {
    const value = stack.pop();
    if (value === null || value === undefined || seen.has(value)) continue;
    if (typeof value === "string") {
      const text = value.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      if (!text.startsWith("{")) continue;
      try {
        const parsed: unknown = JSON.parse(text);
        if (parsed && typeof parsed === "object" && "classes" in parsed) return parsed;
      } catch {
        // JSON이 아닌 글은 건너뛴다.
      }
      continue;
    }
    if (typeof value !== "object") continue;
    seen.add(value);
    if ("classes" in value && Array.isArray((value as { classes: unknown }).classes)) return value;
    stack.push(...Object.values(value as Record<string, unknown>).reverse());
  }
  return null;
}
