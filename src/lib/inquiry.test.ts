import { describe, expect, it } from "vitest";
import { DISPLAY_NAME_MAX, INQUIRY_BODY_MAX, INQUIRY_TITLE_MAX, validateDisplayName, validateInquiry } from "./inquiry";

describe("문의 검사", () => {
  it("제목과 내용이 있으면 통과한다", () => {
    expect(validateInquiry("검색 기능", "탭을 검색하고 싶어요")).toEqual({});
  });

  it("공백만 있으면 비어 있는 것으로 본다", () => {
    expect(Object.keys(validateInquiry("  ", "\n "))).toEqual(["title", "body"]);
  });

  it("글자 수 제한을 넘으면 막는다", () => {
    const errors = validateInquiry("가".repeat(INQUIRY_TITLE_MAX + 1), "나".repeat(INQUIRY_BODY_MAX + 1));
    expect(Object.keys(errors)).toEqual(["title", "body"]);
  });

  it("글자 수 제한까지는 허용한다", () => {
    expect(validateInquiry("가".repeat(INQUIRY_TITLE_MAX), "나".repeat(INQUIRY_BODY_MAX))).toEqual({});
  });
});

describe("이름 검사", () => {
  it("빈 이름을 막는다", () => {
    expect(validateDisplayName("   ")).not.toBeNull();
  });

  it("글자 수 제한을 넘으면 막는다", () => {
    expect(validateDisplayName("가".repeat(DISPLAY_NAME_MAX + 1))).not.toBeNull();
  });

  it("정상 이름은 통과한다", () => {
    expect(validateDisplayName("기획부 멤버")).toBeNull();
  });
});
