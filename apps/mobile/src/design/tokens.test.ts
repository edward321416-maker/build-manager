import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { color, status, text } from "./tokens";

/**
 * Design rules v1 for the app (§2, §3.2, §16): every screen takes its colours and text styles from tokens.ts,
 * so a screen cannot drift back to its own palette. This reads the production Mobile source directly.
 */
const SOURCE_ROOT = join(__dirname, "..");
const TOKENS = join(__dirname, "tokens.ts");

function productionSources(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      found.push(...productionSources(full));
      continue;
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

const literals: [string, RegExp][] = [
  ["colour literal", /["'](#[0-9A-Fa-f]{3,8}|rgba?\([^"']*\))["']/],
  ["font size", /\bfontSize\s*:/],
  ["line height", /\blineHeight\s*:/],
  ["font weight", /\bfontWeight\s*:/],
  ["letter spacing", /\bletterSpacing\s*:/],
  ["opacity", /\bopacity\s*:/],
];

describe("design tokens in mobile source", () => {
  const sources = productionSources(SOURCE_ROOT).filter((file) => file !== TOKENS);

  it("scans a meaningful amount of source", () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it.each(literals)("sets no %s outside tokens.ts", (_name, pattern) => {
    const offenders = sources.filter((file) => pattern.test(readFileSync(file, "utf8"))).map((file) => relative(SOURCE_ROOT, file));
    expect(offenders).toEqual([]);
  });
});

describe("token values follow design rules v1", () => {
  it("uses the rules' colours", () => {
    expect(color).toMatchObject({
      page: "#F2F2F7", surface: "#FFFFFF", text: "#202632", textSecondary: "#636771", textInverse: "#FFFFFF",
      borderControl: "#868B95", primary: "#0064FF", danger: "#FF3B30",
    });
    expect(status.progress).toEqual({ color: "#0056D8", backgroundColor: "#EEF4FF" });
    expect(status.done).toEqual({ color: "#17754F", backgroundColor: "#E7F5EE" });
    expect(status.neutral).toEqual({ color: color.textSecondary, backgroundColor: color.fillSubtle });
  });

  it("uses the app text styles, weights 400/600/700 only and no positive letter spacing", () => {
    expect(text.title).toEqual({ fontSize: 24, lineHeight: 32, fontWeight: "700", letterSpacing: -0.5 });
    expect(text.heading).toEqual({ fontSize: 20, lineHeight: 28, fontWeight: "600", letterSpacing: -0.4 });
    expect(text.body).toEqual({ fontSize: 16, lineHeight: 24, fontWeight: "400", letterSpacing: -0.2 });
    expect(text.caption).toEqual({ fontSize: 13, lineHeight: 18, fontWeight: "400", letterSpacing: 0 });
    for (const style of Object.values(text)) {
      expect(["400", "600", "700"]).toContain(style.fontWeight);
      expect(style.letterSpacing).toBeLessThanOrEqual(0);
    }
  });
});
