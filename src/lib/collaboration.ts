const CURSOR_COLORS = [
  "#e03131",
  "#d9480f",
  "#2f9e44",
  "#0f8a6a",
  "#1098ad",
  "#1971c2",
  "#5645d4",
  "#ae3ec9",
  "#d6336c",
];

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const NOTE_ROOM = new RegExp(`^note:(${UUID})$`, "i");

export const noteRoomId = (tabId: string) => `note:${tabId}`;

/** 동시 편집 방 이름에서 탭 ID를 꺼낸다. 형식이 다르면 null을 돌려준다. */
export function tabIdFromRoom(room: unknown): string | null {
  if (typeof room !== "string") return null;
  return NOTE_ROOM.exec(room)?.[1] ?? null;
}

/** 같은 사람은 어느 기기에서나 같은 커서 색을 갖도록 ID로 색을 정한다. */
export function cursorColor(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}
