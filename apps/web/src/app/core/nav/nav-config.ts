import type { CoreSessionDto } from "@build-manager/api-contracts";

// P5 (docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md §1): one menu definition per role draws the phone
// tab bar, the wide-screen left menu, the 더 보기 and 내 정보 lists and the address check (design rules 8.10, 8.14, 8.16).
export type CoreRole = CoreSessionDto["role"];
export type TabId = "home" | "requests" | "alerts" | "me" | "work" | "more";
export type ViewId = "units" | "link" | "licenses" | "maintenance" | "invitations" | "me";
export type NavIconName = "home" | "clipboard-list" | "bell" | "user" | "dots" | "file-text" | "key" | "layout-grid";
export type NavLocation = { tab: TabId; view: ViewId | null };
/** `b1`: signed in through the login flow, which alone has organisations and move-in links. */
export type NavContext = { role: CoreRole; b1: boolean };
export type NavTab = { id: TabId; label: string; icon: NavIconName };
export type MenuRow =
  | { kind: "view"; label: string; to: NavLocation; icon?: NavIconName }
  | { kind: "href"; label: string; href: string; icon: NavIconName }
  | { kind: "organization"; label: string }
  | { kind: "logout"; label: string };

const TENANT_TABS: readonly NavTab[] = [
  { id: "home", label: "우리 집", icon: "home" },
  { id: "requests", label: "내 요청", icon: "clipboard-list" },
  { id: "alerts", label: "알림", icon: "bell" },
  { id: "me", label: "내 정보", icon: "user" },
];
const MANAGER_TABS: readonly NavTab[] = [
  { id: "work", label: "업무함", icon: "clipboard-list" },
  { id: "alerts", label: "알림", icon: "bell" },
  { id: "more", label: "더 보기", icon: "dots" },
];
export const VIEW_LABELS: Record<ViewId, string> = {
  units: "내 호실", link: "호실 연결", licenses: "오픈소스 라이선스", maintenance: "호실 정비 이력", invitations: "입주 연결", me: "내 정보",
};

export const isTenant = (role: CoreRole) => role === "TENANT";
export const roleName = (role: CoreRole) => role === "TENANT" ? "세입자" : role === "ORG_ADMIN" ? "조직 관리자" : "건물 담당자";
export const navTabs = (role: CoreRole): readonly NavTab[] => isTenant(role) ? TENANT_TABS : MANAGER_TABS;
export const firstTab = (role: CoreRole): TabId => isTenant(role) ? "home" : "work";
/** Row screens hang under 내 정보 for the tenant and under 더 보기 for managers. */
export const rowTab = (role: CoreRole): TabId => isTenant(role) ? "me" : "more";
/** 내 정보 is the tenant's last tab and the last 더 보기 row for managers (rules 8.14). */
export const accountLocation = (role: CoreRole): NavLocation => isTenant(role) ? { tab: "me", view: null } : { tab: "more", view: "me" };

/** 더 보기 rows, top to bottom. Rows with an icon are also spread into the wide-screen left menu (rules 8.10, spec D9). */
export function moreRows(ctx: NavContext): MenuRow[] {
  if (isTenant(ctx.role)) return [];
  const rows: MenuRow[] = [{ kind: "view", label: VIEW_LABELS.maintenance, to: { tab: "more", view: "maintenance" }, icon: "file-text" }];
  // Move-in links and building setup exist only behind the login flow, and only an organisation admin manages them.
  if (ctx.role === "ORG_ADMIN" && ctx.b1) {
    rows.push({ kind: "view", label: VIEW_LABELS.invitations, to: { tab: "more", view: "invitations" }, icon: "key" });
    rows.push({ kind: "href", label: "건물·호실 관리", href: "/workspace", icon: "layout-grid" });
  }
  rows.push({ kind: "view", label: VIEW_LABELS.me, to: { tab: "more", view: "me" } });
  return rows;
}

/** 내 정보 rows (rules 8.16), top to bottom; 로그아웃 is always last. */
export function meRows(ctx: NavContext): MenuRow[] {
  const at = (view: ViewId): NavLocation => ({ tab: rowTab(ctx.role), view });
  const rows: MenuRow[] = [];
  if (isTenant(ctx.role)) rows.push({ kind: "view", label: VIEW_LABELS.units, to: at("units") });
  if (ctx.b1) rows.push({ kind: "organization", label: "내 소속" });
  if (isTenant(ctx.role) && ctx.b1) rows.push({ kind: "view", label: VIEW_LABELS.link, to: at("link") });
  rows.push({ kind: "view", label: VIEW_LABELS.licenses, to: at("licenses") });
  rows.push({ kind: "logout", label: "로그아웃" });
  return rows;
}

const viewsOf = (rows: MenuRow[]) => rows.flatMap(row => row.kind === "view" && row.to.view ? [row.to.view] : []);
/** Row screens this role may open; anything else in the address is dropped (spec §3). */
export const allowedViews = (ctx: NavContext): ViewId[] => [...new Set([...viewsOf(moreRows(ctx)), ...viewsOf(meRows(ctx))])];

/** Row screens the left menu lists are first screens on wide screens, so they get no back button there (rules 8.10). */
export function inLeftMenu(ctx: NavContext, view: ViewId): boolean {
  if (view === "me") return !isTenant(ctx.role);
  return moreRows(ctx).some(row => row.kind === "view" && row.to.view === view && row.icon !== undefined);
}

/** One step up: a manager's 내 정보 rows go back to 내 정보, every other row screen to its tab's first screen. */
export function parentOf(ctx: NavContext, location: NavLocation): NavLocation {
  if (!location.view) return location;
  const underMe = !isTenant(ctx.role) && location.view !== "me" && viewsOf(meRows(ctx)).includes(location.view);
  return underMe ? { tab: "more", view: "me" } : { tab: location.tab, view: null };
}

/** The top bar's screen name (spec §2): the row name on a row screen, otherwise the tab name. */
export function navTitle(role: CoreRole, location: NavLocation): string {
  if (location.view) return VIEW_LABELS[location.view];
  return navTabs(role).find(tab => tab.id === location.tab)?.label ?? "";
}
