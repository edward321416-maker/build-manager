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
| PF02-B / B5 | ACCEPTED_AND_MERGED_WITH_DISCLOSED_LOCAL_MOBILE_RISK | [Successor receipt](pf02_b_b5_acceptance.md), original failures and AC18 PARTIAL retained. |
| Core flow RC1 | WEB_RUNNABLE / EXPO_EXECUTION_BLOCKED | [Issue69 authority](https://github.com/edward321416-maker/build-manager/issues/69), [execution](core_flow_rc1.md), [running](../docs/core-flow-rc1-running.md). Other unscoped slices remain unauthorized. |

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
- B5 design/plan approval, implementation review and candidate-specific Mobile-risk acceptance are completed history. [Successor receipt](pf02_b_b5_acceptance.md) records merge e9144fa. Issue69 separately authorizes core-flow RC1 through runnable development delivery and Draft publication; no final RC1 merge or production.

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
| #68 | MERGED | B5 accepted candidate1e7a684 integrated at e9144fa with disclosed local Mobile risk; [receipt](pf02_b_b5_acceptance.md) |
| #67 | MERGED | Approved revision0.4 plan publication; original plan/spec bytes retained |
| #63 | MERGED | Historical B5 design publication; merge/main `08fd7eb2ebd2aa3ba61efc089484b479c6f2b764`; later plan and implementation authority is recorded separately |
| #35 | MERGED | B2 canonical closure |
| #34 | MERGED | B2 implementation |
| #33 | CLOSED / NOT_MERGED / `SUPERSEDED_BY_CANONICAL_SPEC_IN_MAIN` | Approved B2 design source; spec canonicalized into `main`, branch/history preserved. Not a rejection. |
| #30 | OPEN / DRAFT | Historical B1 coordination-document registration. `NOT_CANONICAL`. Do not merge or close as part of unrelated work. |

**The current `main` is expected to move past this baseline** — publishing this package is itself a
commit. A newer `main` is normal, not an error. Read live `main`, compare ancestry, and prefer the
current canonical documents.

## Current authorized next task

**CURRENT ADDITIONAL PRODUCT TASK = CORE_FLOW_RC1_IMPLEMENTATION_FIRST.**

Authority: [issue69](https://github.com/edward321416-maker/build-manager/issues/69) and the operator-delivered RC1 implementation directive. Base/POLICY_REF `e9144fac807f39544932baac25b11f836658dbb3`; branch `feat/core-flow-rc1`. Preserve the parent checkout and old B5 worktree/history. No intermediate plan approval or independent-review loop is required.

Read [photo evidence](core_flow_rc1_photos.md), [earlier execution evidence](core_flow_rc1.md) and [run instructions](../docs/core-flow-rc1-running.md). The operator-authorized photo successor starts from3b71970 and preserves the existing Web and database: JPEG/PNG selection → preview → persisted attachment → manager view → new browser/server restart is verified.11core browser tests and310PostgreSQL tests pass. Earlier Mobile cold/focused timeout failures remain disclosed; final source focused6 and full139pass plus static exports are not runtime proof. No Expo startup request or bypass was made in this photo phase. Expo/phone/APK runtime is NOT_RUN; final two-platform RUNNABLE_CORE_FLOW_RC1_DELIVERED is not claimed. Same Draft PR70, no Ready/merge/deployment; exact-head CI receipts follow publication there. Current photo summaries were written/read back at native Sheets A179:D180 after correcting the initial transport-discovery statement; final rolling/CI receipt follows publication. Historical queues remain separate.

Finish the blocked Expo runtime verification and consolidate app feedback. Draft publication/normal pushes and bookkeeping are authorized; no final Ready/merge, deployment, paid account/OAuth/IAM, destructive change or real personal data. Fixed publication HEAD and CI receipts live on the new Draft PR. B5 is already accepted/merged: do not restart its review, merge or local Mobile diagnosis. New Mobile initial132/133 failure remains OPEN despite subsequent cold136 and finalwarm137 passes; no root-cause resolution is inferred.

Resume2026-10-03: same main and PR70 HEAD256f47d confirmed; operator renewed execution authority. Automatic review again rejected Expo startup before process creation. Separate Expo Web static export passed9routes, synthetic preparation preserved the database, and existing Web returned200. No new Expo runtime or Mobile test claim. Read the [resume receipt](core_flow_rc1.md#2026-10-03-resumed-runtime-check); this is an executor restriction, not an approval/review gate. New external sync is pending because the Google transports are unavailable in this session.

Web usability follow-up from91db051: operator explicitly prohibited repeating/bypassing Expo startup while authorizing Web improvements. Actual320px audit led to compact44px controls, saved/result descriptions and session/error/empty guidance; nested session loss now clears parent content too. Final local core browser7/7 (original4+new3), Web465, existing browser23, typecheck/lint/build passed. Failed intermediate runs and the exact peer-list before/after oracle are preserved in [the implementation receipt](core_flow_rc1.md#2026-10-03-web-usability-implementation). Web remains on3130 with the same database. Continue existing Mobile goal only after formally allowed host conditions are confirmed; no Expo startup attempt occurred in this phase. No final merge/deployment. Current new-head CI receipts are on PR70; Google sync pending.

## Existing-login implementation — 2026-10-03

Operator-authorized successor from df922d7, same branch/Draft70. [Login evidence](core_flow_rc1_login.md) is current: B1 SDK/registry adapter, additive0013 association discovery and request-scoped org binding, workspace entry, account/no-association UI, protected photos and existing POST logout. Original0001–0012 and B1–B5 security sources/identities/data preserved. Actual synthetic SDK browser5, prior core11, PG315, Web475, shared438, B1browser60/checker21, demo23 and fresh-cache Mobile139 pass. Exact photo/ticket restart verified. [Running guide](../docs/core-flow-rc1-running.md) includes3133 synthetic SDK launcher/helper and separate real Auth0 preflight. LIVE_AUTH0=NOT_RUN/CONFIGURATION_REQUIRED; Expo remains blocked/not retried. Current implementation summary A185:D185 externally appended/read back. Exact committed HEAD/required9CI and final rolling readback are published as the next receipt on PR70; no Ready/merge/deployment.

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

## Actual B1 Auth0 runtime execution — 2026-10-03

Event `CORE-FLOW-RC1-LIVE-AUTH0-20261003`; unchanged product HEAD `2d63b6f58fdf7683fe055c59dab20e32f1f1ea3c`, same worktree/branch. This actual execution supersedes only the earlier RC1 `LIVE_AUTH0=NOT_RUN/CONFIGURATION_REQUIRED` current-state claim; earlier synthetic runs and historical receipts remain unchanged.

The operator approved the existing B1 credential bundle plus one new RC1 session secret. The original B1 registered `http://localhost:3100` origin was recovered from its existing live receipt and referenced smoke test. B1 source settings and all old keys were preserved; no D01 values were mixed. Five values were connected to a private env file outside Git with exclusive creation and readback. No values, cookies, identity details or private destination identifiers appear in this receipt.

Actual isolated-browser execution, with the operator entering the existing test account directly into Auth0:

- Callback 307, B1 session completion 303 and authenticated session 200: PASS.
- Core access 200 with organization count 0; the actual app displayed the existing no-association guidance. No membership, role, assignment or ticket ownership was changed.
- Actual-account intake, photo and handling-history round-trip: NOT_RUN because this account has no existing association. Previous synthetic ticket/photo evidence remains separate.
- Product logout 303, actual provider logout return to the registered local root, then session 401: PASS. Replayed old cookies were rejected with 401 by session, core access and session completion.
- Three real app screenshots and a sanitized runtime receipt are retained privately. No synthetic session was used. Server remains available on localhost3100; the browser ends logged out.

No product source change, new regression/CI run, Ready conversion, merge or deployment occurred in this execution. AC-D06 remains NOT_VERIFIED and full desktop acceptance remains unchanged. Expo/native was not retried. Current summary was appended to the existing native execution Sheet A196:D196 and nine rolling handoff fields were updated and read back; prior coordinator rows were preserved. These append-only local records remain uncommitted so the implementation HEAD is unchanged. A future authorized account association is a separate action; no automatic grants or owner transfer is implied.

## Live tenant continuation completed

Event `RC1-LIVE-TENANT-FLOW-PASS-5968939198`: [actual tenant flow receipt](core_flow_rc1_login.md#actual-tenant-photo-flow--2026-10-03) supersedes the prior current no-association limitation only. Same product HEAD2d63b6f; actual Auth0 tenant now has exactly one explicitly authorized dedicated synthetic unit/occupancy link, while the existing manager uses synthetic SDK authentication. Real UI text/photo/submission/manager handling/reload/re-entry/history/logout completed; peer/other-org404 and post-logout401/DB-session revocation verified. No broad grants, owner transfers or existing-data changes. Original no-association state and intermediate helper failures remain historical. Local runtime records stay uncommitted; external A204 and current rolling fields read back. Preserve all existing desktop/Mobile/Expo verdicts and stop before Ready/merge/deployment; no new plan/review loop is needed.

## Tenant invitation successor in progress

Operator receipt5969526294 authorizes the [invitation successor](core_flow_rc1_onboarding.md) on the same branch/worktree. Manager invite creation, authenticated tenant request, explicit request-number confirmation and atomic approval are implemented. Local PostgreSQL330, Web487, shared438, fresh-cache Mobile139, core browser11, B1 login/onboarding browser16, B1–B5 browser60 and demo browser23 pass; initial failures remain in the receipt. One authorized empty synthetic unit was added because none was vacant. Its invitation was created/copied in the manager app. No runtime occupancy/member SQL was used for this successor. Actual Auth0 tenant login remains pending; preceding real-account evidence does not prove the new invitation flow. Final public safety checks, candidate commit and exact-head CI remain separate gates. Existing data, photos, keys, desktop dispositions and Expo restriction are preserved. External execution summary A208:D208 was read back.


## Ticket public Q&A and next action v1 successor

Authority: the operator-dispatched public-Q&A implementation attachment; POLICY/main e9144fa and preserved UI start9c1fa3e. Backendad09592 and the following Web integration add four public conversation intents, waiting badges, versioned completion guard and own-receipt recovery without changing private notes, protocol or handling meanings. [Current execution evidence](core_flow_rc1_ticket_communication.md) is the26-AC map and measured local receipt. Actual development3130 and synthetic B1 SDK runs are separate from historical actual-Auth0 evidence. The final exact candidate and required nine hosted jobs are recorded on Draft PR70 after publication. Preserve all failed attempts, five prior dirty records, data/photos and migrations0001–0015. Stop after delivery; no Ready/main merge/deployment, Expo retry, account work or automatic next slice.
