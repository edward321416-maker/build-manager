# PF02-B/B5 approved plan and implementation-start authority

Date: 2026-10-02. Classification: operator authorization and plan-publication evidence, not product implementation acceptance.

- POLICY_REF / original product baseline: `211d84ead3e65f328da648d1cc9f3e050c326c1a`.
- Approved revision 0.4 HEAD: `857b1f409c304c1a4835691352b59a91c5111958`.
- Approved [plan](../docs/superpowers/plans/2026-10-01-pf02-b-b5-membership-termination-foundation.md) blob: `61f44c6dc50d04e978602cfcd914ba85baba8721`.
- Approved [design](../docs/superpowers/specs/2026-09-30-pf02-b-b5-organization-membership-termination-last-admin-safety-design.md) blob: `3c33c817236f7b9d3c6a404125f94e48913d7a8f`.
- Independent review intake: [5935045024](https://github.com/edward321416-maker/build-manager/pull/67#issuecomment-5935045024), DELTA_ACCEPTED B0/H0/M0/L1.
- Plan-only approval: [5935475350](https://github.com/edward321416-maker/build-manager/pull/67#issuecomment-5935475350).
- Separate publication and implementation authority: [5936216651](https://github.com/edward321416-maker/build-manager/pull/67#issuecomment-5936216651), posted and read back in this execution session.
- Plan publication: PR #67 merged as `9ee208b996ad945e0e8dea828d3f0e77b6ccbe42`; reviewed plan bytes preserved.

The operator explicitly authorized plan Ready/merge, canonical authority publication, isolated B5 implementation branch, implementation/tests/commits/push/Draft PR and execution logs/rolling handoff. No repeated plan approval or plan review is required. This supersedes historical NOT_AUTHORIZED plan front matter without rewriting approved plan/spec bytes.

## Evidence and implementation base

At the approved plan HEAD, Repository run [36865075465](https://github.com/edward321416-maker/build-manager/actions/runs/36865075465) and App run [36865075494](https://github.com/edward321416-maker/build-manager/actions/runs/36865075494) were re-read: verify, repository-safety, apps, mobile-cold-linux, install-mobile-windows, web-e2e, mobile-health, postgres-integration and foundation-gate all SUCCESS. This read inspected job conclusions and head association, not job logs or test counts; it is plan-candidate evidence only.

The executor must freeze the actual main commit containing this authority publication as IMPLEMENTATION_BASE_SHA, record that exact SHA in implementation evidence, and verify the delta from POLICY_REF remains docs/ops only. No self-referential commit hash is invented here. Product implementation HEAD and AC01–AC19 runtime evidence do not yet exist in this receipt.

## Binding execution boundary

Follow the approved six-task plan and the operator-supplied ASTRA_B5_IMPLEMENTATION_INSTRUCTIONS.md handoff text. Preserve migrations 0001–0009, frozen B1–B4 and the bounded additive integration exceptions. Work RED → minimal implementation → GREEN → regression → small commits. No dependency/lockfile/workflow change, real data, provider/IAM, production hosting, PF02-C/F43, membership creation/reactivation, role mutation or roster/onboarding.

Prepare official Node 24.21.0 in a project-isolated environment; verify archive hash, actual executable and transform-types option. Do not substitute other-version results or change global configuration. B5PDR2-L01 remains OPEN_NON_BLOCKING / IMPLEMENTATION_PREFLIGHT: parent-side sanitized warning capture only for load-only/no-DB smoke, no raw stderr retained; failure children discard output and use sanitized IPC. Preserve B5D2-L02 and prior B3/B4/Mobile risks. F15/F25/F39/F43 receive no promotion.

NEXT_GATE = FIXED_HEAD_WHOLE_IMPLEMENTATION_REVIEW after fixed implementation HEAD and all nine required CI jobs. Independent whole-implementation review belongs to a separate reviewer. Implementation PR Ready conversion and merge require later explicit operator acceptance and remain NOT_AUTHORIZED. Current authorization is not runtime verification or a deadline guarantee.

External bookkeeping for this event is PENDING until an authorized destination is available and write/readback succeeds. Historical queues are not reconstructed or cleared.
