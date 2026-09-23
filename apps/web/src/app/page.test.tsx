import { renderToStaticMarkup } from "react-dom/server";
import { afterEach,beforeEach,describe, expect, it,vi } from "vitest";
import Home from "./page";

function markup(): string {
  return renderToStaticMarkup(<Home />);
}

describe("product root", () => {
  beforeEach(()=>vi.stubEnv('BUILD_MANAGER_MODE','DEMO'));
  afterEach(()=>vi.unstubAllEnvs());
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
it('B1 root presents authentication/workspace without demo data',()=>{vi.stubEnv('BUILD_MANAGER_MODE','B1');try{const html=markup();expect(html).toContain('href="/auth/login"');expect(html).toContain('href="/workspace"');expect(html).not.toContain('/demo/');}finally{vi.unstubAllEnvs();}});
