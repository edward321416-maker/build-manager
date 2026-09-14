# Building-Aware Web + Mobile MVP Implementation Plan v3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one authoritative Building-Aware maintenance engine and expose the approved P0 workflow to landlord and tenant users on both Next.js Web and Expo Mobile without duplicating decision logic.

**Architecture:** An npm-workspaces monorepo contains `apps/web`, `apps/mobile`, and five focused shared packages. Domain/application logic runs authoritatively on the Next.js server; clients consume versioned Zod contracts through a shared API client. Web and Mobile have capability parity but independent platform-native UI. Public P0 uses only synthetic fixtures and does not require external API accounts, LLMs, real media, production auth, EAS, or cloud database services.

**Tech Stack:** Node 24 LTS; Next.js 16.3.4; React 19.2.3; Expo SDK 57 / React Native 0.86.x; npm workspaces; TypeScript strict; Zod; Drizzle + Node `node:sqlite` local server adapter; Vitest; Playwright; jest-expo; React Native Testing Library.

**Spec:** `product/05_product_spec_v3_web_mobile_REAUDITED.md`

## Global Constraints

- This v3 plan **supersedes every v2 web-only implementation plan and prompt**.
- Repository: `edward321416-maker/build-manager`.
- Work in isolated branch/worktree `feat/building-aware-mvp`.
- Preserve existing documentation/research/governance/submission/ops structure.
- Root app structure: `apps/web`, `apps/mobile`, `packages/*`.
- P0 roles: landlord + tenant on Web and App.
- P0 protocols: HEATING and LEAK only.
- P0 buildings: two synthetic fixtures only.
- Safety/Protocol/Evidence/Route decisions execute on the server, not client UI.
- Web/Mobile may import `api-contracts`/`api-client`; Mobile must not import `domain`/`application`/`fixtures`.
- The public DTO package path/name is `packages/api-contracts` / `@build-manager/api-contracts`; never whitelist the reserved exact path segment `contracts`.
- Normal auto recommendation requires `COMPLETE` evidence and no safety escalation.
- `MISSING_REQUIRED`, `CONFLICTING`, `SAFETY_ESCALATED` => no normal recommendation.
- LLM is not required for P0.
- Real camera/gallery, push, production auth, vendor workflow, payments, OCR, QR, weather, EAS/Maestro are out of P0.
- No real private address, tenant PII, or real media in public Git.
- Strict TDD for behavior changes.
- No completion claim without fresh verification evidence.
- Append AI execution-log rows after major phases; token count is `unknown` unless measured.
- Stage named reviewed paths only; no repository-root `git add .`.
- Conventional Commits.

---

# Task 0: Repair Pre-existing Repository Verifier False Positive

**Files:**
- Create: `tests/test_verify_repository.py`
- Modify: `scripts/verify_repository.py`
- Modify: `ops/AI_Execution_Log.csv`

**Produces:** clean pre-application baseline.

- [ ] **Step 1: Write the regression tests first**

```python
import unittest

from scripts.verify_repository import scan_content


class VerifyRepositoryRegressionTests(unittest.TestCase):
    def test_official_viewer_url_is_not_resident_id(self):
        content = (
            "https://www.knuh.ac.kr/weblink/download/viewer/"
            "1788418418979/index.html"
        ).encode("utf-8")
        self.assertNotIn(
            "resident_id",
            scan_content("submission/official_requirements.md", content),
        )

    def test_plausible_synthetic_resident_id_is_detected(self):
        content = ("synthetic test id " + "900101" + "-1234567").encode("utf-8")
        self.assertIn(
            "resident_id",
            scan_content("tests/synthetic.txt", content),
        )


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Verify RED**

```bash
python3 -m unittest discover -s tests -p 'test_verify_repository.py'
```

Expected: URL test fails under the current broad resident-id pattern.

- [ ] **Step 3: Make the smallest verifier fix**

Replace only the `resident_id` pattern with:

```python
'resident_id': (
    r'(?<!\d)'
    r'\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])'
    r'[- ]?[1-8]\d{6}'
    r'(?!\d)'
),
```

This is a plausibility filter, not a checksum validator.

- [ ] **Step 4: Verify GREEN and baseline**

```bash
python3 -m unittest discover -s tests -p 'test_verify_repository.py'
python3 scripts/verify_repository.py --history
git diff --check
```

If another independent finding appears, report it instead of weakening unrelated scans.

- [ ] **Step 5: Log and commit**

```bash
git add tests/test_verify_repository.py scripts/verify_repository.py ops/AI_Execution_Log.csv
git commit -m "fix: avoid resident-id URL false positive"
```

---

# Task 1: Install v3 as Canonical Product Authority

**Files:**
- Create: `product/05_product_spec_v3_web_mobile_REAUDITED.md`
- Create: `docs/superpowers/plans/2026-09-14-building-aware-web-mobile-mvp.md`
- Modify: `product/mvp_scope.md`
- Modify: `STATUS.md`
- Modify: `ops/AI_Execution_Log.csv`

**Produces:** unambiguous current design/plan.

- [ ] **Step 1: Add approved v3 files byte-for-byte**

- [ ] **Step 2: Replace `product/mvp_scope.md` summary**

Use:

```markdown
# MVP Scope

Status: **[DECISION] Web + Mobile contest P0 approved on 2026-09-14.**

Canonical behavior: [Step 05 v3 Product Spec](05_product_spec_v3_web_mobile_REAUDITED.md).

P0 proves one hypothesis: verified building context changes maintenance questions, evidence requirements, and human-reviewed routing.

Delivery surfaces:
- Web Landlord + Web Tenant
- App Landlord + App Tenant

The same authoritative server-side Safety / Protocol / Routing behavior backs every surface. Capability parity does not require identical UI.

P0 uses two synthetic buildings and HEATING/LEAK only. No real PII/media, production auth, camera, push, vendor marketplace, payments, legal-liability allocation, or autonomous dispatch.

[AI Safety Boundary](ai_safety_boundary.md) remains authoritative.
```

- [ ] **Step 3: Update only application row in `STATUS.md`**

```text
| Application implementation | V3 SPEC APPROVED / IMPLEMENTATION STARTING | Web+Mobile npm-workspaces MVP; authoritative server core; two synthetic buildings × HEATING/LEAK |
```

- [ ] **Step 4: Verify docs**

```bash
python3 scripts/verify_repository.py --history
git diff --check
```

- [ ] **Step 5: Commit**

```bash
git add product/05_product_spec_v3_web_mobile_REAUDITED.md product/mvp_scope.md STATUS.md docs/superpowers/plans/2026-09-14-building-aware-web-mobile-mvp.md ops/AI_Execution_Log.csv
git commit -m "docs: approve web mobile MVP architecture"
```

---

# Task 2: Create npm Workspaces and Platform Skeletons

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `.nvmrc`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `apps/web/**`
- Create: `apps/mobile/**`
- Create: `packages/*/package.json`
- Modify: `.gitignore`
- Create: `.github/workflows/app-check.yml`

**Produces:** installable monorepo baseline.

- [ ] **Step 1: Write a failing shared smoke test**

`packages/api-contracts/src/product-meta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "./product-meta";

describe("product metadata", () => {
  it("uses the approved external product name", () => {
    expect(PRODUCT_NAME).toBe("건물 맞춤형 AI 수리 라우터");
  });
});
```

- [ ] **Step 2: Create root workspace metadata**

Root `package.json` must include:

```json
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=24 <25" },
  "overrides": {
    "react": "19.2.3",
    "react-dom": "19.2.3"
  }
}
```

Add semantic scripts for shared/web/mobile tests, lint, typecheck, Web build, dependency check, Web E2E.

- [ ] **Step 3: Scaffold `apps/web`**

Target:

```text
Next 16.3.4
React 19.2.3
App Router
TypeScript strict
```

Package name:

```text
@build-manager/web
```

- [ ] **Step 4: Scaffold `apps/mobile` with Expo SDK 57**

Package name:

```text
@build-manager/mobile
```

Use Expo Router. Ensure installed Expo resolves to SDK 57 stable, at least `57.0.17` compatible patch.

After scaffold, root lockfile must be authoritative. Do not keep nested package-lock files.

- [ ] **Step 5: Create shared package manifests**

Names:

```text
@build-manager/domain
@build-manager/application
@build-manager/api-contracts
@build-manager/api-client
@build-manager/fixtures
```

Workspace dependency graph:

```text
application → domain
api-contracts → zod
api-client → api-contracts
fixtures → domain
web server → domain/application/api-contracts/fixtures
web UI → api-contracts/api-client
mobile → api-contracts/api-client
```

- [ ] **Step 6: Implement smoke constant**

```ts
export const PRODUCT_NAME = "건물 맞춤형 AI 수리 라우터";
export const HERO_MESSAGE = "주소가 수리 프로토콜이 된다";
```

- [ ] **Step 7: Configure Next `transpilePackages`**

Include all local packages consumed by Web.

- [ ] **Step 8: Dependency alignment gate**

```bash
npm install
npm ls react
npm ls react-dom
npm ls react-native
npm ls expo
```

Expected:
- React 19.2.3 aligned.
- Expo SDK 57.
- RN stays in Expo-supported 0.86.x.

- [ ] **Step 9: Baseline green**

```bash
npm run test:shared
npm run lint
npm run typecheck
npm run build:web
```

- [ ] **Step 10: Commit**

```bash
git commit -m "chore: scaffold web mobile monorepo"
```

---

# Task 3: Public Contracts and Architecture Guard

**Files:**
- Create: `packages/api-contracts/src/*.ts`
- Create: `tests/architecture/import-boundaries.test.ts`

**Produces:** public DTOs and forbidden-import enforcement.

- [ ] **Step 1: RED contract tests**

Cover:

```text
BuildingPassportDto
LandlordTicketDetailDto
TenantTicketStatusDto
TenantQuestionDto
DecisionRequest union
ApiError
```

- [ ] **Step 2: RED import-boundary test**

Fail if `apps/mobile/**` imports:

```text
@build-manager/domain
@build-manager/application
@build-manager/fixtures
```

Also scan browser-facing Web UI directories for server-only package imports.

- [ ] **Step 3: Implement Zod contracts**

Never expose one giant internal Ticket to both roles.

- [ ] **Step 4: GREEN**

```bash
npm run test:shared
```

- [ ] **Step 5: Commit**

```text
feat: define cross-platform API contracts
```

---

# Task 4: Building Context and Synthetic Fixtures

**Files:**
- Create: `packages/domain/src/building/**`
- Create: `packages/fixtures/src/buildings.ts`
- Create tests.

**Produces:** A/B context and `routingEligible` semantics.

- [ ] RED tests for A/B, `routingEligible`, no real address.
- [ ] Implement minimal types/fixtures.
- [ ] GREEN `npm run test:shared`.
- [ ] Commit `feat: define building context fixtures`.

---

# Task 5: Deterministic Safety Engine

**Files:**
- `packages/domain/src/safety/**`
- tests

P0 flags:

```text
GAS_SMELL
SMOKE_OR_FIRE
ELECTRICAL_WATER_RISK
```

- [ ] RED one behavior per signal.
- [ ] Implement pure function; no model/network.
- [ ] GREEN.
- [ ] Commit `feat: add deterministic safety gate`.

---

# Task 6: Heating Protocol

**Files:**
- `packages/domain/src/protocol/heating.v1.ts`
- selector/evaluation tests

Required branches:

```text
HEATING_INDIVIDUAL_V1
HEATING_SHARED_V1
HEATING_UNKNOWN_V1
```

- [ ] RED Building A/B/UNKNOWN divergence.
- [ ] Implement only approved questions/evidence.
- [ ] GREEN.
- [ ] Commit `feat: add building-aware heating protocol`.

---

# Task 7: Leak Protocol and Evidence Gate

**Files:**
- `packages/domain/src/protocol/leak.v1.ts`
- `packages/domain/src/evidence/**`
- tests

Evidence states:

```text
COMPLETE
MISSING_REQUIRED
CONFLICTING
SAFETY_ESCALATED
```

- [ ] RED leak/evidence tests.
- [ ] Implement.
- [ ] GREEN.
- [ ] Commit `feat: add leak protocol and evidence gate`.

---

# Task 8: Routing, Repair Packet, Ticket State

**Files:**
- `packages/domain/src/routing/**`
- `packages/domain/src/packet/**`
- `packages/domain/src/ticket/**`
- tests

Mandatory RED tests:

```text
approval year change => route unchanged
heating type change => route changes
MISSING_REQUIRED => recommendation null
CONFLICTING => recommendation null
SAFETY_ESCALATED => recommendation null
REQUEST_MORE_INFO => NEEDS_MORE_INFO
refinalize => packet revision +1
```

Implement minimum functions:

```ts
recommendRoute()
buildRepairPacket()
requestMoreInfo()
applyRouteDecision()
```

- [ ] RED.
- [ ] Implement.
- [ ] GREEN.
- [ ] Commit `feat: add repair routing and review state`.

---

# Task 9: Framework-independent Application Use Cases

**Files:**
- `packages/application/src/ports/**`
- `packages/application/src/use-cases/**`
- in-memory test adapters
- tests

Exact use cases:

```text
createDemoBuilding
verifyBuildingContext
createTicket
submitTicketAnswer
submitTicketEvidence
finalizeTicket
approveRecommendation
overrideRoute
requestMoreInfo
listTickets
getTicket
```

`resetDemo` is the twelfth use case and lands in Task 10.1, once the API client
has established that the demo reset endpoint exists.

- [ ] RED using in-memory repositories.
- [ ] Implement ports/use cases.
- [ ] GREEN.
- [ ] Commit `feat: add maintenance application use cases`.

---

# Task 10: Shared Typed API Client

**Files:**
- `packages/api-client/src/client.ts`
- `packages/api-client/src/index.ts` (real package entrypoint)
- `packages/api-client/package.json` (add `@build-manager/api-contracts`)
- tests

Requirements:

- configurable `baseUrl` and injectable `fetchImpl`; no global singleton;
- no `process.env`, `EXPO_PUBLIC_API_URL`, or `window.location` read inside the package;
- imports api-contracts only; no direct `zod` dependency (use the schemas api-contracts exports);
- validates successful responses with Zod;
- parses the common error envelope;
- no domain/application/fixtures imports.

Role projection (see Spec 8.1 and 24.1):

```text
listTickets({ view: "landlord" }) -> LandlordTicketDetailDto[]
listTickets({ view: "tenant" })   -> TenantTicketStatusDto[]
```

`view` is `"landlord" | "tenant"` — a demo projection selector, never authentication.
Literal `view` must narrow the return type at compile time.

Sanitized errors only. Stable codes:

```text
NETWORK_ERROR
HTTP_ERROR
INVALID_RESPONSE
```

`ApiClientError` never retains a raw response body, raw `ZodError`, raw validation
input, tenant answer/evidence payload, or an arbitrary fetch `cause`.

Out of scope here: retry, backoff, timeout framework, offline cache, request queue,
telemetry, payload logging, `searchAddress()`.

- [ ] RED fetch-adapter tests with an injected fake fetch.
- [ ] Implement.
- [ ] Extend the architecture suite: api-client source import boundary **and** a
      runtime dependency allowlist check on `packages/api-client/package.json`.
- [ ] GREEN.
- [ ] Commit `feat: add shared maintenance API client`.

---

# Task 10.1: Demo Reset Application Path

**Files:**
- `packages/application/src/ports/**` (add `DemoStateResetter`)
- `packages/application/src/use-cases/reset-demo.ts`
- tests

**Produces:** the missing application path behind the client's `resetDemo()`.

The API client exposes `resetDemo()` but no use case backs it. Without this,
the Task 12 route handler would have to reach into a repository or the fixture
package directly, bypassing the application layer.

Approved path:

```text
HTTP
→ Application resetDemo()
→ DemoStateResetter port
→ Task 11 server adapter
```

Port concept — follow the existing Task 9 async port convention:

```ts
type DemoStateResetter = {
  reset(): Promise<Building[]>;
};
```

The use case calls the port and returns the buildings it yields. It performs no
reset logic of its own. `packages/application` must still import no fixtures,
Drizzle, `node:sqlite`, Next, React, or Expo.

- [ ] RED against a fake resetter: called exactly once, buildings returned
      unchanged, resetter error propagates.
- [ ] Implement port and use case.
- [ ] GREEN.
- [ ] Commit `feat: add demo reset application use case`.

---

# Task 11: Next Server Composition and Persistence

**Files:**
- `apps/web/src/server/container.ts`
- `apps/web/src/server/persistence/**`
- `apps/web/src/server/providers/**`
- integration tests

P0 adapters:

- in-memory for tests;
- Node `node:sqlite` + Drizzle local server adapter;
- fixture building/address providers.

- [ ] RED repository contract against memory.
- [ ] RED temporary SQLite integration.
- [ ] Implement.
- [ ] Assert domain/application do not import Drizzle.
- [ ] GREEN.
- [ ] Commit `feat: add local server persistence adapters`.

---

# Task 12: `/api/v1` Route Handlers

**Files:**
- `apps/web/src/app/api/v1/**`
- integration tests

Endpoints:

```text
GET  /api/v1/demo/buildings
POST /api/v1/demo/reset
GET  /api/v1/address/search
GET  /api/v1/buildings/:id
PATCH /api/v1/buildings/:id/context
GET  /api/v1/tickets
POST /api/v1/tickets
GET  /api/v1/tickets/:id
POST /api/v1/tickets/:id/answers
POST /api/v1/tickets/:id/evidence
POST /api/v1/tickets/:id/finalize
POST /api/v1/tickets/:id/decision
```

- [ ] RED full fixture API integration.
- [ ] Zod validate input/output.
- [ ] Separate landlord/tenant response views.
- [ ] Never leak raw stack.
- [ ] GREEN.
- [ ] Commit `feat: expose maintenance API v1`.

---

# Task 13: Web Landlord Capability

**Produces:** desktop-focused landlord surface.

Capabilities:

```text
DEMO role
building select
Building Passport
owner verify
ticket list
Repair Packet
Why/provenance
approve/override/more-info
```

- [ ] Write Playwright RED first.
- [ ] Implement using api-contracts/api-client only in browser-facing code.
- [ ] GREEN.
- [ ] Commit `feat: add landlord web workflow`.

---

# Task 14: Web Tenant Capability

Capabilities:

```text
DEMO tenant entry
issue input
one question per step
synthetic evidence
safety interruption
submitted/status
more-info response
```

- [ ] RED mobile-viewport Playwright.
- [ ] Implement.
- [ ] GREEN.
- [ ] Commit `feat: add tenant web workflow`.

---

# Task 15: Expo Router Mobile Shell

**Files:**
- Expo Router routes/layouts
- `apps/mobile/src/lib/api.ts`
- `.env.example`
- Jest/RNTL config/tests

Requirements:

```text
EXPO_PUBLIC_API_URL = URL only
no secret
no domain/application/fixtures import
```

- [ ] RED DEMO role-entry test.
- [ ] Configure Expo Router.
- [ ] Configure shared api-client.
- [ ] GREEN.
- [ ] Commit `feat: configure mobile app shell`.

---

# Task 16: App Tenant Capability

Capabilities:

```text
DEMO role
issue
question
synthetic evidence
safety
submitted/status
more-info response
```

Tests:

- HEATING DTO render;
- LEAK DTO render;
- one question at a time;
- safety interruption;
- missing evidence status;
- more-info response.

- [ ] RED using jest-expo/RNTL/Router testing utilities.
- [ ] Implement native UI without camera/gallery.
- [ ] GREEN.
- [ ] Commit `feat: add tenant mobile workflow`.

---

# Task 17: App Landlord Capability

Capabilities:

```text
demo building select
Building Passport
owner context verify
ticket list
compact Repair Packet
Why/provenance
approve/override/more-info
```

Tests:

- Landlord DTO semantics;
- actions call shared api-client;
- tenant-only view separation;
- no forbidden imports.

- [ ] RED.
- [ ] Implement.
- [ ] GREEN.
- [ ] Commit `feat: add landlord mobile workflow`.

---

# Task 18: Cross-platform Contract Parity and Hero Scenarios

**Hero A:**

```text
App Tenant
→ Building A HEATING
→ API
→ Web Landlord
→ LANDLORD_REVIEW + manufacturer alternative
→ approve
```

**Hero B:**

```text
Web Tenant
→ Building B HEATING
→ API
→ App Landlord
→ MANAGEMENT_OFFICE
→ decision
```

Proof strategy:

- server/API integration;
- Web Playwright;
- Mobile Jest/RNTL/router tests;
- shared DTO fixtures.

Do not require one test runner to drive Web + native simultaneously.

- [ ] RED parity assertions.
- [ ] Implement only missing behavior.
- [ ] GREEN.
- [ ] Commit `test: lock cross-platform hero flows`.

---

# Task 19: Mobile Health / Bundle Gates Without EAS

Required checks:

```bash
npm ls react
npm ls react-dom
npm ls react-native
npm ls expo
```

From the correct Mobile workspace/context:

```bash
npx expo-doctor@latest
npx expo export --platform android --output-dir .expo-export-android
npx expo export --platform ios --output-dir .expo-export-ios
```

Generated export dirs are ignored.

No EAS account connection.

- [ ] Run Mobile tests.
- [ ] Review dependency tree.
- [ ] Run Expo Doctor.
- [ ] Android export.
- [ ] iOS export.
- [ ] Record exact output.
- [ ] Commit `ci: add mobile health verification`.

---

# Task 20: Integrated CI and Fresh Final Verification

**Files:**
- `.github/workflows/app-check.yml`
- `ops/building_aware_web_mobile_mvp_verification.md`
- `STATUS.md`
- `ops/AI_Execution_Log.csv`

CI should cover, where supported without external account:

```text
npm ci
shared tests
web tests
mobile tests
lint
typecheck
web build
dependency tree check
Web Playwright
repository verifier
```

Do not connect EAS automatically.

Fresh local gate:

```bash
npm ci
npm run test:shared
npm run test:web
npm run test:mobile
npm run lint
npm run typecheck
npm run build:web
npm run check:deps
```

Then Mobile from correct workspace:

```bash
npx expo-doctor@latest
npx expo export --platform android --output-dir .expo-export-android
npx expo export --platform ios --output-dir .expo-export-ios
```

Then:

```bash
npm run test:e2e:web
python3 -m unittest discover -s tests
python3 scripts/verify_repository.py --history
git diff --check
git status --short
```

If an exact workspace invocation must differ, record the actual equivalent command. Never silently skip.

Verification receipt headings:

```markdown
# Building-Aware Web + Mobile MVP Verification
## Environment
## Dependency Resolution
## Shared Core Tests
## Web Tests
## Mobile Tests
## Lint / Typecheck
## Web Build
## Mobile Expo Doctor
## Android Export
## iOS Export
## Web E2E
## Architecture Boundary
## Repository Verification
## Privacy / Secret Review
## Open Risks
## Not Tested
## Commit Under Review
```

Only after fresh pass may STATUS say:

```text
CONTEST P0 WEB+MOBILE IMPLEMENTED / VERIFIED LOCALLY
```

Never claim App Store/Play Store build unless actually performed.

Commit:

```text
ci: verify web mobile contest MVP
```

---

# Required Commit Sequence

```text
fix: avoid resident-id URL false positive
docs: approve web mobile MVP architecture
chore: scaffold web mobile monorepo
feat: define cross-platform API contracts
feat: define building context fixtures
feat: add deterministic safety gate
feat: add building-aware heating protocol
feat: add leak protocol and evidence gate
feat: add repair routing and review state
feat: add maintenance application use cases
feat: add shared maintenance API client
feat: add local server persistence adapters
feat: expose maintenance API v1
feat: add landlord web workflow
feat: add tenant web workflow
feat: configure mobile app shell
feat: add tenant mobile workflow
feat: add landlord mobile workflow
test: lock cross-platform hero flows
ci: add mobile health verification
ci: verify web mobile contest MVP
```

---

# Stop Conditions

Stop and report instead of scope expansion if:

- Expo SDK 57 resolves incompatible React tree;
- React/RN duplicates cannot be corrected within official support;
- a shared domain package needs UI/native framework imports;
- Mobile requires direct domain/application import;
- authoritative server behavior cannot fit approved contracts;
- P0 requires production auth/camera/push/EAS;
- an external paid/account service becomes mandatory;
- repository verifier exposes a new independent privacy finding;
- unrelated research/governance deletion is required.

---

# Definition of Done

Fresh evidence must show:

- npm workspace installs;
- React/RN/Expo dependency tree acceptable;
- domain/application pure from UI frameworks;
- client import boundary passes;
- two synthetic buildings;
- HEATING + LEAK;
- safety precedence;
- evidence gate;
- route rationale/provenance;
- approve/override/more-info;
- packet revision on refinalize;
- Web landlord + tenant capability;
- App landlord + tenant capability;
- Hero A semantic flow proven;
- Hero B semantic flow proven;
- shared tests pass;
- Web tests/build/Playwright pass;
- Mobile Jest/RNTL pass;
- Expo Doctor passes;
- Android/iOS exports pass;
- repository verifier passes;
- no real PII/media/secrets;
- verification receipt lists risks and not-tested surfaces;
- no PMF/WTP/customer-effectiveness claim.
