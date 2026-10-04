# Core flow RC1 development-main acceptance and closure

Snapshot: **2026-10-04**. Repository: `edward321416-maker/build-manager`.
POLICY_REF: `e9144fac807f39544932baac25b11f836658dbb3`.

Canonical disposition: **ACCEPTED_IN_DEVELOPMENT_MAIN_WITH_RETAINED_RISKS**.
This closes the accepted PR70 development integration scope. It does not establish production, real-user/private-beta, native-device or live-manager-Auth0 readiness, and does not claim completion of the original two-platform runtime goal.

## Authority and exact refs

[DECISION] The operator approved the supplied `PR70_FINAL_ACCEPTANCE_REVIEW_C60501A.md` and explicitly accepted its retained risks for development-main integration only. The supplied independent review reports `ACCEPT_WITH_RETAINED_RISKS`, BLOCKER 0, HIGH 0 and blocking MEDIUM 0. This closure records that review; it is not a new independent code review or local product-test run. Review artifact SHA256: `9737c8f48094d6a7cf097a03fedae0a32fdabdc12ca61524180392c777679f02`.

[FACT] [PR #70](https://github.com/edward321416-maker/build-manager/pull/70) was marked Ready and merged after the exact HEAD and all nine required acceptance checks were reread before both mutations. Repository branch protection is not enabled; “required” here identifies the project's acceptance check set, not an enforcement claim.

| Reference | Exact value |
| --- | --- |
| Accepted candidate | `c60501a6e59f0572d98e2f1cb7be96d3db7d1545` |
| Pre-merge development main | `e9144fac807f39544932baac25b11f836658dbb3` |
| Actual merge / implementation main | `2cd6dcab67c8ae6fd9fcc91de37e139d07f91f5c` |
| Merged at | `2026-10-04T11:03:06Z` |
| Candidate and merge tree | `0ee99d68ec6c6f751eef32109d09beeefb5658fd` |

Both parent commits are preserved by a merge commit. The actual remote main SHA and merge parents were read back. No force push, history rewrite, branch deletion, product edit or deployment was performed for closure.

## Accepted scope and evidence succession

The accepted development flow includes persistent authorized-unit HEATING/LEAK intake and photos; tenant detail/history and public Q&A/next action; manager queue, handling, work metadata and private notes; invitation requests and manager decisions; tenant completion assertions, atomic new follow-up tickets and source/target navigation. Authorization, privacy, persistence and response-loss boundaries remain those of the accepted code.

The Apple/Toss color system, spatial architecture, responsive polish and outcome/follow-up presentation are accepted and frozen. The final candidate's React-key correction is presentation-neutral according to the supplied review; earlier actual browser captures remain their original visual evidence, not new screenshots of a rerun.

| Evidence class | Ref / event | Receipt | Disposition |
| --- | --- | --- | --- |
| HOSTED_CI candidate | `c60501a6e59f0572d98e2f1cb7be96d3db7d1545` / pull_request | [Repository 37195637516](https://github.com/edward321416-maker/build-manager/actions/runs/37195637516), [App 37195637530](https://github.com/edward321416-maker/build-manager/actions/runs/37195637530) | Required 9/9 SUCCESS reread before merge |
| INDEPENDENT_REVIEW | Same candidate against `e9144fa` | Operator-supplied acceptance artifact identified above | ACCEPT_WITH_RETAINED_RISKS; explicitly accepted by operator |
| HOSTED_CI implementation main | `2cd6dcab67c8ae6fd9fcc91de37e139d07f91f5c` / push | [Repository 37197401955](https://github.com/edward321416-maker/build-manager/actions/runs/37197401955), [App 37197401942](https://github.com/edward321416-maker/build-manager/actions/runs/37197401942) | Fresh implementation-main generation; read actual run conclusions |
| HOSTED_CI closure main | Commit publishing this receipt / push | Its exact-SHA main Actions checks and the final [issue69 closure readback](https://github.com/edward321416-maker/build-manager/issues/69) | Separate required 9/9 SUCCESS gate after publication; candidate success cannot substitute |

The nine checks are `verify`, `repository-safety`, `apps`, `mobile-cold-linux`, `install-mobile-windows`, `web-e2e`, `mobile-health`, `postgres-integration` and `foundation-gate`. Final closure delivery requires the publication SHA to match remote main, the canonical file blobs to match the committed files, and all nine fresh main checks to succeed. The final readback records the publication SHA and run IDs outside this self-referencing commit.

The supplied review's candidate-log inventory is shared 447/40, Web 533/52, PostgreSQL 377/35, standard Web E2E 23/23, B1 browser 60/60 with 21 negative controls, and cold Mobile Linux/Windows each 142/16. Doctor 21/21 and Android/iOS JS/assets exports are not native execution. These are attributed review/hosted results, not tests rerun by this documentation task.

Historical [initial execution](core_flow_rc1.md), [photos](core_flow_rc1_photos.md), [login](core_flow_rc1_login.md), [invitations](core_flow_rc1_onboarding.md), [manager work queue](core_flow_rc1_manager_work_queue.md), [public Q&A](core_flow_rc1_ticket_communication.md) and [completion/follow-up](core_flow_rc1_completion_followup.md) receipts retain their own refs and failed/intermediate attempts. Their earlier NOT_ACCEPTED and no-merge statements describe prior authorization stages; this receipt supersedes only the current acceptance state.

## Retained risks accepted for development integration only

| Risk | Unchanged disposition / boundary |
| --- | --- |
| Expo / native runtime | Expo dev-server, physical device and APK/native execution NOT_RUN; phone-accessible LAN NOT_VERIFIED. Tests, Doctor and JS/assets exports do not prove these. Blocks native-release claims. |
| Actual-manager Auth0 | NOT_VERIFIED. Final Core/B1 evidence uses synthetic SDK/development sessions. Historical actual-tenant evidence remains separate; it does not prove actual-manager authentication or actual-account invitation continuation. |
| AC-D06 | NOT_VERIFIED. Visual acceptance and this merge do not promote the historical acceptance item. |
| Historical Mobile / AC18 | B5 AC18 PARTIAL; original local Mobile failures FAILED / OPEN / ROOT_CAUSE_NOT_ESTABLISHED. Current cold CI passes do not retrospectively diagnose or resolve them. |
| Dependency security | The disclosed 14 moderate npm vulnerabilities and install-script/dependency triage remain release backlog. No audit fix or script approval is claimed. |
| CI maintenance | Pinned Action runtime / forced Node24 warnings and existing non-error lint warnings remain separate maintenance work. Green jobs do not resolve the backlog. |

No canonical F-case or historical B1–B5 acceptance label is promoted by this closure. Security/privacy-program completion is not claimed.

## Execution boundary and next work

This approval does not authorize production deployment, real tenant data/private beta, native release/APK distribution, live Auth0 rollout, paid services, account/OAuth/IAM changes, dispatch/notification, automatic repair-verification claims or Unit Maintenance Fact Timeline. Additional product work requires its own scope; retained risks are not a standing waiver for future candidates.

Existing dirty runtime records and their authorship remain in the original worktrees. Closure was prepared from the verified merge SHA in a separate clean worktree; no mixed-origin dirty documents were staged or copied into the closure. Existing servers, browser resources and private data were not changed.

Local execution events are append-only in [AI execution log](AI_Execution_Log.csv); this phase's external Google sync is queued in [pending sync](pending_external_sync.md). No new external Google write/readback is claimed, and previous verified sync receipts and pending events remain distinct.
