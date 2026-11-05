import { describe, expect, it } from "vitest";
import { isBlockedInAppBrowser } from "./in-app-browser";

describe("앱 내부 브라우저 감지", () => {
  it("카카오톡 내부 브라우저를 감지한다", () => {
    expect(
      isBlockedInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 KAKAOTALK 10.8.0",
      ),
    ).toBe(true);
  });

  it("일반 Chrome과 Safari는 감지하지 않는다", () => {
    expect(
      isBlockedInAppBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(
      isBlockedInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
  });
});
