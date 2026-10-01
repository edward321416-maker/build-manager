import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { B5Error } from "./errors";
import { endOrganizationMembership } from "./membership-termination";
import type { B5Dependencies } from "./ports";

const digest="a".repeat(64),org=randomUUID(),member=randomUUID();
function deps(): B5Dependencies {
  return {sessions:{currentActor:vi.fn().mockResolvedValue({userId:randomUUID()}),revoke:vi.fn()},
    memberships:{endCurrent:vi.fn().mockResolvedValue(undefined)}};
}
describe("B5 application",()=>{
  it("delegates exactly once and returns no identity",async()=>{
    const d=deps(); expect(await endOrganizationMembership(d,digest,org,member)).toBeUndefined();
    expect(d.sessions.currentActor).toHaveBeenCalledExactlyOnceWith(digest);
    expect(d.memberships.endCurrent).toHaveBeenCalledExactlyOnceWith(digest,org,member);
  });
  it.each([["Z".repeat(64),org,member],[digest,org.toUpperCase(),member],[digest,org,"x"],["",org,member]])("rejects noncanonical selectors before session/command",async(digest,org,member)=>{
    const d=deps(); await expect(endOrganizationMembership(d,digest,org,member)).rejects.toMatchObject({code:"INVALID_INPUT"});
    expect(d.sessions.currentActor).not.toHaveBeenCalled(); expect(d.memberships.endCurrent).not.toHaveBeenCalled();
  });
  it("rejects missing actor",async()=>{
    const d=deps(); vi.mocked(d.sessions.currentActor).mockResolvedValue(null);
    await expect(endOrganizationMembership(d,digest,org,member)).rejects.toMatchObject({code:"UNAUTHENTICATED"});
    expect(d.memberships.endCurrent).not.toHaveBeenCalled();
  });
  it.each(["NOT_FOUND","FORBIDDEN","CONFLICT","DEPENDENCY_UNAVAILABLE"] as const)("preserves sanitized %s",async code=>{
    const d=deps(); vi.mocked(d.memberships.endCurrent).mockRejectedValue(new B5Error(code));
    await expect(endOrganizationMembership(d,digest,org,member)).rejects.toEqual(new B5Error(code));
  });
  it("sanitizes unexpected precheck failures",async()=>{
    const d=deps(); vi.mocked(d.sessions.currentActor).mockRejectedValue(new Error("private failure"));
    await expect(endOrganizationMembership(d,digest,org,member)).rejects.toEqual(new B5Error("DEPENDENCY_UNAVAILABLE"));
  });
});
