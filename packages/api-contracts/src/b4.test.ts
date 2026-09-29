import { describe, expect, it } from "vitest";
import { B4AssignmentStateSchema, B4ErrorSchema } from "./index";

describe("B4 exact public relationship contract", () => {
  it("accepts only the positive current-state projection", () => {
    expect(B4AssignmentStateSchema.parse({ assigned: true })).toEqual({ assigned: true });
  });
  it.each([
    {}, { assigned: false }, { assigned: "true" },
    ...["extra", "assignmentId", "role", "userId", "status", "created_at", "ended_at"]
      .map((key) => ({ assigned: true, [key]: "synthetic" })),
  ])("rejects non-state or authority/history input %j", (value) => {
    expect(B4AssignmentStateSchema.safeParse(value).success).toBe(false);
  });
  it("allows exactly the seven fixed sanitized errors", () => {
    expect(B4ErrorSchema.shape.error.options).toEqual([
      "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "INVALID_INPUT",
      "PAYLOAD_TOO_LARGE", "DEPENDENCY_UNAVAILABLE", "METHOD_NOT_ALLOWED",
    ]);
    for (const error of B4ErrorSchema.shape.error.options) {
      expect(B4ErrorSchema.parse({ error })).toEqual({ error });
      expect(B4ErrorSchema.safeParse({ error, detail: "internal" }).success).toBe(false);
    }
    expect(B4ErrorSchema.safeParse({ error: "CONFLICT" }).success).toBe(false);
  });
});
