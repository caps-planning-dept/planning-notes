import { describe, expect, it } from "vitest";
import { formatBytes, isInlineImage, MAX_NOTE_FILE_BYTES, noteFilePath } from "./note-files";

describe("노트 첨부 파일", () => {
  it("경로는 탭 ID 폴더와 무작위 이름, 원래 확장자로 만든다", () => {
    expect(noteFilePath("tab-1", "회의 사진.JPG", "abc")).toBe("tab-1/abc.jpg");
    expect(noteFilePath("tab-1", "자료.tar.gz", "abc")).toBe("tab-1/abc.gz");
  });

  it("확장자가 없거나 이상하면 붙이지 않는다", () => {
    expect(noteFilePath("tab-1", "README", "abc")).toBe("tab-1/abc");
    expect(noteFilePath("tab-1", "a.한글", "abc")).toBe("tab-1/abc");
    expect(noteFilePath("tab-1", "../../x.png/..", "abc")).toBe("tab-1/abc");
  });

  it("흔한 사진만 노트 안에 바로 보여 준다", () => {
    expect(isInlineImage("image/png")).toBe(true);
    expect(isInlineImage("IMAGE/JPEG")).toBe(true);
    expect(isInlineImage("image/svg+xml")).toBe(false);
    expect(isInlineImage("image/heic")).toBe(false);
    expect(isInlineImage("application/pdf")).toBe(false);
  });

  it("크기를 읽기 쉽게 보여 준다", () => {
    expect(formatBytes(900)).toBe("900B");
    expect(formatBytes(2048)).toBe("2KB");
    expect(formatBytes(MAX_NOTE_FILE_BYTES)).toBe("10.0MB");
  });
});
