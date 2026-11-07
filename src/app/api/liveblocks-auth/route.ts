import { Liveblocks } from "@liveblocks/node";
import { cursorColor, tabIdFromRoom } from "@/lib/collaboration";
import { createClient } from "@/lib/supabase/server";

const json = (message: string, status: number) => Response.json({ error: message }, { status });

/** 로그인한 멤버가 접근할 수 있는 노트의 방에만 입장 권한을 준다. */
export async function POST(request: Request) {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) return json("동시 편집 키가 설정되지 않았습니다.", 500);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return json("로그인이 필요합니다.", 401);

  const body: unknown = await request.json().catch(() => null);
  const room = (body as { room?: unknown } | null)?.room;
  const tabId = tabIdFromRoom(room);
  if (!tabId) return json("잘못된 요청입니다.", 400);

  // 두 조회는 서로 기다릴 필요가 없으므로 함께 보낸다.
  const [{ data: tab }, { data: profile }] = await Promise.all([
    // RLS가 적용되므로 멤버가 아니면 탭을 조회할 수 없다.
    supabase
      .from("tabs")
      .select("id")
      .eq("id", tabId)
      .eq("template", "note")
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).maybeSingle(),
  ]);
  if (!tab) return json("이 노트를 열 권한이 없습니다.", 403);

  const session = new Liveblocks({ secret }).prepareSession(userId, {
    userInfo: {
      name: profile?.display_name ?? "멤버",
      color: cursorColor(userId),
      ...(profile?.avatar_url ? { avatar: profile.avatar_url } : {}),
    },
  });
  session.allow(room as string, session.FULL_ACCESS);

  const { status, body: token } = await session.authorize();
  return new Response(token, { status });
}
