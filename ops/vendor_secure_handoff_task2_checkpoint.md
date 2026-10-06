# Vendor Secure Handoff Task2 local checkpoint

Status: IMPLEMENTATION_VERIFIED_LOCAL_TASK2. Controller review and later tasks remain outstanding. This receipt supersedes no historical failure and does not claim release-candidate, hosted, browser, production or deployment completion.

- Authority: PR75 comment6013595548; accepted plan blob51123e2583c8ecdb132711d86cacdf43027743b1.
- POLICY_REF:4f3d3dbdf57c7d537ad6b79674b05b29888c44e1.
- Entry TARGET_REF:4fa4265d5c55aff22ff4f9d8fa0deb8f5719e0c8.
- Fixed implementation HEAD: 186c27f86954f82c740380e5b09fbd6bc5f79ee3.
- Branch:feat/vendor-secure-handoff-v1. No push, PR comment/Ready conversion, merge or deployment was performed in this phase. Draft PR75 lifecycle comes from the controller preflight, not a new remote write by this worker.
- Runtime: pinned Node24.21.0, disposable PostgreSQL18.6, synthetic-only fixtures. No new dependency, role architecture, production credential, IAM/provider action or real data.

Task2 fixes the isolated foundation boundary in migration0019: exact owner/Core bridge grants; six org-scoped FORCE-RLS tables; org-only restrictive write ceilings and digest-only SELECT bootstrap; bounded B1 and external Vendor EXECUTE grants; current authorization after source-ticket waits; immutable packet/photo allowlists; canonical location and selected structured-detail provenance; and safe atomic command receipts. Exact issuance replay returns `created:false` metadata without a raw link. The incidental Task1 DTO/schema repair explicitly distinguishes first issuance and metadata-only replay and restores the approved safetyNotice array. Existing eligible Core data has no non-escalating notice vocabulary, so notices remain an empty array and raw text is never copied; canonical hard-escalation flags deny create/publication/issuance.

Request uniqueness is enforced by org/actor-scoped receipts. The former global capability issue_request_id uniqueness incorrectly rejected another authenticated organization using its own identical request UUID; a new behavioral RED proved it. Removing that accidental global coupling preserves digest uniqueness, one current capability, one current assignment and one active session. The final focused/regression generation below reran after this actual source correction; it was not a retry of unchanged passing code.

## Final local validation

Commands ran in the relocated worktree with the pinned Node path prepended to PATH. Logs remain local under `.superpowers/sdd/2026-10-06-vendor-secure-handoff-v1/`.

| Command | Observed result | Evidence log |
| --- | --- | --- |
| `npm run test:postgres -- tests/postgres/vendor-handoff-foundation.test.ts tests/postgres/vendor-handoff-security.test.ts` |2 files,36 passed,zero skipped/todo| `task2-final-focused-green2.log` |
| `npm run test:postgres -- tests/postgres/b1-access.test.ts tests/postgres/b2-capabilities.test.ts tests/postgres/b5-capabilities.test.ts tests/postgres/core-flow-access.test.ts tests/postgres/core-flow.test.ts tests/postgres/core-flow-photos.test.ts` |6 files,42 passed,zero skipped/todo| `task2-frozen-final2.log` |
| `npm run test:shared -- tests/architecture/b5-boundary.test.ts` |1 file,3 passed,zero skipped/todo| `task2-ac17-full-final.log` |
| `npm test` |43 files,474 passed| `task2-shared-final1.log` |
| `npm run typecheck` |packages/tests/Web/mobile exit0| `task2-typecheck-final1.log` |
| `npm run typecheck:tests` after the last new request-scope test |exit0| `task2-tests-typecheck-final.log` |
| Staged public-tree scan and whitespace |code index PASS; final receipt index verified separately before receipt commit| `task2-public-index-scan.log` |

The shared/full typecheck generation preceded only the final SQL uniqueness correction and its additional PostgreSQL test; the final test typecheck and both PostgreSQL suites ran after that edit. No claim of a new shared/full-typecheck run after that SQL-only correction is made.

Catalog and hostile SQL prove exact six-table ownership/org columns/ENABLE+FORCE RLS; exact policy inventory/role/predicates; strict schema ACL; PUBLIC EXECUTE absence; owner-only Core bridge EXECUTE with fixed search_path; direct runtime DML and SET ROLE denial; no broad Vendor-owner Core/app table access; exact Manager/Tenant bridge projections; and digest bootstrap visibility limited to the requested row with no bootstrap write. Runtime tests cover manager scope, two eligible routes, safety denial, concurrent assignment replay, minimum-data packet projection/provenance/address, exact source-photo allowlist, immutable snapshots, stale/NULL guards, one-time redeem, exact-request session replacement/absolute expiry, logout and request scopes.

Real ticket-wait probes show revoke/reassignment fixture commits deny subsequent redeem and that ended membership, changed Tenant role and revoked/ended session authority are rechecked after waits with no new durable action/receipt. Final Manager revoke/reassign commands, PREAUTHORIZED_ENTRY visit start and completion-photo races are future-owned tasks and were not simulated as implemented here.

## Preservation and historical generations

Migrations0001–0018 are byte-identical to their canonical entry Git blobs,18/18. Migration0019 SHA-256:`a18367b08155af78314a9b61fe1dd46ba5fab67c6af04b1728f1bd10f3b3f857`. The original B5 hash map/baseline and earlier exact vendor export normalization are unchanged. Frozen B2/Core catalog tests now assert only the exact approved successor owner membership/seven owner-only bridge functions separately and retain their original baseline assertions.

Historical [Task2 STOP](vendor_secure_handoff_task2_stop.md), [resume STOP](vendor_secure_handoff_task2_resume_stop.md) and [syntax revalidation STOP](vendor_secure_handoff_task2_syntax_revalidation_stop.md) remain byte-preserved. Their local/hosted generations are not replaced by this receipt. Every meaningful failure in this phase is retained in uniquely named local logs: initial frozen catalog failures; runtime/security RED; link schema RED; unsafe-source RED; malformed-ID harness failure; final NULL/unsafe/role RED; and org/actor issuance-scope RED. PostgreSQL name[]/statistics-cache harness corrections preserve the actual assertions and introduce no retry/timeout increase. Detailed per-generation counts and commands are in the local `task-2-report.md`.

The operator moved worktrees into the primary repository's `worktree` directory during this phase. The controller repaired the Git backlink and restored generated npm junctions at unchanged entry HEAD. All source/evidence survived. This environment repair introduced no tracked dependency/manifest/lock change.

## Next work and external sync

Next: controller independent Task2 review, then authorized sequential Task3. The ordinary Core completion adapter integration remains Task9; Task2 proves its available guard capability under the caller-held source-ticket lock. Scheduling/work/report/Manager-action methods remain unavailable until their owning tasks, as the accepted task dependency rulings require.

Whole-candidate history scan, full final local/browser/restart/hosted gates and AC01–AC57 reconciliation belong to later authorized milestones. Production credentials/IAM/real data/deployment remain NOT_AUTHORIZED/NOT_RUN. External Google execution-log sync is pending; no cloud append/readback or schema-cache write was claimed for this local phase.

CHECKPOINT | Vendor Secure Handoff Task2 foundation | evidence=186c27f86954f82c740380e5b09fbd6bc5f79ee3 | tokens=unknown
