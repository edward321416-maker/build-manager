import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "./product-meta";

describe("product metadata", () => {
  it("uses the approved external product name", () => {
    expect(PRODUCT_NAME).toBe("건물 맞춤형 AI 수리 라우터");
  });
});
