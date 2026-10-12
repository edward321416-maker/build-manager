import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Menu audit P3 part 3 (design rules §10 and §16): /core, the pieces it embeds and the Vendor job screen speak 해요체.
// Demo-only copy in the shared view files stays formal until the demo goes away with app v2, so it is allowed by exact
// sentence. Server error messages (apps/web/src/server) are outside this check.
const src = fileURLToPath(new URL("../../", import.meta.url));
const apiClient = fileURLToPath(new URL("../../../../../packages/api-client/src/", import.meta.url));
const sources = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return sources(path);
  return /\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) ? [path] : [];
});
const scanned = [
  ...sources(join(src, "app/core")),
  ...sources(join(src, "app/vendor/job")),
  ...["components/core-photos.tsx", "components/landlord/ticket-review.tsx", "components/landlord/views.tsx", "components/landlord/logic.ts",
    "components/tenant/views.tsx", "components/tenant/ticket-intake.tsx", "components/vendor-interval-fields.tsx", "components/status-names.ts",
    "components/date-time.tsx", "lib/browser-api-client.ts", "lib/date-text.ts", "lib/vendor-blocker.ts", "lib/vendor-time.ts"].map(path => join(src, path)),
  ...["http.ts", "core-photos.ts", "vendor-job.ts"].map(path => join(apiClient, path)),
];
const demoOnly: Record<string, string[]> = {
  "components/landlord/views.tsx": [
    "모든 건물·수리 요청 데이터는 합성 데모 데이터입니다.",
    "이 데모에 포함되어 있지 않습니다.",
    "표시할 데모 건물이 없습니다.",
    "아래 항목은 참고용입니다. 값이 바뀌어도 수리 경로는 달라지지 않습니다.",
    "접수된 수리 요청이 없습니다. 데모를 초기화하면 이 상태로 돌아옵니다.",
  ],
  "components/tenant/views.tsx": [
    "모든 건물·수리 요청 데이터는 합성 데모 데이터입니다.",
    "이 데모에 포함되어 있지 않습니다.",
    "표시할 데모 건물이 없습니다.",
    "이 데모는 실제 사진을 올리지 않습니다. 준비된 합성 예시를 선택해 제출합니다.",
    "제출할 DEMO 증빙이 남아 있지 않습니다.",
    "아직 제출이 완료되지 않았습니다.",
  ],
};
const normalized = (text: string) => text.replace(/\s+/g, " ");
const formal = (text: string) => [...text.matchAll(/[가-힣]+(?:니다|니까|십시오)/g)].map(match => match[0]);
const key = (path: string) => relative(src, path).replaceAll("\\", "/");

describe("해요체 on /core, the pieces it embeds and the Vendor job screen", () => {
  it("finds the formal endings it guards against", () => {
    expect(formal("사진을 저장했습니다. 다시 확인하시겠습니까? 새로고침하십시오.")).toEqual(["저장했습니다", "확인하시겠습니까", "새로고침하십시오"]);
    expect(formal("사진을 저장했어요. 다시 확인해 주세요.")).toEqual([]);
  });

  it("has no formal sentence outside the listed demo-only copy", () => {
    expect(scanned.length).toBeGreaterThan(20);
    const found = scanned.flatMap(path => {
      let text = normalized(readFileSync(path, "utf8"));
      for (const sentence of demoOnly[key(path)] ?? []) text = text.split(sentence).join(" ");
      return formal(text).map(word => `${key(path)}: ${word}`);
    });
    expect(found).toEqual([]);
  });

  it("lists only demo-only sentences that still exist", () => {
    for (const [path, sentences] of Object.entries(demoOnly)) {
      const text = normalized(readFileSync(join(src, path), "utf8"));
      for (const sentence of sentences) expect(text.includes(sentence), `${path}: ${sentence}`).toBe(true);
    }
  });
});
