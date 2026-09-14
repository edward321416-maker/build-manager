import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("root page", () => {
  it("introduces the product and links to the synthetic demo", () => {
    const html = renderToStaticMarkup(createElement(Home));

    expect(html).toContain("건물 맞춤형 AI 수리 라우터");
    expect(html).toContain("주소가 수리 프로토콜이 된다");
    expect(html).toContain('href="/demo"');
  });
});
