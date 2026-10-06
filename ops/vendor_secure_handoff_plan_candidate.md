# Vendor Secure Handoff v1 — Implementation Plan Candidate Receipt

**Status:** `CANDIDATE_READY_FOR_INDEPENDENT_REVIEW / PRODUCT_IMPLEMENTATION_NOT_AUTHORIZED`

## Fixed refs

- BASE / POLICY_REF / TARGET_REF: `954ef347efef9db29465aefa2e72003b176ee150`
- planning branch: `docs/vendor-secure-handoff-v1-implementation-plan-d9r1`
- plan: `docs/superpowers/plans/2026-10-06-vendor-secure-handoff-v1.md`
- plan blob: `a6aa1d111dec67ee80b7f687000af087b3bf1ce6`
- approved design spec blob: `ce0ad01a532e6d7230d441f6a580ea0c6ea5e11e`
- frozen D9 snapshot blob on this branch: `67d5ec480db3464eebdf51842905526f0de91b26`
- D9R1 closure receipt blob: `8bec733aac1a18b8b5dd6b03488acaafe96c8eb0`
- final D9R1 package SHA-256: `bd191175ba687081eb5a3a18df0d3686458334c2c1d8a01fdca1fe96ffd474b7`

## Authority separation

The Design snapshot records the historical D9 gate before Development authorized plan drafting. Development later authorized **plan drafting only** after a PASS/BLOCKER0/HIGH0 review.

The historical post-`5dd8c` plan remains:
`QUARANTINED / NOT_AUTHORIZED / DO_NOT_EXECUTE`.

This candidate does not authorize or perform product implementation.

## Self-audit

- Task inventory: `Task 0–Task 12` present.
- AC traceability: `AC01–AC57 = 57/57`; missing AC = 0.
- placeholder scan: no unresolved `TBD / TODO / FIXME`.
- Review Focus: all five required failure classes have owning tests/tasks.
- approved Design package SHA is pinned in the plan.
- product implementation prohibition is explicit at header, global constraints, Task 0 and execution handoff.
- all `Create:` paths were checked against drafting-time main; no create-path collision.
- existing repository paths named by the plan were read from `954ef347...`.
- paths marked Modify/Extend that do not exist on drafting-time main are introduced by an earlier plan task before later modification; no use-before-create task ordering was found.
- drafting-time migration head is `0018`; Task 0 requires live renumbering rather than assuming `0019–0022` if main advances.
- open RR01 Draft PR #73 is treated as potential future main drift; implementation start requires live-main/dependency/workflow revalidation.

## Plan corrections made during self-review

The initial candidate was tightened before review to cover:

1. frozen 72-hour raw-link expiry, 7-day Vendor-session maximum and one active Vendor session;
2. exact Vendor source-photo and completion-photo routes, with no Tenant raw completion-photo route;
3. `COMPLETION_REPORTED` as a derived phase rather than a fifth assignment status;
4. a server-side `vendor_handoff.guard_direct_completion` integrated into the existing Core completion transaction so a non-ended VendorAssignment cannot be bypassed by direct handling, including create-vs-complete race coverage;
5. exact minimum text bounds for vendorLabel/accessInstruction/short operational notes;
6. self-contained independent-review authority bundle.

## Independent review focus

Review should reject the candidate for BLOCKER/HIGH if it:

- lets Vendor HTTP authenticate through B1/Auth0 or `bm_b1_web`;
- lets Manager/Tenant authority become Vendor authority;
- durably stores/logs raw capability/session/CSRF;
- permits Manager-authored Tenant unattended-entry consent;
- updates Appointment time in place;
- collapses Vendor report, Manager completion, Tenant outcome or Maintenance Fact;
- fails to atomically guard closeout, public communication, assignment end and Vendor access revocation;
- leaves direct Manager completion usable while a non-ended assignment exists;
- blocks ordinary direct completion because of only historical ENDED assignments;
- proves image metadata stripping only with mocks rather than decoded output;
- blindly retries ambiguous mutations;
- rewrites existing migrations or weakens frozen security/tests/CI gates;
- authorizes product implementation merely because plan review passes.

## Changed-path class

At this candidate stage, repository changes are limited to planning/review documentation and append-only bookkeeping. No product source, SQL migration, test implementation, dependency manifest, lockfile or workflow implementation is authorized.

## Next gate

`INDEPENDENT_IMPLEMENTATION_PLAN_REVIEW_VENDOR_SECURE_HANDOFF_V1`

A PASS independent review still does **not** authorize product implementation. The operator must separately authorize implementation and execution method.

CHECKPOINT | Vendor Secure Handoff plan candidate | evidence=plan_blob_a6aa1d11 / AC57_of_57 / authority_bundle_exact | tokens=unknown
