import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { color, inputText, radius, size, space, status, text } from "./tokens";

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

  // Every TextInput element in the source, as written (a JSX tag up to its self-closing end).
  const inputs = sources.flatMap((file) => [...readFileSync(file, "utf8").matchAll(/<TextInput\b[\s\S]*?\/>/g)]
    .map((match) => ({ file: relative(SOURCE_ROOT, file), tag: match[0] })));

  it("finds the app's text inputs", () => {
    expect(inputs.length).toBeGreaterThan(5);
  });

  it("gives every input with a placeholder the secondary placeholder colour (§2.1)", () => {
    const offenders = inputs.filter(({ tag }) => /\splaceholder=/.test(tag) && !/\splaceholderTextColor=/.test(tag)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("gives the core flow's multi-line inputs the 120-tall style (§8.2)", () => {
    const multiline = inputs.filter(({ file, tag }) => /app[\\/]core\.tsx$/.test(file) && /\smultiline\b/.test(tag));
    expect(multiline.length).toBeGreaterThan(0);
    expect(multiline.filter(({ tag }) => !/style=\{styles\.multiline\}/.test(tag))).toEqual([]);
  });
});

describe("token values follow design rules v1", () => {
  it("uses the rules' colours", () => {
    expect(color).toEqual({
      page: "#F2F2F7", surface: "#FFFFFF", text: "#202632", textSecondary: "#636771", textInverse: "#FFFFFF",
      border: "rgba(32,38,50,0.12)", borderStrong: "rgba(32,38,50,0.20)", borderControl: "#868B95",
      fillSubtle: "rgba(32,38,50,0.04)", primary: "#0064FF", primarySoft: "rgba(0,100,255,0.08)",
      danger: "#FF3B30", dangerSoft: "rgba(255,59,48,0.08)",
    });
    expect(status).toEqual({
      urgent: { color: "#C8231A", backgroundColor: "#FFF0EF" },
      waiting: { color: "#9A5B00", backgroundColor: "#FFF3DC" },
      progress: { color: "#0056D8", backgroundColor: "#EEF4FF" },
      done: { color: "#17754F", backgroundColor: "#E7F5EE" },
      neutral: { color: color.textSecondary, backgroundColor: color.fillSubtle },
    });
  });

  it("uses the rules' spacing, corners and sizes", () => {
    expect(space).toEqual({ s1: 5, s2: 10, s3: 15, s4: 20, s5: 25, s6: 30, s8: 40, s10: 50 });
    expect(radius).toEqual({ small: 5, control: 10, group: 15, sheet: 20 });
    expect(size).toEqual({ target: 48, multiline: 120 });
  });

  it("uses the app text styles, weights 400/600/700 only and no positive letter spacing", () => {
    expect(text).toEqual({
      title: { fontSize: 24, lineHeight: 32, fontWeight: "700", letterSpacing: -0.5 },
      heading: { fontSize: 20, lineHeight: 28, fontWeight: "600", letterSpacing: -0.4 },
      subheading: { fontSize: 16, lineHeight: 24, fontWeight: "600", letterSpacing: -0.2 },
      body: { fontSize: 16, lineHeight: 24, fontWeight: "400", letterSpacing: -0.2 },
      label: { fontSize: 16, lineHeight: 24, fontWeight: "600", letterSpacing: -0.2 },
      caption: { fontSize: 13, lineHeight: 18, fontWeight: "400", letterSpacing: 0 },
    });
    const { lineHeight: _bodyLine, ...bodyWithoutLine } = text.body;
    expect(inputText).toEqual(bodyWithoutLine);
    for (const style of Object.values(text)) {
      expect(["400", "600", "700"]).toContain(style.fontWeight);
      expect(style.letterSpacing).toBeLessThanOrEqual(0);
    }
  });
});
