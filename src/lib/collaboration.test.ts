import { describe, expect, it } from "vitest";
import { cursorColor, noteRoomId, tabIdFromRoom } from "./collaboration";

const TAB_ID = "3f2b8c1e-7a4d-4e9b-8c21-0d5f6a7b8c9d";

describe("동시 편집 방 이름", () => {
  it("탭 ID로 만든 방 이름에서 다시 탭 ID를 꺼낸다", () => {
    expect(tabIdFromRoom(noteRoomId(TAB_ID))).toBe(TAB_ID);
  });

  it("형식이 다른 방 이름은 거부한다", () => {
    expect(tabIdFromRoom("note:*")).toBeNull();
    expect(tabIdFromRoom(`other:${TAB_ID}`)).toBeNull();
    expect(tabIdFromRoom(`note:${TAB_ID}:x`)).toBeNull();
    expect(tabIdFromRoom(undefined)).toBeNull();
  });
});

describe("커서 색", () => {
  it("같은 사람은 항상 같은 색을 받는다", () => {
    expect(cursorColor(TAB_ID)).toBe(cursorColor(TAB_ID));
    expect(cursorColor(TAB_ID)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
