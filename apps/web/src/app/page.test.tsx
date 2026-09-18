import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "./page";

function markup(): string {
  return renderToStaticMarkup(<Home />);
}

describe("product root", () => {
  it("still leads with the product hero", () => {
    const html = markup();

    expect(html).toContain("BUILDING-AWARE REPAIR ROUTER");
    expect(html).toContain("주소가 수리 프로토콜이 된다");
  });

  it("offers a visible way into the tenant demo", () => {
    const html = markup();

    expect(html).toContain('href="/demo/tenant"');
    expect(html).toContain("세입자 데모 시작");
  });

  it("offers a visible way into the landlord demo", () => {
    const html = markup();

    expect(html).toContain('href="/demo/landlord"');
    expect(html).toContain("임대인 데모 시작");
  });

  it("says the data is synthetic and what the demo does not do", () => {
    const html = markup();

    expect(html).toContain("합성 데이터");
    expect(html).toContain("업체 배정");
  });

  it("does not claim the product skips hazard gating", () => {
    const html = markup();

    // It does gate on hazard signals, so the looser disclaimer would be untrue.
    expect(html).not.toContain("안전 판정 기능 아님");
    expect(html).toContain("중단");
  });
});
