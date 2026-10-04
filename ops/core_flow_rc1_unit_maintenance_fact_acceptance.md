# Unit Maintenance Fact Timeline v1 development-main acceptance

Snapshot: **2026-10-05 KST**. Repository: `edward321416-maker/build-manager`.

Canonical disposition: **ACCEPTED_AND_INTEGRATED_IN_DEVELOPMENT_MAIN_WITH_RETAINED_RISKS**.

This receipt closes the manager-only Unit Maintenance Fact Timeline v1 slice. It does not establish production/private-beta readiness, tenant-facing maintenance-history disclosure, live-manager Auth0 readiness, Expo/native/device/APK readiness, or completion of the broader security/privacy program.

## Authority and exact refs

The operator approved the reviewed design and implementation plan, authorized implementation, then approved the independent acceptance/delta-review result for merge.

| Reference | Exact value |
| --- | --- |
| Implementation base | `8d5b9c6c5723b29ed4c0b5efb1173365fee3f6a5` |
| Initial runnable candidate | `963a7ef0360c1c8f3ca9a07f3a63c17089ba7bd1` |
| Accepted remediation FIX_HEAD | `be2733fc03dc67941896972cf72850e8e1b52104` |
| Actual merge / implementation main | `fd9dffdee5aaaea089607ac28db27b7fcb77b056` |
| Candidate and merge tree | `4b57383b2a8d6bc0f6ed0c49b9b9323b35917ffc` |
| Merged at | `2026-10-04T15:20:50Z` |
| PR | [#71](https://github.com/edward321416-maker/build-manager/pull/71) |

PR #71 was marked Ready only after the fixed HEAD, mergeability and fresh candidate required checks were reread. It was then merged with an expected-head guard. Remote main and PR merge status were read back after the mutation.

## Independent review

The fixed-ref full acceptance review at `963a7ef...` returned **FIX_REQUIRED** with one HIGH, two MEDIUM and one LOW advisory.

The bounded remediation at `be2733f...` closed:
- stale maintenance timeline retention after assignment revocation and denied source navigation;
- the approved `관리자 처리 완료 기록` timestamp label;
- the approved minimum-data/privacy editor copy.

The independent delta review of exactly `963a7ef... → be2733f...` returned **ACCEPT / BLOCKER0 / HIGH0 / MEDIUM0 / LOW1 retained bookkeeping advisory**. Review artifact SHA-256: `377b004c3aacfd8de2eefcaeee3093afe2d66d024b574d8bd0d1f3431dadcd2f`.

The LOW bookkeeping advisory is resolved by this canonical closure/status reconciliation; it was not a product defect.

## Accepted behavior

The accepted manager-only flow includes:
- explicit structured maintenance facts only from completed authorized tickets;
- action taxonomy `INSPECTION / REPAIR / PART_REPLACEMENT / ADJUSTMENT / OTHER`;
- server-derived org/unit/issue/completion dimensions;
- append-only correction chains with no direct edit/delete API;
- one root chain and one child per replaced fact;
- current fact from chain topology, not timestamp;
- per-unit current-fact timeline bounded to 100 rows ordered by source completion time descending then fact ID ascending;
- current tenant outcome and previous/follow-up relation projected dynamically rather than copied into the ledger;
- no tenant maintenance-fact API or tenant-facing history;
- no copy of raw tenant text, protocol answers, Q&A bodies, photos, tenant identity, private notes, priority, assignee or due time;
- current-property authorization for PROPERTY_STAFF, including authority rechecks after lock waits and before saved-request replay;
- response-loss/idempotency recovery with current authorization;
- manager Web timeline/editor at desktop and 390px.

See [execution/34-AC evidence](core_flow_rc1_unit_maintenance_fact.md) and [run instructions](../docs/core-flow-rc1-running.md).

## Evidence generations

| Evidence class | Ref | Runs / receipt | Disposition |
| --- | --- | --- | --- |
| EXECUTOR_LOCAL | final FIX_HEAD lineage | [execution receipt](core_flow_rc1_unit_maintenance_fact.md) | Web551, Core32, SDK34, standard Web23/B1 60, scanner and synthetic runtime evidence; local failures retained separately |
| HOSTED_CI candidate | `be2733fc03dc67941896972cf72850e8e1b52104` / pull_request | Repository `37210527837`; App `37210527858` | attempt1, required9/9 SUCCESS |
| INDEPENDENT_REVIEW | `963a7ef... → be2733f...` | coordinator fixed-ref review | ACCEPT after bounded remediation; B0/H0/M0/L1 |
| HOSTED_CI implementation main | `fd9dffdee5aaaea089607ac28db27b7fcb77b056` / push | Repository `37212648981`; App `37212648985` | attempt1, required9/9 SUCCESS |
| DOCUMENTATION_PUBLICATION | commit publishing this receipt | exact-SHA push workflows after publication | separate closure-publication gate; recorded outside this self-referencing commit |

Required hosted jobs are `verify`, `repository-safety`, `apps`, `mobile-cold-linux`, `install-mobile-windows`, `web-e2e`, `mobile-health`, `postgres-integration`, and `foundation-gate`.

## Retained risks

The following are unchanged and are not promoted by this acceptance:
- Expo/native/device/APK runtime NOT_RUN; phone LAN NOT_VERIFIED;
- actual-manager Auth0 NOT_VERIFIED;
- AC-D06 NOT_VERIFIED;
- B5 AC18 PARTIAL and historical local Mobile failures / ROOT_CAUSE_NOT_ESTABLISHED;
- the first remediation Core reload delay cause remains UNESTABLISHED;
- dependency-security and CI supply-chain maintenance backlog.

Hosted/current passes do not retrospectively diagnose historical failures.

## Closure boundary

This acceptance freezes the Unit Maintenance Fact Timeline v1 manager-only boundary. It does **not** authorize:
- tenant-visible maintenance history;
- automated fact extraction or AI summarization;
- vendor/cost/invoice/warranty fields;
- building analytics or preventive-maintenance scheduling;
- production deployment or real tenant/property data;
- Auth0/IAM/provider changes;
- native/App release work.

**Current additional product task: NONE_AUTHORIZED_BY_THIS_CLOSURE.**

The closure-publication commit changes documentation/status only. Its fresh push CI is publication evidence, not a new product-runtime generation. Final publication SHA/run IDs may be recorded in the merged PR conversation and external rolling handoff without creating a self-referential follow-up commit.
