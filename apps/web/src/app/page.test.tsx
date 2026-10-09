import { renderToStaticMarkup } from "react-dom/server";
import { afterEach,beforeEach,describe, expect, it,vi } from "vitest";
import Home from "./page";

function markup(): string {
  return renderToStaticMarkup(<Home />);
}

describe("product root", () => {
  beforeEach(()=>vi.stubEnv('BUILD_MANAGER_MODE','DEMO'));
  afterEach(()=>vi.unstubAllEnvs());
  it("leads with what the service does and one example ticket", () => {
    const html = markup();

    expect(html).toContain("세입자 수리 요청, 문자 대신 여기서 받아요");
    expect(html).toContain("101동 1203호 · 난방");
    expect(html).toContain("이렇게 진행돼요");
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
it("B1 demo root offers both login-free roles as same-origin forms and says which issues exist",()=>{
  vi.stubEnv("BUILD_MANAGER_MODE","B1");vi.stubEnv("BUILD_MANAGER_DEMO_ENTRY","1");vi.stubEnv("B1_AUTH0_DOMAIN","b1.synthetic.invalid");
  vi.stubEnv("BUILD_MANAGER_DEMO_SUBJECTS",JSON.stringify({manager:"auth0|synthetic-demo-manager",tenant:"auth0|synthetic-demo-tenant"}));
  try{const html=markup();
    expect(html.split('action="/api/v2/session/demo"').length-1).toBe(2);
    expect(html).toContain('value="manager"');expect(html).toContain('value="tenant"');
    expect(html).toContain("관리자로 체험하기");expect(html).toContain("세입자로 체험하기");
    expect(html).toContain("난방과 누수 두 가지");expect(html).not.toContain('href="/auth/login"');
  }finally{vi.unstubAllEnvs();}
});
