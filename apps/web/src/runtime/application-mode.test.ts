import { expect, it } from "vitest";
import { parseApplicationMode } from "./application-mode";
it("R10 refuses missing or unknown mode instead of demo fallback", () => {
  for (const value of [undefined, "", "production", "b1", " B1", "DEMO "]) expect(parseApplicationMode(value)).toBeNull();
});
it("accepts only explicit DEMO or B1", () => {
  expect(parseApplicationMode("DEMO")).toBe("DEMO");
  expect(parseApplicationMode("B1")).toBe("B1");
});
