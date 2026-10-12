import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OnboardingPanel } from "./onboarding-panel";

const noop = () => {};

describe("onboarding panel sections by role", () => {
  it("does not show a manager the tenant's own-request section while the manager has no request of their own", () => {
    const html = renderToStaticMarkup(<OnboardingPanel csrf="synthetic-csrf" orgId="synthetic-org" manager onRefreshAccess={noop} onDenied={noop} />);
    expect(html).toContain("입주 연결");
    expect(html).not.toContain("내 연결 요청");
    expect(html).not.toContain("아직 신청한 연결이 없습니다");
  });

  it("keeps the own-request section and its empty guidance for a person who is not a manager", () => {
    const html = renderToStaticMarkup(<OnboardingPanel csrf="synthetic-csrf" manager={false} onRefreshAccess={noop} onDenied={noop} />);
    expect(html).toContain("내 연결 요청");
    expect(html).toContain("아직 신청한 연결이 없습니다");
  });
});
