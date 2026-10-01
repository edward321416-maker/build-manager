# Project session handoff

Repository: `edward321416-maker/build-manager`

## Purpose

Canonical reconstruction entry point for a new ChatGPT / Claude / Codex session.

This file is a **router and index**, not an encyclopedia. It does not restate the content of
`STATUS.md`, acceptance receipts, specs or policies. It tells a new agent **what to read, in what
order, which decisions are closed, and what work is currently authorized**. Every substantive fact
lives in the canonical repository file linked from here or from
[`ops/CHAT_CONTEXT_MANIFEST.json`](CHAT_CONTEXT_MANIFEST.json).

If this file and a canonical repository file disagree, the canonical file at the **current** `main`
wins and this file is stale.

## Authority rule

Ordered, highest authority last:

1. Conversation memory — **lowest**. Never a source of truth. Do not claim recall of prior chats.
2. This handoff and the manifest — routing only. They can go stale between publications.
3. Exact Git ref readback from the current `main` — authoritative for code, schema, policy and workflow.
4. Canonical acceptance receipts and `STATUS.md` at that ref — authoritative for milestone state.

Rules that follow from this:

- Do not say you read something you did not read. Name the ref and path you actually read.
- Prefer a direct GitHub readback over any summary, including this one.
- The manifest records a **baseline** commit as provenance, not as a permanent claim about the
  current `main`. Always read the live `main` yourself and compare.
- If a private artifact referenced here is not reachable, mark it `UNAVAILABLE_LOCAL_ARTIFACT`
  and continue from repository evidence. Do not guess its contents.
- Distinguish *design proposal*, *executor-reported evidence*, *hosted CI*, *independent review*
  and *live provider evidence*. See "Evidence classification".

## Mandatory bootstrap order

Read exactly these, in this order, before answering anything substantive:

1. `AGENTS.md`
2. `governance/ai_delivery_rules.md`
3. `governance/project_policy.md`
4. `ops/CHAT_CONTEXT_MANIFEST.json`
5. `STATUS.md`
6. `ops/CHAT_HANDOFF.md` (this file)

Then read **only** the acceptance receipts and approved specs that the manifest marks as current
for the slice you are working on. Do not bulk-read the repository.

Record the `main` commit you actually read as `POLICY_REF`. Product/code facts are read at the same
ref unless a task pins a different `TARGET_REF`.

## Current canonical milestones

Acceptance receipts are the milestone evidence. Read the receipt, not a summary of it.

| Milestone | State | Canonical receipt |
| --- | --- | --- |
| PF00 (A/B, C, D) | FROZEN | `ops/pf00_ab_acceptance.md`, `ops/pf00_c_acceptance.md`, `ops/pf00_d_acceptance.md` |
| PF01 | REVIEW_DRAFT | `docs/production-foundation/PF01_data_authorization.md` (design, not a receipt) |
| PF02-A | VERIFIED / FROZEN | `ops/pf02_a_acceptance.md` |
| PF02-B | IN_PROGRESS | — |
| PF02-B / B1 | VERIFIED / FROZEN | `ops/pf02_b_b1_acceptance.md` |
| PF02-B / B2 | VERIFIED / FROZEN | `ops/pf02_b_b2_acceptance.md` |
| PF02-B / B3 | VERIFIED / FROZEN | [Canonical closure receipt](pf02_b_b3_closure.md); implementation/remediation/F01 evidence accepted and published; retained B3D-L01/L02, AC04 PG-513 evidence limit and Local Mobile risk remain disclosed |
| PF02-B / B4 | VERIFIED / FROZEN | [Canonical closure receipt](pf02_b_b4_closure.md); PR #58 accepted HEAD `6f8d98e5abaf8edb68585f3029459c4df0d91307` merged as `6cf71049c479d100ec6e949002c2e30c8df81eba`; retained B4I-L01/B4R-L01 LOW and B4D-L01..L04 boundaries remain disclosed. [Erratum publication](pf02_b_b4_erratum_publication.md) is a historical pre-implementation snapshot. |
| PF02-B / B5 | PLAN_APPROVED_PUBLISHED / IMPLEMENTATION_AUTHORIZED | [Authority receipt](pf02_b_b5_plan_acceptance.md); next gate FIXED_HEAD_WHOLE_IMPLEMENTATION_REVIEW. |
| Beyond B5 | NOT_STARTED / NOT_YET_SCOPED | — |

Foundation design context (not milestone evidence):
`docs/production-foundation/README.md`, `docs/production-foundation/00_foundation_blueprint.md`,
`docs/production-foundation/PF01_data_authorization.md`.

## Frozen decisions

Closed. Do not re-derive, re-propose or re-ask these. Each is evidenced by the receipts above.

- PF00 toolchain and verification foundation are frozen.
- PF02-A PostgreSQL foundation (schema, transaction/RLS boundary, ephemeral integration tests) is frozen.
- B1: Auth0 **Database-connection-only** Web identity/session path.
- B1 authentication, session registry, proxy transport, completion and logout are frozen.
- B2: the approved **A+** architecture, now canonical in `main` at
  `docs/superpowers/specs/2026-09-23-pf02-b-b2-property-staff-scope-design.md`.
- **Organization context is not property authority.** They are separate capabilities.
- `ORG_ADMIN` sees every ACTIVE property in their own ACTIVE organization.
- `PROPERTY_STAFF` sees only properties with a current ACTIVE assignment to their current membership.
- Existing `/api/v2` URLs are reused. No staff-specific duplicate API.
- No assignment mutation API or UI in B2.
- Modular Monolith, explicit SQL, application ports. No ORM.
- B3 Building Registration Foundation is VERIFIED / FROZEN at the approved design/plan and accepted implementation boundary. Retained B3D-L01/L02, AC04 PG-513 evidence limit and Local Mobile risk remain disclosed; none authorizes reopening or later product work.
- B4 Property Assignment Mutation Foundation is VERIFIED / FROZEN: exact-resource GET/PUT/DELETE for an ORG_ADMIN on a current same-org ACTIVE PROPERTY_STAFF membership and ACTIVE Property, migration 0009, `bm_b4_assignment_owner` SECURITY DEFINER boundary and canonical B4D-L04 method boundary. Retained B4I-L01/B4R-L01 and B4D-L01..L04 do not authorize reopening or later work.
- B5 design and revision 0.4 plan are approved and published. Separate [execution authority](pf02_b_b5_plan_acceptance.md) permits implementation through a Draft PR; implementation Ready/merge, PF02-C and later slices remain unauthorized.

## Do not reopen without new evidence

A frozen decision reopens only on **new, specific, reproducible evidence**: a demonstrated security
or data-isolation defect, a contradiction proven against an exact ref, or an operator instruction.

Not sufficient to reopen:

- "a cleaner architecture", "a more modern pattern", "this would scale better"
- preference about naming, file layout or framework style
- a general best-practice claim with no failing case against this repository
- a desire to unify or refactor frozen code while adding no verified behavior

If you believe a frozen decision is wrong, report the exact file, ref and failing scenario and stop.
Do not redesign first.

## Deferred / unauthorized

Not in scope. Do not implement, scaffold or "prepare" these:

- Production DB hosting, credential/IAM provisioning
- Real tenant / landlord / address data (`REAL_TENANT_DATA = NOT_AUTHORIZED`)
- Staff invitation, staff creation, membership role mutation
- Assignment management UI, assignment collection/list API, and lifecycle work beyond the frozen B4 exact-resource API
- Staff roster, staff search, staff onboarding
- Resident / occupancy end-user flow
- Ticket flow
- Mobile authentication
- Kakao login, account linking
- Billing
- Completion of privacy/security work

## Evidence classification

Never collapse these categories. State which one you are using.

| Class | Meaning |
| --- | --- |
| `EXECUTOR_LOCAL` | Run on the executor's machine. Not independently reproduced. |
| `HOSTED_CI` | GitHub Actions run. Cite run id, head SHA and event. |
| `INDEPENDENT_REVIEW` | Reviewer-side reading of a fixed ref. Not a runtime claim. |
| `LIVE_PROVIDER` | Real Auth0 interaction. Currently executor-reported only. |
| `SYNTHETIC_AUTH` | Test-minted session cookie, not a provider login. |
| `ACTUAL_WEB_POSTGRES` | Real app server and real PostgreSQL, synthetic identity. |

CI generations are not interchangeable: **candidate** (`pull_request`), **implementation-main**
(`push`) and **closure-main** (`push`) are separate evidence. A docs-only closure run is
publication evidence, not product re-verification.

Automated bot status (for example CodeRabbit) is **not** independent review. Test counts are not
coverage. A green CI run is not a correctness proof for authorization.

## Open risks

Summarized by link only. Read the cited file for the current wording.

- Dependency security triage — moderate npm advisories and an install-script warning. `STATUS.md`.
- CI supply-chain maintenance — pinned Action majors vs. hosted Node runtime. `STATUS.md`.
- Mobile Windows-mounted Ubuntu timeout — `ROOT_CAUSE_NOT_ESTABLISHED`. `STATUS.md`.
- Auth0 entitlement `NOT_VERIFIED`; `LIVE_AUTH0_INDEPENDENT_REPRO = NOT_RUN`; `LIVE_AUTH0_B2 = NOT_RUN`.
  `ops/pf02_b_b1_acceptance.md`, `ops/pf02_b_b2_acceptance.md`.
- Deferred findings — B1 LOW findings and B2 `B2I-L01`–`L04` remain non-blocking and deferred.
  See each receipt for current disposition.
- B3 local Mobile: FAILED / OPEN / ROOT_CAUSE_NOT_ESTABLISHED; original/native Windows A/B failures remain distinct from instrumented BASE and hosted passes, and from the earlier Windows-mounted Ubuntu risk — [PR45 follow-up receipt](pf02_b_b3_low_remediation_acceptance.md).
- Retained B3D-L01/L02 and AC04 separate PG-layer 513-code-point rejection NOT_RUN — [historical B3 receipt](pf02_b_b3_acceptance.md) and [current follow-up](pf02_b_b3_low_remediation_acceptance.md). Targeted M01/M03/M04 are resolved, not open risks.
- Retained B4I-L01/B4R-L01 (non-blocking LOW concurrent-lifecycle classification limitation) and B4D-L01..L04 boundaries — [B4 closure receipt](pf02_b_b4_closure.md). No global lifecycle serialization, exactly-once/CommandReceipt or request-arrival eligibility-snapshot claim.
- B5D2-L02 = `ACCEPTED_LOW_RESIDUAL`: a self-termination 204/409 may reveal one bit about whether another effective administrator exists to an already-authorized admin; no User/status row or reason is publicly projected. See the approved B5 design.
- Canonical acceptance cases — most `F` cases remain `NOT_RUN`.
  `docs/production-foundation/acceptance_cases.json`.
- External sync — `EXTERNAL_SYNC = PARTIAL_SYNC`: PR48 correction/sync/cache events have verified Google write/readback; historical queued events remain pending. `ops/pending_external_sync.md`.

### Succession, not contradiction

`B1I-M01` is recorded as open hardening backlog in the **B1** receipt (true at B1 closure) and as
`CLOSED_BY_B2` in the **B2** receipt and `STATUS.md` (true now). That is succession. Never edit a
past receipt to match today's status. Likewise, PR42's LOW OPEN / AC04 PARTIAL snapshot is preserved; the [PR45 successor receipt](pf02_b_b3_low_remediation_acceptance.md) records accepted targeted resolution and required evidence satisfied. PR46 merged that follow-up documentation; PR47 then merged the direct F01 evidence test. The [F01 promotion receipt](pf02_b_f01_promotion_acceptance.md) records F01-only registry succession to PASS_POSTGRES_INTEGRATION. It does not retroactively change earlier authorization or historical snapshots.

## Baseline Git state

Provenance for this package, **not** a claim about the current `main`:

- Baseline `main` used to build this package: `5670a6246805cadc9e6cb2c0ccff3eaaf01a2c2d`
  (B2 canonical closure merge, PR #35).
- B2 implementation main: `f0c6e80c9e1072f5b6a98bacc7697af01da9c7d1` (PR #34).
- Closure-main CI: App run `35947253215`, Repository run `35947253217`, event `push`, 9/9 SUCCESS.
- Implementation-main CI: App run `35944851872`, Repository run `35944851923`, event `push`, 9/9 SUCCESS.

Pull requests:

| PR | State | Role |
| --- | --- | --- |
| #67 | MERGED | Approved revision 0.4 plan publication; merge/main `9ee208b996ad945e0e8dea828d3f0e77b6ccbe42`; separate execution authority is recorded in the B5 receipt |
| #63 | MERGED | Historical B5 design publication; merge/main `08fd7eb2ebd2aa3ba61efc089484b479c6f2b764`; later plan and implementation authority is recorded separately |
| #35 | MERGED | B2 canonical closure |
| #34 | MERGED | B2 implementation |
| #33 | CLOSED / NOT_MERGED / `SUPERSEDED_BY_CANONICAL_SPEC_IN_MAIN` | Approved B2 design source; spec canonicalized into `main`, branch/history preserved. Not a rejection. |
| #30 | OPEN / DRAFT | Historical B1 coordination-document registration. `NOT_CANONICAL`. Do not merge or close as part of unrelated work. |

**The current `main` is expected to move past this baseline** — publishing this package is itself a
commit. A newer `main` is normal, not an error. Read live `main`, compare ancestry, and prefer the
current canonical documents.

## Current authorized next task

**CURRENT ADDITIONAL PRODUCT TASK = B5_PRODUCT_IMPLEMENTATION_AUTHORIZED.**

Read [B5 plan approval and execution authority](pf02_b_b5_plan_acceptance.md). The operator approved plan publication and implementation start together on 2026-10-02, including branch, tests, commits, push, Draft implementation PR and execution bookkeeping. PR #67 published unchanged revision 0.4. Plan re-approval and repeated whole-plan review are not required.

Use the actual main SHA after this authority publication as IMPLEMENTATION_BASE_SHA; record it in the implementation evidence. Preserve the six-task plan, AC01–AC19, frozen B1–B4 and migration bytes. Prepare isolated official Node 24.21.0 and verify it without changing global environments or repository pins. B5PDR2-L01 remains OPEN_NON_BLOCKING / IMPLEMENTATION_PREFLIGHT until actual evidence.

Next gate: **FIXED_HEAD_WHOLE_IMPLEMENTATION_REVIEW** after the implementation candidate and its nine required CI jobs. Independent implementation review has not run. Implementation PR Ready/merge, PF02-C/F43, role mutation, roster/onboarding, real data, provider/IAM and production hosting remain unauthorized. The 2026-10-05 target does not waive gates.

## Private artifact rule

Do **not** assume a new session can read local machine paths. Planning artifacts, private review
documents and executor logs live outside the repository and are usually **not** attached to a new
conversation.

- If a needed private artifact is not attached or readable: state `UNAVAILABLE_LOCAL_ARTIFACT`,
  name what you needed it for, and proceed from repository evidence.
- Never reconstruct a private artifact's contents from memory or inference.
- After a milestone closes, the canonical receipt in `ops/` supersedes any private review document
  for that milestone. Prefer the receipt.
- Private paths are intentionally not listed in this package; the manifest records them as
  `not repository-addressable`.
