import { describe, expect, it } from "vitest";
import { isWebHref, tabIdFromHref, tabLinkHref } from "./note-links";

const ID = "3f2c1a4e-8b7d-4c6e-9a1f-2b3c4d5e6f70";

describe("노트의 탭 연결", () => {
  it("탭 연결 주소에서 탭 ID를 다시 꺼낸다", () => {
    expect(tabIdFromHref(tabLinkHref(ID))).toBe(ID);
  });

  it("탭 연결이 아닌 주소는 무시한다", () => {
    expect(tabIdFromHref("https://example.com")).toBeNull();
    expect(tabIdFromHref("#tab-not-a-uuid")).toBeNull();
    expect(tabIdFromHref(`#tab-${ID}x`)).toBeNull();
    expect(tabIdFromHref(null)).toBeNull();
  });

  it("웹 주소만 일반 링크로 연다", () => {
    expect(isWebHref("https://example.com")).toBe(true);
    expect(isWebHref("javascript:alert(1)")).toBe(false);
    expect(isWebHref(tabLinkHref(ID))).toBe(false);
  });
});
