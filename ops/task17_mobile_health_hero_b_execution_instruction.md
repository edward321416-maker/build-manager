# Task 17 Mobile Health + Cross-platform Hero B — Final Execution Instruction

Status: **READY FOR OPERATOR HANDOFF — implementation not started by this document**
Date: 2026-09-18
Repository: `edward321416-maker/build-manager`

## 1. Pinned authority

Use these refs exactly at start:

```text
POLICY_REF = a47dc0876052ce42252cb954dfdb264076fa4d84
TARGET_REF = b3aa9b765b0694e05b6f968a3d7571135d949233
BRANCH     = feat/building-aware-mvp
```

Read policy at `POLICY_REF`:

```text
AGENTS.md
governance/ai_delivery_rules.md
governance/project_policy.md
```

Read execution authority at `TARGET_REF`:

```text
docs/superpowers/specs/2026-09-17-task17-mobile-health-hero-b-design.md
docs/superpowers/plans/2026-09-18-task17-mobile-health-hero-b.md
package.json
.nvmrc
apps/web/package.json
apps/mobile/package.json
apps/mobile/app.json
apps/mobile/.gitignore
apps/web/playwright.config.ts
apps/web/tests/e2e/web-milestone.spec.ts
apps/mobile/src/features/landlord/ticket-review.tsx
apps/mobile/src/features/landlord/ticket-review.test.tsx
packages/api-contracts/src/ticket.ts
scripts/verify_repository.py
```

The approved Design is the Task 17 authority. The Implementation Plan is the exact execution sequence. If they conflict, prefer the approved Design and record a ruling.

Frozen Task 16 product baseline:

```text
9aa80fbee3f05a9191f1daad6e4e4e051d3beb1d
```

Do not reset/check out that older product baseline for execution; `TARGET_REF` is the execution baseline and already contains the approved Task 17 design and audited plan.

## 2. Execution mode

This instruction is intended for Claude Code, Codex, or another agentic coding environment.

At start:

1. Read `superpowers:using-superpowers`.
2. Use `superpowers:using-git-worktrees` to detect existing isolation.
3. The operator authorizes an isolated Task 17 worktree when this execution instruction is handed to an implementation agent.
4. The workspace must be pinned exactly to `TARGET_REF`.
   - If a platform-native worktree tool can select the exact ref without introducing an unrelated base branch, use it.
   - If the native tool can only create a branch from its default base, do **not** use that behavior. Use the skill's manual fallback and create a detached worktree pinned to `TARGET_REF`, for example `git worktree add --detach <isolated-path> TARGET_REF`.
   - Never trust a stale local `feat/building-aware-mvp` pointer as authority.
5. If subagents are available, use `superpowers:subagent-driven-development`; otherwise use `superpowers:executing-plans`.
6. Hero B tests are verification-only existing-pass work. Do not manufacture a failing product state. The only required RED→GREEN change is Task 3's `.gitignore` behavior.
7. If any unexpected failure occurs, use `superpowers:systematic-debugging` before proposing a fix.
8. Before any completion claim, use `superpowers:verification-before-completion`.
9. If the execution workflow reaches `superpowers:finishing-a-development-branch`, the operator's integration choice for this milestone is **Keep as-is**. The plan's verified normal fast-forward push to the existing feature branch occurs before that generic finish step. Do not merge to `main`, create/merge a PR, delete the feature branch, or remove an externally managed workspace.

Do not start implementation on `main`.

## 3. Mandatory preflight

Before editing:

```bash
git remote -v
git branch --show-current
git status --short --untracked-files=all
git fetch origin --prune
git rev-parse HEAD
git rev-parse origin/feat/building-aware-mvp
git show --no-patch --oneline b3aa9b765b0694e05b6f968a3d7571135d949233
node --version
npm --version
```

Required:

```text
local HEAD == TARGET_REF
origin/feat/building-aware-mvp == TARGET_REF
working tree clean
Node = v24.x
```

A detached execution HEAD is valid if it equals `TARGET_REF`.

If the remote moved, the workspace is dirty with unexplained/user-owned work, or Node is not 24.x: **STOP_AND_REPORT**. Do not merge, rebase, reset, amend, stash user work, or force the repository into the expected state.

Read manifests as metadata before scripts. Then run:

```bash
npm ci
git status --short --untracked-files=all
git diff -- package.json package-lock.json apps/mobile/package.json apps/mobile/app.json
```

Require no tracked dependency/config mutation. If `npm ci` fails, report an environment/tooling blocker; do not alter dependency metadata.

## 4. Authorized scope

Execute exactly:

```text
CREATE
apps/web/tests/e2e/cross-platform-hero-b.spec.ts
apps/mobile/src/testing/cross-platform-hero-b.test.tsx

MODIFY
apps/mobile/.gitignore
```

A test-only helper may be added only under the existing Web E2E or Mobile testing directories if the plan proves it necessary. Record that ruling.

No new npm dependency.

## 5. Frozen scope

Do not edit:

```text
apps/web/src/**
apps/mobile/src/features/tenant/**
apps/mobile/src/app/tenant/**
apps/mobile/src/features/landlord/**
apps/mobile/src/app/landlord/**
packages/domain/**
packages/application/**
packages/fixtures/**
packages/api-contracts/**
packages/api-client/**
package.json
package-lock.json
apps/mobile/package.json
apps/mobile/app.json
.github/workflows/**
```

A newly reproduced BLOCKER/HIGH does not silently authorize fixing these paths. Stop the affected path and report evidence.

## 6. Hero B non-negotiable contract

Required composite proof:

```text
Web Tenant
-> demo-building-b
-> HEATING
-> real Web UI + real API
-> every server-returned yes/no intake question answered safely
-> server-returned FIXTURE_VIEW synthetic evidence
-> finalize
-> READY_FOR_REVIEW + COMPLETE
-> landlord API projection runtime-validates as LandlordTicketDetailDto
-> recommendation MANAGEMENT_OFFICE
-> reasons non-empty
-> provenance includes heatingType + managementMode

App Landlord
-> equivalent schema-parsed LandlordTicketDetailDto
-> existing TicketReview renders management-office recommendation/reasons/provenance
-> recommended route not offered as manual override
-> compact-packet-hidden fields remain hidden
-> approveRoute(exact ticket id) called once
-> returned APPROVED DTO replaces displayed state
```

Do not hardcode a safety-question count. The server-returned flow is authority.

Do not import domain/application/fixtures into the new tests.

Do not claim one browser-created ticket was physically opened in a native emulator. The proof is cross-platform contract parity.

## 7. Verification-only test semantics

Task 1 and Task 2 may PASS on their first valid run.

That is acceptable because Task 17 is locking already accepted behavior.

If a first valid run fails:

- test/selector/fixture construction defect -> correct only the new test;
- frozen product/API behavior defect -> **STOP_AND_REPORT**;
- do not edit frozen implementation to force green.

Task 3 must prove:

```text
before: git check-ignore exit 1
after: exact .gitignore rule is reported by git check-ignore -v
```

Only these rules are authorized:

```gitignore
/.expo-export-android/
/.expo-export-ios/
```

## 8. Exact execution sequence

Follow:

```text
docs/superpowers/plans/2026-09-18-task17-mobile-health-hero-b.md
```

Tasks, in order:

1. Web Tenant → API Hero B Playwright proof.
2. App Landlord Hero B RNTL proof.
3. Export-ignore RED→GREEN correction.
4. Fresh full regression + Node/npm evidence + pinned Expo Doctor + Android export + iOS export + repository/history gates + normal fast-forward publication.

Do not skip task review gates when using subagent-driven development.

## 9. Mobile Health rules

Pinned tool:

```text
expo-doctor@1.20.4
```

Run from `apps/mobile`:

```bash
npx --yes expo-doctor@1.20.4 --version
npx --yes expo-doctor@1.20.4 .
```

Do not use `@latest` during execution.

Do not run:

```text
expo install --fix
SDK upgrade
dependency upgrade
prebuild
EAS
native project generation
```

unless separately authorized after a blocker review.

Fresh exports are required for both platforms, using the plan's exact commands and an explicit `EXPO_PUBLIC_API_URL`.

Export success means JS/assets bundle success only. No native build/device/signing claim.

Generated export directories are expected to be ignored after Task 3. Do not stage or commit them. Do not delete them automatically; exact-target removal would require separate explicit authorization if desired.

## 10. Required final gates

Fresh evidence must include:

```text
focused Web Hero B
focused Mobile Hero B
npm run test:shared
npm run test:web
npm run test:mobile
npm run lint
npm run typecheck
npm run typecheck:tests
npm run build:web
npm run test:e2e:web
npm run check:deps
expo-doctor@1.20.4
Android expo export
iOS expo export
python3 scripts/verify_repository.py
python3 scripts/verify_repository.py --history
git diff --check
frozen-scope diff
manifest/config diff
pre/post-push remote readback
```

Do not reuse Task 16 runtime counts as Task 17 evidence.

## 11. Publication rule

Immediately before push:

```bash
git fetch origin --prune
git rev-parse origin/feat/building-aware-mvp
```

Remote must still equal:

```text
b3aa9b765b0694e05b6f968a3d7571135d949233
```

If not, **STOP_AND_REPORT**.

After every required fresh gate passes, the only authorized product-branch remote write is the ordinary fast-forward:

```bash
git push origin HEAD:refs/heads/feat/building-aware-mvp
```

Never use `--force` or `--force-with-lease`.

Do not merge `main`.

After push, fetch/read back and rerun history verification exactly as the plan requires.

## 12. Logging and external sync

Do not interrupt feature execution to merge/pull `main` merely to log.

Record local execution events in the plan's ignored Superpowers ledger and, if needed, a sanitized pending execution-log file outside the committed feature delta.

Google Sheet/Drive sync remains `PENDING` unless a working authorized transport is actually available and the write is verified.

Do not claim external sync from repository text.

## 13. Stop conditions

Return `STOP_AND_REPORT` when:

- local/remote start ref differs from `TARGET_REF`;
- Node is not 24.x;
- clean `npm ci` cannot complete;
- focused Hero B reveals a frozen product/API contract defect;
- Mobile fixture cannot schema-parse without changing the public contract;
- Expo Doctor has a failed check requiring frozen config/dependency changes;
- Android or iOS export fails;
- history/public-data verifier fails;
- final implementation delta includes anything beyond the approved tests + `.gitignore` (plus explicitly ruled test-only helper);
- remote feature branch moves before publication;
- a required fix would widen into Task 15/16/shared product scope.

Do not reinterpret a stop condition as permission to upgrade, refactor, or change production behavior.

## 14. Completion report

Return the exact completion contract from Task 17 Plan Task 4 Step 13.

Minimum headline:

```text
CHECKPOINT | TASK 17 MOBILE HEALTH + HERO B | evidence=<fresh direct evidence only> | tokens=unknown
```

Separate:

- directly executed runtime evidence;
- remote Git evidence;
- any prior executor evidence.

If all gates pass:

```text
Task 15 status: FROZEN
Task 16 status: FROZEN
Task 17 status: READY_FOR_ACCEPTANCE
Task 20 readiness: READY
```

Then stop.

Do not begin Task 20.
