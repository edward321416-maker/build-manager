# Task 16 Landlord Mobile — Acceptance Record

Status: **ACCEPTED_WITH_EXECUTOR_RUNTIME_EVIDENCE / TASK 16 PRODUCT FROZEN**
Date: 2026-09-17

## Authority and refs

- Repository: `edward321416-maker/build-manager`
- Acceptance policy ref: `main@620df5b7f6913d56ff9a69251ee669ba15ddda03`
- Start TARGET_REF: `016d9f4bae71e05311f5c3078dc2e1b44bf467df`
- Final remote feature HEAD: `9aa80fbee3f05a9191f1daad6e4e4e051d3beb1d`
- Final tree SHA: `99513fcfeb8673e12a17a5c80ea369694cf33001`
- Feature branch: `feat/building-aware-mvp`

This record accepts Task 16 while distinguishing **independently checked remote evidence** from **executor-reported local/runtime evidence**. It does not retroactively claim that the acceptance reviewer reran commands that were only run in the executor environment.

## Independently verified remote evidence

The acceptance reviewer verified through the connected GitHub API that:

1. `refs/heads/feat/building-aware-mvp` resolves to `9aa80fbee3f05a9191f1daad6e4e4e051d3beb1d`.
2. Comparing `016d9f4…` to `9aa80fb…` yields **ahead 5, behind 0, total commits 5**.
3. The comparison contains exactly **13 changed files**, all within the approved Task 16 Mobile/README working set:
   - `apps/mobile/README.md`
   - `apps/mobile/src/app/landlord/index.tsx`
   - `apps/mobile/src/app/landlord/buildings/[buildingId].tsx`
   - `apps/mobile/src/app/landlord/tickets/[ticketId].tsx`
   - four Landlord feature implementation files
   - four matching Landlord feature test files
   - `apps/mobile/src/testing/role-navigation.test.tsx`
4. No file under `apps/web/**`, `apps/mobile/src/features/tenant/**`, `apps/mobile/src/app/tenant/**`, or `packages/**` changed.
5. No package manifest or lockfile changed in the accepted remote delta.
6. The five remote commits and their order/messages match the executor report:
   - `b6c0c01268ccef443bbebc40ff6c976511e9f21e` — `feat: add landlord mobile presentation policy`
   - `0b442783be84d688cecb1e1634931ef9a350a672` — `feat: add landlord mobile home`
   - `0771effbd8bccb40a637f59aab56095a680bfd3c` — `feat: add landlord building context confirmation`
   - `6bccddaabbde935288160375fcec644d1dc699d5` — `feat: add landlord ticket review`
   - `9aa80fbee3f05a9191f1daad6e4e4e051d3beb1d` — `test: lock landlord mobile routes`
7. Git commit data for the final commit reports tree `99513fcfeb8673e12a17a5c80ea369694cf33001`, matching the executor report.
8. Direct code readback confirms the approved architectural boundaries:
   - Landlord Home uses `listDemoBuildings()` and `listTickets({ view: "landlord" })` and navigates with server-returned IDs.
   - Building Detail preserves absent `ownerSuppliedBoiler` as absent, submits only the owner-context request shape, labels the operation as DEMO context confirmation rather than ownership/authentication, and replaces state from the server-returned passport.
   - Ticket Review reads `LandlordTicketDetailDto`, hides the compact-packet-excluded fields, treats all three returned safety indicators as escalation inputs, sends override/more-info reasons unchanged after whitespace gating, uses `followUpOptions`, and replaces state from returned DTOs.
   - All three Landlord route wrappers use the existing `ConfigErrorScreen` when no Mobile API client can be constructed.
9. The final commit has no GitHub combined status checks attached (`statuses: []`). Therefore GitHub CI does not independently corroborate the executor's local runtime gates.

## Executor-reported runtime evidence — not rerun by acceptance reviewer

The executor reported the following fresh Task 16 gate results:

- Mobile: **132 passed / 132 total, 12 suites, 0 failed**.
- Shared/architecture: **301 passed / 301 total, 21 files, 0 failed**.
- Lint: exit 0.
- Typecheck: exit 0, covering packages + tests + Web + Mobile.
- Dependency check: exit 0; no manifest/lockfile change after `npm ci`.
- Android Expo export: exit 0; executor inspected the generated bundle for the required Landlord markers.
- Repository/history verifier: **502 history blobs, 0 findings, PASS**, before and after push.
- Final remote readback matched the local final HEAD after the authorized fast-forward push.

The acceptance reviewer attempted to obtain an independent runtime environment, but the available environment exposed Node 22 while this repository requires Node 24. A temporary Node 24 bootstrap attempt did not complete within the tool window. Accordingly, the acceptance reviewer does **not** restate the runtime results above as independently rerun results.

## Rulings accepted with Task 16

### 1. Role-return coverage moved to component level

The old route-level Landlord placeholder test could press a back control because the placeholder did not require API configuration. After Task 16, an unconfigured `/landlord` correctly renders `ConfigErrorScreen`, so that route-level back control is not reachable in the no-config route-test environment. The executor preserved role-return behavior through `landlord-home.test.tsx` and retained route-level role entry/config coverage. This is accepted as equivalent behavioral coverage and does not reopen Task 16.

### 2. `.expo-export-android` is not currently ignored

The executor reported that `git check-ignore` did not treat `.expo-export-android` as ignored. The generated export was inspected and then deleted instead of widening Task 16 to edit `.gitignore`. The accepted remote delta confirms no export artifact or `.gitignore` change was committed.

Classification: **LOW operational follow-up**. If the project intends future export artifacts to remain local automatically, address the ignore policy in the later Mobile Health/integrated verification scope rather than reopening Task 16.

### 3. README server command correction

The executor changed the README from nonexistent root command `npm run dev:web` to `npm --workspace @build-manager/web run dev`. This is accepted as a documentation correction discovered while implementing the approved README scope.

### 4. Detached worktree publication

The executor used a detached worktree pinned to the Task 16 TARGET_REF and pushed `HEAD` as a non-force fast-forward update to the existing remote feature ref. The pre-existing local named feature-branch pointer was left untouched. The independently verified remote feature ref is the accepted product authority.

Operational consequence: **the next task must use remote `feat/building-aware-mvp@9aa80fbee3f05a9191f1daad6e4e4e051d3beb1d` as its TARGET_REF and must not trust a stale local feature-branch pointer without a fresh preflight.**

## Pending provenance / sync

- Executor execution-log sync remains **PENDING**.
- Executor reported sanitized pending rows at `scratchpad/task16-landlord/PENDING_execution_log.md`; that local-only source has not been independently retrieved or cross-checked by this acceptance reviewer.
- No Google Sheet/Drive synchronization is claimed.
- The Task 15 pending local execution-log provenance remains separate and unresolved.

These provenance items do not reopen Task 16 product acceptance.

## Freeze decision

No independently evidenced BLOCKER/HIGH was found in the accepted remote Task 16 delta. The approved Task 16 product scope is therefore **FROZEN**, with runtime gate results explicitly attributed to the executor rather than falsely claimed as independently rerun.

Do not reopen Web, Tenant, shared contracts, or Task 16 Landlord Mobile for cleanup or polish alone. Reopen only on newly reproduced BLOCKER/HIGH evidence under the canonical delivery rules.

## Next baseline

Any next implementation/design instruction that depends on the completed Mobile apps must start from a freshly verified remote baseline:

```text
feat/building-aware-mvp@9aa80fbee3f05a9191f1daad6e4e4e051d3beb1d
```

The explicitly deferred integrated/mobile-health items remain:

- Expo Doctor
- iOS export/bundle smoke
- cross-platform Hero B
- real-device validation
- EAS/cloud build where later authorized
