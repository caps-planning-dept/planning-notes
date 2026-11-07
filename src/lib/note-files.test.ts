import { describe, expect, it } from "vitest";
import {
  clampImageWidth,
  fitImageSize,
  formatBytes,
  isInlineImage,
  MAX_NOTE_FILE_BYTES,
  MIN_IMAGE_WIDTH,
  noteFilePath,
  replaceExtension,
} from "./note-files";

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

describe("노트 사진 크기", () => {
  it("너비를 15~100% 사이 정수로 맞춘다", () => {
    expect(clampImageWidth(50)).toBe(50);
    expect(clampImageWidth("33.4")).toBe(33);
    expect(clampImageWidth(3)).toBe(MIN_IMAGE_WIDTH);
    expect(clampImageWidth(140)).toBe(100);
    expect(clampImageWidth(null)).toBeNull();
    expect(clampImageWidth("abc")).toBeNull();
    expect(clampImageWidth(0)).toBeNull();
  });

  it("긴 쪽이 기준보다 크면 비율을 지켜 줄인다", () => {
    expect(fitImageSize(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitImageSize(1080, 2400)).toEqual({ width: 900, height: 2000 });
    expect(fitImageSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("줄인 사진의 확장자를 바꾼다", () => {
    expect(replaceExtension("회의 사진.PNG", "webp")).toBe("회의 사진.webp");
    expect(replaceExtension("README", "jpg")).toBe("README.jpg");
    expect(replaceExtension(".png", "jpg")).toBe("사진.jpg");
  });
});
