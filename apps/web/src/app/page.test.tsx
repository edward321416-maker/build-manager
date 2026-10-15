import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

function markup(): string {
  return renderToStaticMarkup(<Home />);
}

const STEPS = [
  "문제를 고르고 사진과 함께 접수해요", "위험한 신호부터 확인해요", "건물에 맞춘 질문에 답하고 보내요",
  "할 일은 알림에 모여요", "부족하면 다시 묻고, 처리 방법을 정해요", "업체에 보안 링크를 보내요",
  "링크로 작업을 열고 수락해요", "세입자와 방문 시간을 정해요", "방문하고 사진과 함께 보고해요",
];

describe("product root", () => {
  beforeEach(() => vi.stubEnv("BUILD_MANAGER_MODE", "DEMO"));
  afterEach(() => vi.unstubAllEnvs());

  it("leads with what the service does and tells it in the order the app handles a request", () => {
    const html = markup().replaceAll("<br/>", "");
    const order = [
      "세입자 수리 요청, 문자 대신 여기서 받아요", "세입자와 관리자가 같은 요청을 함께 봐요", "사진과 몇 가지 답이면 접수가 끝나요",
      "확인부터 업체 연결까지 이어서 처리해요", "업체는 로그인 없이 링크 하나로 일해요", "결과를 확인하면 세대마다 이력이 남아요",
      "오늘 들어온 수리 요청부터 여기서 받아 보세요",
    ];
    const at = order.map(text => html.indexOf(text));
    expect(at.every(index => index >= 0), at.join(",")).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("sends every step and every drawn screen still, without motion", () => {
    const html = markup();
    expect(html).not.toContain("data-motion=");
    for (const step of STEPS) expect(html).toContain(step);
    expect(html.match(/data-step-item="/g)).toHaveLength(9);
    expect(html.match(/data-screen="/g)).toHaveLength(9);
  });

  it("uses the app's own names and words on the drawn screens", () => {
    const html = markup();
    expect(html).toContain('data-state="progress">처리 중</span>');
    for (const words of [
      "난방 · 101동 1203호", "관리자가 처리하고 있어요.", "가스 냄새가 나나요?", "수리 요청 제출", "추가 정보 요청",
      "보안 링크를 발급했어요. 업체에 직접 전달하세요.", "작업 수락", "확정된 방문 일정", "세입자가 있을 때만 방문",
      "작업 보고를 제출했어요.", "해결됐어요",
    ]) expect(html).toContain(words);
  });

  it("names each drawing once and hides its parts from screen readers", () => {
    const html = markup();
    expect(html.match(/<figure[^>]*aria-label="[^"]+"/g)).toHaveLength(5);
    expect(html.match(/aria-hidden="true"/g)?.length).toBe(7);
  });

  it("gives every element its own id", () => {
    const ids = [...markup().matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("speaks in 해요체 (rules §10)", () => {
    expect(markup()).not.toMatch(/습니다|십시오/);
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
    // Two forms under the first scene's explanation and two in the closing entry (spec: actions in both places).
    expect(html.split('action="/api/v2/session/demo"').length-1).toBe(4);
    expect(html).toContain('value="manager"');expect(html).toContain('value="tenant"');
    expect(html).toContain("관리자로 체험하기");expect(html).toContain("세입자로 체험하기");
    expect(html).toContain("난방과 누수 두 가지");expect(html).not.toContain('href="/auth/login"');
  }finally{vi.unstubAllEnvs();}
});
