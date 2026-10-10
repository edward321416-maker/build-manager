import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const browserTests = join(import.meta.dirname, "..", "..", "apps", "web", "tests");

describe("browser test routes", () => {
  it("never expire a route with the times option; routeOnce keeps request interception on", async () => {
    const files = (await readdir(browserTests, { recursive: true })).filter((file) => /\.tsx?$/.test(file));
    const expiring: string[] = [];
    for (const file of files) {
      const source = await readFile(join(browserTests, file), "utf8");
      if (/\btimes\s*:\s*\d/.test(source)) expiring.push(file);
    }
    expect(expiring).toEqual([]);
  });
});
