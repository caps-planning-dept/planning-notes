import { createClient } from "@/lib/supabase/server";
import { normalizeReadClasses } from "@/lib/timetable";
import { findReadResult, MAX_READ_BASE64_LENGTH, READ_PROMPT, READ_SCHEMA, READABLE_IMAGE_TYPES } from "@/lib/timetable-read";

const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (message: string, status: number) => json({ error: message }, status);

// 바꾸고 싶으면 Vercel 환경 변수 GEMINI_MODEL에 다른 모델 이름을 넣는다.
// 2026-11-07 시험: 3.8 Flash는 무료 사용 중 붐빔(503)과 45초 넘는 지연이 잦았고,
// 3.5 Flash-Lite는 시간표 12개 수업을 모두 찾고 10개의 시간을 정확히 읽었다. 그래서 Lite를 먼저 쓴다.
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
// 기본 모델이 붐비거나(503) 늦으면 한 번 더 시도할 모델
const FALLBACK_MODEL = "gemini-3.8-flash";
const INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const API_REVISION = "2026-05-20";
// 기본 모델이 오래 걸리면 기다리지 않고 가벼운 모델로 넘어간다. 둘을 합쳐도 1분 안에 끝난다.
const PRIMARY_TIMEOUT_MS = 25_000;
const FALLBACK_TIMEOUT_MS = 30_000;

/** 시간표 사진을 AI로 읽어 수업 목록을 돌려준다. 저장은 하지 않고, 사용자가 확인한 뒤 화면에서 저장한다. */
export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail("사진 읽기용 AI 열쇠가 아직 설정되지 않았습니다. 관리자에게 알려 주세요.", 503);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return fail("로그인이 필요합니다.", 401);

  const body = (await request.json().catch(() => null)) as {
    tabId?: unknown;
    image?: unknown;
    mimeType?: unknown;
  } | null;
  const tabId = typeof body?.tabId === "string" ? body.tabId : "";
  const image = typeof body?.image === "string" ? body.image : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
  if (!tabId || !image || !READABLE_IMAGE_TYPES.includes(mimeType)) return fail("잘못된 요청입니다.", 400);
  if (image.length > MAX_READ_BASE64_LENGTH) return fail("사진이 너무 큽니다.", 413);

  // RLS가 적용되므로 이 워크스페이스 멤버만 탭을 찾을 수 있다. 바깥 사람이 AI를 쓰지 못하게 막는다.
  const { data: tab } = await supabase
    .from("tabs")
    .select("id")
    .eq("id", tabId)
    .eq("template", "timetable")
    .is("deleted_at", null)
    .maybeSingle();
  if (!tab) return fail("이 시간표를 열 권한이 없습니다.", 403);

  const models = [...new Set([process.env.GEMINI_MODEL || DEFAULT_MODEL, FALLBACK_MODEL])];
  let response: Response | null = null;
  for (const [index, model] of models.entries()) {
    const last = index === models.length - 1;
    try {
      response = await readWith(key, model, image, mimeType, last ? FALLBACK_TIMEOUT_MS : PRIMARY_TIMEOUT_MS);
    } catch {
      if (last) return fail("AI가 제때 답하지 않았습니다. 잠시 뒤 다시 시도해 주세요.", 504);
      console.error("timetable read slow", model);
      continue;
    }
    if (response.ok) console.info("timetable read ok", model);
    if (response.status !== 503 || last) break;
    console.error("timetable read busy", model);
  }
  if (!response) return fail("AI가 사진을 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.", 502);

  if (!response.ok) {
    // 원인 확인용으로 서버 기록에만 남긴다. 사진 내용은 남기지 않는다.
    console.error("timetable read failed", response.status, (await response.text()).slice(0, 500));
    if (response.status === 503) return fail("AI가 지금 붐빕니다. 1~2분 뒤 다시 시도해 주세요.", 503);
    if (response.status === 429) return fail("오늘 쓸 수 있는 AI 사용량을 다 썼습니다. 내일 다시 시도하거나 직접 입력해 주세요.", 429);
    return fail("AI가 사진을 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.", 502);
  }

  const classes = normalizeReadClasses(findReadResult(await response.json().catch(() => null)));
  return json({ classes });
}

function readWith(key: string, model: string, image: string, mimeType: string, timeoutMs: number) {
  return fetch(INTERACTIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key, "Api-Revision": API_REVISION },
    body: JSON.stringify({
      model,
      input: [
        { type: "text", text: READ_PROMPT },
        { type: "image", data: image, mime_type: mimeType },
      ],
      response_format: { type: "text", mime_type: "application/json", schema: READ_SCHEMA },
      // 칸 위치를 읽는 일이라 깊게 생각할 필요가 없다. 생각을 줄이면 훨씬 빨리 답한다.
      generation_config: { thinking_level: "low" },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
}
