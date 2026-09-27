# PF02-B B3 LOW remediation acceptance and integration

Snapshot: **2026-09-27**. POLICY_REF / DOCS_BASE / recorded-against main: `baf60a1f31326cb8c6ce469a6a366dc91301cf47`.
Repository: `edward321416-maker/build-manager`.

## Scope and document authority

This follow-up receipt records the accepted and merged PR #45 remediation of B3SR-M01/M03/M04. The operator separately authorized this six-path documentation reconciliation, local document/public checks, commit/push, one Draft PR and its exact-head CI. This document is a **documentation candidate** until separately reviewed and merged; it does not claim its state-router changes are already on main. Its stopping point is OPEN / DRAFT / NOT_MERGED. No Ready transition or merge is authorized for this documentation PR.

PF02-B remains IN_PROGRESS; B1/B2 and the previously frozen foundation remain unchanged. B3 remains **MERGED_WITH_DISCLOSED_LOW**: the PR #42 integration state now has the accepted PR #45 remediation recorded alongside it, with the targeted three findings resolved. The label does not mean those three findings are still OPEN. Formal B3 slice closure or VERIFIED/FROZEN promotion has not been performed. **CURRENT ADDITIONAL PRODUCT TASK = NONE_AUTHORIZED**. F01/F43 remain NOT_RUN.

## Historical succession and received review

1. The [original B3 acceptance receipt](pf02_b_b3_acceptance.md) records PR #42 acceptance with M01/M03/M04 deferred as LOW / OPEN and AC04 PARTIAL. That historical receipt and the [plan authorization](pf02_b_b3_plan_acceptance.md) remain byte-identical.
2. The separately authorized PR #45 candidate remedied those three findings. Its fixed three-commit, ten-path delta was independently reviewed by Opus as **DELTA_ACCEPTED**, with new BLOCKER/HIGH/MEDIUM/LOW findings **0/0/0/0**.
3. The operator accepted that exact candidate and explicitly extended the earlier Draft-only local Mobile exception to its acceptance and merge, retaining the local failure as OPEN. Candidate and fresh merge-main hosted CI were not waived.
4. PR #45 was merged and its actual new main CI passed. This later documentation authorization records the resulting targeted finding dispositions; it does not retroactively alter what the earlier acceptance or merge tasks were authorized to publish.

Sources: [received review and operator acceptance](https://github.com/edward321416-maker/build-manager/pull/45#issuecomment-5847820911), [actual merge/main CI publication receipt](https://github.com/edward321416-maker/build-manager/pull/45#issuecomment-5847875936).

The accessible original `PR45_B3_LOW_DELTA_REVIEW.md` was read and rehashed: **23,253 bytes**, SHA-256 `c9b6e175b735c631a9bc198741f6bb4f500a10108500c11679795be469e4cc06`. This matches the remote review receipt. Reviewer LOCAL_EXECUTION=NOT_RUN: fixed-ref analysis and executor/hosted evidence readback are not an independent runtime reproduction. The reviewer disclosed prior B3 design, PR #42 implementation, M02 and PR #44 review participation, with no product implementation/edit/commit/publication participation. Codex records that received review, not a new independent review. O1–O4 remain observations, not new findings or authorized tasks.

## Exact Git publication

| Fact | Value |
| --- | --- |
| Accepted PR | [#45](https://github.com/edward321416-maker/build-manager/pull/45), MERGED |
| Pre-merge main / ordered parent 1 | `9590ffe4bdd5602a9b2975214d6f2f0fdd12b1bf` |
| Accepted candidate / ordered parent 2 | `738c061a9e5396fb9a8f39e477e3cc706f330d3e` |
| Actual merge / product main | `baf60a1f31326cb8c6ce469a6a366dc91301cf47` |
| Merged at | `2026-09-26T16:19:17Z` = `2026-09-27T01:19:17+09:00` |
| Candidate and merge tree | `219b66afe1d45aac9961a8776e0520fa044d7f9e` |

Live GitHub readback confirms the ordered parents and equal tree. The native exact-head protected merge added no candidate code/docs/log-only commit; the feature branch was preserved. The PR test-merge checkout is distinct from this actual merge. The original B3 implementation remains PR #42 / `741997d93015991c1c89716a3ca93b662a8be0d8`; PR #45 supplements rather than replaces that provenance.

## Targeted findings and AC04 evidence

| Item | Current disposition recorded by this candidate | Accepted evidence and limit |
| --- | --- | --- |
| B3SR-M01 | RESOLVED — accepted and integrated through PR #45 | Valid denied Property/Unit registration views retain logout. Invalid/401 sessions discard stale session authority; registration denial and H01 request-cancellation/late-response guards remain. Review and real authenticated Web/PostgreSQL evidence are linked above. |
| B3SR-M03 | RESOLVED — accepted and integrated through PR #45 | Exact installed policy expressions and complete function EXECUTE ACL tuples, including grantee/grantor/grant-option, are asserted. The same checkers reject throwaway observation mutations; this is not a claim of a reproduced live RLS bypass. |
| B3SR-M04 | RESOLVED — accepted and integrated through PR #45 | Actual PostgreSQL persistence and independent readback of 512-code-point Korean, emoji and mixed references; actual HTTP 513-code-point rejection with 400 and unchanged row snapshots. |
| B3 AC04 | REQUIRED_EVIDENCE_SATISFIED — judgement of the accepted independent review | The requested gap is satisfied by the accepted execution evidence; this is an evidence disposition, not a new runtime run or canonical F-case PASS. |

**AC04 remaining limit:** a separate PostgreSQL-layer rejection of a 513-code-point input was **NOT_RUN**. The accepted positive evidence is real PostgreSQL 512-code-point storage/readback with byte/code-point checks and legacy-null preservation. The negative evidence is real HTTP 513-code-point input returning 400 below the payload-size limit, with exact data-snapshot equality. Those layers are not interchangeable. No 23/23 newly reproduced acceptance claim, coverage percentage, launch readiness or security-completion claim is made. Other AC dispositions remain sourced to their historical reviews.

The original LOW severity and deferral history remain in the original receipt. This follow-up is succession, not a contradiction or permission to rewrite historical evidence. B3D-L01/L02, B1 deferred LOWs and B2 B2I-L01–L04 remain outside this remediation.

## CI generations and evidence classification

| Generation | Exact head | Event / attempt | Repository run | App run | Disposition |
| --- | --- | --- | --- | --- | --- |
| PR #45 product candidate | `738c061a9e5396fb9a8f39e477e3cc706f330d3e` | pull_request / 1 | [36214923529](https://github.com/edward321416-maker/build-manager/actions/runs/36214923529) | [36214923536](https://github.com/edward321416-maker/build-manager/actions/runs/36214923536) | Required 9/9 SUCCESS |
| PR #45 actual product merge-main | `baf60a1f31326cb8c6ce469a6a366dc91301cf47` | push / main / 1 | [36255034896](https://github.com/edward321416-maker/build-manager/actions/runs/36255034896) | [36255034880](https://github.com/edward321416-maker/build-manager/actions/runs/36255034880) | Required 9/9 SUCCESS |
| This documentation candidate | Fixed after commit; recorded on its Draft PR | New pull_request generation | Recorded on documentation PR | Recorded on documentation PR | Separate DOCUMENTATION_PUBLICATION evidence; never substituted with the two rows above |

All nine named jobs in each product generation were directly rechecked through the API: verify, repository-safety, apps, mobile-cold-linux, install-mobile-windows, web-e2e, mobile-health, postgres-integration and foundation-gate. They are completed/success; none is missing, skipped or cancelled.

The [merge publication receipt's raw-log readback](https://github.com/edward321416-maker/build-manager/pull/45#issuecomment-5847875936) reports Linux and Windows Mobile each 13 suites / 133 tests (failed/pending/todo 0), demo 23, authenticated Web/PostgreSQL 51 (H01 8, new LOW 9; failed/skipped/retries 0), registry negative controls 17, PostgreSQL 184 / 16 files and Expo Doctor 21/21. These counts are attributed to that executor log-readback receipt; this documentation task rechecked run/job metadata and read the receipt, without a new raw-log audit or local runtime rerun. Counts are not coverage or release readiness.

INDEPENDENT_REVIEW, EXECUTOR_LOCAL and HOSTED_CI remain separate classes. Authentication evidence is **SYNTHETIC_AUTH + ACTUAL_WEB + ACTUAL_POSTGRES**, not LIVE_PROVIDER. No live Auth0 test or native-device verification is claimed. Local product tests/builds in this documentation task are NOT_RUN; document/scanner checks are separate.

## Local Mobile risk and other retained limits

**LOCAL_MOBILE_FAILED_DISCLOSED_EXCEPTION / FAILED / OPEN / ROOT_CAUSE_NOT_ESTABLISHED** remains current. The following retained executor evidence is summarized from the received review, publication receipt and [historical execution log](AI_Execution_Log.csv), not rerun here:

| Evidence | Result and limitation |
| --- | --- |
| Original non-instrumented local run | 132 PASS / 1 timeout FAIL; TEST_TIME_SNAPSHOT_UNVERIFIED remains. Outer log-printing exit 0 did not override npm failure 1. |
| Controlled native Windows A(BASE) and B(dirty candidate) | One run per arm; each 132 PASS / 1 FAIL; child exit 1 at the unchanged 5000 ms limit. |
| Separate instrumented BASE | One run; 133 PASS, child exit 0, target 4644 ms; NOT_REPRODUCED_UNDER_INSTRUMENTATION. Not candidate acceptance or cause resolution. |
| Hosted candidate and actual-main Mobile | Successful separate environments; do not erase the local failures or establish an environment-only cause. |

The completed diagnostic ledger remains A=1 / B=1 / TRACE=1. Do not repeat those runs. This native Windows comparison is **separate from** the earlier Windows-mounted Ubuntu timeout in [PF02-A evidence](pf02_a_acceptance.md); file invariance and past passes do not prove a common cause. The operator's one-candidate risk exception is completed approval history, not a standing waiver for future local or hosted failures.

Existing dependency advisories/install-script warning, Actions runtime warning, Auth0 entitlement and independent live reproduction limits, operational session/retention, production hosting/credentials, real-data pilot and incomplete security/privacy review remain open. REAL_TENANT_DATA = NOT_AUTHORIZED; PRODUCTION_DB_HOSTING = NOT_AUTHORIZED. No provider/IAM or follow-on product work is authorized.

## Preservation, next gate and publication boundary

This docs candidate changes only STATUS, the two state routers, this new receipt and the two append-only ops logs. Past acceptance receipts, migrations 0001–0008, approved design/plan, canonical acceptance_cases.json, all product/source/tests/workflows/dependencies and PR #45 records are unchanged. Completed LOW remediation, diagnostics and PR #45 merge must not restart.

The next gate is **review of this PR #45 follow-up documentation candidate**, followed only by separately authorized publication. No B3 whole-product re-audit, canonical slice closure, VERIFIED/FROZEN, F01/F43 promotion or later slice is initiated. Before this docs PR is merged, main's old LOW/AC04 wording remains unchanged; the candidate records the accepted successor facts without claiming early integration.

Only explicitly listed accessible pending events are appended to [the execution log](AI_Execution_Log.csv) and [pending sync queue](pending_external_sync.md). New events after the docs HEAD is fixed belong in its PR/private queue, not another log-only commit. EXTERNAL_SYNC=PENDING; Google Sheets/Drive writes=0; new account/OAuth/IAM changes=0.
