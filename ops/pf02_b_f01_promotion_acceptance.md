# F01 canonical promotion acceptance and evidence receipt

Snapshot: 2026-09-27. POLICY_REF / DOCS_BASE / fixed implementation TARGET_REF: `6706afe3a2cc5bdd2fd7204ce7944fafdd422065`.
Canonical disposition: **F01 = PASS_POSTGRES_INTEGRATION; F43 = NOT_RUN**. B3 remains MERGED_WITH_DISCLOSED_LOW; B3 closure / VERIFIED/FROZEN = NOT_PERFORMED. The fixed evidence ref is provenance, not a permanent live-main pointer.

## Authority and exact scope

[DECISION] The operator authorized canonical F01 `NOT_RUN` → `PASS_POSTGRES_INTEGRATION` on the evidence reconciled below, with F01 requirement fields and all other F-cases preserved. This receipt records that F01-only disposition and its limits. The documentation publication/review/merge lifecycle is recorded in [PR48](https://github.com/edward321416-maker/build-manager/pull/48); it is not an additional product authorization or canonical current-state field.

The [canonical registry](../docs/production-foundation/acceptance_cases.json) changes only F01 status and adds its evidence object. Its phase, requirement, precondition, action, expected and planned_evidence are unchanged. Every other case is unchanged, including F43 **NOT_RUN**. The [approved design §17](../docs/superpowers/specs/2026-09-25-pf02-b-b3-building-registration-foundation-design.md#17-canonical-f-case-mapping--ci--securityprivacy) supplies the promotion condition. This is the existing registry classification, not a claim that PostgreSQL alone establishes Web behavior.

## Independent reconciliation provenance

[FACT] Original artifact `OPUS_F01_FIXED_HEAD_EVIDENCE_RECONCILIATION.md` was directly read by the executor and verified: **11,968 bytes**, SHA-256 `257b33138247049937d5ae5814f68ad7329d53a37e9deeb7453fffa6b0fb03dd`. Reviewer: Claude Opus 5.5. TARGET_REF: `6706afe3a2cc5bdd2fd7204ce7944fafdd422065`. Disposition: **F01_PROMOTION_EVIDENCE_SUFFICIENT**. This is INDEPENDENT_REVIEW plus hosted-evidence readback; reviewer local tests/builds/CI reruns were NOT_RUN. The operator separately authorized F01-only canonical promotion on that sufficiency judgement.

The private original is not copied into the public repository. Future readers without it should classify the original as UNAVAILABLE_LOCAL_ARTIFACT and use this provenance receipt and repository-addressable evidence, without inventing the report's contents. An operator-provided receipt is not the original; no substitute was used for the directly verified original here.

PR47's **DELTA_ACCEPTED**, 0/0/0/0 findings, concerns the test-only candidate. It is distinct from the later fixed-main reconciliation above. The [PR47 review/approval receipt](https://github.com/edward321416-maker/build-manager/pull/47#issuecomment-5854538718) records the received candidate judgement; the [publication receipt](https://github.com/edward321416-maker/build-manager/pull/47#issuecomment-5854583928) records its merge and new main CI. Codex did not perform a new independent Opus review.

## Git and CI provenance

- PR46 documentation was merged at `c9b8107e77163800b3d443d0e03620b79f1488e9`; the current routers reflect its completed publication.
- [PR47](https://github.com/edward321416-maker/build-manager/pull/47) candidate: `ae289c18cc716afee0a19a969fa4e929227494f4`; actual merge: `6706afe3a2cc5bdd2fd7204ce7944fafdd422065`.
- Ordered merge parents: `c9b8107e77163800b3d443d0e03620b79f1488e9`, then `ae289c18cc716afee0a19a969fa4e929227494f4`. Candidate and merge tree: `61437958ae6c13545ea5ac6f771604808337fc30`.
- Candidate CI, separate evidence: [Repository 36307552033](https://github.com/edward321416-maker/build-manager/actions/runs/36307552033) / [App 36307552064](https://github.com/edward321416-maker/build-manager/actions/runs/36307552064), pull_request / attempt 1 / 9/9 SUCCESS, candidate head above.
- Fixed implementation-main CI: [Repository 36308648913](https://github.com/edward321416-maker/build-manager/actions/runs/36308648913) / [App 36308648939](https://github.com/edward321416-maker/build-manager/actions/runs/36308648939), push / main / attempt 1 / completed / success, head `6706afe3a2cc5bdd2fd7204ce7944fafdd422065`.
- Required main jobs: verify, repository-safety, apps, mobile-cold-linux, install-mobile-windows, web-e2e, mobile-health, postgres-integration, foundation-gate: **9/9 SUCCESS**. This executor directly re-read run metadata, jobs and the PG/Web raw logs; no rerun was requested.

## F01 evidence mapping at the fixed implementation main

The source links below are pinned to the reviewed main. [PostgreSQL job 108590150778](https://github.com/edward321416-maker/build-manager/actions/runs/36308648939/job/108590150778) reports 16/16 files and 185/185 tests; registration 10/10, units 6/6, capabilities 4/4. [Web job 108590150735](https://github.com/edward321416-maker/build-manager/actions/runs/36308648939/job/108590150735) contains the six named passes below and authenticated gate summary: 51 tests, failed 0, skipped 0, retries 0, negative controls 17. Counts are execution inventory, not coverage or release readiness.

| Requirement / design item | Fixed-main source / assertion | Execution evidence |
|---|---|---|
| AC01 own-org Property creation/readback | [registration:36](https://github.com/edward321416-maker/build-manager/blob/6706afe3a2cc5bdd2fd7204ce7944fafdd422065/tests/postgres/b3-registration.test.ts#L36), `AC01/AC04 admin creates Property, keeps legacy null rows readable, and permits duplicate references` | PG registration 10/10; named Web `B3 AC01 adminPropertyCreateReadback` |
| AC03 foreign/inactive org creation denied | [registration:92](https://github.com/edward321416-maker/build-manager/blob/6706afe3a2cc5bdd2fd7204ce7944fafdd422065/tests/postgres/b3-registration.test.ts#L92), NOT_FOUND and no row | PG registration; named Web `B3 AC03 hiddenOrgPropertyCreate404` |
| AC05 Unit creation and persisted readback | [registration:106](https://github.com/edward321416-maker/build-manager/blob/6706afe3a2cc5bdd2fd7204ce7944fafdd422065/tests/postgres/b3-registration.test.ts#L106), stored Unit defaults / no Occupancy | PG registration; named Web `B3 AC05 adminUnitCreateReadback` |
| AC07 foreign/archived Property write denied | [registration:131](https://github.com/edward321416-maker/build-manager/blob/6706afe3a2cc5bdd2fd7204ce7944fafdd422065/tests/postgres/b3-registration.test.ts#L131), createUnit NOT_FOUND | PG registration; named Web `B3 AC07 hiddenPropertyUnitCreate404` |
| AC09 cross-org Unit parent constraint | [units:143](https://github.com/edward321416-maker/build-manager/blob/6706afe3a2cc5bdd2fd7204ce7944fafdd422065/tests/postgres/b3-units.test.ts#L143), FK23503 outside Web RLS | PG units 6/6 |
| AC10 own-org Unit list/detail | [units:33](https://github.com/edward321416-maker/build-manager/blob/6706afe3a2cc5bdd2fd7204ce7944fafdd422065/tests/postgres/b3-units.test.ts#L33), ACTIVE rows and cursor filtering | PG units; named Web `B3 AC10 adminUnitReadEmptyAndDetail` |
| AC13 write bypass resistance | [units:98](https://github.com/edward321416-maker/build-manager/blob/6706afe3a2cc5bdd2fd7204ce7944fafdd422065/tests/postgres/b3-units.test.ts#L98), raw staff INSERT / forged org/digest denied; [capabilities:154](https://github.com/edward321416-maker/build-manager/blob/6706afe3a2cc5bdd2fd7204ce7944fafdd422065/tests/postgres/b3-capabilities.test.ts#L154), column/policy contract | PG units and capabilities 4/4 |
| AC19 Unit non-disclosure | [units:127](https://github.com/edward321416-maker/build-manager/blob/6706afe3a2cc5bdd2fd7204ce7944fafdd422065/tests/postgres/b3-units.test.ts#L127), full org/property/unit chain, generalized NOT_FOUND | PG units; named Web `B3 AC19 hiddenUnitPagination` |
| PR47 last direct Property gap | [registration:59](https://github.com/edward321416-maker/build-manager/blob/6706afe3a2cc5bdd2fd7204ce7944fafdd422065/tests/postgres/b3-registration.test.ts#L59), `F01 newly registered Properties are unreadable across organizations in both directions`: A/B create via registration port, both own-org persisted readbacks, exact foreign IDs denied under both caller and owning org contexts | PG registration 10/10; real authorization-aware reader, not bypass SQL |

The six named Web cases are in [b3.spec.ts](https://github.com/edward321416-maker/build-manager/blob/6706afe3a2cc5bdd2fd7204ce7944fafdd422065/apps/web/tests/b1-e2e/b3.spec.ts). Together these satisfy creation, own-org readback, and cross-org non-visibility under design §17. The private reconciliation explicitly maps the canonical clauses and finds no remaining F01 evidence gap. The operator authorized the F01-only registry promotion on this reconciliation; documentation review and publication evidence are tracked in PR48 separately from the implementation evidence above.

## Evidence classes and limits

- HOSTED_CI: fixed-main jobs and logs above. SYNTHETIC_AUTH + ACTUAL_WEB_POSTGRES: authenticated real Web/API/PostgreSQL flows; not LIVE_PROVIDER.
- INDEPENDENT_REVIEW: Opus source analysis and hosted-log readback; not independent runtime reproduction. DOCUMENT_EVIDENCE: this executor's source/log/readback checks. Local product/PG/Web/Mobile execution for this docs task: **NOT_RUN**.
- The PG reporter reports per-file totals, not every test title. Inclusion of the PR47 test is established from the fixed source's 10 declared registration tests, no skip/only/todo modifiers, and the file's 10/10 pass result. Do not claim a per-test named PG log line.
- The direct PR47 test checks the authorization-aware adapter/reader, not RLS in isolation; separate AC12/AC13 tests supply raw RLS/ACL evidence.
- No new cross-org Property-list test was required by reconciliation; the absence of that additional observation is retained, not represented as executed evidence.
- F01 has no race clause. Its planned_evidence synchronized-dual-connection language is N/A for this case, not removed from the registry and not silently weakened.
- F43 includes registration **and search**. Search remains absent; F43 stays NOT_RUN. No address/reference merge, provider verification, real-data or production-readiness claim is made.

## Preserved state and historical succession

B3 remains **MERGED_WITH_DISCLOSED_LOW**; PF02-B remains IN_PROGRESS; B1/B2 stay VERIFIED / FROZEN. Targeted M01/M03/M04 resolution and AC04 REQUIRED_EVIDENCE_SATISFIED with its separate PG-layer 513 rejection NOT_RUN remain as recorded in the [PR45 successor receipt](pf02_b_b3_low_remediation_acceptance.md). Local Mobile stays **FAILED / OPEN / ROOT_CAUSE_NOT_ESTABLISHED**; hosted passes neither replace the original failures nor establish their cause.

[PF02-A](pf02_a_acceptance.md), [B3 implementation](pf02_b_b3_acceptance.md), [B3 LOW remediation](pf02_b_b3_low_remediation_acceptance.md), the approved design/plan and `AUDIT_REPORT.md` retain their historical F01 NOT_RUN snapshots; those earlier records are not rewritten. The current-facing [production-foundation README](../docs/production-foundation/README.md) is revision 1.2 and now reflects F01 PASS / F43 NOT_RUN. [SHA256SUMS.json](../docs/production-foundation/SHA256SUMS.json) is likewise revision 1.2 with all 12 governed UTF-8 byte streams freshly recomputed, including the promoted registry and README. No other F-case is promoted or rewritten.

## Publication provenance and next consequential gate

The canonical registry records **F01 = PASS_POSTGRES_INTEGRATION**. Evidence main `6706afe3a2cc5bdd2fd7204ce7944fafdd422065` is the immutable implementation snapshot reconciled above; it is not a claim about the current live main or the current publication state. [PR48](https://github.com/edward321416-maker/build-manager/pull/48) holds the exact documentation commits, independent review, publication state and associated CI receipts. Documentation CI remains distinct from fixed implementation-main runtime evidence. Read live GitHub state when those publication facts are needed.

The next consequential gate is a **separately authorized B3 closure/status decision**. It is not authorized or performed by this F01 promotion. B3 remains MERGED_WITH_DISCLOSED_LOW; PF02-B remains IN_PROGRESS. B3 closure / VERIFIED/FROZEN = NOT_PERFORMED. F43 remains NOT_RUN. Current additional product task = NONE_AUTHORIZED; no F43 implementation, additional product work or later slice is authorized. Product/source/test/migration/workflow/dependency changes = 0. Local Mobile remains FAILED / OPEN / ROOT_CAUSE_NOT_ESTABLISHED. REAL_TENANT_DATA and PRODUCTION_DB_HOSTING remain NOT_AUTHORIZED. EXTERNAL_SYNC = PARTIAL_SYNC: the PR48 correction event, its sync receipt, the coordinator-review skill receipt and the sanitized schema-cache event were written to the configured Google execution log and read back; the sanitized tool/schema cache was also written to the configured Drive cache folder and read back. Historical queued events remain pending. OAuth/IAM/provider changes = 0.
