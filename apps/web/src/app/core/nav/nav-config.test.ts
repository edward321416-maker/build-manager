import { describe, expect, it } from "vitest";
import { accountLocation, allowedViews, firstTab, inLeftMenu, meRows, moreRows, navTabs, navTitle, parentOf, roleName, type CoreRole } from "./nav-config";

const ctx = (role: CoreRole, b1 = true) => ({ role, b1 });

describe("menu definition (P5 spec §1)", () => {
  it("gives the tenant four tabs and managers three, in the decided order", () => {
    expect(navTabs("TENANT").map(tab => tab.label)).toEqual(["우리 집", "내 요청", "알림", "내 정보"]);
    expect(navTabs("ORG_ADMIN").map(tab => tab.label)).toEqual(["업무함", "알림", "더 보기"]);
    expect(navTabs("PROPERTY_STAFF")).toEqual(navTabs("ORG_ADMIN"));
    expect(navTabs("TENANT").map(tab => tab.icon)).toEqual(["home", "clipboard-list", "bell", "user"]);
    expect(navTabs("ORG_ADMIN").map(tab => tab.icon)).toEqual(["clipboard-list", "bell", "dots"]);
  });

  it("keeps 3–5 tabs and labels within four characters (rules 8.14)", () => {
    for (const role of ["TENANT", "ORG_ADMIN"] as const) {
      const tabs = navTabs(role);
      expect(tabs.length).toBeGreaterThanOrEqual(3);
      expect(tabs.length).toBeLessThanOrEqual(5);
      for (const tab of tabs) expect([...tab.label].length).toBeLessThanOrEqual(4);
    }
  });

  it("starts each role on its first tab and puts 내 정보 last (rules 8.14)", () => {
    expect(firstTab("TENANT")).toBe("home");
    expect(firstTab("PROPERTY_STAFF")).toBe("work");
    expect(accountLocation("TENANT")).toEqual({ tab: "me", view: null });
    expect(accountLocation("ORG_ADMIN")).toEqual({ tab: "more", view: "me" });
    expect(moreRows(ctx("ORG_ADMIN")).at(-1)?.label).toBe("내 정보");
  });

  it("shows move-in links and building setup only to organisation admins after login", () => {
    expect(moreRows(ctx("ORG_ADMIN")).map(row => row.label)).toEqual(["호실 정비 이력", "입주 연결", "건물·호실 관리", "내 정보"]);
    expect(moreRows(ctx("PROPERTY_STAFF")).map(row => row.label)).toEqual(["호실 정비 이력", "내 정보"]);
    expect(moreRows(ctx("ORG_ADMIN", false)).map(row => row.label)).toEqual(["호실 정비 이력", "내 정보"]);
    expect(moreRows(ctx("TENANT"))).toEqual([]);
    expect(moreRows(ctx("ORG_ADMIN")).flatMap(row => "icon" in row && row.icon ? [row.icon] : [])).toEqual(["file-text", "key", "layout-grid"]);
  });

  it("lists 내 정보 with the licence notice for every role and logout last (rules 8.13, 8.16)", () => {
    expect(meRows(ctx("TENANT")).map(row => row.label)).toEqual(["내 호실", "내 소속", "호실 연결", "오픈소스 라이선스", "로그아웃"]);
    expect(meRows(ctx("ORG_ADMIN")).map(row => row.label)).toEqual(["내 소속", "오픈소스 라이선스", "로그아웃"]);
    expect(meRows(ctx("TENANT", false)).map(row => row.label)).toEqual(["내 호실", "오픈소스 라이선스", "로그아웃"]);
    expect(meRows(ctx("PROPERTY_STAFF", false)).map(row => row.label)).toEqual(["오픈소스 라이선스", "로그아웃"]);
  });

  it("knows which row screens a role may open", () => {
    expect(allowedViews(ctx("TENANT"))).toEqual(["units", "link", "licenses"]);
    expect(allowedViews(ctx("ORG_ADMIN"))).toEqual(["maintenance", "invitations", "me", "licenses"]);
    expect(allowedViews(ctx("PROPERTY_STAFF"))).toEqual(["maintenance", "me", "licenses"]);
  });

  it("treats left-menu rows as first screens on wide screens and the rest as sub-screens (rules 8.10)", () => {
    expect(inLeftMenu(ctx("ORG_ADMIN"), "maintenance")).toBe(true);
    expect(inLeftMenu(ctx("ORG_ADMIN"), "invitations")).toBe(true);
    expect(inLeftMenu(ctx("ORG_ADMIN"), "me")).toBe(true);
    expect(inLeftMenu(ctx("ORG_ADMIN"), "licenses")).toBe(false);
    expect(inLeftMenu(ctx("TENANT"), "units")).toBe(false);
  });

  it("goes one step up from a row screen", () => {
    expect(parentOf(ctx("TENANT"), { tab: "me", view: "licenses" })).toEqual({ tab: "me", view: null });
    expect(parentOf(ctx("ORG_ADMIN"), { tab: "more", view: "licenses" })).toEqual({ tab: "more", view: "me" });
    expect(parentOf(ctx("ORG_ADMIN"), { tab: "more", view: "me" })).toEqual({ tab: "more", view: null });
    expect(parentOf(ctx("ORG_ADMIN"), { tab: "more", view: "maintenance" })).toEqual({ tab: "more", view: null });
  });

  it("names screens and roles", () => {
    expect(navTitle("TENANT", { tab: "alerts", view: null })).toBe("알림");
    expect(navTitle("ORG_ADMIN", { tab: "more", view: "invitations" })).toBe("입주 연결");
    expect(["TENANT", "ORG_ADMIN", "PROPERTY_STAFF"].map(role => roleName(role as CoreRole))).toEqual(["세입자", "조직 관리자", "건물 담당자"]);
  });
});
