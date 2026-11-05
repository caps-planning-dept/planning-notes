import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-path";

describe("로그인 후 이동 경로", () => {
  it("사이트 안의 경로는 그대로 쓴다", () => {
    expect(safeRedirectPath("/invite/abc")).toBe("/invite/abc");
  });

  it("외부 사이트로 보내는 값은 첫 화면으로 바꾼다", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
  });

  it("값이 없으면 첫 화면으로 간다", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
  });
});
