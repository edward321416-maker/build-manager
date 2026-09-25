import { describe, expect, test } from "vitest";
import {
  B1PropertySchema,
  B3ErrorSchema,
  B3PropertyCreateSchema,
  B3UnitCreateSchema,
  B3UnitSchema,
} from "./index";

const uuid = "018f3f1e-7b1a-7c2f-8d4e-123456789abc";

describe("B3 contracts", () => {
  test("enforces Property reference operator-text boundaries", () => {
    expect(B3PropertyCreateSchema.safeParse({ addressReference: "" }).success).toBe(false);
    expect(B3PropertyCreateSchema.safeParse({ addressReference: "가".repeat(512) }).success).toBe(true);
    expect(B3PropertyCreateSchema.safeParse({ addressReference: "가".repeat(513) }).success).toBe(false);
    expect(B3PropertyCreateSchema.safeParse({ addressReference: "😀".repeat(512) }).success).toBe(true);
    expect(B3PropertyCreateSchema.safeParse({ addressReference: " synthetic " }).success).toBe(false);
    expect(B3PropertyCreateSchema.safeParse({ addressReference: "a\u0000b" }).success).toBe(false);
    expect(B3PropertyCreateSchema.safeParse({ addressReference: "a\u0085b" }).success).toBe(false);
    expect(B3PropertyCreateSchema.safeParse({ addressReference: "\ud800" }).success).toBe(false);
    expect(B3PropertyCreateSchema.safeParse({ addressReference: "\udc00" }).success).toBe(false);
  });

  test("enforces Unit label boundaries while preserving case", () => {
    expect(B3UnitCreateSchema.safeParse({ label: "가".repeat(80) }).success).toBe(true);
    expect(B3UnitCreateSchema.safeParse({ label: "😀".repeat(80) }).success).toBe(true);
    expect(B3UnitCreateSchema.safeParse({ label: "😀".repeat(81) }).success).toBe(false);
    expect(B3UnitCreateSchema.safeParse({ label: "A-101" }).data).toEqual({ label: "A-101" });
    expect(B3UnitCreateSchema.safeParse({ label: " A-101" }).success).toBe(false);
  });

  test("rejects unknown and server-owned body fields and scalar substitutes", () => {
    for (const extra of ["id","orgId","propertyId","status","role","createdAt","assignment","userId"]) {
      expect(B3PropertyCreateSchema.safeParse({ addressReference: "synthetic", [extra]: "x" }).success).toBe(false);
      expect(B3UnitCreateSchema.safeParse({ label: "101", [extra]: "x" }).success).toBe(false);
    }
    expect(B3PropertyCreateSchema.safeParse({ addressReference: { nested: "x" } }).success).toBe(false);
    for (const body of [null, [], 1, true, "synthetic"]) {
      expect(B3PropertyCreateSchema.safeParse(body).success).toBe(false);
      expect(B3UnitCreateSchema.safeParse(body).success).toBe(false);
    }
  });

  test("keeps B1 Property output nullable and B3 Unit output narrow", () => {
    expect(B1PropertySchema.parse({ id: uuid, orgId: uuid, addressReference: null }).addressReference).toBeNull();
    const unit = B3UnitSchema.parse({ id: uuid, orgId: uuid, propertyId: uuid, label: "101" });
    expect(Object.keys(unit).sort()).toEqual(["id","label","orgId","propertyId"].sort());
    expect(B3UnitSchema.safeParse({ ...unit, status: "ACTIVE" }).success).toBe(false);
  });

  test("exposes exactly the eight B3 public error codes", () => {
    const codes = [
      "UNAUTHENTICATED","FORBIDDEN","NOT_FOUND","INVALID_INPUT",
      "CONFLICT","PAYLOAD_TOO_LARGE","DEPENDENCY_UNAVAILABLE","METHOD_NOT_ALLOWED",
    ] as const;
    for (const error of codes) expect(B3ErrorSchema.safeParse({ error }).success).toBe(true);
    expect(B3ErrorSchema.safeParse({ error: "AUTHENTICATION_REJECTED" }).success).toBe(false);
  });
});
