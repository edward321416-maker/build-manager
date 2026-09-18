import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The hypothesis under test is that the building decides the questions — so the
 * app must never decide them. Every prompt it shows comes from the Tenant DTO.
 *
 * This reads the production Mobile source directly: a branch on a specific
 * demo building, or a protocol restated on the client, would make the app agree
 * with the server by coincidence rather than by construction.
 */
const SOURCE_ROOT = join(__dirname, "..");

function productionSources(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      found.push(...productionSources(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) {
      continue;
    }
    found.push(full);
  }

  return found;
}

describe("server authority in mobile source", () => {
  const sources = productionSources(SOURCE_ROOT);

  it("scans a meaningful amount of source", () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it("branches on no specific demo building", () => {
    const offenders = sources.filter((file) =>
      /demo-building-[ab]/.test(readFileSync(file, "utf8")),
    );

    expect(offenders).toEqual([]);
  });

  it("restates no protocol question id or protocol name", () => {
    const offenders = sources.filter((file) => {
      const code = readFileSync(file, "utf8");
      return (
        /HEATING_(INDIVIDUAL|SHARED|UNKNOWN)_V1|LEAK_V1/.test(code) ||
        /"(heating|leak)\.[a-zA-Z]/.test(code)
      );
    });

    expect(offenders).toEqual([]);
  });

  it("names no evidence fixture id of its own", () => {
    const offenders = sources.filter((file) =>
      /demo-(boiler-display|leak-location|fixture-view|general-view)/.test(
        readFileSync(file, "utf8"),
      ),
    );

    expect(offenders).toEqual([]);
  });
});
