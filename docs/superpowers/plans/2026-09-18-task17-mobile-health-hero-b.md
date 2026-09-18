# Task 17 Mobile Health + Cross-platform Hero B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add verification-only Hero B coverage proving Web Tenant + authoritative API + App Landlord contract parity for Building B HEATING, close the local Expo export-ignore gap, and collect fresh Node 24 / Expo Doctor / Android+iOS export / regression evidence without changing frozen product behavior.

**Architecture:** Task 17 adds one Web Playwright verification, one Mobile RNTL verification, and two scoped Mobile ignore rules. The Web test drives the real Web Tenant UI and then runtime-validates the real landlord API projection; the Mobile test feeds an independently runtime-validated equivalent `LandlordTicketDetailDto` into the existing Task 16 `TicketReview` and proves approval behavior. Product code, domain rules, fixtures, public contracts, and API-client behavior remain read-only unless a newly reproduced BLOCKER/HIGH forces a separate reopening decision.

**Tech Stack:** Node 24.x; npm workspaces; Next.js 16.3.4; Playwright 1.63.0; Expo SDK 57.0.22; React Native 0.86.3; React 19.2.3; Expo Router 57.0.21; TypeScript 6.0.x; Jest / `jest-expo`; React Native Testing Library; `expo-doctor@1.20.4`.

**Spec:** `docs/superpowers/specs/2026-09-17-task17-mobile-health-hero-b-design.md`

**Approved-design baseline:** `feat/building-aware-mvp@728f4862345115e8dc84d3b316986c1830bc87c3`

**Frozen product baseline:** `feat/building-aware-mvp@9aa80fbee3f05a9191f1daad6e4e4e051d3beb1d`

## Global Constraints

- Repository: `edward321416-maker/build-manager`; implementation branch: `feat/building-aware-mvp`.
- The execution handoff must provide one exact remote `TARGET_REF` containing this approved design and this plan. Before editing, fetch the branch and prove local `HEAD == TARGET_REF`. If not, `STOP_AND_REPORT`; do not merge, rebase, reset, amend, or force-push to manufacture a match.
- Read `main` policy files at the handoff `POLICY_REF` without merging `main` into the feature worktree.
- Runtime requirement is exact major Node 24: `.nvmrc = 24`, root `package.json engines = >=24 <25`. Record `node --version` and `npm --version` before runtime gates. Any non-24 Node result is an environment blocker.
- Run a fresh root `npm ci` before Task 17 runtime verification. A failed install is an environment/tooling blocker; it is not permission to modify manifests, lockfiles, SDK versions, or frozen product code.
- No new dependency is approved. `package.json`, `package-lock.json`, `apps/mobile/package.json`, and `apps/mobile/app.json` are frozen.
- Task 15 Tenant, Task 16 Landlord, Web product code, shared domain/application/fixtures/contracts/API client, and server behavior stay frozen. In particular, do not edit:
  - `apps/web/src/**`
  - `apps/mobile/src/features/tenant/**`
  - `apps/mobile/src/app/tenant/**`
  - `apps/mobile/src/features/landlord/**`
  - `apps/mobile/src/app/landlord/**`
  - `packages/domain/**`
  - `packages/application/**`
  - `packages/fixtures/**`
  - `packages/api-contracts/**`
  - `packages/api-client/**`
  - `.github/workflows/**`
- The only expected implementation files are:
  - create `apps/web/tests/e2e/cross-platform-hero-b.spec.ts`
  - create `apps/mobile/src/testing/cross-platform-hero-b.test.tsx`
  - modify `apps/mobile/.gitignore`
- Test-only helpers may be added only under the existing Web E2E or Mobile testing directories if genuinely necessary. Do not create a new production/shared helper API.
- Hero B is fixed: Web Tenant → Building B → HEATING → server-returned guided intake → required synthetic evidence → finalize → `READY_FOR_REVIEW + COMPLETE` → landlord projection recommends `MANAGEMENT_OFFICE` → App Landlord renders the equivalent public contract → approve → returned state `APPROVED`.
- The cross-platform claim is composite contract parity, not one browser-created ticket physically opened by a native emulator. Do not claim emulator/device execution, production auth, native compilation, signing, EAS, or app-store readiness.
- Safety question count is not a client contract. The Web test answers every currently returned yes/no question with `no` until the server presents `FIXTURE_VIEW`; it must not encode “four safety questions” as product truth.
- Runtime-valid contract evidence uses `LandlordTicketDetailDtoSchema.parse(...)`. A TypeScript cast alone is not sufficient.
- Hero B tests are verification of frozen behavior. Their first valid run may already PASS. Do not sabotage setup or product behavior to manufacture RED. If a first valid run fails because accepted product behavior is broken, `STOP_AND_REPORT`.
- The `.gitignore` change is a real behavior change to repository hygiene and must demonstrate a genuine `git check-ignore` RED→GREEN transition.
- Pin Expo Doctor to `expo-doctor@1.20.4`. Do not use `@latest`, `expo install --fix`, SDK upgrade, dependency upgrade, or any automatic remediation without a separate reopening decision.
- Expo export proves JS/assets bundling only. It does not prove Xcode/Gradle native compilation, APK/AAB, `.app`, simulator/device execution, signing, EAS, App Store, or Play Store readiness.
- Do not automatically delete generated export directories. After Task 3 they are intentionally ignored; leave them local unless the operator explicitly authorizes removal of those exact generated targets.
- Make small Conventional Commits from named paths only. Never use `git add .`, `git add -A`, `git commit -a`, empty commits, history rewrite, or force push.
- Do not push until all Task 17 final gates pass and the remote feature branch still equals the execution `TARGET_REF`.
- Google Sheet/Drive execution-log synchronization remains separate. If no authorized transport exists, queue sanitized rows and report `PENDING`; never claim sync.

## Mandatory execution preflight

Before Task 1:

```bash
git fetch origin --prune
git rev-parse HEAD
git rev-parse origin/feat/building-aware-mvp
git status --short --untracked-files=all
node --version
npm --version
git diff --name-only 9aa80fbee3f05a9191f1daad6e4e4e051d3beb1d..HEAD
```

Require:

```text
HEAD == handoff TARGET_REF
origin/feat/building-aware-mvp == handoff TARGET_REF
working tree clean
Node = v24.x
delta from Task 16 product baseline = Task 17 design/plan docs only
```

Then:

```bash
npm ci
git status --short --untracked-files=all
git diff -- package.json package-lock.json apps/mobile/package.json apps/mobile/app.json
```

Require no tracked manifest/lock/config mutation. If `npm ci` cannot complete, stop as an environment/tooling blocker.

---

### Task 1: Lock Web Tenant → API Hero B contract proof

**Files:**
- Create: `apps/web/tests/e2e/cross-platform-hero-b.spec.ts`
- Reference only: `apps/web/tests/e2e/web-milestone.spec.ts`
- Reference only: `packages/api-contracts/src/ticket.ts`

**Interfaces:**
- Consumes: existing Web Tenant controls under `/demo/tenant`, existing API `GET /api/v1/tickets/{ticketId}?view=landlord`, `LandlordTicketDetailDtoSchema`.
- Produces: a Playwright proof that a real Building B HEATING ticket created via Web UI reaches `READY_FOR_REVIEW + COMPLETE` and projects to a runtime-valid landlord DTO recommending `MANAGEMENT_OFFICE`.

- [ ] **Step 1: Create the dedicated Hero B Playwright test**

Create `apps/web/tests/e2e/cross-platform-hero-b.spec.ts` with this structure:

```ts
import { LandlordTicketDetailDtoSchema } from "@build-manager/api-contracts";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const BUILDING_B = "demo-building-b";
const ORDINARY_HEATING = "난방이 안 돼요";
const FIXTURE_EVIDENCE = "submit-FIXTURE_VIEW";

async function resetDemo(request: APIRequestContext): Promise<void> {
  expect((await request.post("/api/v1/demo/reset")).status()).toBe(200);
}

function questionHeading(page: Page) {
  return page.locator(".question-card h2");
}

async function answerNoAndWait(page: Page): Promise<void> {
  const before = await questionHeading(page).textContent();

  await page.getByTestId("answer-no").click();

  await expect
    .poll(async () => {
      if (await page.getByTestId(FIXTURE_EVIDENCE).isVisible().catch(() => false)) {
        return "__EVIDENCE__";
      }
      return (await questionHeading(page).textContent()) ?? "__NO_QUESTION__";
    })
    .not.toBe(before ?? "");
}

async function answerUntilFixtureEvidence(page: Page): Promise<void> {
  for (let guard = 0; guard < 12; guard += 1) {
    if (await page.getByTestId(FIXTURE_EVIDENCE).isVisible().catch(() => false)) {
      return;
    }

    await expect(page.getByTestId("answer-no")).toBeVisible();
    await answerNoAndWait(page);
  }

  throw new Error("Hero B did not reach FIXTURE_VIEW evidence within 12 answers");
}

test("Hero B: Web Tenant produces the Building B management-office landlord contract", async ({
  page,
  request,
}) => {
  await resetDemo(request);
  await page.goto("/demo/tenant");

  await page.locator(`#building-${BUILDING_B}`).check();
  await page.locator("#issue-HEATING").check();
  await page.getByLabel("어떤 상황인지 적어 주세요").fill(ORDINARY_HEATING);
  await page.getByTestId("create-ticket").click();

  await expect(page).toHaveURL(/\/demo\/tenant\/tickets\//);
  const ticketId = page.url().split("/").pop()!;
  expect(ticketId).toBeTruthy();

  await answerUntilFixtureEvidence(page);

  await page.getByTestId(FIXTURE_EVIDENCE).click();
  await expect(page.getByTestId("finalize")).toBeVisible();
  await page.getByTestId("finalize").click();

  await expect(page.getByText("상태: 검토 대기")).toBeVisible();
  await expect(page.getByText("정보 상태: 필수 정보 확인됨")).toBeVisible();

  const response = await request.get(
    `/api/v1/tickets/${encodeURIComponent(ticketId)}?view=landlord`,
  );
  expect(response.status()).toBe(200);

  const landlord = LandlordTicketDetailDtoSchema.parse(await response.json());

  expect(landlord.ticketId).toBe(ticketId);
  expect(landlord.building.buildingId).toBe(BUILDING_B);
  expect(landlord.issueType).toBe("HEATING");
  expect(landlord.status).toBe("READY_FOR_REVIEW");
  expect(landlord.evidenceStatus).toBe("COMPLETE");
  expect(landlord.repairPacket).not.toBeNull();
  expect(landlord.repairPacket?.safetyEscalated).toBe(false);
  expect(landlord.repairPacket?.recommendation?.routeCode).toBe(
    "MANAGEMENT_OFFICE",
  );
  expect(landlord.repairPacket?.recommendation?.reasons.length).toBeGreaterThan(0);
  expect(landlord.repairPacket?.provenance).toEqual(
    expect.arrayContaining(["heatingType", "managementMode"]),
  );
});
```

Do not import domain/application/fixtures into this test. The only business-contract import is the public DTO schema.

- [ ] **Step 2: Run the first valid focused Web Hero B verification**

From repository root:

```bash
npm --workspace @build-manager/web run test:e2e -- tests/e2e/cross-platform-hero-b.spec.ts
```

Interpretation:

- PASS on first valid run is acceptable and is recorded as an existing-pass verification.
- FAIL caused by bad selector/test construction may be corrected inside this new test file.
- FAIL proving the accepted Web Tenant/API behavior cannot reach the specified Hero B contract is `STOP_AND_REPORT`; do not edit frozen product code.

- [ ] **Step 3: Re-run the focused test after any test-only correction**

```bash
npm --workspace @build-manager/web run test:e2e -- tests/e2e/cross-platform-hero-b.spec.ts
```

Require: 0 failed.

- [ ] **Step 4: Inspect the Task 1 diff**

```bash
git diff --check -- apps/web/tests/e2e/cross-platform-hero-b.spec.ts
git diff -- apps/web/tests/e2e/cross-platform-hero-b.spec.ts
```

Require: only the new verification test.

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/web/tests/e2e/cross-platform-hero-b.spec.ts
git diff --cached --check
git diff --cached --name-only
git commit -m "test: lock web hero b contract"
```

---

### Task 2: Lock App Landlord Hero B presentation and approval proof

**Files:**
- Create: `apps/mobile/src/testing/cross-platform-hero-b.test.tsx`
- Reference only: `apps/mobile/src/features/landlord/ticket-review.tsx`
- Reference only: `apps/mobile/src/features/landlord/ticket-review.test.tsx`
- Reference only: `packages/api-contracts/src/ticket.ts`

**Interfaces:**
- Consumes: existing `TicketReview`, injected shared `ApiClient`, public `LandlordTicketDetailDtoSchema`.
- Produces: a Mobile RNTL proof that the equivalent runtime-valid Building B HEATING landlord contract renders `MANAGEMENT_OFFICE`, hides compact-packet-excluded fields, excludes the recommended route from override choices, and submits one approval for the exact ticket id.

- [ ] **Step 1: Create the dedicated Mobile Hero B test**

Create `apps/mobile/src/testing/cross-platform-hero-b.test.tsx`:

```tsx
import type { ApiClient } from "@build-manager/api-client";
import { LandlordTicketDetailDtoSchema } from "@build-manager/api-contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { TicketReview } from "../features/landlord/ticket-review";

const HERO_B_TICKET_ID = "hero-b-building-b-heating";

const heroB = LandlordTicketDetailDtoSchema.parse({
  ticketId: HERO_B_TICKET_ID,
  building: {
    buildingId: "demo-building-b",
    displayName: "DEMO 라온하우징",
    demo: true,
    primaryUse: "공동주택",
    approvalYear: "2018",
    managementMode: "MANAGEMENT_OFFICE",
    heatingType: "CENTRAL_SHARED",
    contextVerified: true,
    routingEligibleFields: ["managementMode", "heatingType"],
  },
  issueType: "HEATING",
  protocol: "HEATING_V1",
  status: "READY_FOR_REVIEW",
  evidenceStatus: "COMPLETE",
  activeQuestion: null,
  repairPacket: {
    revision: 1,
    summary: "난방 접수 건입니다. 필수 정보가 준비되었습니다.",
    safetyEscalated: false,
    recommendation: {
      routeCode: "MANAGEMENT_OFFICE",
      label: "관리사무소",
      reasons: [
        "공용난방 및 관리사무소 관리의 검증된 건물 정보를 기준으로 관리사무소 검토가 우선입니다.",
      ],
    },
    routeAlternatives: [
      { routeCode: "LANDLORD_REVIEW", label: "임대인 검토" },
    ],
    provenance: ["heatingType", "managementMode"],
    internalNotes: ["HERO_B_INTERNAL_ONLY"],
    estimatedCost: { currency: "KRW", minimum: 10000, maximum: 20000 },
    affectedUnits: ["203호"],
    hiddenContacts: ["HERO_B_HIDDEN_CONTACT"],
  },
  decision: null,
  followUpOptions: {
    questions: [],
    evidence: [],
  },
});

const approvedHeroB = LandlordTicketDetailDtoSchema.parse({
  ...heroB,
  status: "APPROVED",
  decision: { type: "APPROVE" },
});

test("Hero B: App Landlord renders and approves the management-office contract", async () => {
  const getLandlordTicket = jest.fn(async (ticketId: string) => {
    expect(ticketId).toBe(HERO_B_TICKET_ID);
    return heroB;
  });
  const approveRoute = jest.fn(async (ticketId: string) => {
    expect(ticketId).toBe(HERO_B_TICKET_ID);
    return approvedHeroB;
  });

  const client = {
    getLandlordTicket,
    approveRoute,
    overrideRoute: jest.fn(),
    requestMoreInfo: jest.fn(),
  } as unknown as ApiClient;

  render(
    <TicketReview
      client={client}
      onBack={jest.fn()}
      ticketId={HERO_B_TICKET_ID}
    />,
  );

  expect(await screen.findByText("관리사무소")).toBeTruthy();
  expect(
    screen.getByText(
      "공용난방 및 관리사무소 관리의 검증된 건물 정보를 기준으로 관리사무소 검토가 우선입니다.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("heatingType")).toBeTruthy();
  expect(screen.getByText("managementMode")).toBeTruthy();

  expect(screen.queryByTestId("route-MANAGEMENT_OFFICE")).toBeNull();
  expect(screen.getByTestId("route-LANDLORD_REVIEW")).toBeTruthy();

  expect(screen.queryByText("HERO_B_INTERNAL_ONLY")).toBeNull();
  expect(screen.queryByText("HERO_B_HIDDEN_CONTACT")).toBeNull();
  expect(screen.queryByText("203호")).toBeNull();
  expect(screen.queryByText("10,000")).toBeNull();

  await fireEvent.press(screen.getByTestId("approve"));

  await waitFor(() => expect(approveRoute).toHaveBeenCalledTimes(1));
  expect(approveRoute).toHaveBeenCalledWith(HERO_B_TICKET_ID);
  expect(await screen.findByText("상태: 승인됨")).toBeTruthy();
});
```

The fixture must remain schema-parsed. Do not replace `LandlordTicketDetailDtoSchema.parse(...)` with `as LandlordTicketDetailDto`.

- [ ] **Step 2: Run the first valid focused Mobile Hero B verification**

From repository root:

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/testing/cross-platform-hero-b.test.tsx
```

Interpretation:

- PASS on first valid run is acceptable.
- Test-only fixture/assertion mistakes may be corrected inside this new test.
- A failure proving existing `TicketReview` cannot render/approve a contract-valid Hero B DTO is `STOP_AND_REPORT`; do not edit Task 16 product code.

- [ ] **Step 3: Re-run the focused Mobile test after any test-only correction**

```bash
npm --workspace @build-manager/mobile run test -- --runInBand src/testing/cross-platform-hero-b.test.tsx
```

Require: 0 failed.

- [ ] **Step 4: Inspect the Task 2 diff**

```bash
git diff --check -- apps/mobile/src/testing/cross-platform-hero-b.test.tsx
git diff -- apps/mobile/src/testing/cross-platform-hero-b.test.tsx
```

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/mobile/src/testing/cross-platform-hero-b.test.tsx
git diff --cached --check
git diff --cached --name-only
git commit -m "test: lock mobile hero b contract"
```

---

### Task 3: Make Task 17 export artifacts explicitly local

**Files:**
- Modify: `apps/mobile/.gitignore`

**Interfaces:**
- Consumes: the Task 16 finding that `.expo-export-android` was not ignored.
- Produces: exactly two ignore rules for Task 17 Android/iOS Expo export directories.

- [ ] **Step 1: Prove the current ignore behavior is RED**

From repository root:

```bash
git check-ignore -q apps/mobile/.expo-export-android/probe
printf 'android ignore exit=%s\n' "$?"
git check-ignore -q apps/mobile/.expo-export-ios/probe
printf 'ios ignore exit=%s\n' "$?"
```

PowerShell equivalent:

```powershell
git check-ignore -q apps/mobile/.expo-export-android/probe
"android ignore exit=$LASTEXITCODE"
git check-ignore -q apps/mobile/.expo-export-ios/probe
"ios ignore exit=$LASTEXITCODE"
```

Expected before the change: both exit codes = 1.

If either path is already ignored at the execution `TARGET_REF`, stop and inspect why before editing; do not duplicate broader rules blindly.

- [ ] **Step 2: Add only the two approved ignore rules**

Append under the Expo/generated-output portion of `apps/mobile/.gitignore`:

```gitignore
/.expo-export-android/
/.expo-export-ios/
```

Do not add wildcards that hide unrelated directories.

- [ ] **Step 3: Prove GREEN with rule provenance**

```bash
git check-ignore -v apps/mobile/.expo-export-android/probe
git check-ignore -v apps/mobile/.expo-export-ios/probe
```

Require both output lines to identify `apps/mobile/.gitignore` and the exact new rule.

- [ ] **Step 4: Inspect and commit Task 3**

```bash
git diff --check -- apps/mobile/.gitignore
git diff -- apps/mobile/.gitignore
git add apps/mobile/.gitignore
git diff --cached --check
git diff --cached --name-only
git commit -m "chore: ignore mobile export artifacts"
```

---

### Task 4: Run fresh Task 17 regression, Mobile Health, export, and publication gates

**Files:**
- No new product file.
- No generated export artifact may be staged or committed.
- Any execution-log queue file must stay outside the public feature delta unless a separately authorized logging path says otherwise.

**Interfaces:**
- Consumes: Tasks 1–3 candidate tree.
- Produces: fresh evidence sufficient for Task 17 acceptance review and a normal fast-forward publication only if every required gate passes.

- [ ] **Step 1: Reconfirm runtime and candidate identity**

```bash
node --version
npm --version
git rev-parse HEAD
git status --short --untracked-files=all
```

Require Node 24.x and a clean tracked tree before runtime verification. Ignored export directories must not be relied upon yet because exports have not run.

- [ ] **Step 2: Reconfirm clean dependency install and frozen manifests**

```bash
npm ci
git diff -- package.json package-lock.json apps/mobile/package.json apps/mobile/app.json
npm run check:deps
```

Require no manifest/config delta and dependency check exit 0.

- [ ] **Step 3: Run focused Hero B proofs again**

```bash
npm --workspace @build-manager/web run test:e2e -- tests/e2e/cross-platform-hero-b.spec.ts
npm --workspace @build-manager/mobile run test -- --runInBand src/testing/cross-platform-hero-b.test.tsx
```

Require both focused groups to pass.

- [ ] **Step 4: Run the full regression gates**

```bash
npm run test:shared
npm run test:web
npm run test:mobile
npm run lint
npm run typecheck
npm run typecheck:tests
npm run build:web
npm run test:e2e:web
npm run check:deps
```

Record actual suite/test counts and exit codes. Do not reuse Task 16 counts as Task 17 evidence.

If any failure points to a frozen product-code defect, stop instead of widening scope.

- [ ] **Step 5: Pin and verify Expo Doctor tooling**

From `apps/mobile`:

```bash
npx --yes expo-doctor@1.20.4 --version
npx --yes expo-doctor@1.20.4 .
```

Expected version: `1.20.4`. Require Doctor exit 0 and no failed check silently ignored.

Do not run `expo install --fix`, install a different SDK, or edit dependency/config files in response to a Doctor finding. A finding requiring those changes is `STOP_AND_REPORT`.

- [ ] **Step 6: Run fresh Android Expo export**

Record:

```bash
git rev-parse HEAD
git status --short --untracked-files=all
```

POSIX:

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 \
  npx expo export \
  --platform android \
  --output-dir .expo-export-android
cd ../..
```

PowerShell:

```powershell
Push-Location apps/mobile
$env:EXPO_PUBLIC_API_URL = "http://10.0.2.2:3000"
npx expo export --platform android --output-dir .expo-export-android
Remove-Item Env:EXPO_PUBLIC_API_URL -ErrorAction SilentlyContinue
Pop-Location
```

Then verify:

```bash
git rev-parse HEAD
git check-ignore -v apps/mobile/.expo-export-android/probe
git status --short --untracked-files=all
```

Require:
- export exit 0;
- HEAD unchanged;
- output directory exists and is non-empty;
- export path is ignored;
- no export file appears staged or as non-ignored untracked content.

Do not infer native Android build/device evidence.

- [ ] **Step 7: Run fresh iOS Expo export**

POSIX:

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 \
  npx expo export \
  --platform ios \
  --output-dir .expo-export-ios
cd ../..
```

PowerShell:

```powershell
Push-Location apps/mobile
$env:EXPO_PUBLIC_API_URL = "http://10.0.2.2:3000"
npx expo export --platform ios --output-dir .expo-export-ios
Remove-Item Env:EXPO_PUBLIC_API_URL -ErrorAction SilentlyContinue
Pop-Location
```

Then:

```bash
git rev-parse HEAD
git check-ignore -v apps/mobile/.expo-export-ios/probe
git status --short --untracked-files=all
```

Require the same evidence as Android: exit 0, unchanged HEAD, non-empty output, ignored output, no staged/non-ignored generated artifact.

Do not infer native iOS build/simulator/device/signing evidence.

- [ ] **Step 8: Run repository/public-history gates**

```bash
python3 scripts/verify_repository.py
python3 scripts/verify_repository.py --history
git diff --check
git status --short --untracked-files=all
```

Require repository verifier PASS and history findings 0. If the host uses `python` as the configured interpreter, it may additionally run the same commands with `python`, but one successful invocation does not excuse a failure from the repository's preferred `python3` command when `python3` exists.

- [ ] **Step 9: Prove frozen-scope and implementation-scope boundaries**

Let `TARGET_REF` be the exact execution handoff ref.

```bash
git diff --name-only "$TARGET_REF"..HEAD
git diff --name-only 9aa80fbee3f05a9191f1daad6e4e4e051d3beb1d..HEAD
git diff -- "$TARGET_REF"..HEAD -- \
  package.json package-lock.json apps/mobile/package.json apps/mobile/app.json
```

Implementation delta from `TARGET_REF` must contain only:

```text
apps/web/tests/e2e/cross-platform-hero-b.spec.ts
apps/mobile/src/testing/cross-platform-hero-b.test.tsx
apps/mobile/.gitignore
```

The broader delta from frozen Task 16 product baseline may additionally contain only the already-approved Task 17 design/plan documentation.

Any product/shared/workflow/manifest file means `STOP_AND_REPORT`.

- [ ] **Step 10: Pre-push remote movement check**

```bash
git fetch origin --prune
git rev-parse origin/feat/building-aware-mvp
```

Require remote feature ref still equals `TARGET_REF`. If it moved, stop; do not rebase, reset, merge, or force.

- [ ] **Step 11: Publish by normal fast-forward only**

For a detached Task 17 worktree:

```bash
git push origin HEAD:refs/heads/feat/building-aware-mvp
```

Forbidden:

```text
--force
--force-with-lease
history rewrite
refspec overwrite
```

If ordinary push is rejected, stop and report local/remote SHAs.

- [ ] **Step 12: Post-push readback**

```bash
git fetch origin --prune
git rev-parse HEAD
git rev-parse origin/feat/building-aware-mvp
python3 scripts/verify_repository.py --history
git status --short --untracked-files=all
```

Require:
- local HEAD == remote HEAD;
- post-push history verifier PASS with 0 findings;
- tracked worktree clean;
- ignored Expo export directories may remain local but must not appear in Git status or history.

- [ ] **Step 13: Completion report**

Return exact observed evidence, separating direct execution from prior evidence:

```text
CHECKPOINT | TASK 17 MOBILE HEALTH + HERO B | evidence=<Hero B Web + Hero B Mobile + Node24/npm ci + full regression + expo-doctor@1.20.4 + Android/iOS export + public-history gate + local==remote> | tokens=unknown

POLICY_REF:
TARGET_REF:
start HEAD:
final local HEAD:
final remote HEAD:
changed files:

Web Hero B focused:
Mobile Hero B focused:
full Web E2E:
full Mobile:
shared:
test:web:
lint:
typecheck:
typecheck:tests:
build:web:
check:deps:

Node:
npm:
npm ci:
expo-doctor version:
expo-doctor result:
Android export:
iOS export:
export ignore proof:

repository verifier:
pre-push history verifier:
post-push history verifier:
history findings:
manifest/config delta:
frozen-scope delta:
new dependencies:

Task 15 status: FROZEN / REOPENED
Task 16 status: FROZEN / REOPENED
Task 17 status: READY_FOR_ACCEPTANCE / BLOCKED
Task 20 readiness: READY / BLOCKED
execution-log sync: SYNCED / PENDING
open risks:
```

If `READY_FOR_ACCEPTANCE`, stop. Do not begin Task 20.

---

## Plan self-review requirements

Before handing this plan to an implementation worker, verify:

1. Every approved-design requirement maps to Tasks 1–4.
2. No step asks the worker to modify frozen product code to make verification green.
3. No Hero B step hardcodes a safety-question count.
4. Both Hero B halves runtime-validate the public landlord DTO schema where applicable.
5. Expo Doctor is pinned to exactly `1.20.4`; no `@latest` execution command remains.
6. Node 24 and fresh `npm ci` are mandatory gates.
7. Android and iOS export claims are limited to JS/assets bundling.
8. Only `apps/mobile/.gitignore` gets a genuine RED→GREEN code/config cycle.
9. Final implementation delta is exactly the two new verification tests plus `apps/mobile/.gitignore`.
10. Task 20, device validation, native builds, EAS, auth, and app-store claims remain deferred.
