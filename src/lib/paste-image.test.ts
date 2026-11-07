import { describe, expect, it } from "vitest";
import { describeTypes, imageSourceFromHtml } from "./paste-image";

describe("붙여넣은 웹 문서에서 사진 찾기", () => {
  it("img 주소를 꺼낸다", () => {
    expect(imageSourceFromHtml('<html><body><img alt="x" src="https://example.com/a.png?w=1&amp;h=2"></body></html>')).toBe(
      "https://example.com/a.png?w=1&h=2",
    );
    expect(imageSourceFromHtml("<img src='data:image/png;base64,AAAA'>")).toBe("data:image/png;base64,AAAA");
    expect(imageSourceFromHtml("<IMG SRC=https://e.com/b.jpg>")).toBe("https://e.com/b.jpg");
  });

  it("읽을 수 없는 주소나 사진이 없으면 null", () => {
    expect(imageSourceFromHtml('<img src="file:///C:/Users/a/KakaoTalk/b.png">')).toBeNull();
    expect(imageSourceFromHtml("<p>글만 있음</p>")).toBeNull();
  });

  it("받은 형식을 읽기 쉽게 적는다", () => {
    expect(describeTypes(["text/plain", "text/html"])).toBe("글, 웹 문서");
    expect(describeTypes([])).toBe("비어 있음");
    expect(describeTypes(["Files", "image/bmp"])).toBe("파일, image/bmp");
  });
});
