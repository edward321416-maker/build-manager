import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The CDN stylesheet layout.tsx loads declares every @font-face as 'Pretendard Variable' (checked 2026-10-14: all 92
// rules use that name), but the stacks below named only `Pretendard`, so the web font was never applied anywhere.
const dir = fileURLToPath(new URL(".", import.meta.url));
const read = (name: string) => readFileSync(`${dir}${name}`, "utf8");

const STACK_TAIL = '"Noto Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif';
const STACK = `"Pretendard Variable", Pretendard, ${STACK_TAIL}`;

describe("font stack names the CDN face before the static fallback", () => {
  test("tokens.css --font-sans starts with the CDN face name", () => {
    const tokens = read("tokens.css");
    expect(tokens).toMatch(new RegExp(`--font-sans:\\s*${STACK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")};`));
  });

  test("globals.css body font-family starts with the CDN face name and matches tokens.css", () => {
    const globals = read("globals.css");
    expect(globals).toMatch(new RegExp(`font-family:\\s*${STACK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")};`));
  });

  test("layout.tsx still loads the variable dynamic-subset stylesheet, which declares 'Pretendard Variable'", () => {
    const layout = read("layout.tsx");
    expect(layout).toContain("pretendardvariable-dynamic-subset");
    expect(layout).toMatch(/Pretendard Variable/);
  });
});
