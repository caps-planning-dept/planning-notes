import { describe, expect, it } from "vitest";
import { contrastRatio } from "./color";
import { HIGHLIGHT_COLORS, TEXT_COLORS } from "./note-format";

describe("노트 서식 색", () => {
  it.each(TEXT_COLORS)("글씨 색 $label은 흰 배경에서 4.5:1 이상이다", ({ value }) => {
    expect(contrastRatio(value, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it.each(HIGHLIGHT_COLORS)("형광펜 $label은 본문 글자와 4.5:1 이상이다", ({ value }) => {
    expect(contrastRatio(value, "#2b2a27")).toBeGreaterThanOrEqual(4.5);
  });
});
