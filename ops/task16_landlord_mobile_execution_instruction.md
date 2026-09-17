# Task 16 Landlord Mobile — Final Execution Instruction

Status: **READY FOR OPERATOR HANDOFF — implementation not started by this document**
Date: 2026-09-17
Repository: `edward321416-maker/build-manager`

## 1. Pinned authority

Use these refs exactly at start:

```text
POLICY_REF = 39ffa51df03bc9f524fdc1a50332957ce1d77afb
TARGET_REF = 016d9f4bae71e05311f5c3078dc2e1b44bf467df
BRANCH     = feat/building-aware-mvp
```

`POLICY_REF` is a read-only main-branch policy snapshot. Read, at that exact ref:

```text
AGENTS.md
governance/ai_delivery_rules.md
governance/project_policy.md
```

`TARGET_REF` is the exact approved execution baseline. Read, at that exact ref:

```text
docs/superpowers/specs/2026-09-17-task16-landlord-mobile-design.md
docs/superpowers/plans/2026-09-17-task16-landlord-mobile.md
package.json
apps/mobile/package.json
apps/mobile/README.md
apps/mobile/src/testing/role-navigation.test.tsx
apps/mobile/src/testing/server-authority.test.ts
scripts/verify_repository.py
```

The approved Design is the product/UX authority for Task 16. The Implementation Plan is the task sequence and verification authority. If they conflict, prefer the Design and record the ruling. Do not use the older Task 15 product baseline `5b7a874…` as a checkout/reset target.

## 2. Execution mode

This instruction is intended for Claude Code, Codex, or another agentic coding environment.

At the beginning:

1. Read the installed `superpowers:using-superpowers` skill.
2. Use `superpowers:using-git-worktrees` to detect whether the environment is already isolated. The operator authorizes creation of an isolated worktree for this Task 16 execution if one is needed. Prefer a platform-native worktree mechanism; use the skill's safe fallback only when no native mechanism exists.
3. If subagents are available, use `superpowers:subagent-driven-development` for the full plan. If subagents are not available, use `superpowers:executing-plans`.
4. Use `superpowers:test-driven-development` for every behavior change.
5. If any test failure or unexpected behavior appears, use `superpowers:systematic-debugging` before proposing or applying a fix.
6. Before any completion/FROZEN claim, use `superpowers:verification-before-completion`.

Do not start implementation on `main`.

## 3. Mandatory preflight

Before editing any product file:

```bash
git remote -v
git branch --show-current
git status --short
git fetch origin feat/building-aware-mvp main
git rev-parse HEAD
git rev-parse origin/feat/building-aware-mvp
git show --no-patch --oneline 016d9f4bae71e05311f5c3078dc2e1b44bf467df
node -v
npm -v
```

Required start condition:

```text
local execution HEAD == TARGET_REF
origin/feat/building-aware-mvp == TARGET_REF
```

If the remote feature ref is no longer `TARGET_REF`, or the execution workspace contains unexplained/user-owned changes, **STOP_AND_REPORT**. Do not merge, rebase, reset, amend, stash user work, or force the repository into the expected state.

Read package manifests for stack metadata before running scripts. Do not add dependencies. If the environment cannot run the existing repository because installed dependencies are absent or corrupted, report the setup problem rather than changing package manifests or versions.

Before Task 1, establish the executable baseline from repository root:

```bash
npm run test:mobile
npm run test:shared
```

If either baseline suite fails before Task 16 edits, record the exact failure and **STOP_AND_REPORT** rather than attributing it to Task 16 or weakening tests.

## 4. Authorized scope

Implement exactly the approved Task 16 plan.

Expected product working set:

```text
CREATE
apps/mobile/src/app/landlord/buildings/[buildingId].tsx
apps/mobile/src/app/landlord/tickets/[ticketId].tsx
apps/mobile/src/features/landlord/logic.ts
apps/mobile/src/features/landlord/logic.test.ts
apps/mobile/src/features/landlord/landlord-home.tsx
apps/mobile/src/features/landlord/landlord-home.test.tsx
apps/mobile/src/features/landlord/building-detail.tsx
apps/mobile/src/features/landlord/building-detail.test.tsx
apps/mobile/src/features/landlord/ticket-review.tsx
apps/mobile/src/features/landlord/ticket-review.test.tsx

MODIFY
apps/mobile/src/app/landlord/index.tsx
apps/mobile/src/testing/role-navigation.test.tsx
apps/mobile/README.md
```

`apps/mobile/src/components/ui.tsx` is an exception-only path: modify it only if the implementation proves a genuinely generic primitive is required. Any such change must be backwards-compatible and must not alter existing Tenant behavior.

Operational scratch/ledger files required by Superpowers may live only in the skill's ignored workspace. Do not commit them.

## 5. Frozen / forbidden scope

Do not edit by default:

```text
apps/web/**
apps/mobile/src/features/tenant/**
apps/mobile/src/app/tenant/**
packages/domain/**
packages/application/**
packages/fixtures/**
packages/api-contracts/**
packages/api-client/**
```

Do not add or remove npm dependencies, change API/DTO vocabulary, change database/server behavior, redesign Web, or refactor frozen Tenant code for cleanliness.

A new directly reproduced BLOCKER/HIGH contract or safety defect may justify stopping the affected work. It does **not** authorize silently widening scope. Report it with evidence and stop that path.

## 6. Non-negotiable product behavior

Task 16 is **A. Mobile-native parity**. It is not a Web component port.

Required Landlord Mobile flow:

```text
/landlord
  -> demo building list + landlord ticket list
  -> /landlord/buildings/[buildingId]
       -> Building Passport + demo owner-context confirmation
  -> /landlord/tickets/[ticketId]
       -> compact Repair Packet + Why/provenance
       -> approve / override / more-info
```

Authority boundary:

```text
Mobile UI -> existing @build-manager/api-client -> existing HTTP API
          -> application/domain authoritative decisions
```

Mobile must never recompute Safety, protocol branch, evidence completeness, Repair Packet, recommendation, route provenance, or ticket transition.

Use only the existing typed API client methods already present at `TARGET_REF`:

```text
listDemoBuildings()
listTickets({ view: "landlord" })
getBuilding(buildingId)
verifyBuildingContext(buildingId, request)
getLandlordTicket(ticketId)
approveRoute(ticketId)
overrideRoute(ticketId, input)
requestMoreInfo(ticketId, input)
```

Important boundaries:

- `view: "landlord"` is a P0/demo projection selector, not authentication or authorization.
- `verifyBuildingContext()` is demo building-context confirmation. Do not imply real landlord identity, ownership, or authorization verification.
- `ownerSuppliedBoiler` is optional. If the returned value is `undefined`, do not invent or submit `false`; for the approved UI, render/edit that control only when the returned value is defined.
- After any context-confirmation or landlord-decision mutation, replace local display state with the exact server-returned DTO.
- Route codes come only from the closed public `RouteCode` vocabulary.
- Safety escalation suppresses ordinary override when any returned indicator says escalation: ticket status, evidence status, or packet safety flag.
- With a recommendation, exclude that recommendation from override choices because approve is the explicit path. With no recommendation and no safety escalation, allow the full closed RouteCode vocabulary, matching frozen Web behavior.
- Override and more-info reasons use `trim()` only to determine whether submission is allowed; send the original entered string unchanged.
- More-info selections come only from `ticket.followUpOptions`, and at least one question ID or evidence type is required.
- Do not surface `internalNotes`, `estimatedCost`, `affectedUnits`, or `hiddenContacts` in the compact Mobile Repair Packet.
- All three Landlord routes must render the existing `ConfigErrorScreen` instead of crashing when `EXPO_PUBLIC_API_URL` is missing/invalid.
- Because Landlord Stack headers are hidden, provide explicit navigation from detail screens back to `/landlord`, and from Landlord Home back to `/`.

## 7. TDD and task execution

Execute `docs/superpowers/plans/2026-09-17-task16-landlord-mobile.md` task-by-task in order.

For each task:

1. Write the plan-specified failing test first.
2. Run the smallest targeted test command and verify the failure is caused by the intended missing behavior.
3. Implement the minimum code to satisfy the test and approved Design.
4. Run the targeted test again and verify GREEN.
5. Run the broader Mobile regression required by that task before committing.
6. Review only named paths, then stage named reviewed paths; never use blind `git add .`.
7. Make a meaningful Conventional Commit. Do not create empty commits or manipulate commit count.
8. Do not push yet.

Every intermediate implementation commit must leave the tests relevant to that commit green. Do not knowingly commit an obsolete failing placeholder assertion for a later task to repair.

If using subagent-driven development, a fresh implementer and task review should be used as specified by that skill. Record rulings in the skill ledger. The Design is binding when a plan detail is ambiguous.

## 8. Existing regression that must be deliberately replaced

`apps/mobile/src/testing/role-navigation.test.tsx` currently asserts that `/landlord` is a placeholder and makes no API call. That assertion is obsolete only because Task 16 replaces the placeholder.

When Landlord Home is implemented:

- replace the obsolete Landlord-placeholder assertions in the same task/commit;
- preserve role-entry navigation to both Tenant and Landlord;
- preserve Tenant config-error assertions;
- preserve role-return behavior;
- add missing-config coverage for `/landlord`, `/landlord/buildings/[id]`, and `/landlord/tickets/[id]`.

Do not delete unrelated Tenant/navigation coverage.

## 9. Error, safety, and data-handling rules

Reuse:

```text
useMobileApiClient()
describeMobileError()
ConfigErrorScreen
LoadingState
ErrorState
```

Never display or log raw response bodies, Zod inputs, stack traces, raw tenant answer/evidence payloads, credentials, private addresses, or API secrets.

Mutating-action failure must preserve the last validated server DTO on screen. Busy state must block duplicate submissions.

Do not add camera/gallery, upload, OCR, QR, production auth, push, payment, vendor booking/dispatch, telemetry, retry framework, offline queue, EAS, or cloud services.

Public Git remains synthetic-data-only.

## 10. Commit and publication authority

During implementation, create local commits only.

A **single normal fast-forward push** of `feat/building-aware-mvp` is authorized only after every Task 16 freeze gate in the approved plan has passed locally and the repository/history scan is clean. The invocation of this instruction by the operator is the authorization for that final normal push.

Not authorized:

```text
force push
history rewrite
amend of published commits
interactive rebase
merge to main
PR merge
branch deletion
repository deletion
IAM/settings changes
new account/OAuth/paid-service connection
```

If the final push would not be a normal fast-forward because the remote moved, **STOP_AND_REPORT** rather than reconciling history automatically.

## 11. Final Task 16 freeze gate

Run the exact plan gate from repository root. At minimum it includes:

```bash
npm run test:mobile
npm run test:shared
npm run lint
npm run typecheck
npm run check:deps
```

Then Android task-level bundle smoke from `apps/mobile`:

```bash
npx expo export --platform android --output-dir .expo-export-android
```

Then return to repository root and run the history/public-data gate using the available Python launcher:

```bash
python scripts/verify_repository.py --history
```

If only `python3` is available, use it and report the substitution. Do not weaken the verifier or add exceptions to make Task 16 pass.

Also perform the exact changed-file/diff/status/log checks specified in the approved Implementation Plan.

Task 16 does **not** verify and must explicitly defer:

```text
Expo Doctor
iOS export/bundle
cross-platform Hero B
real-device validation
EAS/cloud build
```

These remain later Mobile Health/integrated P0 gates.

## 12. Execution logging

Follow the canonical logging rule without merging main into the product branch.

If the environment can safely append the canonical `main/ops/AI_Execution_Log.csv` in a separate authorized workspace without disturbing product work, append sanitized rows and verify the write. Otherwise queue sanitized execution events locally and report:

```text
EXECUTION LOG SYNC: PENDING
```

Do not claim Google Sheet/Drive synchronization without an actual authorized transport and verified response.

Do not copy secrets, raw tenant content, raw logs, or private identifiers into execution logs.

## 13. Stop conditions

Return `STOP_AND_REPORT` rather than guessing if any of these occurs:

- start HEAD or remote feature ref does not equal `TARGET_REF`;
- unexplained/user-owned dirty work would be overwritten or mixed into Task 16;
- baseline Mobile/shared regression fails before Task 16 edits;
- a required Task 16 test, lint, typecheck, dependency, Android export, or repository/history gate cannot be made green without widening frozen scope;
- an existing shared API/DTO contract prevents the approved flow;
- a new BLOCKER/HIGH safety/data-exposure defect is reproduced;
- final remote feature branch moved so a normal fast-forward push is no longer possible;
- execution requires destructive/history-rewriting/security-sensitive actions not explicitly authorized here.

Do not start Hero B, Expo Doctor/iOS Mobile Health, EAS, or any later task in this execution.

## 14. Final report contract

End with exactly this evidence-oriented report shape:

```text
TASK 16 STATUS: FROZEN or STOP_AND_REPORT
START TARGET_REF
FINAL LOCAL HEAD
FINAL REMOTE HEAD
FINAL TREE SHA
COMMITS CREATED (messages + SHAs; no required count)
MOBILE TEST RESULT (full suite count)
SHARED/ARCHITECTURE TEST RESULT (full suite count)
LINT RESULT
TYPECHECK RESULT
DEPENDENCY CHECK RESULT
ANDROID EXPORT RESULT
REPOSITORY/HISTORY SCAN RESULT (history blob count + findings count)
CHANGED FILES
TASK 15 TENANT REGRESSION STATUS
WEB/TENANT/SHARED FROZEN-SCOPE CHECK
DEFERRED: Expo Doctor, iOS export/bundle, cross-platform Hero B, real-device validation
EXECUTION LOG SYNC: synced or PENDING with transport/evidence
```

Do not report `FROZEN` from agent confidence or prior test output. `FROZEN` requires fresh verification from this execution and remote-ref readback after the authorized normal push.

Stop after this report.