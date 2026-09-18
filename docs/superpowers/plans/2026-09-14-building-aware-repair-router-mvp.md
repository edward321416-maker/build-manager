# Building-Aware AI Repair Router MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a contest-ready web MVP that proves the same tenant issue produces different questions, evidence requirements, and human-reviewed routing when verified building context differs.

**Architecture:** Preserve the existing documentation-first repository and add an isolated `web/` Next.js application. Core safety, protocol selection, evidence completeness, routing, and state transitions live in pure TypeScript domain modules with no Next.js dependency. External address/building APIs are ports/adapters; automated tests use synthetic fixtures and in-memory repositories, while local persistence uses a repository abstraction backed by Node `node:sqlite`.

**Tech Stack:** Node.js 24 LTS, Next.js 16.3.x App Router, TypeScript strict, React, Zod, Drizzle ORM + `node:sqlite` for local demo persistence, Vitest 5, Playwright, npm/package-lock.

**Spec:** `product/05_product_spec_v1_REAUDITED_v2.md` — the executor must add the approved spec to the repository before implementation and treat it as authoritative together with `AGENTS.md`, `governance/project_policy.md`, `research/README.md`, and `product/ai_safety_boundary.md`.

## Global Constraints

- Repository: `edward321416-maker/build-manager`; public; default branch `main`.
- Work in an isolated worktree/feature branch named `feat/building-aware-mvp`; never force-push or rewrite history.
- Existing repo has no package manifest at plan time; create the application under `web/`, not at repository root.
- Keep existing `product/`, `research/`, `submission/`, `ops/`, `governance/`, and verification workflow intact unless this plan names a modification.
- P0 is two synthetic buildings × two protocols only: `HEATING` and `LEAK`.
- Public demo defaults to `FIXTURE`; no real tenant PII, real private residential address, arbitrary public file upload, payment, marketplace, rent/accounting, legal-liability AI, or autonomous vendor dispatch.
- Decision precedence: `SAFETY HARD STOP → VERIFIED CONTEXT → DETERMINISTIC PROTOCOL → OPTIONAL LLM → HUMAN APPROVAL`.
- Normal automatic route recommendations are generated only when evidence state is `COMPLETE`.
- `MISSING_REQUIRED`, `CONFLICTING`, or `SAFETY_ESCALATED` must not receive a normal automatic route recommendation.
- `REQUEST_MORE_INFO` must transition the ticket to `NEEDS_MORE_INFO`, then permit tenant data to be added and the packet to be regenerated with incremented revision.
- `routingEligible=false` context can be displayed but must never directly alter routing.
- Core routing must work with LLM adapter disabled.
- External provider response shapes must remain inside adapters; domain code uses internal types.
- Do not invent Juso/BuildingHUB field mappings. When live adapters are added, verify current official provider docs and keep live mode optional.
- Local SQLite is for the local contest demo only. Do not assume local SQLite is durable on serverless hosting.
- TDD is mandatory for application behavior: write a failing test, run it and confirm the intended failure, implement the minimum code, run green, then refactor.
- Before each completion/commit claim, run fresh verification and cite the command/output.
- After each major phase, append one row to `ops/AI_Execution_Log.csv` and report a one-line checkpoint. If Google sync is unavailable, keep `sync_status=pending`.
- Stage named reviewed paths only; no `git add .`.
- Use Conventional Commits.
- No production integrations or real personal data are required for this plan.

---

# 1. Repository State This Plan Assumes

At planning time:

- `AGENTS.md` requires repository-policy, evidence-policy, execution-log, clean staging, and verification discipline.
- `STATUS.md` reports application implementation `NOT STARTED` and no `package.json`, Python manifest, or Compose manifest.
- Existing `product/mvp_scope.md` contains an older, broader four-module MVP definition.
- Existing `product/ai_safety_boundary.md` is authoritative for prohibited safety/legal conclusions.
- Existing CI runs `python3 scripts/verify_repository.py --history` and `git diff-tree --check HEAD`.

The first implementation task therefore syncs the approved spec into canonical product documentation before code.

---

# 2. Target File Map

## Existing files to modify

```text
product/mvp_scope.md
STATUS.md
ops/AI_Execution_Log.csv
.github/workflows/            # add, do not replace repository-check.yml
```

## New product/plan docs

```text
product/05_product_spec_v1_REAUDITED_v2.md
docs/superpowers/plans/2026-09-14-building-aware-repair-router-mvp.md
```

## New application

```text
web/
├─ app/
│  ├─ page.tsx
│  ├─ demo/page.tsx
│  ├─ landlord/
│  │  ├─ buildings/[buildingId]/page.tsx
│  │  ├─ buildings/[buildingId]/verify/page.tsx
│  │  ├─ tickets/page.tsx
│  │  └─ tickets/[ticketId]/page.tsx
│  ├─ t/[tenantToken]/
│  │  ├─ page.tsx
│  │  ├─ questions/page.tsx
│  │  ├─ evidence/page.tsx
│  │  └─ submitted/page.tsx
│  └─ api/
│     ├─ address/search/route.ts
│     ├─ buildings/route.ts
│     ├─ buildings/[id]/route.ts
│     ├─ buildings/[id]/context/route.ts
│     ├─ tickets/route.ts
│     └─ tickets/[id]/
│        ├─ route.ts
│        ├─ answers/route.ts
│        ├─ evidence/route.ts
│        ├─ finalize/route.ts
│        └─ decision/route.ts
├─ components/
│  ├─ building/
│  ├─ ticket/
│  ├─ protocol/
│  └─ ui/
├─ domain/
│  ├─ building/types.ts
│  ├─ ticket/types.ts
│  ├─ safety/evaluate-safety.ts
│  ├─ protocol/types.ts
│  ├─ protocol/select-protocol.ts
│  ├─ protocol/evaluate-questions.ts
│  ├─ protocol/evaluate-evidence.ts
│  ├─ routing/recommend-route.ts
│  └─ packet/build-repair-packet.ts
├─ protocols/
│  ├─ heating.v1.ts
│  └─ leak.v1.ts
├─ fixtures/
│  ├─ buildings.ts
│  ├─ units.ts
│  └─ scenarios.ts
├─ adapters/
│  ├─ address/types.ts
│  ├─ address/fixture-address-provider.ts
│  ├─ building/types.ts
│  ├─ building/fixture-building-provider.ts
│  ├─ llm/types.ts
│  ├─ llm/disabled-llm-provider.ts
│  └─ evidence/types.ts
├─ repositories/
│  ├─ ports.ts
│  ├─ memory.ts
│  └─ sqlite.ts
├─ db/
│  ├─ schema.ts
│  └─ migrations/
├─ lib/
│  ├─ runtime-mode.ts
│  ├─ container.ts
│  └─ demo-session.ts
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ next.config.ts
├─ eslint.config.mjs
├─ vitest.config.ts
├─ playwright.config.ts
├─ .env.example
└─ README.md
```

---

### Task 1: Sync Approved Product Scope into Canonical Repository Docs

**Files:**
- Create: `product/05_product_spec_v1_REAUDITED_v2.md`
- Create: `docs/superpowers/plans/2026-09-14-building-aware-repair-router-mvp.md`
- Modify: `product/mvp_scope.md`
- Modify: `STATUS.md`
- Modify: `ops/AI_Execution_Log.csv`

**Interfaces:**
- Consumes: approved Step 05 spec and this plan.
- Produces: one canonical implementation spec linked from the existing MVP summary.

- [ ] **Step 1: Inspect governing docs and confirm no application manifest exists**

Run:
```bash
git status --short
git branch --show-current
git remote -v
git log -5 --oneline
test ! -f package.json
test ! -f requirements.txt
test ! -f pyproject.toml
test ! -f docker-compose.yml
test ! -f compose.yml
```

Expected:
- working tree state is understood before edits;
- no root application manifest exists.

- [ ] **Step 2: Copy the approved Step 05 spec and this plan into canonical paths**

The spec content must be byte-for-byte the user-approved `05_product_spec_v1_REAUDITED_v2.md`.

The plan path must be:
```text
docs/superpowers/plans/2026-09-14-building-aware-repair-router-mvp.md
```

- [ ] **Step 3: Replace the old broad MVP summary with a narrow link-based summary**

Use this content structure in `product/mvp_scope.md`:

```markdown
# MVP Scope

Status: **[DECISION] Contest P0 scope narrowed on 2026-09-14.**

Canonical behavior and acceptance criteria: [Product Spec v1](05_product_spec_v1_REAUDITED_v2.md).

The contest MVP proves one hypothesis: the same tenant issue produces different questions, evidence requirements, and human-reviewed routing when verified building context differs.

P0 contains two synthetic buildings and two protocols only: HEATING and LEAK. Safety hard stops precede ordinary troubleshooting. Normal automatic route recommendations require COMPLETE evidence and are always subject to human approval.

Out of scope: rent/accounting, contracts, marketplace, payment, legal liability allocation, autonomous vendor dispatch, native apps, IoT, real customer data, and production integrations.

The existing [AI Safety Boundary](ai_safety_boundary.md) remains authoritative.
```

- [ ] **Step 4: Update only the application row in `STATUS.md`**

Exact replacement:

```text
| Application implementation | NOT STARTED | No package.json, requirements.txt, pyproject.toml, or Compose manifest existed at inspection |
```

with:

```text
| Application implementation | SPEC APPROVED / IMPLEMENTATION STARTING | [Product Spec v1](product/05_product_spec_v1_REAUDITED_v2.md); contest P0 is two synthetic buildings × HEATING/LEAK |
```

Do not change unrelated status rows.

- [ ] **Step 5: Append execution-log row**

Append one CSV row with:
```text
phase-building-aware-spec,<UTC ISO timestamp>,superpowers-writing-plans;superpowers-test-driven-development,unknown,Approved Building-Aware contest MVP spec and implementation plan added; application implementation may begin,product/05_product_spec_v1_REAUDITED_v2.md;docs/superpowers/plans/2026-09-14-building-aware-repair-router-mvp.md,pending
```

Preserve CSV quoting rules.

- [ ] **Step 6: Verify docs before commit**

Run:
```bash
python3 scripts/verify_repository.py --history
git diff --check
git diff -- product/mvp_scope.md STATUS.md product/05_product_spec_v1_REAUDITED_v2.md docs/superpowers/plans/2026-09-14-building-aware-repair-router-mvp.md ops/AI_Execution_Log.csv
```

Expected:
- repository verifier exit 0;
- `git diff --check` exit 0;
- diff shows only intended docs/log changes.

- [ ] **Step 7: Commit**

```bash
git add product/mvp_scope.md STATUS.md product/05_product_spec_v1_REAUDITED_v2.md docs/superpowers/plans/2026-09-14-building-aware-repair-router-mvp.md ops/AI_Execution_Log.csv
git commit -m "docs: approve building-aware contest MVP"
```

---

### Task 2: Scaffold Isolated Next.js App and Test Harness

**Files:**
- Create: `web/package.json`
- Create: `web/package-lock.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.ts`
- Create: `web/eslint.config.mjs`
- Create: `web/vitest.config.ts`
- Create: `web/playwright.config.ts`
- Create: `web/app/layout.tsx`
- Create: `web/app/page.tsx`
- Create: `web/app/globals.css`
- Create: `web/.env.example`
- Create: `web/README.md`
- Create: `.github/workflows/web-check.yml`
- Modify: `.gitignore`

**Interfaces:**
- Produces commands: `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`.
- No production feature logic yet.

- [ ] **Step 1: Write a failing scaffold smoke test**

Create `web/tests/unit/scaffold.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { productName } from "@/lib/product-meta";

describe("product metadata", () => {
  it("uses the approved external product name", () => {
    expect(productName).toBe("건물 맞춤형 AI 수리 라우터");
  });
});
```

- [ ] **Step 2: Install only approved baseline dependencies**

From `web/` initialize npm and install:
```bash
npm init -y
npm install next@16.3 react react-dom zod drizzle-orm
npm install -D typescript @types/node @types/react @types/react-dom eslint eslint-config-next vitest @vitest/coverage-v8 playwright @playwright/test tailwindcss @tailwindcss/postcss
```

Then create scripts in `web/package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Do not add an LLM SDK, auth SDK, cloud DB SDK, analytics SDK, or upload SDK in P0.

- [ ] **Step 3: Run the test and verify RED**

Run:
```bash
npm test -- tests/unit/scaffold.test.ts
```

Expected: FAIL because `@/lib/product-meta` does not exist.

- [ ] **Step 4: Add minimal product metadata**

Create `web/lib/product-meta.ts`:

```ts
export const productName = "건물 맞춤형 AI 수리 라우터";
export const heroMessage = "주소가 수리 프로토콜이 된다";
```

- [ ] **Step 5: Add Next/Vitest/TypeScript config and minimal root page**

Configure `@/*` path alias to web root. `app/page.tsx` may render only the product name, hero message, and a link to `/demo`.

- [ ] **Step 6: Run green verification**

```bash
npm test -- tests/unit/scaffold.test.ts
npm run lint
npm run build
```

Expected: all exit 0.

- [ ] **Step 7: Add CI without altering existing repository-check workflow**

Create `.github/workflows/web-check.yml` with:
```yaml
name: Web MVP checks
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  web:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - run: npm run build
```

Do not install Playwright browsers in CI yet; add E2E CI only after Task 12.

- [ ] **Step 8: Update `.gitignore`**

Add only:
```gitignore
web/node_modules/
web/.next/
web/.env
web/.env.local
web/data/*.db
web/test-results/
web/playwright-report/
```

Do not ignore source fixtures.

- [ ] **Step 9: Verify repository + app**

```bash
cd web
npm test
npm run lint
npm run build
cd ..
python3 scripts/verify_repository.py --history
git diff --check
```

- [ ] **Step 10: Commit**

```bash
git add web .github/workflows/web-check.yml .gitignore
git commit -m "chore: scaffold contest web MVP"
```

---

### Task 3: Define Domain Types and Synthetic Building Fixtures

**Files:**
- Create: `web/domain/building/types.ts`
- Create: `web/domain/ticket/types.ts`
- Create: `web/domain/protocol/types.ts`
- Create: `web/fixtures/buildings.ts`
- Create: `web/fixtures/units.ts`
- Test: `web/tests/unit/fixtures.test.ts`

**Interfaces:**
- Produces `ContextValue<T>`, `Building`, `Unit`, `Ticket`, `EvidenceState`, `RouteType`, `RouteRecommendation`.
- Produces fixture IDs `demo-building-a`, `demo-building-b`, tenant token fixtures.

- [ ] **Step 1: Write failing fixture tests**

```ts
import { describe, expect, it } from "vitest";
import { demoBuildingA, demoBuildingB } from "@/fixtures/buildings";

describe("building fixtures", () => {
  it("marks both public fixtures as synthetic demo data", () => {
    expect(demoBuildingA.demo).toBe(true);
    expect(demoBuildingB.demo).toBe(true);
  });

  it("uses routing-eligible verified heating context only where intended", () => {
    expect(demoBuildingA.context.heatingType.routingEligible).toBe(true);
    expect(demoBuildingA.context.approvalYear.routingEligible).toBe(false);
    expect(demoBuildingB.context.managementMode.value).toBe("MANAGEMENT_OFFICE");
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/unit/fixtures.test.ts
```

Expected: missing fixture modules/types.

- [ ] **Step 3: Implement the smallest type model**

Use exact enums:

```ts
export type ContextSourceType =
  | "JUSO"
  | "BUILDING_HUB"
  | "KAPT"
  | "OWNER_VERIFIED"
  | "TENANT_SUBMITTED"
  | "SYSTEM_DERIVED"
  | "FIXTURE_OFFICIAL";

export type ManagementMode =
  | "OWNER_DIRECT"
  | "MANAGEMENT_OFFICE"
  | "THIRD_PARTY_MANAGER"
  | "UNKNOWN";

export type HeatingType =
  | "INDIVIDUAL"
  | "CENTRAL_SHARED"
  | "DISTRICT"
  | "UNKNOWN";
```

`ContextValue<T>` must include `verified` and `routingEligible`.

- [ ] **Step 4: Implement exact synthetic fixtures**

A:
- display name `DEMO 해솔빌라`
- `demo=true`
- primary use 다가구주택
- approval year 2011, informational only
- management `OWNER_DIRECT`, routing eligible
- heating `INDIVIDUAL`, routing eligible
- owner-supplied boiler true

B:
- display name `DEMO 라온하우징`
- `demo=true`
- primary use 공동주택
- management `MANAGEMENT_OFFICE`
- heating `CENTRAL_SHARED`

No precise real address.

- [ ] **Step 5: Run green + typecheck via build**

```bash
npm test -- tests/unit/fixtures.test.ts
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add web/domain web/fixtures web/tests/unit/fixtures.test.ts
git commit -m "feat: define building context fixtures"
```

---

### Task 4: Implement Safety Engine First

**Files:**
- Create: `web/domain/safety/evaluate-safety.ts`
- Test: `web/tests/unit/safety.test.ts`

**Interfaces:**
- Consumes answers keyed by safety question IDs.
- Produces `{ escalated: boolean; flags: SafetyFlag[] }`.
- No UI or LLM dependency.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { evaluateSafety } from "@/domain/safety/evaluate-safety";

describe("evaluateSafety", () => {
  it("hard-stops on gas smell", () => {
    expect(evaluateSafety({ gasSmell: true })).toEqual({
      escalated: true,
      flags: ["GAS_SMELL"],
    });
  });

  it("hard-stops on smoke or fire", () => {
    expect(evaluateSafety({ smokeOrFire: true })).toEqual({
      escalated: true,
      flags: ["SMOKE_OR_FIRE"],
    });
  });

  it("hard-stops when water is near electricity", () => {
    expect(evaluateSafety({ electricalWaterRisk: true })).toEqual({
      escalated: true,
      flags: ["ELECTRICAL_WATER_RISK"],
    });
  });

  it("returns no escalation for ordinary answers", () => {
    expect(evaluateSafety({ gasSmell: false })).toEqual({
      escalated: false,
      flags: [],
    });
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/unit/safety.test.ts
```

- [ ] **Step 3: Implement minimal deterministic engine**

```ts
export function evaluateSafety(input: SafetyInput): SafetyResult {
  const flags: SafetyFlag[] = [];
  if (input.gasSmell === true) flags.push("GAS_SMELL");
  if (input.smokeOrFire === true) flags.push("SMOKE_OR_FIRE");
  if (input.electricalWaterRisk === true) flags.push("ELECTRICAL_WATER_RISK");
  return { escalated: flags.length > 0, flags };
}
```

Do not use LLM/model confidence.

- [ ] **Step 4: Run green**

```bash
npm test -- tests/unit/safety.test.ts
npm test
```

- [ ] **Step 5: Commit**

```bash
git add web/domain/safety web/tests/unit/safety.test.ts
git commit -m "feat: add deterministic safety gate"
```

---

### Task 5: Implement Versioned Heating Protocol and Building-Aware Selection

**Files:**
- Create: `web/protocols/heating.v1.ts`
- Create: `web/domain/protocol/select-protocol.ts`
- Create: `web/domain/protocol/evaluate-questions.ts`
- Test: `web/tests/unit/heating-protocol.test.ts`

**Interfaces:**
- Consumes `Building` and `IssueType`.
- Produces a protocol branch with questions, evidence requirements, route rules.
- Heating branches: individual, shared/central, unknown.

- [ ] **Step 1: Write RED tests for A/B divergence**

```ts
it("selects individual heating questions for Building A", () => {
  const p = selectProtocol(demoBuildingA, "HEATING");
  expect(p.id).toBe("HEATING_INDIVIDUAL_V1");
  expect(p.questions.map(q => q.id)).toContain("heating.hotWater");
  expect(p.evidence.map(e => e.type)).toContain("CONTROL_PANEL_PHOTO");
});

it("selects shared-heating questions for Building B", () => {
  const p = selectProtocol(demoBuildingB, "HEATING");
  expect(p.id).toBe("HEATING_SHARED_V1");
  expect(p.questions.map(q => q.id)).toContain("heating.unitOnly");
  expect(p.evidence.map(e => e.type)).not.toContain("CONTROL_PANEL_PHOTO");
});
```

Add an `UNKNOWN` heating test that requires a heating-type clarification and does not infer a shared/individual branch.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/unit/heating-protocol.test.ts
```

- [ ] **Step 3: Implement only the three explicit branches**

No generic rules DSL beyond the approved typed conditions. Protocol IDs:
```text
HEATING_INDIVIDUAL_V1
HEATING_SHARED_V1
HEATING_UNKNOWN_V1
```

Every branch begins with gas/smoke safety checks.

- [ ] **Step 4: Verify A/B divergence**

```bash
npm test -- tests/unit/heating-protocol.test.ts
npm test
```

- [ ] **Step 5: Commit**

```bash
git add web/protocols/heating.v1.ts web/domain/protocol web/tests/unit/heating-protocol.test.ts
git commit -m "feat: add building-aware heating protocol"
```

---

### Task 6: Implement Leak Protocol and Evidence Completeness Gate

**Files:**
- Create: `web/protocols/leak.v1.ts`
- Create: `web/domain/protocol/evaluate-evidence.ts`
- Test: `web/tests/unit/leak-protocol.test.ts`
- Test: `web/tests/unit/evidence-gate.test.ts`

**Interfaces:**
- Consumes leak answers/evidence.
- Produces `EvidenceState`.
- Normal route generation later receives only `COMPLETE` evidence.

- [ ] **Step 1: Write leak RED tests**

```ts
it("asks electrical-water safety before ordinary leak questions", () => {
  const p = selectProtocol(demoBuildingA, "LEAK");
  expect(p.safetyChecks[0]?.flag).toBe("ELECTRICAL_WATER_RISK");
});

it("uses management-office candidate for ceiling leak in Building B", () => {
  const p = selectProtocol(demoBuildingB, "LEAK");
  expect(p.id).toBe("LEAK_V1");
});
```

- [ ] **Step 2: Write evidence-gate RED tests**

```ts
it("marks missing required evidence as MISSING_REQUIRED", () => {
  expect(evaluateEvidence(required, [])).toBe("MISSING_REQUIRED");
});

it("marks required evidence present as COMPLETE", () => {
  expect(evaluateEvidence(required, supplied)).toBe("COMPLETE");
});
```

- [ ] **Step 3: Run RED**

```bash
npm test -- tests/unit/leak-protocol.test.ts tests/unit/evidence-gate.test.ts
```

- [ ] **Step 4: Implement minimal leak protocol/evidence gate**

Leak locations:
```text
CEILING_WALL
SINK_BATHROOM_FIXTURE
APPLIANCE
UNKNOWN
```

Do not infer liability or leak origin.

- [ ] **Step 5: Run green**

```bash
npm test -- tests/unit/leak-protocol.test.ts tests/unit/evidence-gate.test.ts
npm test
```

- [ ] **Step 6: Commit**

```bash
git add web/protocols/leak.v1.ts web/domain/protocol/evaluate-evidence.ts web/tests/unit/leak-protocol.test.ts web/tests/unit/evidence-gate.test.ts
git commit -m "feat: add leak protocol and evidence gate"
```

---

### Task 7: Implement Routing, Repair Packet, and Review State Machine

**Files:**
- Create: `web/domain/routing/recommend-route.ts`
- Create: `web/domain/packet/build-repair-packet.ts`
- Create: `web/domain/ticket/review-ticket.ts`
- Test: `web/tests/unit/routing.test.ts`
- Test: `web/tests/unit/repair-packet.test.ts`
- Test: `web/tests/unit/review-state.test.ts`

**Interfaces:**
- Normal `recommendRoute()` requires `EvidenceState === "COMPLETE"` and no safety escalation.
- `buildRepairPacket()` may produce `recommendation: null`.
- `requestMoreInfo()` moves to `NEEDS_MORE_INFO`.
- Re-finalization increments packet revision.

- [ ] **Step 1: Write RED route integrity tests**

```ts
it("does not route on approvalYear", () => {
  const original = recommendRoute(inputWithApprovalYear("2011"));
  const changed = recommendRoute(inputWithApprovalYear("1990"));
  expect(changed).toEqual(original);
});

it("changes heating route when routing-eligible heating context changes", () => {
  expect(routeFor(demoBuildingA, "HEATING")).toBe("LANDLORD_REVIEW");
  expect(routeFor(demoBuildingB, "HEATING")).toBe("MANAGEMENT_OFFICE");
});
```

- [ ] **Step 2: Write RED completeness/safety tests**

```ts
it("returns null recommendation when evidence is incomplete", () => {
  expect(recommendRoute({ ...input, evidenceState: "MISSING_REQUIRED" })).toBeNull();
});

it("returns null recommendation when safety is escalated", () => {
  expect(recommendRoute({ ...input, safetyEscalated: true })).toBeNull();
});
```

- [ ] **Step 3: Write RED state-machine tests**

```ts
it("moves reviewable ticket to NEEDS_MORE_INFO", () => {
  const result = requestMoreInfo(ticket, request);
  expect(result.status).toBe("NEEDS_MORE_INFO");
});

it("increments packet revision after more info and re-finalize", () => {
  const next = regeneratePacket(existingPacket);
  expect(next.revision).toBe(existingPacket.revision + 1);
});
```

- [ ] **Step 4: Run RED**

```bash
npm test -- tests/unit/routing.test.ts tests/unit/repair-packet.test.ts tests/unit/review-state.test.ts
```

- [ ] **Step 5: Implement minimal domain functions**

Function signatures:

```ts
export function recommendRoute(input: RoutingInput): RouteRecommendation | null;
export function buildRepairPacket(input: RepairPacketInput): RepairPacket;
export function requestMoreInfo(ticket: Ticket, request: MoreInfoRequest): Ticket;
export function applyRouteDecision(ticket: Ticket, decision: RouteDecision): Ticket;
```

Every rationale item must cite a protocol rule and may cite only routing-eligible context as routing basis.

- [ ] **Step 6: Verify green**

```bash
npm test -- tests/unit/routing.test.ts tests/unit/repair-packet.test.ts tests/unit/review-state.test.ts
npm test
```

- [ ] **Step 7: Commit**

```bash
git add web/domain/routing web/domain/packet web/domain/ticket web/tests/unit
git commit -m "feat: add repair packet and human review flow"
```

---

### Task 8: Add Repository Ports, In-Memory Adapter, and Local node:sqlite Adapter

**Files:**
- Create: `web/repositories/ports.ts`
- Create: `web/repositories/memory.ts`
- Create: `web/repositories/sqlite.ts`
- Create: `web/db/schema.ts`
- Create: `web/lib/container.ts`
- Test: `web/tests/unit/repositories.test.ts`
- Test: `web/tests/integration/sqlite-repository.test.ts`

**Interfaces:**
- UI/API code depends on ports, never directly on SQLite.
- `FIXTURE` tests use memory.
- Local demo may use `node:sqlite`.

- [ ] **Step 1: Write RED repository contract tests**

```ts
async function repositoryContract(repo: TicketRepository) {
  const ticket = makeTicket();
  await repo.save(ticket);
  expect(await repo.get(ticket.id)).toEqual(ticket);
  expect(await repo.list()).toContainEqual(ticket);
}

it("memory ticket repo satisfies contract", async () => {
  await repositoryContract(new MemoryTicketRepository());
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/unit/repositories.test.ts
```

- [ ] **Step 3: Implement ports + memory repositories**

Required ports:
```ts
interface TicketRepository {
  get(id: string): Promise<Ticket | null>;
  list(): Promise<Ticket[]>;
  save(ticket: Ticket): Promise<void>;
}

interface BuildingRepository {
  get(id: string): Promise<Building | null>;
  list(): Promise<Building[]>;
  save(building: Building): Promise<void>;
}
```

- [ ] **Step 4: Run memory GREEN**

```bash
npm test -- tests/unit/repositories.test.ts
```

- [ ] **Step 5: Write RED sqlite integration test**

Use a temporary DB path created under the test temp directory; never write test DB into Git.

- [ ] **Step 6: Implement Node 24 `node:sqlite` + Drizzle adapter**

Keep serialization explicit and reversible. Do not make domain types import Drizzle.

- [ ] **Step 7: Verify**

```bash
npm test -- tests/unit/repositories.test.ts tests/integration/sqlite-repository.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add web/repositories web/db web/lib/container.ts web/tests
git commit -m "feat: add repository persistence boundary"
```

---

### Task 9: Add Fixture Providers, Runtime Mode, and API Routes

**Files:**
- Create: `web/lib/runtime-mode.ts`
- Create: `web/adapters/address/types.ts`
- Create: `web/adapters/address/fixture-address-provider.ts`
- Create: `web/adapters/building/types.ts`
- Create: `web/adapters/building/fixture-building-provider.ts`
- Create: `web/adapters/llm/types.ts`
- Create: `web/adapters/llm/disabled-llm-provider.ts`
- Create API routes named in the file map
- Test: `web/tests/integration/api-fixture-flow.test.ts`

**Interfaces:**
- `RUNTIME_MODE=FIXTURE` by default.
- No live network call is required.
- API boundaries validated with Zod.

- [ ] **Step 1: Write RED fixture API integration test**

The test must:
1. search a demo building;
2. create/resolve it;
3. update owner context;
4. create a tenant ticket;
5. save answers/evidence;
6. finalize;
7. fetch the Repair Packet.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/integration/api-fixture-flow.test.ts
```

- [ ] **Step 3: Implement runtime mode**

```ts
export function getRuntimeMode(): "FIXTURE" | "LIVE" {
  return process.env.RUNTIME_MODE === "LIVE" ? "LIVE" : "FIXTURE";
}
```

LIVE mode without configured live providers must return an explicit configuration error, not silently fall back while pretending data is live.

- [ ] **Step 4: Implement fixture adapters and API routes**

Use synthetic demo buildings only. No real address fixture.

- [ ] **Step 5: Verify**

```bash
npm test -- tests/integration/api-fixture-flow.test.ts
npm test
```

- [ ] **Step 6: Commit**

```bash
git add web/lib/runtime-mode.ts web/adapters web/app/api web/tests/integration/api-fixture-flow.test.ts
git commit -m "feat: expose fixture-mode maintenance API"
```

---

### Task 10: Build Landlord Building Setup UX

**Files:**
- Create/Modify: `web/app/demo/page.tsx`
- Create: `web/app/landlord/buildings/[buildingId]/page.tsx`
- Create: `web/app/landlord/buildings/[buildingId]/verify/page.tsx`
- Create: `web/components/building/building-passport.tsx`
- Create: `web/components/building/source-badge.tsx`
- Test: `web/tests/unit/building-ui.test.tsx` if DOM test tooling is already available; otherwise cover with Playwright in Task 12 and keep domain/API unit tests authoritative.

**Interfaces:**
- Consumes building fixture/API.
- Produces owner-verified context and a DEMO CTA to tenant flow.

- [ ] **Step 1: Add page-level acceptance test before implementation**

Prefer Playwright component/page test only if the current chosen test harness supports it without adding a second DOM framework. Otherwise create the E2E expectation first in `tests/e2e/building-setup.spec.ts` and run it to RED.

Expected behavior:
- two demo cards visible;
- DEMO label visible;
- source badges visible;
- unknown allowed;
- owner verify form has three questions;
- submit leads to `203호 세입자 신고 화면 열기`.

- [ ] **Step 2: Verify RED**

```bash
npx playwright test tests/e2e/building-setup.spec.ts --project=chromium
```

Expected: FAIL because pages do not exist.

- [ ] **Step 3: Implement minimal accessible pages/components**

Do not build generic admin navigation beyond the demo path.

- [ ] **Step 4: Verify page flow**

```bash
npx playwright test tests/e2e/building-setup.spec.ts --project=chromium
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add web/app/demo web/app/landlord/buildings web/components/building web/tests/e2e/building-setup.spec.ts
git commit -m "feat: add building context onboarding"
```

---

### Task 11: Build Tenant Guided Intake UX

**Files:**
- Create/Modify: `web/app/t/[tenantToken]/page.tsx`
- Create: `web/app/t/[tenantToken]/questions/page.tsx`
- Create: `web/app/t/[tenantToken]/evidence/page.tsx`
- Create: `web/app/t/[tenantToken]/submitted/page.tsx`
- Create: `web/components/protocol/question-step.tsx`
- Create: `web/components/protocol/evidence-step.tsx`
- Test: `web/tests/e2e/tenant-intake.spec.ts`

**Interfaces:**
- One question per screen state.
- Supports HEATING and LEAK.
- Fixture evidence selection only in public demo.
- Safety can interrupt.

- [ ] **Step 1: Write RED mobile E2E test**

At viewport 390×844:
- open Building A tenant token;
- enter `난방이 안 돼요`;
- choose HEATING if parser is disabled;
- answer individual-heating questions;
- select synthetic control-panel evidence;
- submit;
- expect `필요한 정보가 준비됐어요`.

Also write safety test:
- gas smell yes;
- expect safety screen and no normal completion CTA.

- [ ] **Step 2: Verify RED**

```bash
npx playwright test tests/e2e/tenant-intake.spec.ts --project=mobile-chromium
```

- [ ] **Step 3: Implement minimal mobile-first guided flow**

One primary action per step. Do not expose internal reasoning.

- [ ] **Step 4: Verify**

```bash
npx playwright test tests/e2e/tenant-intake.spec.ts --project=mobile-chromium
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add web/app/t web/components/protocol web/tests/e2e/tenant-intake.spec.ts
git commit -m "feat: add tenant guided maintenance intake"
```

---

### Task 12: Build Landlord Dashboard, Repair Packet, and Human Decision UX

**Files:**
- Create/Modify: `web/app/landlord/tickets/page.tsx`
- Create: `web/app/landlord/tickets/[ticketId]/page.tsx`
- Create: `web/components/ticket/repair-packet.tsx`
- Create: `web/components/ticket/routing-basis.tsx`
- Create: `web/components/ticket/route-decision.tsx`
- Test: `web/tests/e2e/landlord-review.spec.ts`

**Interfaces:**
- Displays fact vs generated summary vs human decision distinctly.
- Hides normal approve when recommendation is null.
- Supports REQUEST_MORE_INFO and OVERRIDE_ROUTE.

- [ ] **Step 1: Write RED E2E tests**

Test normal complete ticket:
- recommendation shown;
- rationale/source labels shown;
- approve works.

Test incomplete ticket:
- no normal recommendation;
- `추가정보 요청` available.

Test override:
- choose different route;
- audit history shows recommended and selected.

- [ ] **Step 2: Verify RED**

```bash
npx playwright test tests/e2e/landlord-review.spec.ts --project=chromium
```

- [ ] **Step 3: Implement pages/components**

Status must never rely on color alone.

- [ ] **Step 4: Verify**

```bash
npx playwright test tests/e2e/landlord-review.spec.ts --project=chromium
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add web/app/landlord/tickets web/components/ticket web/tests/e2e/landlord-review.spec.ts
git commit -m "feat: add landlord repair review workflow"
```

---

### Task 13: Lock Hero A/B Demo and Re-finalization Workflow

**Files:**
- Create: `web/tests/e2e/hero-comparison.spec.ts`
- Create: `web/tests/e2e/more-info.spec.ts`
- Modify only files necessary to make tests pass.

**Interfaces:**
- Hero test is the contest acceptance gate.
- Same issue text + different building context = different protocol/route.
- More-info regenerates packet revision.

- [ ] **Step 1: Write RED Hero comparison**

```ts
test("same heating issue yields different protocol and route", async ({ page }) => {
  // Build A path -> LANDLORD_REVIEW + manufacturer alternative
  // Build B path -> MANAGEMENT_OFFICE
  // Assert visible question sets differ before final result.
});
```

Use user-visible assertions, not internal implementation selectors only.

- [ ] **Step 2: Write RED re-finalize workflow**

Flow:
```text
PARTIAL
→ landlord REQUEST_MORE_INFO
→ NEEDS_MORE_INFO
→ tenant supplies missing data
→ IN_PROGRESS
→ finalize
→ READY_FOR_REVIEW
→ packet revision increases
```

- [ ] **Step 3: Verify RED**

```bash
npx playwright test tests/e2e/hero-comparison.spec.ts tests/e2e/more-info.spec.ts --project=chromium
```

- [ ] **Step 4: Implement only missing behavior**

No OCR/QR/vendor scope expansion.

- [ ] **Step 5: Verify green**

```bash
npx playwright test tests/e2e/hero-comparison.spec.ts tests/e2e/more-info.spec.ts --project=chromium
```

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "test: lock contest hero workflows"
```

Before staging `web`, run `git status --short web` and verify every staged path is expected; do not use repository-root `git add .`.

---

### Task 14: Accessibility, Build, CI E2E, and Repository Verification

**Files:**
- Modify: `web/playwright.config.ts`
- Modify: `.github/workflows/web-check.yml`
- Modify: `web/README.md`
- Modify: `STATUS.md`
- Modify: `ops/AI_Execution_Log.csv`
- Create: `ops/building_aware_mvp_verification.md`

**Interfaces:**
- Produces final verification evidence.
- Does not claim customer validation or PMF.

- [ ] **Step 1: Configure Playwright projects**

Required projects:
```text
chromium
mobile-chromium (390×844)
webkit-smoke
```

- [ ] **Step 2: Add E2E CI after unit/build gates**

Extend `web-check.yml`:
```yaml
      - run: npx playwright install --with-deps chromium webkit
      - run: npm run test:e2e
```

Keep total timeout reasonable (15 minutes).

- [ ] **Step 3: Add README exact run commands**

`web/README.md` must include:
```bash
cd web
npm ci
npm test
npm run lint
npm run build
npm run test:e2e
npm run dev
```

Explain:
- FIXTURE is default;
- data is synthetic;
- no PMF/customer-effectiveness claim;
- LIVE provider work is not required for contest P0.

- [ ] **Step 4: Update `STATUS.md` application row only after fresh verification**

Target text:
```text
| Application implementation | CONTEST P0 IMPLEMENTED / VERIFIED LOCALLY | Building-aware fixture MVP; see [verification](ops/building_aware_mvp_verification.md) |
```

Do not use this text until every command in Step 5 has actually passed.

- [ ] **Step 5: Run full fresh verification**

From repository root:

```bash
cd web
npm ci
npm test
npm run lint
npm run build
npm run test:e2e
cd ..
python3 scripts/verify_repository.py --history
git diff --check
git status --short
```

Record exact:
- test counts;
- exit codes/failure counts;
- build result;
- E2E project results;
- repository verification result;
- any OPEN RISK / NOT TESTED item.

- [ ] **Step 6: Write verification receipt**

`ops/building_aware_mvp_verification.md` must contain only fresh observed evidence.

Required headings:
```markdown
# Building-Aware MVP Verification
## Environment
## Unit / Integration
## Lint
## Build
## E2E
## Repository Check
## Security / PII Review
## Open Risks
## Not Tested
## Commit Under Review
```

- [ ] **Step 7: Append execution-log row**

Use `estimated_tokens_used=unknown` unless the runtime exposes an actual measured count.

- [ ] **Step 8: Run a final diff review before commit**

```bash
git diff --check
git status --short
git diff --stat
git diff -- .github/workflows/web-check.yml STATUS.md ops/building_aware_mvp_verification.md ops/AI_Execution_Log.csv web/README.md web/playwright.config.ts
```

- [ ] **Step 9: Commit**

```bash
git add .github/workflows/web-check.yml STATUS.md ops/building_aware_mvp_verification.md ops/AI_Execution_Log.csv web/README.md web/playwright.config.ts
git commit -m "ci: verify building-aware contest MVP"
```

- [ ] **Step 10: Verify the committed HEAD before any completion claim**

```bash
git status --short
git log -1 --oneline
cd web
npm test
npm run lint
npm run build
npm run test:e2e
cd ..
python3 scripts/verify_repository.py --history
git diff-tree --check HEAD
```

Only after these pass may the implementer say the MVP is complete/passing.

---

# 3. Explicit Non-Goals During Execution

Do not add any of the following even if they appear useful:

```text
OCR
QR rendering
vendor marketplace
vendor secure link
payments
rent/accounting
contracts
tax
legal AI
insurance
weather context
preventive maintenance
asset warranty
native mobile app
IoT
3D scanning
real production auth
real customer data
real tenant upload storage in public demo
autonomous vendor dispatch
production hosting migration
```

If one of these becomes necessary to make a specified P0 test pass, stop and report a spec contradiction rather than expanding scope.

---

# 4. Required Checkpoints

After each committed task report exactly one line:

```text
CHECKPOINT | <task name> | evidence=<test command and commit SHA> | tokens=unknown
```

If a phase also acquires/uses a new skill, append the required execution-log row in the same phase.

---

# 5. Definition of Done

The plan is complete only when all are true:

- approved spec exists in repo;
- docs no longer conflict with approved P0;
- `web/` scaffold is isolated from canonical docs;
- two synthetic buildings exist;
- HEATING and LEAK are versioned protocols;
- safety hard stops precede normal routing;
- same heating issue visibly produces different Building A/B question flows and recommendations;
- incomplete/conflicting/safety cases receive no normal automatic recommendation;
- more-info/re-finalize flow works;
- route override is audited;
- LLM-disabled mode passes Hero flow;
- FIXTURE mode requires no external account/key;
- no real PII exists in fixtures/tests;
- unit/integration/lint/build/E2E pass fresh;
- existing repository verifier passes;
- final receipt states open risks without claiming customer validation, WTP, PMF, or final contest success.
