import { describe, expect, it } from "vitest";
import { navHref, parseNavLocation, sameLocation } from "./nav-location";

const tenant = { role: "TENANT", b1: true } as const, admin = { role: "ORG_ADMIN", b1: true } as const, staff = { role: "PROPERTY_STAFF", b1: true } as const;

describe("menu address (P5 spec §3)", () => {
  it("reads a valid tab and row screen", () => {
    expect(parseNavLocation("?tab=alerts", tenant)).toEqual({ tab: "alerts", view: null });
    expect(parseNavLocation("?tab=more&view=invitations", admin)).toEqual({ tab: "more", view: "invitations" });
    expect(parseNavLocation("?tab=me&view=units", tenant)).toEqual({ tab: "me", view: "units" });
  });

  it("falls back to the role's first tab for a missing, unknown or other-role tab, without an error", () => {
    expect(parseNavLocation("", tenant)).toEqual({ tab: "home", view: null });
    expect(parseNavLocation("?tab=..%2F..%2Fx", admin)).toEqual({ tab: "work", view: null });
    expect(parseNavLocation("?tab=work", tenant)).toEqual({ tab: "home", view: null });
    expect(parseNavLocation("?tab=home", admin)).toEqual({ tab: "work", view: null });
  });

  it("drops a row screen outside its tab or hidden from the role", () => {
    expect(parseNavLocation("?tab=alerts&view=licenses", tenant)).toEqual({ tab: "alerts", view: null });
    expect(parseNavLocation("?tab=more&view=invitations", staff)).toEqual({ tab: "more", view: null });
    expect(parseNavLocation("?tab=me&view=maintenance", tenant)).toEqual({ tab: "me", view: null });
    expect(parseNavLocation("?tab=more&view=invitations", { role: "ORG_ADMIN", b1: false })).toEqual({ tab: "more", view: null });
  });

  it("writes the address back the way it reads it", () => {
    expect(navHref({ tab: "home", view: null })).toBe("/core?tab=home");
    expect(navHref({ tab: "more", view: "me" })).toBe("/core?tab=more&view=me");
    for (const search of ["?tab=requests", "?tab=me&view=units"]) expect(navHref(parseNavLocation(search, tenant))).toBe("/core" + search);
    expect(sameLocation({ tab: "me", view: null }, { tab: "me", view: null })).toBe(true);
    expect(sameLocation({ tab: "me", view: null }, { tab: "me", view: "units" })).toBe(false);
  });
});
