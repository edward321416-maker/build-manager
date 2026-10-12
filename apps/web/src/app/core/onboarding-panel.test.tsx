// @vitest-environment jsdom
import type { InvitationDto } from "@build-manager/api-contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingPanel } from "./onboarding-panel";

const own = vi.hoisted(() => ({ items: [] as InvitationDto[] }));
vi.mock("@build-manager/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@build-manager/api-client")>();
  const empty = { items: [], nextCursor: null };
  return {
    ...actual,
    createCoreOnboardingClient: () => ({
      mine: async () => ({ items: own.items, nextCursor: null }),
      list: async () => empty,
      units: async () => empty,
    }),
  };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const noop = () => {};
const request: InvitationDto = {
  invitationId: "11111111-1111-4111-8111-111111111111", requestNumber: "22222222-2222-4222-8222-222222222222",
  unitId: "33333333-3333-4333-8333-333333333333", buildingId: "44444444-4444-4444-8444-444444444444",
  buildingName: "합성 건물", unitLabel: "합성 호실", state: "REQUESTED", createdAt: "2026-10-12T00:00:00Z",
  expiresAt: "2026-10-13T00:00:00Z", requestedAt: "2026-10-12T00:10:00Z", decidedAt: null,
};
let root: Root | undefined, host: HTMLDivElement | undefined;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  host?.remove(); root = undefined; host = undefined; own.items = [];
});
async function mount(manager: boolean) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => { root!.render(<OnboardingPanel csrf="synthetic-csrf" orgId={manager ? "synthetic-org" : undefined} manager={manager} onRefreshAccess={noop} onDenied={noop} />); });
  await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
  return host.textContent ?? "";
}

describe("onboarding panel sections by role", () => {
  it("does not show a manager the tenant's own-request section while the manager has no request of their own", async () => {
    const text = await mount(true);
    expect(text).toContain("입주 연결");
    expect(text).not.toContain("내 연결 요청");
    expect(text).not.toContain("아직 신청한 연결이 없어요");
  });

  it("still shows a manager their own connection request and its confirmation number", async () => {
    own.items = [request];
    const text = await mount(true);
    expect(text).toContain("내 연결 요청");
    expect(text).toContain(request.requestNumber!);
  });

  it("keeps the own-request section and its empty guidance for a person who is not a manager", () => {
    const html = renderToStaticMarkup(<OnboardingPanel csrf="synthetic-csrf" manager={false} onRefreshAccess={noop} onDenied={noop} />);
    expect(html).toContain("내 연결 요청");
    expect(html).toContain("아직 신청한 연결이 없어요");
  });
});
