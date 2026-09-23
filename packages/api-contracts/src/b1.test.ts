import { describe, expect, it } from "vitest";
import { B1PageQuerySchema } from "./b1";
describe("B1 R04 request authority and pagination", () => {
  it("rejects client user, role and org authority instead of stripping it", () => {
    for (const key of ["userId", "role", "orgId", "connection"]) {
      expect(B1PageQuerySchema.safeParse({ [key]: "synthetic" }).success).toBe(false);
    }
  });
  it("bounds pagination and validates the cursor", () => {
    for (const limit of [0, 51, 1.5, "bad"]) expect(B1PageQuerySchema.safeParse({ limit }).success).toBe(false);
    expect(B1PageQuerySchema.safeParse({ after: "not-a-uuid" }).success).toBe(false);
  });
  it("accepts a default page and bounded numeric URL input", () => {
    expect(B1PageQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(B1PageQuerySchema.parse({ limit: "50" })).toEqual({ limit: 50 });
  });
});
