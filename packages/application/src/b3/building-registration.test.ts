import { describe, expect, test, vi } from "vitest";
import { B3Error } from "./errors";
import {
  canCreateOrganizationProperty,
  createOrganizationProperty,
  createPropertyUnit,
  listPropertyUnits,
} from "./building-registration";
import type { B3Dependencies } from "./ports";

const digest = "a".repeat(64);
const orgId = "018f3f1e-7b1a-7c2f-8d4e-123456789abc";
const propertyId = "018f3f1e-7b1a-7c2f-8d4e-123456789abd";

function deps(): B3Dependencies {
  return {
    sessions: { currentActor: vi.fn(async () => ({ userId: orgId })), revoke: vi.fn(async () => undefined) },
    registration: {
      createProperty: vi.fn(async (_d,_o,input) => ({ id: propertyId, orgId, addressReference: input.addressReference })),
      createUnit: vi.fn(async (_d,_o,p,input) => ({ id: orgId, orgId, propertyId:p, label:input.label })),
      canCreateProperty: vi.fn(async () => false),
      canCreateUnit: vi.fn(async () => false),
    },
    units: {
      listUnits: vi.fn(async () => ({ items: [], nextCursor: null })),
      getUnit: vi.fn(async () => ({ id: orgId, orgId, propertyId, label:"101" })),
    },
  };
}

describe("B3 application use cases", () => {
  test("rejects malformed digest before any B3 port call", async () => {
    const d=deps();
    await expect(createOrganizationProperty(d,"BAD",orgId,{addressReference:"synthetic"})).rejects.toMatchObject({code:"UNAUTHENTICATED"});
    expect(d.registration.createProperty).not.toHaveBeenCalled();
  });

  test("rejects absent current actor before any B3 port call", async () => {
    const d=deps();
    vi.mocked(d.sessions.currentActor).mockResolvedValueOnce(null);
    await expect(createOrganizationProperty(d,digest,orgId,{addressReference:"synthetic"})).rejects.toMatchObject({code:"UNAUTHENTICATED"});
    expect(d.registration.createProperty).not.toHaveBeenCalled();
  });

  test("rejects invalid selectors and operator text before ports", async () => {
    const d=deps();
    await expect(createOrganizationProperty(d,digest,"NOT-UUID",{addressReference:"synthetic"})).rejects.toMatchObject({code:"INVALID_INPUT"});
    await expect(createPropertyUnit(d,digest,orgId,propertyId,{label:" bad "})).rejects.toMatchObject({code:"INVALID_INPUT"});
    expect(d.registration.createProperty).not.toHaveBeenCalled();
    expect(d.registration.createUnit).not.toHaveBeenCalled();
  });

  test("preserves B3 port error categories", async () => {
    for (const code of ["NOT_FOUND","FORBIDDEN","CONFLICT","DEPENDENCY_UNAVAILABLE"] as const) {
      const d=deps();
      vi.mocked(d.registration.createProperty).mockRejectedValueOnce(new B3Error(code));
      await expect(createOrganizationProperty(d,digest,orgId,{addressReference:"synthetic"})).rejects.toMatchObject({code});
    }
  });

  test("forwards page exactly and keeps false capability as false", async () => {
    const d=deps();
    const page={after:propertyId,limit:17};
    await expect(listPropertyUnits(d,digest,orgId,propertyId,page)).resolves.toEqual({items:[],nextCursor:null});
    expect(d.units.listUnits).toHaveBeenCalledWith(digest,orgId,propertyId,page);
    await expect(canCreateOrganizationProperty(d,digest,orgId)).resolves.toBe(false);
  });
});
