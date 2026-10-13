"use client";
import type { MouseEvent } from "react";
import { accountLocation, isTenant, moreRows, navTabs, type NavContext, type NavIconName, type NavLocation } from "./nav-config";
import { navHref } from "./nav-location";
import { NavIcon } from "./nav-icons";
import styles from "./core-nav.module.css";

/** A plain left click stays on this page; a modified click (new tab, new window) follows the real address. */
export const plainClick = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
const count = (n: number) => n > 99 ? "99+" : String(n);

/** The one `<nav aria-label="주 메뉴">` (rules 12): the bottom tab bar up to 767px and the 248px left menu from 768px
 * (rules 8.10, 8.14). Items marked `data-device` show at one width only, so the same names keep the same order. */
export function CoreNav({ ctx, location, badge, caption, onNavigate }: {
  ctx: NavContext; location: NavLocation; badge: number; caption: string; onNavigate(next: NavLocation): void;
}) {
  const tenant = isTenant(ctx.role);
  const accountCurrent = tenant ? location.tab === "me" : location.tab === "more" && (location.view === "me" || location.view === "licenses");
  const item = (key: string, to: NavLocation, label: string, icon: NavIconName, current: boolean, device?: "phone" | "wide", n = 0) =>
    <li key={key} data-device={device}>
      <a href={navHref(to)} aria-current={current ? "page" : undefined} aria-label={n ? `${label}, 처리할 일 ${n}건` : undefined}
        onClick={event => { if (plainClick(event)) { event.preventDefault(); onNavigate(to); } }}>
        <NavIcon name={icon} filled={current} /><span className={styles.label}>{label}</span>
        {n ? <span className={styles.badge} aria-hidden="true">{count(n)}</span> : null}
      </a>
    </li>;
  return <nav aria-label="주 메뉴" className={styles.nav}>
    <ul className={styles.items}>
      {navTabs(ctx.role).map(tab => item(tab.id, { tab: tab.id, view: null }, tab.label, tab.icon,
        location.tab === tab.id && (tab.id !== "more" || location.view === null),
        tab.id === "me" || tab.id === "more" ? "phone" : undefined, tab.id === "alerts" ? badge : 0))}
      {moreRows(ctx).map(row => row.kind === "view" && row.icon && row.to.view
        ? item(row.to.view, row.to, row.label, row.icon, location.tab === "more" && location.view === row.to.view, "wide")
        : row.kind === "href" ? <li key={row.href} data-device="wide"><a href={row.href}><NavIcon name={row.icon} /><span className={styles.label}>{row.label}</span></a></li> : null)}
    </ul>
    <div className={styles.account} data-device="wide">
      <p className={styles.caption}>{caption}</p>
      <ul className={styles.items}>{item("account", accountLocation(ctx.role), "내 정보", "user", accountCurrent)}</ul>
    </div>
  </nav>;
}

/** The top bar's back button (rules 8.10): a 24px chevron in a 50px target. `wide={false}` hides it from 768px, where the
 * left menu lists the screen and it is a first screen. */
export function BackButton({ onClick, disabled, wide }: { onClick(): void; disabled?: boolean; wide: boolean }) {
  return <button type="button" className={styles.back} aria-label="뒤로" disabled={disabled} data-device={wide ? undefined : "phone"} onClick={onClick}><NavIcon name="chevron-left" /></button>;
}
