import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NavIcon } from "./nav-icons";
import { OpenSourceNotice } from "./open-source-notice";

const MENU_ICONS = ["home", "clipboard-list", "bell", "user", "dots", "file-text", "key", "layout-grid"] as const;

describe("menu icons (rules 8.13, REF-07)", () => {
  it("draws outlines at stroke 1.5 in the text colour, hidden from screen readers", () => {
    const html = renderToStaticMarkup(<NavIcon name="bell" />);
    expect(html).toContain('stroke-width="1.5"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("data-filled");
  });

  it("has a filled shape for every menu icon and fills only on request", () => {
    for (const name of MENU_ICONS) {
      const html = renderToStaticMarkup(<NavIcon name={name} filled />);
      expect(html, name).toContain('data-filled="true"');
      expect(html, name).toContain('fill="currentColor"');
      expect(html, name).toMatch(/<path d="M/);
    }
  });

  it("keeps the back chevron outline only", () => {
    expect(renderToStaticMarkup(<NavIcon name="chevron-left" filled />)).not.toContain("data-filled");
  });

  it("marks the copied Tabler paths with their source and licence", () => {
    const source = readFileSync(new URL("./nav-icons.tsx", import.meta.url), "utf8");
    for (const line of ["// SPDX-SnippetBegin", "// SPDX-SnippetCopyrightText: 2020-2026 Paweł Kuna", "// SPDX-License-Identifier: MIT", "// SPDX-SnippetEnd"]) expect(source).toContain(line);
    expect(source).toMatch(/\/\/ Source: https:\/\/github\.com\/tabler\/tabler-icons .*\(확인 2026-10-13\)/);
  });

  it("shows the MIT notice the icons require", () => {
    const html = renderToStaticMarkup(<OpenSourceNotice />);
    expect(html).toContain('aria-label="오픈소스 라이선스"');
    expect(html).toContain("Copyright (c) 2020-2026 Paweł Kuna");
    expect(html).toContain("MIT License");
    expect(html).toContain("THE SOFTWARE IS PROVIDED");
  });
});
