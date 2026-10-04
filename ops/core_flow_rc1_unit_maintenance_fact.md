# Unit Maintenance Fact Timeline v1 execution evidence

## Authority and candidate

The operator approved the reviewed design and plan and then authorized execution through a new Draft PR and exact-head CI. The execution packet overrides the approved plan's historical PR70/base instructions. PR70 is merged and is not reused. Ready, merge, deployment, real data, Auth0/IAM and Expo/native work are not authorized here.

- POLICY_REF / EXECUTION_BASE / START_HEAD: `8d5b9c6c5723b29ed4c0b5efb1173365fee3f6a5`.
- Approved product lineage: `c60501a6e59f0572d98e2f1cb7be96d3db7d1545`; intervening changes to the execution base are documentation/ops only.
- Branch: `feat/unit-maintenance-fact-v1`, isolated sibling worktree. The previous RC1 and parent worktrees remain untouched.
- [Approved spec](../docs/superpowers/specs/2026-10-04-unit-maintenance-fact-timeline-v1-design.md), SHA-256 `77e645fcbf438987192c5ef851c48fdb4e3ecdcd803f97890d5983cafaa4c956`.
- [Approved plan](../docs/superpowers/plans/2026-10-04-unit-maintenance-fact-timeline-v1.md), SHA-256 `3ef4030e223d2c6fa8d3efc8132cd3e49e6acb661e449f0ff2b35f9342ab96ae`.
- Artifact freeze: `76edb0f54114884521f9b3a0dc63aeba1e9829a5`; no approved artifact bytes were rewritten. A narrow `.gitattributes` rule preserves the spec's intentional Markdown hard breaks, consistent with existing immutable-spec handling.
- Final publication HEAD, new Draft number, CI run IDs/attempts and merge-test SHA/tree belong to the post-publication receipt on that new PR. Earlier main/PR70 CI is not evidence for this candidate.

All runtime evidence below is synthetic. Screenshots, raw test logs, fixture identifiers and private connection settings are outside Git. This is executor verification, not operator acceptance. The single fresh-context branch review below is an implementation aid, not the operator's independent acceptance review. This file records the pre-publication freeze; the new Draft's final receipt completes AC32/AC34 and records final HEAD/run IDs without a self-referential evidence commit.

## Implemented behavior

Only migration `0018_core_unit_maintenance_fact.sql` was added. Migrations0001–0017, B1–B5 security implementations, dependencies, lockfile and workflows are preserved. The new forced-RLS ledger has no runtime table write grant. Four manager capabilities return strict projections; private helpers have no PUBLIC/runtime execution grant.

An authorized manager explicitly records a fact for a completed ticket. Org/unit/issue/completion timestamp derive from the source. A correction appends one successor with immutable source dimensions. Unique root, child and actor/request keys prevent duplicate chains and branching. Current rows are leaves, revisions follow chain topology, and at most100 rows are returned by source completion time descending then fact ID ascending.

Tenant outcome and previous/follow-up links are read dynamically. Ticket text, protocol answers, conversation, photos, tenant/actor IDs, priority, assignee, due date and private notes are excluded. Existing source rows and photo bytes are preserved. Recurrence remains a tenant claim, not a confirmed diagnosis.

The completed-ticket editor and manager **업무함 / 호실 정비 이력** navigation reuse the existing app. Unknown commit outcomes retain one in-memory request and require explicit same-key verification; matching server values alone do not prove that request succeeded. A stale correction preserves input and requires explicit review. The **근거 접수 보기** action performs the existing authorized ticket read. No raw form content is persisted in browser storage.

## Commands and local evidence

Environment: Windows, project-isolated Node **24.21.0**, npm **11.19.0**, Docker **29.8.0**, PostgreSQL **18.6** synthetic fixtures. `npm ci` preserved manifests/lockfile. Each command's exit code and full output were captured privately; a later success does not replace earlier failed output.

| Command / surface | Observed result |
| --- | --- |
| Baseline shared / Web / selected PostgreSQL / types | 447/40; 533/52; 32/2; PASS |
| Strict maintenance contracts | 11 behavioral RED, then11 GREEN |
| Maintenance PostgreSQL | initial missing-table/function RED;17 GREEN; observed key-wait authorization RED then18 GREEN; actual B5 membership termination19 GREEN |
| Manager HTTP | route404 RED, then8 GREEN |
| Manager UI | 8 scaffold RED, then8 GREEN; exact AC25 source label1 RED then8 GREEN |
| `npm run test:shared` | 458 tests /41 suites PASS |
| `npm run test:web` | 549 tests /54 suites PASS |
| `npm run test:postgres` | final396 tests /36 suites PASS; earlier394 and395 full runs retained separately |
| `npm run verify` | PASS: shared, lint, types, Web build, dependency checks; existing4 Web +1 Mobile lint warnings retained |
| `npm run test:mobile -- --cacheDirectory <fresh-private-cache>` | first cold run141 PASS /1 timeout,16 suites; serial fresh-cache comparison142/142,16 suites PASS |
| Core browser suite | final32/32 PASS; includes5 new maintenance cases and all existing27 |
| B1 SDK browser suite | 32/32 PASS, including2 new cases; synthetic SDK authentication, not actual Auth0 |
| `npm run test:e2e:web` after fresh build, prebuilt flag | 23/23 PASS |
| `npm run test:e2e:b1` and exact result checker | 60/60 PASS,21 negative controls,0 skips/retries; full report checked |
| New maintenance owned-server restart | 3 cases PASS; distinct server PIDs; root/correction IDs, completion time, source hashes, dynamic outcome/links and exact replay retained |
| Existing four RC1 restart helpers | PASS: exact photo bytes/ticket, work metadata/private notes, public Q&A/races/receipts and five completion/follow-up cases |
| Scanner regressions | 3/3 and14/14 PASS |
| Initial tree/reachable-history scan | 637 files,313 internal links,1671 history blobs;0 findings |
| Final staged tree/history and whitespace | final publication gate, not yet claimed by the initial scan |

The final integration uses the unchanged current browser configurations. Development sessions are prepared immediately before Core runs because existing logout tests intentionally revoke shared development codes. The tests never weaken expected status codes or retry until successful.

### Retained failures and fixes

1. Typechecking first rejected the new required `CoreScope.maintenance` binding. The four real SQL bindings were pulled forward from Task3; no optional/dummy port was introduced.
2. The observed cross-source idempotency-key wait exposed a revoked-assignment write. Both new commands now recheck session and source authority after that wait as well as after the source-ticket lock. The failing test was retained and became GREEN.
3. SDK test setup initially required an explicit UUID cast, then a unique synthetic unit label. The first full SDK run had24 PASS /8 failures because new test memberships changed the existing shared tenant's default unit. New cases now use fresh synthetic actors. Only five links introduced by this task were ended from an exact private receipt; no rows, baseline memberships, tickets or photos were deleted.
4. First full Core run:30 PASS /1 ambiguous text locator after persistent previous test data. The assertion was scoped to the exact fact ID. Next run:29 PASS /2 failures with401 from previously revoked development sessions. Existing preparation was reapplied, followed by31 PASS. Old tests and assertions were preserved.
5. New local Mobile cold run: `tenant-ticket.test.tsx` / `loads the ticket named by the route` exceeded the unchanged5000ms limit;141/142 passed. Heavy suites were concurrent. A single serial comparison with a new cache passed142/142 in20.499s. Resource contention is a hypothesis, not an established cause. No timeout, skip, dependency or test configuration changed. This does not resolve historical B3/B5 Mobile failures.
6. The initial scanner14 command lacked process-local `PYTHONPATH` and failed import; the exact workflow setup then passed14/14. No scanner exception was added.
7. The added B5 test initially exposed an optional fixture-membership type at compile time; explicit fixture validation fixed it. The full `verify` command then passed.
8. After fresh-actor isolation the full SDK run had31 PASS /1 failure: three new test properties from earlier attempts broke an existing orgA fixture assertion that all units belong to the baseline property. The new case now uses its own unit within the baseline property. Only those three identified task-created synthetic properties were marked ARCHIVED; every row and all tickets/photos remain. Existing assertions were not changed.
9. A single fresh-context review of base8d5b9c6 through3afd28e found0 Critical /1 Important /0 Minor. Refreshing an open correction draft silently advanced its expected fact ID. A real browser test reproduced the missing review gate (RED). The fix pins the expected fact at edit/explicit review and preserves the draft while blocking submission after a changed baseline. Full Core32, SDK32, Web549, verify, standard Web23, final types and the3-case restart passed after the bounded fix. No unresolved Critical/Important finding remains. The review is not a new plan approval or operator acceptance. Deferred review surfaces are the still-required publication gates and the explicitly excluded Auth0/native/production/historical dispositions.
10. The first post-fix full Core run was31 PASS /1 failure: the committed-root response-loss recovery button remained disabled during the readback. Its test removed the interception from inside the aborted request handler. The fixture now intercepts exactly one POST, like the already-passing correction-loss case, leaving the recovery GET untouched. The same201 commit/200 replay/409 changed-input/no-duplicate assertions remain; no timeout or retry count changed. Full Core32 then passed. This fixture ordering issue is not asserted to be a production root cause.

During development the marked local synthetic DB had already applied an earlier unpublished0018 definition. Only the two new command functions were refreshed to the tracked0018 definitions under the existing migration role, with grants preserved. No existing migration, table, row or schema baseline was reset. Fresh disposable PostgreSQL tests apply0018 from scratch.

## AC01–AC34 evidence map

Abbreviations: **DB** = `tests/postgres/core-maintenance-fact.test.ts`; **HTTP** = `apps/web/src/server/core-flow/maintenance-fact.test.ts`; **contract** = `packages/api-contracts/src/core-maintenance-fact.test.ts`; **UI** = `apps/web/src/app/core/manager-maintenance-timeline.test.tsx`; **Core** / **SDK** = the new `maintenance-fact.spec.ts` in their existing browser suites; **restart** = `scripts/core-maintenance-fact-restart-check.mjs`.

| AC | Status | Executed evidence |
| --- | --- | --- |
| 01 | PASS | DB completed root, HTTP201, Core actual editor/timeline |
| 02 | PASS | DB OPEN/IN_PROGRESS conflict; UI hides creation until completed |
| 03 | PASS | DB and HTTP all four tenant routes denied; actual SDK negative controls |
| 04 | PASS | DB foreign unit/source/fact non-disclosure; HTTP mapping; SDK foreign actor controls |
| 05 | PASS | DB assigned staff, observed source/key waits and revocation; SDK current-scope UI clearing |
| 06 | PASS | strict contract rejects override fields; DB derives source completion time and dimensions |
| 07 | PASS | exact17-field contract; DB rich source/protocol/Q&A/photo fixture; Core DOM exclusions |
| 08 | PASS | DB work/private-note canaries, strict DTO and Core manager-only content separation |
| 09 | PASS | DB saved root exact replay; Core real commit/response abort followed by explicit200 replay |
| 10 | PASS | DB changed payload/source conflict; Core and restart409 |
| 11 | PASS | observed backend lock waits; competing root commands produce one chain; unique root constraint |
| 12 | PASS | root row hashes unchanged after appended corrections; Core source hashes unchanged |
| 13 | PASS | leaf selection after multiple corrections; Core current card and timeline |
| 14 | PASS | recursive topology order under adversarial recorded timestamps; UI revision history |
| 15 | PASS | observed correction lock race gives one success /one conflict; Core stale409 retains input; refresh also requires explicit review before rebasing a draft |
| 16 | PASS | DB composite correction FK, self-cycle/second-child controls, strict immutable DTO/input |
| 17 | PASS | later RESOLVED/RECURRENCE claim changes projection while ledger hashes stay identical |
| 18 | PASS | source/follow-up IDs join existing relation; no source/target content copy; actual navigation |
| 19 | PASS | neutral tenant-claim wording in UI and actual390px timeline |
| 20 | PASS | assignment revoked during observed source/advisory waits; actual B5 membership termination during correction wait; reads/writes/old receipts denied |
| 21 | PASS | restart distinct server PIDs; stable source time, current fact, chain and links |
| 22 | PASS | existing authorized unit scope only; actual select and unit switch |
| 23 | PASS | UI and Core loading, empty, failure and explicit reload states |
| 24 | PASS | actual390px, long80-character label, no horizontal overflow and usable controls; private screenshots |
| 25 | PASS | exact **근거 접수 보기** label; Core navigation through existing authorized read |
| 26 | PASS | actual isolated unit turnover; replacement tenant cannot access old source or manager fact routes |
| 27 | PASS | full Core existing manager-work case; full PostgreSQL work queue regressions |
| 28 | PASS | full Core public Q&A cases and full PostgreSQL communication regressions |
| 29 | PASS | full Core RESOLVED/UNRESOLVED/RECURRENCE, no-copy and response-loss cases |
| 30 | PASS | full Core existing photos/protocol/handling and source hash controls |
| 31 | PASS | forced RLS, existing nonlogin owner, pinned search paths, exact PUBLIC/private/runtime ACL inventory |
| 32 | NOT_RUN | final candidate public tree/reachable-history scan pending; earlier scan/regressions are separate evidence |
| 33 | PASS | real committed response loss for root/correction, same-key200/changed409, persistence restart and revoked replay denial |
| 34 | NOT_RUN | new Draft exact-head9 hosted CI not yet run; post-publication receipt required |

## Publication and retained limits

The final remote receipt must identify the pushed HEAD, new Draft PR, both workflow runs/attempts, all nine required job conclusions and actual test counts where logs were read. A PR synthetic merge must have the candidate tree/parents verified. Failed/cancelled attempts must remain in the report. No Ready/merge/deploy is performed.

Historical dispositions remain unchanged: Expo/native/device/APK NOT_RUN, phone LAN and actual-manager Auth0 NOT_VERIFIED, AC-D06 NOT_VERIFIED, B5 AC18 PARTIAL, original Mobile failures/root cause OPEN, dependency-security and CI-maintenance backlog retained. Current tests do not establish real tenant, production or native readiness.

The existing single Google rolling handoff was corrected in place and read back at Task0; the native execution sheet append was read back. Tasks1–7 and the review-fix freeze were appended through native Sheets and read back; the existing rolling Google Doc was updated to3afd28e and read back. Final publication sync is a separate receipt. Historical pending rows are not removed or reconstructed.

See [run instructions](../docs/core-flow-rc1-running.md) for the isolated worktree's synthetic Web flow. No private codes, credentials, external destination IDs or raw test identifiers belong in this repository.
