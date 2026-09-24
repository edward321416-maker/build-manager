# PF02-B B2 independent acceptance, implementation-main publication and canonical closure

Snapshot: 2026-09-24.

- POLICY_REF / CLOSURE_BASE: `5670a6246805cadc9e6cb2c0ccff3eaaf01a2c2d`
- IMPLEMENTATION_MAIN: `f0c6e80c9e1072f5b6a98bacc7697af01da9c7d1`
- CLOSURE_MAIN: `5670a6246805cadc9e6cb2c0ccff3eaaf01a2c2d`

## Disposition and scope

[FACT] The independently accepted B2 implementation is merged and fresh implementation-main CI is 9/9 SUCCESS. [FACT] Canonical closure PR [#35](https://github.com/edward321416-maker/build-manager/pull/35) is **MERGED** at closure main `5670a6246805cadc9e6cb2c0ccff3eaaf01a2c2d`, read back, with fresh closure-main CI 9/9 SUCCESS. **PF02-B / B2 = VERIFIED / FROZEN** is now the canonical published state, no longer a proposal.

| Area | Disposition |
| --- | --- |
| PF00 | FROZEN |
| PF01 | REVIEW_DRAFT |
| PF02-A | VERIFIED / FROZEN |
| PF02-B | IN_PROGRESS |
| PF02-B / B1 | VERIFIED / FROZEN |
| PF02-B / B2 | VERIFIED / FROZEN — canonically closed on closure main |
| Later PF02-B slice(s) | NOT_STARTED / NOT_YET_SCOPED |

Verified B2 means active PROPERTY_STAFF organization discovery, organization visibility with zero assignments, PropertyAssignment constraints, active ORG_ADMIN own-organization ACTIVE Property reads, active staff assigned ACTIVE Property reads, uniform unassigned/foreign/archived denial, committed assignment/membership/organization revocation, READ COMMITTED guard-to-final-SELECT race safety, pool/GUC isolation, explicit discovery membership predicates, existing API reuse, neutral Web empty state and PF02-A/B1 regressions.

It does not include staff invitation, assignment mutation API, staff-management UI, resident/ticket flows, Mobile auth, Kakao/account linking, production DB hosting or real landlord/tenant data. It is not security/privacy completion or production readiness. REAL_TENANT_DATA = NOT_AUTHORIZED. PRODUCTION_DB_HOSTING = NOT_AUTHORIZED. No B3 product scope is defined here.

## Approved A+ design provenance

The [approved A+ spec](../docs/superpowers/specs/2026-09-23-pf02-b-b2-property-staff-scope-design.md) comes from [PR #33](https://github.com/edward321416-maker/build-manager/pull/33), exact source ref `1a056151d908a8d7bebb76100a2307e6555621b7`. Canonicalization copies the Git blob without text/encoding changes: **32,600 UTF-8 bytes**, SHA-256 `ec9fc095767624fdc4098447bd8b00bc65f90b5456f6570378d704fe41b63557`. This is not a design rewrite.

PR #33 is now **CLOSED / NOT_MERGED**, disposition `SUPERSEDED_BY_CANONICAL_SPEC_IN_MAIN`. Its execution-log EOF append overlapped the independently merged implementation's append from the same base, so direct merge was deliberately not selected; no rebase/update/cherry-pick of PR #33 occurred and its branch/history remain preserved. **This is supersession, not design rejection**: the approved exact spec was canonicalized into main through closure, byte-identical at blob `b6fd0ce3c15d2255105434911889dd61693dbdb7`, and is now readable at [`docs/superpowers/specs/2026-09-23-pf02-b-b2-property-staff-scope-design.md`](../docs/superpowers/specs/2026-09-23-pf02-b-b2-property-staff-scope-design.md) on main.

## Implementation plan and independent review provenance

- Final approved private implementation plan: SHA-256 `ed46d13d96b99bf56cc755aa6400107d8349c34d3421ded5919d6b393933acd6`; 80,545 bytes. Not rewritten or published here.
- Independent Opus implementation review of candidate `d074741e8212ebb2fdb8d0ea7f46a100fd58f24a`: SHA-256 `5b830146be30e3a05675537d35bfe1a85f1b002ed5e804f777e7007abb1d2d32`; **NO_BLOCKING_FINDINGS**, BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 4. Private review contents/paths are not copied into public Git.
- Review attribution: independent code/SQL/test/evidence examination; PostgreSQL/Docker, Playwright and npm runtime suites were **not independently rerun** by that reviewer. Runtime receipts below are HOSTED_CI_EVIDENCE or EXECUTOR_EVIDENCE, not independent runtime reproduction. CodeRabbit does not substitute for this review.

## Exact Git publication

- Accepted [PR #34](https://github.com/edward321416-maker/build-manager/pull/34): **MERGED**, accepted candidate `d074741e8212ebb2fdb8d0ea7f46a100fd58f24a`; candidate base `bd0921c503d952a150ecadeb9873a0299b6263c2`.
- Actual implementation merge: `f0c6e80c9e1072f5b6a98bacc7697af01da9c7d1`, merged at `2026-09-24T01:52:57Z`.
- Merge parent 1: `bd0921c503d952a150ecadeb9873a0299b6263c2`; parent 2: `d074741e8212ebb2fdb8d0ea7f46a100fd58f24a`.
- Candidate and actual merge tree both `f64c34223c5e4b09246c553e22f01f6c136aaab8`, freshly read back. The prior PR synthetic test merge is not the actual main merge.
- Implementation inventory: exact 20 paths, four task commits; four migration/product, fifteen tests/support and one execution log. This closure changes only its eight authorized documentation paths.

## Candidate CI provenance

HOSTED_CI_EVIDENCE: [App 35901709983](https://github.com/edward321416-maker/build-manager/actions/runs/35901709983) and [Repository 35901709798](https://github.com/edward321416-maker/build-manager/actions/runs/35901709798), event `pull_request`, head `d074741e8212ebb2fdb8d0ea7f46a100fd58f24a`, completed/success, required checks **9/9 SUCCESS**. These are candidate evidence only.

## Fresh implementation-main CI provenance

HOSTED_CI_EVIDENCE: [App 35944851872](https://github.com/edward321416-maker/build-manager/actions/runs/35944851872) and [Repository 35944851923](https://github.com/edward321416-maker/build-manager/actions/runs/35944851923), event **push**, head **`f0c6e80c9e1072f5b6a98bacc7697af01da9c7d1`**, completed/success. Both are actual implementation-main evidence, independently read back for this closure; candidate CI was not substituted.

| Required check | Fresh implementation main |
| --- | --- |
| verify | SUCCESS |
| repository-safety | SUCCESS |
| apps | SUCCESS |
| mobile-cold-linux | SUCCESS |
| install-mobile-windows | SUCCESS |
| web-e2e | SUCCESS |
| mobile-health | SUCCESS |
| postgres-integration | SUCCESS |
| foundation-gate | SUCCESS |

Implementation-main logs show PostgreSQL **151 passed across 10 files**, demo Web **21 passed**, B1+B2 Web **21 passed** and the exact named-case gate with zero failures/skips/retries and six negative controls. These logs were read, not rerun locally in closure. Passing counts are execution receipts, not coverage or release-readiness measures. Hosted JS/assets export is not native Mobile compilation.

## Fresh closure-main CI provenance

HOSTED_CI_EVIDENCE: [App 35947253215](https://github.com/edward321416-maker/build-manager/actions/runs/35947253215) and [Repository 35947253217](https://github.com/edward321416-maker/build-manager/actions/runs/35947253217), event **push**, head **`5670a6246805cadc9e6cb2c0ccff3eaaf01a2c2d`**, completed/success, required checks **9/9 SUCCESS** (`verify`, `repository-safety`, `apps`, `mobile-cold-linux`, `install-mobile-windows`, `web-e2e`, `mobile-health`, `postgres-integration`, `foundation-gate`).

Three CI generations remain distinct and are not interchangeable: **candidate** CI (`pull_request`, head `d074741e…`), **implementation-main** CI (`push`, head `f0c6e80c…`) and **closure-main** CI (`push`, head `5670a624…`). The closure commit changed documentation only; its green run is publication evidence, not a re-verification of product behavior.

## PropertyAssignment schema and constraint evidence

[Migration 0007](../packages/persistence-postgres/migrations/0007_b2_property_assignment_scope.sql) alone adds `app.property_assignment`: UUIDv7 primary key; org/membership/property keys; ACTIVE/ENDED status; creation/end timestamps; UNIQUE(org_id,id); separate composite membership and property FKs; status/time CHECK; one ACTIVE assignment partial unique index. ENDED history plus a new ACTIVE row is allowed.

The [schema tests](../tests/postgres/b2-schema.test.ts) execute each cross-org FK failure independently as SQLSTATE23503, two-backend ACTIVE contention as23505, status/time constraints, owner-policy catalog and fresh/upgrade transactional atomicity. EXECUTOR_EVIDENCE and candidate/main PostgreSQL HOSTED_CI_EVIDENCE are distinct from the independent static review.

## Authorization and RLS capability evidence

Organization context and Property permission remain separate: `can_access_org_context` accepts a current active admin/staff membership; `can_read_property` permits own-org active properties for admin or current active assignments for staff. Legacy `can_read_org` remains admin-only. Final list/detail SQL predicates and restrictive Property RLS both filter before pagination/cursor/LIMIT; no broad-select JavaScript filtering or client role authority.

Static `TO CURRENT_USER` owner policy is created before capability-owner role transition. Catalog evidence confirms its sole role OID equals relation owner, distinct from capability/web/runtime/public; separate capability-owner assignment policies remain separate. Narrow column grants exclude address data and assignment writes; raw assignment access is denied to Web/PF02-A runtime. SECURITY DEFINER ownership/search_path/EXECUTE ACL and the nonrecursive graph are covered by [capability tests](../tests/postgres/b2-capabilities.test.ts).

[Access](../tests/postgres/b2-access.test.ts) and [revocation](../tests/postgres/b2-revocation.test.ts) tests cover current relationships, visible-only cursors, actual raw/adapter AC11, and max-one pool/GUC restoration. Adapter sentinel observation first proves the real pool query interception before the final SELECT barrier; no sleep ordering or raw-test substitution.

## B1I-M01 closure

**B1I-M01 = CLOSED_BY_B2.** `list_my_organizations` now explicitly checks current actor, ACTIVE organization, ACTIVE membership and role IN (ORG_ADMIN, PROPERTY_STAFF). AC16 first demonstrates unauthorized/foreign raw visibility under deliberately weakened policies, then proves the function still restricts discovery and restores the catalog after rollback. Candidate PostgreSQL evidence plus fresh actual-main postgres-integration success support closure.

The [B1 acceptance receipt](pf02_b_b1_acceptance.md) is byte-preserved: OPEN_HARDENING_BACKLOG was true at B1 acceptance. This receipt records its later resolution; it does not retroactively claim B1 had closed M01. B1I-M02 remains DOCUMENT_RECONCILED.

## AC01–AC16 disposition

All rows are B2 slice cases, **not** canonical F-cases. Implementation test definitions and independent code/test review establish meaning; EXECUTOR_EVIDENCE and candidate/fresh-main HOSTED_CI_EVIDENCE establish execution. The reviewer did not rerun these runtime suites. [Canonical acceptance_cases.json](../docs/production-foundation/acceptance_cases.json) is unchanged.

| B2 case | Accepted behavior / implementation evidence | Disposition |
| --- | --- | --- |
| AC01 | Admin all own-org ACTIVE properties: b2-access adminAllActive; Web adminAB | PASS_IMPLEMENTATION_ACCEPTED |
| AC02 | Assigned A visible, same-org unassigned B hidden/404, hidden cursor excluded: staffAssignedOnly / visibleCursorOnly / explicitPredicateSurvivesCeilingControl; Web staffAssignedA | PASS_IMPLEMENTATION_ACCEPTED |
| AC03 | Zero-assignment staff keeps organization, property list empty: staffContextWithoutAssignment / staffNoAssignmentKeepsOrg; Web neutral empty state | PASS_IMPLEMENTATION_ACCEPTED |
| AC04 | Foreign organization/property existence hidden: foreignIdsNotFound; Web foreign404 | PASS_IMPLEMENTATION_ACCEPTED |
| AC05 | Committed assignment END hides property but retains org: endedAssignmentKeepsContext; Web assignmentEnded | PASS_IMPLEMENTATION_ACCEPTED |
| AC06 | Committed membership END denies org/property; replacement membership does not inherit old assignment: endedMembershipDeniesBoth | PASS_IMPLEMENTATION_ACCEPTED |
| AC07 | Organization SUSPENDED/ARCHIVED/PENDING denial: inactiveOrganizationDeniesBoth; Web orgSuspended | PASS_IMPLEMENTATION_ACCEPTED |
| AC08 | ARCHIVED assigned property denied to staff/admin: archivedAssignedNotFound; Web archived404 | PASS_IMPLEMENTATION_ACCEPTED |
| AC09 | Separate cross-org membership/property composite FK23503: membershipCompositeFk / propertyCompositeFk | PASS_IMPLEMENTATION_ACCEPTED |
| AC10 | Status/time and ENDED history/new ACTIVE; two-backend duplicate23505: assignmentStateHistory / concurrentActiveUnique | PASS_IMPLEMENTATION_ACCEPTED |
| AC11 | Independent rawSelectAfterGuard and adapterReadCommittedAfterGuard: actual READ COMMITTED, committed revoke before final SELECT, row0 / NOT_FOUND | PASS_IMPLEMENTATION_ACCEPTED |
| AC12 | maxOnePoolContextRestoration: staffA/adminB/anonymous, nested success/failure, savepoint/rollback, no GUC/scope leak | PASS_IMPLEMENTATION_ACCEPTED |
| AC13 | Existing 401/400/404/503 boundaries and method rejection; client authority cannot widen scope: HTTP regression and Web forgedAuthority | PASS_IMPLEMENTATION_ACCEPTED |
| AC14 | B1 positive/foreign/revocation/logout/replay preserved: existing B1 PG and twelve B1 Web cases | PASS_IMPLEMENTATION_ACCEPTED |
| AC15 | Exact eight inventory, frozen original grants/RLS, owner OID, capability catalogs and migration atomicity; foundation regression | PASS_IMPLEMENTATION_ACCEPTED |
| AC16 | Non-vacuous discovery weakening control with raw exposure, explicit predicate restriction and catalog restoration | PASS_IMPLEMENTATION_ACCEPTED |

## B1 / PF02-A freeze preservation

Closure readback compares actual Git blob bytes at candidate base, accepted candidate and implementation main: migrations0001–0006 are identical. Only0007 is the B2 addition. B1 Auth0/proxy/jose/identity/session/completion/logout contracts were not redesigned. Historical PF02-A/B1 **seven-table snapshots** remain historical; current exact app inventory is **eight** with property_assignment. Original seven-table semantics and the PF02-A six-tenant-table runtime privilege/RLS matrix remain covered; no new assignment privilege for bm_pf02a_runtime.

| Frozen migration | Bytes | SHA-256 |
| --- | ---: | --- |
| 0001_core_identity_organization.sql | 1706 | `e10a8d4acd3d11fb3bf90b05d3f123081f6ee4a29d325b0b669a56f819b261f1` |
| 0002_property_unit_occupancy.sql | 3118 | `1733fbaf57a93e8d8eafc98207700f198a3b67ddfd022058b2aa09c3630aa77a` |
| 0003_runtime_isolation.sql | 1823 | `649a0519aa94e2bde319d4eac936dc9c8955739d92ff934211fa2f9d54213cf6` |
| 0004_b1_identity_sessions.sql | 3259 | `2ab71a55851cc37e34e62a5ce7b81c03983b95c67e2e15127e7e31edbe79220a` |
| 0005_b1_auth_capabilities.sql | 5800 | `22aea03a276673ca9e0e6929cc0193b83463b890845b5551d485100ce572ed33` |
| 0006_b1_organization_access.sql | 5779 | `a3dc5101aa69cb3fa65499573fd331273cd311c1349b1a62d38d267b4931a8fe` |

## Auth0 evidence classification

**B2 = SYNTHETIC_AUTH + ACTUAL_WEB + ACTUAL_POSTGRES. LIVE_AUTH0_B2 = NOT_RUN.** B2 did not change B1 authentication infrastructure; a live Auth0 rerun was not an acceptance requirement. B1 historical live smoke remains **EXECUTOR_LIVE_EVIDENCE**, separately attributed in its receipt; LIVE_AUTH0_INDEPENDENT_REPRO remains NOT_RUN. No B2 browser result is labeled live provider evidence.

## Deferred LOW findings

All four independent implementation findings are DEFERRED / NON_BLOCKING hardening backlog; no source correction is performed by closure.

| Finding | Retained scope and reason |
| --- | --- |
| B2I-L01 | Legacy can_read_org retains bm_b1_web EXECUTE despite no current production caller; admin-only meaning remains. |
| B2I-L02 | Owner preflight does not directly assert executing migration role rolsuper/rolbypassrls; existing migration-owner contract and separate tests cover it. This is not a B2 regression. |
| B2I-L03 | AC11 gate duplicates the production SQL literal; drift fails loudly, not a current correctness blocker. |
| B2I-L04 | listMine does not explicitly pin READ COMMITTED; this does not affect the accepted B2 Property revoke race. |

## Remaining open risks

B1's six LOW findings remain deferred in its historical receipt. Existing npm14moderate advisories, unrs-resolver install-script warning, Actions old internal-runtime warning, and Windows-mounted Ubuntu timeout **ROOT_CAUSE_NOT_ESTABLISHED** remain open; native/hosted passes do not resolve that root cause. Auth0 Free entitlement remains NOT_VERIFIED. Production hosting/credential provisioning, real-data pilot, final operational session/retention and complete security/privacy review remain unresolved. Future staff-role mutation/old ACTIVE assignment lifecycle is deferred; B2 adds no mutation workflow.

## Closure publication boundary

This eight-path documentation candidate canonicalizes the approved spec and records accepted implementation evidence. Product/source/SQL/tests/dependency/workflow/provider changes = **0** in closure. B1 historical receipt and canonical F-case statuses are unchanged; the production-foundation manifest keeps its twelve-entry set and self-exclusion, recomputing every final UTF-8 byte stream.

Documentation checks are separate from product runtime evidence. Product suites are NOT_RERUN_FOR_CLOSURE. Closure PR #35 has since been merged at `5670a6246805cadc9e6cb2c0ccff3eaaf01a2c2d` and read back, closure-main CI is 9/9 SUCCESS, and PR #33 has been closed as superseded. Later PF02-B slices remain NOT_STARTED / NOT_YET_SCOPED and **no later product slice is currently scoped or implementation-authorized**; PF02-B overall remains IN_PROGRESS.

External Google Sheets/Drive writes = 0; account/OAuth/IAM changes = 0. EXTERNAL_SYNC = PENDING. See [execution log](AI_Execution_Log.csv) and [pending sync](pending_external_sync.md).
