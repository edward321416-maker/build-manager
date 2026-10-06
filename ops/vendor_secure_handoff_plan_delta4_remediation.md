# Vendor Secure Handoff v1 — Delta4 Plan Remediation Receipt

Status: DELTA4_SUCCESSOR_READY_FOR_INDEPENDENT_REVIEW
Product implementation: NOT_AUTHORIZED

## Fixed refs
- reviewed delta3 HEAD: ad895049154f532b822c1cc160399d7fb39f46c2
- reviewed delta3 plan blob: ab6bc6aa67f578d575bfb984604d8df2dbdd9779
- independent delta3 review: 6009584060 — FIX_REQUIRED B0/H1/M2/L0
- delta4 authorization: 6009777390
- delta4 plan blob: 27759ff9575f1319b903203d8350120267afeb0e

## Resolved findings
- H-D3-01: completion-photo upload now carries expectedCorrectionRequestId|null. Task8 allows initial null context only; Task9 enables exact unresolved correction context, correction-photo upload and correction report as the only two correction-scoped Vendor mutations.
- M-D3-01: upload context is assignment+Appointment+correctionRequest|null; max 10 accepted uploads per context; exact replay consumes no slot; reports attach final 1–5 context-valid photos; unselected uploads become closed non-reusable UNATTACHED_RETAINED history.
- M-D3-02: exact schema ACL matrix pins vendor_handoff USAGE/no-CREATE for bm_vendor_web and bm_b1_web, core_flow/app USAGE/no-CREATE for bm_vendor_handoff_owner, exact function EXECUTE boundaries, PUBLIC revoked and catalog probes.

## Additional consistency
- exact replay is reconciled before fresh context-open/capacity checks, so a closed context still returns the same prior durable upload while fresh requests conflict;
- Task9/0023 owns nonnull correction-request FK/validation and enables correction-context upload after the durable Manager request exists;
- completion-photo staging/resource bound and schema ACLs are represented in candidate review gates;
- AC01–AC57 semantic owner map: 57 rows, missing0, mismatch0.

## Self-audit
- Tasks0–12 present.
- TBD/TODO/FIXME0.
- authority blobs unchanged:
  - spec ce0ad01a532e6d7230d441f6a580ea0c6ea5e11e
  - D9 67d5ec480db3464eebdf51842905526f0de91b26
  - D9R1 receipt 8bec733aac1a18b8b5dd6b03488acaafe96c8eb0
- predecessor→pre-receipt successor repository delta: plan only.
- no product/source/SQL/migration/test/dependency/workflow implementation.

## Next gate
INDEPENDENT_DELTA_REVIEW_VENDOR_SECURE_HANDOFF_PLAN_DELTA4_REMEDIATION

Task0 / Ready / merge / deploy remain unauthorized.
