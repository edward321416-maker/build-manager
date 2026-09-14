import { describe, expect, it } from "vitest";
import { productName } from "@/lib/product-meta";

describe("product metadata", () => {
  it("uses the approved external product name", () => {
    expect(productName).toBe("건물 맞춤형 AI 수리 라우터");
  });
});
