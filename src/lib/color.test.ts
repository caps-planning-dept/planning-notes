import { describe, expect, it } from "vitest";
import { readableTextOn } from "./color";

describe("탭 색 위의 글자색", () => {
  it("어두운 색 위에는 흰 글자를 쓴다", () => {
    expect(readableTextOn("#2b2a27")).toBe("#ffffff");
    expect(readableTextOn("#1971c2")).toBe("#ffffff");
  });

  it("중간 밝기의 녹색과 주황색 위에도 흰 글자를 쓴다", () => {
    expect(readableTextOn("#0f8a6a")).toBe("#ffffff");
    expect(readableTextOn("#d9480f")).toBe("#ffffff");
  });

  it("흰 글자가 잘 보이지 않는 밝은 색 위에는 검은 글자를 쓴다", () => {
    expect(readableTextOn("#c8f135")).toBe("#111111");
    expect(readableTextOn("#f59f00")).toBe("#111111");
    expect(readableTextOn("#6fa3d8")).toBe("#111111");
    expect(readableTextOn("#ffffff")).toBe("#111111");
  });
});
