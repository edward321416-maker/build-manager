import { describe, expect, it, vi } from "vitest";
import {
  B4Error, getPropertyStaffAssignment, ensurePropertyStaffAssignment,
  endPropertyStaffAssignment, type B4Dependencies,
} from "../index";

const digest = "a".repeat(64);
const org = "11111111-1111-4111-8111-111111111111";
const property = "22222222-2222-4222-8222-222222222222";
const membership = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function dependencies(): B4Dependencies {
  return {
    sessions: { currentActor: vi.fn(async () => ({ userId: "synthetic" })), revoke: vi.fn() },
    assignments: {
      getCurrent: vi.fn(async () => ({ assigned: true as const })),
      ensureCurrent: vi.fn(async () => ({ assigned: true as const, created: true })),
      endCurrent: vi.fn(async () => {}),
    },
  };
}

describe("B4 use cases reject forged input and delegate once", () => {
  for (const [method, port] of [
    [getPropertyStaffAssignment, "getCurrent"],
    [ensurePropertyStaffAssignment, "ensureCurrent"],
    [endPropertyStaffAssignment, "endCurrent"],
  ] as const) {
    it.each(["", "a".repeat(63), "A".repeat(64), "g".repeat(64)])(`${port}: rejects digest %s`, async (bad) => {
      const d = dependencies();
      await expect(method(d, bad, org, property, membership)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
      expect(d.sessions.currentActor).not.toHaveBeenCalled();
      expect(d.assignments[port]).not.toHaveBeenCalled();
    });
    it.each([0, 1, 2])(`${port}: rejects malformed resource id at %i`, async (index) => {
      for (const bad of ["", "not-a-uuid", membership.toUpperCase(), `${org} `]) {
        const d = dependencies();
        const ids: [string, string, string] = [org, property, membership];
        ids[index] = bad;
        await expect(method(d, digest, ...ids)).rejects.toMatchObject({ code: "INVALID_INPUT" });
        expect(d.assignments[port]).not.toHaveBeenCalled();
      }
    });
    it(`${port}: refuses missing current actor`, async () => {
      const d = dependencies();
      vi.mocked(d.sessions.currentActor).mockResolvedValue(null);
      await expect(method(d, digest, org, property, membership)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
      expect(d.assignments[port]).not.toHaveBeenCalled();
    });
    it(`${port}: preserves exact resource arguments and never retries a denied write`, async () => {
      const d = dependencies();
      const denied = new B4Error("NOT_FOUND");
      vi.mocked(d.assignments[port]).mockRejectedValue(denied);
      await expect(method(d, digest, org, property, membership)).rejects.toBe(denied);
      expect(d.assignments[port]).toHaveBeenCalledExactlyOnceWith(digest, org, property, membership);
    });
  }
  it("preserves positive state, created/no-op distinction and void end result", async () => {
    const d = dependencies();
    await expect(getPropertyStaffAssignment(d, digest, org, property, membership)).resolves.toEqual({ assigned: true });
    await expect(ensurePropertyStaffAssignment(d, digest, org, property, membership)).resolves.toEqual({ assigned: true, created: true });
    vi.mocked(d.assignments.ensureCurrent).mockResolvedValue({ assigned: true, created: false });
    await expect(ensurePropertyStaffAssignment(d, digest, org, property, membership)).resolves.toEqual({ assigned: true, created: false });
    await expect(endPropertyStaffAssignment(d, digest, org, property, membership)).resolves.toBeUndefined();
  });
});
