import type { MouseEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BackButton, CoreNav, plainClick } from "./core-nav";
import { meRows, moreRows, VIEW_LABELS } from "./nav-config";
import { MenuList, TodoScreen, UnitsScreen } from "./nav-screens";

const noop = () => undefined;
const nav = (role: "TENANT" | "ORG_ADMIN", location: { tab: "home" | "alerts" | "more" | "me" | "work"; view: null | "maintenance" | "me" }, badge = 0) =>
  renderToStaticMarkup(<CoreNav ctx={{ role, b1: true }} location={location} badge={badge} caption="합성 조직 · 세입자" onNavigate={noop} />);

describe("main menu (rules 8.10, 8.14, 8.15, 12)", () => {
  it("is one labelled navigation with real addresses", () => {
    const html = nav("TENANT", { tab: "home", view: null });
    expect(html.match(/<nav /g)).toHaveLength(1);
    expect(html).toContain('aria-label="주 메뉴"');
    for (const href of ["/core?tab=home", "/core?tab=requests", "/core?tab=alerts", "/core?tab=me"]) expect(html).toContain(`href="${href}"`);
  });

  it("marks only the current place, with the filled icon", () => {
    const html = nav("TENANT", { tab: "alerts", view: null });
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="page"[^>]*><svg[^>]*data-icon="bell"[^>]*data-filled="true"/);
    expect(html.match(/data-filled="true"/g)).toHaveLength(1);
  });

  it("puts MY in the tab bar on phones and in the account area on wide screens", () => {
    const html = nav("TENANT", { tab: "me", view: null });
    expect(html).toMatch(/<li data-device="phone"><a href="\/core\?tab=me"[^>]*><svg[^]*?<\/svg><span[^>]*>MY<\/span>/);
    expect(html).toMatch(/data-device="wide"[^]*합성 조직 · 세입자[^]*href="\/core\?tab=me"[^>]*><svg[^]*?<\/svg><span[^>]*>MY<\/span>/);
    // Managers reach the same account entry, under the same name, from the bottom of the left menu (rules 8.10).
    expect(nav("ORG_ADMIN", { tab: "work", view: null })).toMatch(/href="\/core\?tab=more&amp;view=me"[^>]*><svg[^]*?<\/svg><span[^>]*>MY<\/span>/);
  });

  it("spreads a manager's 더 보기 rows into the left menu with their icons", () => {
    const html = nav("ORG_ADMIN", { tab: "more", view: "maintenance" });
    expect(html).toMatch(/<li data-device="phone"><a href="\/core\?tab=more"/);
    for (const [href, icon] of [["/core?tab=more&amp;view=maintenance", "file-text"], ["/core?tab=more&amp;view=invitations", "key"], ["/workspace", "layout-grid"]]) {
      expect(html).toMatch(new RegExp(`<li data-device="wide"><a href="${href.replace(/[?]/g, "\\?")}"[^>]*><svg[^>]*data-icon="${icon}"`));
    }
    expect(html).toMatch(/aria-current="page"[^>]*><svg[^>]*data-icon="file-text"/);
  });

  it("names the badge with its count and caps it at 99+", () => {
    expect(nav("TENANT", { tab: "home", view: null }, 2)).toContain('aria-label="알림, 처리할 일 2건"');
    expect(nav("TENANT", { tab: "home", view: null }, 120)).toContain(">99+</span>");
    expect(nav("TENANT", { tab: "home", view: null }, 0)).not.toContain("처리할 일");
  });

  it("gives the back button a name and hides it on wide screens for left-menu screens", () => {
    expect(renderToStaticMarkup(<BackButton wide onClick={noop} />)).toContain('aria-label="뒤로"');
    expect(renderToStaticMarkup(<BackButton wide={false} onClick={noop} />)).toContain('data-device="phone"');
  });

  it("treats only a plain, unmodified left click as an in-app navigation", () => {
    const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false } as MouseEvent;
    expect(plainClick(plain)).toBe(true);
    expect(plainClick({ ...plain, metaKey: true })).toBe(false);
    expect(plainClick({ ...plain, ctrlKey: true })).toBe(false);
    expect(plainClick({ ...plain, shiftKey: true })).toBe(false);
    expect(plainClick({ ...plain, altKey: true })).toBe(false);
    expect(plainClick({ ...plain, button: 1 })).toBe(false);
  });
});

describe("menu screens (rules 8.5, 8.11, 8.16)", () => {
  it("lists MY rows with the organisation field and logout last", () => {
    const html = renderToStaticMarkup(<MenuList label={VIEW_LABELS.me} rows={meRows({ role: "TENANT", b1: true })} organization={<select aria-label="내 소속" />} onOpen={noop} onLogout={noop} />);
    expect(html).toContain('aria-label="MY"');
    expect(html).toContain('aria-label="내 소속"');
    expect(html.lastIndexOf("로그아웃")).toBeGreaterThan(html.lastIndexOf("오픈소스 라이선스"));
    expect(html).toContain('href="/core?tab=me&amp;view=licenses"');
  });

  it("links 더 보기 rows, including the building setup page", () => {
    const html = renderToStaticMarkup(<MenuList label="더 보기" rows={moreRows({ role: "ORG_ADMIN", b1: true })} onOpen={noop} onLogout={noop} />);
    expect(html).toContain('href="/workspace"');
    expect(html).toContain('href="/core?tab=more&amp;view=me"');
  });

  it("lists 내 호실 units with their building, and says so when there are none", () => {
    const html = renderToStaticMarkup(<UnitsScreen units={[{ id: "u1", label: "101호", buildingName: "합성 건물" } as never]} />);
    expect(html).toContain('aria-label="내 호실"');
    expect(html).toContain("101호");
    expect(html).toContain("합성 건물");
    expect(renderToStaticMarkup(<UnitsScreen units={[]} />)).toContain("연결된 호실이 없어요. 관리자에게 호실 연결을 확인해 주세요.");
  });

  it("shows loading, empty, partial and filled to-do states", () => {
    const empty = { items: [], partial: false };
    expect(renderToStaticMarkup(<TodoScreen role="TENANT" list={empty} ready={false} units={[]} onOpen={noop} onRetry={noop} />)).toContain("불러오는 중이에요");
    expect(renderToStaticMarkup(<TodoScreen role="TENANT" list={empty} ready units={[]} onOpen={noop} onRetry={noop} />)).toContain("지금 처리할 일이 없어요. 새 문제가 생기면 홈에서 접수해 주세요.");
    expect(renderToStaticMarkup(<TodoScreen role="ORG_ADMIN" list={empty} ready units={[]} onOpen={noop} onRetry={noop} />)).toContain("지금 처리할 일이 없어요. 새 요청은 업무함에 들어와요.");
    const partial = renderToStaticMarkup(<TodoScreen role="TENANT" list={{ items: [], partial: true }} ready units={[]} onOpen={noop} onRetry={noop} />);
    expect(partial).toContain("일부를 확인하지 못했어요.");
    expect(partial).toContain(">다시 불러오기</button>");
    const filled = renderToStaticMarkup(<TodoScreen role="TENANT" ready onOpen={noop} onRetry={noop}
      units={[{ id: "u1", label: "101호", buildingName: "합성 건물" } as never]}
      list={{ partial: false, items: [{ ticketId: "t1", unitId: "u1", issueType: "HEATING", reasons: ["REPLY", "DRAFT"], lastActivity: "2026-10-13T01:00:00Z" }] }} />);
    expect(filled).toContain('data-todo-ticket="t1"');
    expect(filled).toContain("난방 · 101호");
    expect(filled).toContain("내 답변 필요");
    expect(filled).toContain("제출 전");
    expect(filled).toContain('dateTime="2026-10-13T01:00:00Z"');
  });

  it("locks every to-do row while the screen is busy or holds unsent photos, like the 요청 rows", () => {
    const list = { partial: false, items: (["t1", "t2"] as const).map(ticketId => ({ ticketId, unitId: "u1", issueType: "LEAK" as const, reasons: ["REPLY" as const], lastActivity: null })) };
    const rows = (html: string) => html.match(/<button[^>]*data-todo-ticket="[^"]*"[^>]*>/g) ?? [];
    const locked = rows(renderToStaticMarkup(<TodoScreen role="TENANT" list={list} ready units={[]} disabled onOpen={noop} onRetry={noop} />));
    expect(locked).toHaveLength(2);
    for (const row of locked) expect(row).toMatch(/\sdisabled=""/);
    const open = rows(renderToStaticMarkup(<TodoScreen role="TENANT" list={list} ready units={[]} onOpen={noop} onRetry={noop} />));
    expect(open).toHaveLength(2);
    for (const row of open) expect(row).not.toContain("disabled");
  });
});
