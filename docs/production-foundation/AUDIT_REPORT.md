# PF02-B B2 post-closure finalization — revision 1.1

Revision: **1.1 (supersedes 1.0)** | Snapshot: 2026-09-24
POLICY_REF / CLOSURE_BASE / B2 closure main: `5670a6246805cadc9e6cb2c0ccff3eaaf01a2c2d`
B2 implementation main: `f0c6e80c9e1072f5b6a98bacc7697af01da9c7d1`

Current disposition: **PF00 FROZEN; PF01 REVIEW_DRAFT; PF02-A VERIFIED / FROZEN; PF02-B IN_PROGRESS; B1 VERIFIED / FROZEN; B2 VERIFIED / FROZEN**. B2 canonical closure is **published**, not proposed. Later PF02-B slices = NOT_STARTED / NOT_YET_SCOPED and **no later product slice is currently scoped or implementation-authorized**; no B3 scope is created here.

Closure publication facts: PR [#35](https://github.com/edward321416-maker/build-manager/pull/35) is **MERGED** at closure main `5670a6246805cadc9e6cb2c0ccff3eaaf01a2c2d` and read back. Fresh **push/main** [App 35947253215](https://github.com/edward321416-maker/build-manager/actions/runs/35947253215) / [Repository 35947253217](https://github.com/edward321416-maker/build-manager/actions/runs/35947253217) at that exact SHA pass all 9 required checks. Three CI generations stay distinct: candidate (`pull_request`, `d074741e…`), implementation-main (`push`, `f0c6e80c…`) and closure-main (`push`, `5670a624…`). The closure commit changed documentation only; its green run is publication evidence, not product re-verification.

PR #33 is now **CLOSED / NOT_MERGED / SUPERSEDED_BY_CANONICAL_SPEC_IN_MAIN**. This is supersession, not design rejection: the approved exact spec is canonical in main at blob `b6fd0ce3c15d2255105434911889dd61693dbdb7`, 32,600 UTF-8 bytes, SHA-256 `ec9fc095767624fdc4098447bd8b00bc65f90b5456f6570378d704fe41b63557`, and PR #33's branch/history are preserved. PR #30 remains OPEN / DRAFT as a historical B1 coordination-document registration and is NOT_CANONICAL; it is untouched by this revision.

This revision also publishes the session bootstrap package (`ops/CHAT_HANDOFF.md`, `ops/CHAT_CONTEXT_MANIFEST.json`, `ops/NEW_CHAT_BOOTSTRAP.md`) so a new session can reconstruct project state from GitHub alone. Those files are routers, not a second canonical truth: live `main` and the canonical receipts override them.

Unchanged by this revision: migrations 0001–0007, product source, tests, dependencies, workflows and provider settings. Canonical `acceptance_cases.json` content/status is unchanged. B1I-M01 = CLOSED_BY_B2 and B1I-M02 = DOCUMENT_RECONCILED; the historical B1 receipt keeps its then-open backlog wording. B1 LOW6 and B2I-L01–L04 remain deferred. All 12 manifest entries are freshly recomputed under revision 1.1 with the same entry set and self-exclusion; prior 1.0 values are not reused as evidence.

Open risks are unchanged: moderate 14 advisories, install-script warning, Actions internal-runtime warning, Windows-mounted Ubuntu timeout ROOT_CAUSE_NOT_ESTABLISHED, Auth0 Free entitlement NOT_VERIFIED, hosting/credentials, real-data pilot, final operational session/retention and complete security/privacy review. REAL_TENANT_DATA = NOT_AUTHORIZED; PRODUCTION_DB_HOSTING = NOT_AUTHORIZED; EXTERNAL_SYNC = PENDING.

## Historical revision 1.0 closure-candidate snapshot — retained verbatim

The section below describes the closure-candidate snapshot as written before closure merge, including its then-pending merge/readback and then-open PR #33 wording. It is preserved as a historical record and does not override revision 1.1 above.

### PF02-B B2 closure reconciliation — revision 1.0

Revision: **1.0 (supersedes 0.9)** | Snapshot: 2026-09-24
POLICY_REF / TARGET_REF / B2 implementation main: `f0c6e80c9e1072f5b6a98bacc7697af01da9c7d1`.

Current disposition: **PF00 FROZEN; PF01 REVIEW_DRAFT; PF02-A VERIFIED / FROZEN; PF02-B IN_PROGRESS; B1 VERIFIED / FROZEN; B2 VERIFIED / FROZEN**. This is the proposed canonical B2 closure; documentation merge/readback remains pending. Later PF02-B slices = NOT_STARTED / NOT_YET_SCOPED; no B3 scope is created.

Independent implementation review SHA-256 `5b830146be30e3a05675537d35bfe1a85f1b002ed5e804f777e7007abb1d2d32` returned NO_BLOCKING_FINDINGS on `d074741e8212ebb2fdb8d0ea7f46a100fd58f24a` (BLOCKER/HIGH/MEDIUM0, LOW4). PR #34 is MERGED at `f0c6e80c9e1072f5b6a98bacc7697af01da9c7d1`, with parents `bd0921c503d952a150ecadeb9873a0299b6263c2` and `d074741e8212ebb2fdb8d0ea7f46a100fd58f24a` and the same accepted tree. Fresh **push/main** [App 35944851872](https://github.com/edward321416-maker/build-manager/actions/runs/35944851872) / [Repository 35944851923](https://github.com/edward321416-maker/build-manager/actions/runs/35944851923) at that exact merge SHA pass all9 required checks. Candidate PR runs35901709983/35901709798 remain separate evidence. Main logs show PostgreSQL151, demo21 and B1+B2 Web21 with zero skips/retries/failures. The independent reviewer did not rerun PostgreSQL/Playwright/npm; those runtime results remain HOSTED_CI_EVIDENCE / EXECUTOR_EVIDENCE.

The [B2 receipt](../../ops/pf02_b_b2_acceptance.md) records all16 slice ACs as PASS_IMPLEMENTATION_ACCEPTED, exact spec canonicalization from PR33 (`1a056151d908a8d7bebb76100a2307e6555621b7`,32,600bytes,SHA-256 `ec9fc095767624fdc4098447bd8b00bc65f90b5456f6570378d704fe41b63557`), and branch-preserving supersession. PR33 remains OPEN/DRAFT/NOT_MERGED; close is separate after closure merge/readback. B1I-M01=CLOSED_BY_B2; its historical B1 receipt stays byte-identical with the then-open backlog. B1 LOW6 and B2I-L01–L04 remain deferred. B2 auth evidence is SYNTHETIC_AUTH + ACTUAL_WEB + ACTUAL_POSTGRES; LIVE_AUTH0_B2=NOT_RUN, not required. B1's EXECUTOR_LIVE_EVIDENCE remains separately attributed.

Migrations0001–0006 remain byte-identical; only0007 adds B2. Historical seven-table snapshots are preserved; current exact app inventory is eight with the original seven semantics/runtime matrix retained. No product/source/SQL/test/dependency/workflow/provider changes in closure. Canonical F-case content is unchanged; all12 manifest entries are freshly recomputed under revision1.0 with the same entry set and self-exclusion.

Existing moderate14/install-script/Actions-runtime risks, Windows-mounted Ubuntu timeout ROOT_CAUSE_NOT_ESTABLISHED, Auth0 Free entitlement NOT_VERIFIED, hosting/credentials, real-data pilot, final operational session/retention and complete security/privacy review remain open. REAL_TENANT_DATA=NOT_AUTHORIZED; PRODUCTION_DB_HOSTING=NOT_AUTHORIZED; EXTERNAL_SYNC=PENDING. B2 read scope excludes invitation/assignment mutation/management UI/resident/ticket/Mobile auth/Kakao/linking and production readiness.

## Historical revision 0.9 and earlier audit snapshots — retained verbatim

All text below describes its own historical snapshot, including then-current disposition and open M01 status. It does not override revision1.0 above.

# PF02-B B1 closure reconciliation — revision 0.9

Revision: **0.9 (supersedes manifest revision 0.8)** | Snapshot: 2026-09-23
POLICY_REF: `87341f143b04dd96a5b7e66dedf8df47b5f5ae73`. TARGET_REF / actual implementation main: `2ede1520e681c3fe02cb5ac2b85847ea803282d8`.

Current disposition: **PF00 FROZEN; PF01 REVIEW_DRAFT; PF02-A VERIFIED / FROZEN; PF02-B IN_PROGRESS; B1 VERIFIED / FROZEN; B2 NOT_STARTED / NEXT**. D01 = RESOLVED_FOR_B1 for Auth0 selection and Database-only Web identity, not all provider/operational decisions.

Operator-side independent Opus review SHA-256 `7c6e6714f92ce98aaa44442cec8428de9099e8ed5f5d573a334eeb2b4797e5ed` returned NO_BLOCKING_FINDINGS on PR #31 candidate `281bb651c2f47a528fd148137fd94d318aa193c7`. The operator explicitly authorized merge and closure. Expected-head merge produced `2ede1520e681c3fe02cb5ac2b85847ea803282d8` with parents `87341f143b04dd96a5b7e66dedf8df47b5f5ae73` and `281bb651c2f47a528fd148137fd94d318aa193c7`; accepted and merged trees match. Fresh main push attempt-1 runs [App 35838146830](https://github.com/edward321416-maker/build-manager/actions/runs/35838146830) / [Repository 35838146810](https://github.com/edward321416-maker/build-manager/actions/runs/35838146810) pass all nine required checks; aggregate dependencies seven/seven success. Main logs include PostgreSQL124, H01/H02/F23 and M05, Shared358/Web313, DEMO21+B1E2E12, Doctor21/21 and executed Android/iOS JS exports.

The [B1 receipt](../../ops/pf02_b_b1_acceptance.md) separates PR/main CI, independent review and EXECUTOR_LIVE_EVIDENCE. LIVE_AUTH0_INDEPENDENT_REPRO=NOT_RUN. PF02-A migration bytes, frozen runtime/F18/F19 and seven-table contract are retained. Canonical acceptance_cases.json is unchanged: only F18/F19/F23 already PASS_POSTGRES_INTEGRATION; other 41 F-cases NOT_RUN. All 12 manifest entries are freshly recomputed for revision 0.9 with unchanged entry set/self-exclusion.

B1I-M01 is OPEN_HARDENING_BACKLOG (explicit membership predicate as a future second defense); B1I-M02 is DOCUMENT_RECONCILED against the final 84-path inventory; six LOW findings remain deferred/non-blocking. No source/workflow/dependency/test changes in closure. Existing moderate14/install-script/Actions runtime risks and unresolved Windows-mounted Ubuntu Mobile timeout remain. Production hosting/credentials, real-data pilot, final session/retention, Kakao/linking/Mobile/staff/B2 remain unfinished. Real tenant data and production DB hosting NOT_AUTHORIZED; external sync PENDING. B1 freeze is not PF02-B completion or production readiness.

## Historical revision 0.7 and earlier audit snapshots — retained verbatim

The historical dispositions below describe their own dates and do not override the current revision 0.9 disposition above. Revision 0.8 updated README/manifest without rewriting those audits.

# PF02-A acceptance/publication reconciliation — revision 0.7

Revision: **0.7 (supersedes 0.6)** | Snapshot: 2026-09-20
POLICY_REF: `08b99623eaec9b654eebeb30854374194ab49233`. TARGET_REF / actual main: `63c619c6bfa451155249ebc458b9d3ac053d0ed7`.
Current disposition: **PF00 FROZEN; PF02-A VERIFIED (IMPLEMENTATION_VERIFIED); PF01 REVIEW_DRAFT; PF02-B NOT_STARTED / D01 REQUIRED**. This evidence-finalization PR awaits separate independent acceptance and must not be merged in this run.

**OPERATOR_SIDE_INDEPENDENT_ACCEPTANCE** accepted corrected PR #27 head `0fa5a9c14c9b57c6362f048b611c0148a3a76132`. The executor did not perform that operator review. Fresh pre-merge checks confirmed the pinned main/head, OPEN state and nine successful PR checks. Expected-head-protected merge commit produced `63c619c6bfa451155249ebc458b9d3ac053d0ed7`, with parents `08b99623eaec9b654eebeb30854374194ab49233` and `0fa5a9c14c9b57c6362f048b611c0148a3a76132`; the implementation branch and accepted tree were preserved.

Separate fresh push-to-main runs **35491995616 / 35491995683**, both attempt 1, passed all **nine** required checks at the actual merge SHA. Actual PostgreSQL logs show **18.6**, executed exact numeric assertion **180006**, **86/86 tests PASS**, both R27-H01 controls, R27-H02 own-idle-backend termination/recovery and F23 **Lock → 23505 → ACTIVE1**. The aggregate log confirms all **seven** internal dependencies success. PR CI was not substituted for actual-main evidence.

The [canonical acceptance receipt](../../ops/pf02_a_acceptance.md) distinguishes operator acceptance, executor-local history, PR CI and actual-main CI. Only **F18/F19/F23** become **PASS_POSTGRES_INTEGRATION**. F01/F16/F41/F43 and all other unexecuted F cases remain **NOT_RUN** (41/44); database prerequisites do not weaken their canonical semantics. C01–C12 objects and provenance remain unchanged. Revision 0.7 recomputes all 12 existing manifest entries from final bytes, retaining entry set and self-exclusion.

The first Windows-mounted Ubuntu Mobile **2/133 tests / 2/13 suites** failure is preserved with prior cache UNKNOWN and ROOT_CAUSE_NOT_ESTABLISHED. Native ext4 and hosted passes remain separate; TIMEOUT_NOT_REPRODUCED_ON_NATIVE_EXT4 is retained. Original PR checks that missed H01/H02, actual RED, corrected GREEN and new main proof remain distinct.

CodeRabbit stays **SUCCESS_STATUS / REVIEW_SKIPPED**. Existing 14 moderate advisories, install-script/optional-build limitations, pinned Actions runtime warnings and limited container failure/concurrent-stop coverage remain open, as detailed in the receipt. No application, schema, workflow, dependency, scanner or test code changes in this documentation phase. Real identity is NOT_IMPLEMENTED; real tenant data and production DB hosting are NOT_AUTHORIZED; security/privacy work is incomplete; Google sync PENDING.

## Retained revision 0.6 and earlier audit snapshots — verbatim

The current reconciliation above supersedes current-state language in the historical snapshots below; their original assertions and evidence remain intact.

# PF00 freeze reconciliation — revision 0.6

Revision: **0.6 (supersedes 0.5)** | Snapshot: 2026-09-19
POLICY_REF: `333228163227d55d13e514fb9311ecb8b9dea615`. Freeze-record TARGET_REF: `6669c50ee5c2a07d40412a7162ddf381fa4698b1`.
Current disposition: **PF00 FROZEN / VERIFIED BASELINE; PF00-D ACCEPTED_AND_INTEGRATED**. PF01 remains REVIEW_DRAFT; PF02 remains NOT_AUTHORIZED / NOT_STARTED.

The operator-side independent acceptance of PR #24 at `f8cbcdbd0c3ec7fde2e298a78f8c809caa1c2e19` is classified **OPERATOR_SIDE_INDEPENDENT_ACCEPTANCE**. It verified seven authorized documentation/ops paths, all eight PR checks, revision 0.5 remote UTF-8 hash/byte matches 12/12, C01–C12 provenance and all 44 F-cases NOT_RUN. The executor does not claim authorship of that independent review.

This executor freshly verified and merged the accepted head with expected-head protection. Parents are `333228163227d55d13e514fb9311ecb8b9dea615` and `f8cbcdbd0c3ec7fde2e298a78f8c809caa1c2e19`; resulting main is `6669c50ee5c2a07d40412a7162ddf381fa4698b1`. The original branch and accepted tree are preserved. New push-to-main runs **35442667639 / 35442667660**, attempt 1, pass all eight required jobs. Actual logs show Shared301/Web256/Mobile133 per OS/E2E21/scanners3+14, Doctor1.20.4 21/21, and executed Android29/iOS25 JS/assets exports; all six aggregate dependencies report success. PR CI was not substituted for main publication evidence.

Canonical receipt: [PF00-D independent acceptance and freeze](../../ops/pf00_d_acceptance.md). [C/F statuses](acceptance_cases.json) remain byte-for-byte unchanged. C12 still means PR #23 PF00-C publication. Revision 0.6 freshly recomputes every existing manifest entry from final bytes, preserving 12 entries and self-exclusion. The revision 0.5 and earlier audits below are retained verbatim as historical snapshots, including their then-pending acceptance language; this section owns the current freeze disposition.

CodeRabbit remains SUCCESS_STATUS / REVIEW_SKIPPED, not independent review evidence. **OPEN_RISK / dependency-security-triage:** 14 moderate npm vulnerabilities and unrs-resolver install-script warning. **OPEN_RISK / ci-supply-chain-maintenance:** pinned v4 Actions older internal-runtime warning and hosted Node24 forcing. Neither is fixed here; both remain follow-up work before private beta/release.

PF00 freeze establishes the reproducible production development/verification foundation and available automatic checks, not production/launch/real-user readiness. Production auth/database, real identity and real property/unit/occupancy persistence are not implemented; actual tenant data is not authorized; security/privacy work is not complete. Merge enforcement is unchanged. The next activity is PF01 consequential-decision review, not implementation. External sync remains PENDING.

## Retained revision 0.5 and earlier audit snapshots — verbatim

# PF00 evidence reconciliation and historical audit

Revision: **0.5 (supersedes 0.4)** | Snapshot: 2026-09-19
POLICY_REF / PF00-D TARGET_REF: `333228163227d55d13e514fb9311ecb8b9dea615`.
Current disposition: **READY_TO_FREEZE_AFTER_PF00_D_ACCEPTANCE**. PF00-C is independently accepted and integrated; PF00-D documentation awaits independent acceptance. PF01 remains REVIEW_DRAFT and PF02 NOT_AUTHORIZED / NOT_STARTED.

## Revision 0.5 reconciliation

The operator independently accepted PF00-C after reviewing Git evidence, workflow logs, direct manifest/lockfile deltas and CI. This executor then verified the pinned pre-merge refs/checks, merged PR #23 with expected-head protection, checked both merge parents and the unchanged candidate tree, preserved its branch, and read back actual merged main. Fresh main push runs **35440841108 / 35440841105** at `333228163227d55d13e514fb9311ecb8b9dea615` passed all eight required checks. PR CI was not substituted for main publication evidence.

Canonical evidence: [PF00-C acceptance](../../ops/pf00_c_acceptance.md), [A/B accepted executor evidence](../../ops/pf00_ab_acceptance.md), [current status](../../STATUS.md), and [case registry](acceptance_cases.json). C01–C04 use PASS_ACCEPTED_EXECUTOR_EVIDENCE; C05–C09 PASS_GITHUB_CI; C10 PASS_MERGED_MAIN_PUBLIC_GATE; C11 PASS_PF00_D_EVIDENCE_RECONCILIATION; C12 PASS_PF00_C_PUBLICATION. C12 concerns PR #23 publication, not the PF00-D docs PR. All F01–F44 stay NOT_RUN.

The first Doctor mismatch (20/21, mobile-health/foundation FAIL, exports NOT_RUN) remains historical RED. Separately approved SDK57 direct patches produced fresh PR GREEN at `33d1d77...` and then actual main GREEN. No timeout/Doctor exclusion/product/workflow change was used to conceal that mismatch. PF00-D itself changes no application, workflow, dependency, scanner or test code.

CodeRabbit classification is **SUCCESS_STATUS / SKIPPED**: its comment says automatic review was skipped below 10 repository stars. It is not independent code-review evidence. Local executor receipts, operator-side independent acceptance, GitHub PR jobs and actual main jobs are separate evidence classes.

C11 reconciles available and executed test gates, actor/source distinctions, pending docs acceptance, raw-data exclusion and visible risks. Registered revision 0.5 recomputes all 12 existing manifest entries from final bytes, retaining the manifest design. The structural/public gates on the documentation candidate complement, rather than replace, the merged-main runtime evidence.

**OPEN_RISK / dependency-security-triage:** npm reports 14 moderate vulnerabilities and an unrs-resolver install-script warning. **OPEN_RISK / ci-supply-chain-maintenance:** pinned v4 Actions target an older internal Node runtime and GitHub forces Node24. Neither is remediated here; both remain visible before private beta/release without retroactively erasing the observed CI results.

PF00 verifies reproducible development and automatic available-check gates, not production/launch/real-user readiness or completed security/privacy review. Production identity/property/unit/occupancy, PostgreSQL/auth and real tenant-data operations are future work. MERGE_ENFORCED is unchanged. External Google sync remains PENDING.

## Historical planning audit — retained verbatim below

All dates, current-state wording, approval boundaries, NOT_RUN statements and planned scenarios below describe their original 2026-09-18/19 snapshots. They are retained for provenance and do not override revision 0.5's current evidence registry or authorize PF01/PF02 execution.

# 기획 전수점검 기록

날짜: 2026-09-18
대상: 같은 디렉터리의 전체 기획, PF00, PF01 v0.2, 예정 검증표, 이번 출처 목록.
검토자: 이번 응답 작성자. 별도 독립 에이전트/사람의 코드 리뷰를 수행했다고 주장하지 않는다.
판정: **REVIEWED_FOR_APPROVAL**. 범위 내 확인한 문서상 충돌·모호성을 수정했다. 실제 앱/DB/CI 회귀 시험은 수행하지 않았고 출시 적합성 판정도 아니다.

## Revision 0.4 실행 권한 정정 (2026-09-19)

아래 기존 감사 기록은 2026-09-18 문서 검토 snapshot으로 보존한다. 운영자는 Node 24.21.0 / bundled npm 11.19.0 후보와 PF00-A 설치 재현성 및 PF00-B 진단·측정만 승인했다. 현재 조건은 [D06](D06_runtime_decision.md)과 [A/B 계획](PF00-A-B_implementation_plan.md)을 따른다. 설치 미검증은 bootstrap을 막는 순환 조건이 아니다. PF00-C scanner 명령은 직접 파일 실행 + root PYTHONPATH로 정정했으며 실행 상태는 NOT_RUN이다. PF01은 검토 초안, PF02는 미승인이다. 등록 revision 0.4의 실제 bytes로 checksum을 재계산하며 0.3 영수증을 재사용하지 않는다.

## 1. 실제 수행한 일

- GitHub 연결을 통한 main ref·고정 커밋의 정책, CI, package metadata, CreateTicketRequest, test tsconfig 확인.
- 이전 PF01 0.1 전문과 blueprint 구조 확인; 공개제품·논문 33개를 이번에 전부 다시 읽었다고 주장하지 않음.
- Jest/npm/GitHub Actions/OWASP/PostgreSQL/RFC/AWS 관련 공식 문서의 필요한 절 확인.
- 문서와 예정 검증표의 정합성 점검; 파일/링크/참조/순서/상태에 대한 local 구조 검증.
- 앱 구현, Node dependency 설치, 실제 DB, 실제 사용자 초대, 제품 테스트, 원격 commit/push는 없음.

## 2. 발견한 기획상 문제와 수정

아래는 **설계상의 위험/누락**이지 현재 코드에 동일한 보안 취약점이 재현됐다는 판정이 아니다. 모두 문서 수준에서 반영했으며 실제 효과는 예정 시험을 통과해야 한다.

| ID | 분류 | 기존 모호성/누락 | 반영 내용 | 위치 |
|---|---|---|---|---|
| A01 | 단계 충돌 | 기존 FROZEN 규칙만 적용하면 실제 사용자/권한 도입도 영구 금지될 수 있었음 | historical freeze와 승인된 production evolution을 분리; exact 파일/계약은 후속 plan | 00 §4 |
| A02 | 검증 누락 | 현재 초록불을 전체 테스트 성공으로 오해할 여지가 있었음 | Linux/Windows cold Mobile·Web 단위/E2E·scanner 회귀를 명시 | PF00 §6 |
| A03 | 원인 단정 | cold transform 비용을 직접 재현한 원인으로 취급할 위험 | 실행자 보고와 가설로 분리; paired cold/warm·최초 렌더 진단 후 최소 수정 | PF00 §5 |
| A04 | 증거 혼동 | --no-cache/캐시 삭제/기존 결과물 재사용을 cold fresh 증거로 혼동 | 새 임시 cacheDirectory와 run별 출력, 기존 cache 삭제 없음 | PF00 §5–7 |
| A05 | 권한 모델 | Occupancy 하나에 사람과 기간이 함께 묶이면 공동거주/부분 퇴거가 모호 | Occupancy + OccupancyMember 분리; 유효시간까지 검사 | PF01 §2–4 |
| A06 | 과거자료 노출 | 같은 호실이면 이전 신고나 동거인 메시지를 볼 수 있다고 해석 가능 | 첫 버전은 resident 본인 신고만; 이전 occupancy 내역 API 제공 유예 | PF01 §5/8 |
| A07 | 초대 경합 | 철회와 수락 중 어느 순서가 유효한지 미확정 | commit/lock 순서와 issuer 퇴사 이후 기존 관계 유지 규칙 명시 | PF01 §7–8 |
| A08 | 철회 경합 | 권한 확인과 실제 쓰기 사이에 철회되는 race 누락 | DB transaction/권한 row 잠금/재검사; in-flight 읽기 회수 한계 구분 | PF01 §8 |
| A09 | 재전송 권한 | idempotency 영수증을 auth보다 먼저 반환하면 퇴거 후 데이터 노출 | 현재 auth/scope 확인이 replay 선행; 생성 request ID 고유성과 stale version | PF01 §9 |
| A10 | 격리 실효성 | RLS owner/서비스 계정이나 pool에 남은 org 문맥으로 시험이 우연히 통과 가능 | 비특권 runtime role, 복합 FK, WITH CHECK, SET LOCAL·rollback pool 재사용 시험 | PF01 §10 |
| A11 | demo 유출 | reset만 막으면 비인증 v1 조회·쓰기가 운영 DB에 남을 수 있음 | 운영 v1 업무·fixture/test identity 전부 차단; DB 오류시 fallback 없음 | PF01 §11 |
| A12 | 입력 보호 | v1 rawUserText 무상한을 새 서비스에도 가져갈 위험 | v2 입력 2,000 codepoints/body64KiB/page50 제안과 경계 시험; silent truncation 금지 | PF01 §9 |
| A13 | 복원·개인정보 | 백업 복원으로 퇴거·삭제된 접근권한이 부활할 수 있음 | 복원 격리·최신 삭제/철회 조정·세션 무효화 후 공개; 기간은 법적 운영결정 전 보류 | PF01 §12 |
| A14 | 작업 선행순서 | DB major/driver 선택 gate를 auth 연결 직전으로 두면 schema 작업이 먼저 진행될 수 있었음 | D02a를 PF02-A 전에, D01은 PF02-B 전에, 호스팅/실데이터는 파일럿 전에 분리 | 00 §3; PF01 §14 |
| A15 | 증거 수준 | RNTL mock DTO만으로 실제 Web/App 인증/DB 흐름이 검증됐다고 과장 가능 | F40은 실제 Web+Mobile 개발빌드의 같은 ticketId/API/DB; 서명 release QA는 별도 | PF01 §13 |
| A16 | 승인·CI 강제 | 설계검토/CI 집계와 실행승인/merge 강제를 동일하게 취급할 위험 | REVIEWED_FOR_APPROVAL·NOT_RUN 유지; branch rules/infra/실데이터는 별도 승인 | 00 §1/8; PF00 §6 |

## 3. 아직 결정해야 하는 것

| 결정 | 해결 시점 | 미결정인 동안 가능한 작업 | 금지되는 진행 |
|---|---|---|---|
| D06 exact Node/npm/runner/action 및 cold-test 변경범위 | PF00 실행계획 | 현재 기획 검토 | unpinned 실행을 검증기준으로 확정 |
| D02a PostgreSQL major/driver/local test | PF02-A 전 | PF00 + 데이터/권한 설계 | 실제 schema 구현 착수 |
| D01 실제 인증 공급자·flow | PF02-B 전 | 승인된 DB/순수 관계 시험 | 외부 인증계정/키 없이 실제 auth라고 주장 |
| D02b/D03/D04/D05 호스팅·리전·backup·관리권 확인·개인정보·운영/예산 | 실제 데이터 파일럿 전 | 합성 검증 환경 | 실제 입주자 자료 수집·유료 가입·일반 공개 |

호스팅·인증 선택과 데이터 보유기간을 모르는 상태에서 무조건 `BLOCKER 0 / 출시 가능`이라고 판정하지 않는다. 기획 수준의 승인 검토가 가능하다는 뜻과 실행 수준의 미결정을 구분한다.

## 4. 기획 점검 항목

| ID | 점검 | 근거 | 방식 |
|---|---|---|---|
| Q01 | 현재 main 및 정책 기준 | 6d0eaab 확인; 고정 ref로 policy/workflow/manifest/계약 읽음 | DOCUMENT_EVIDENCE |
| Q02 | 사용자 선택 보존 | Modular Monolith와 실제 출시 목표 유지; 재선택 요구 안 함 | MANUAL_REVIEW |
| Q03 | 범위/승인 경계 | 기획과 구현을 분리, 과거 인수 기록을 수정하지 않음 | MANUAL_REVIEW |
| Q04 | 시험의 실제 대상 | cold·DB race·RLS·실제 client/서버를 분리 | MANUAL_REVIEW |
| Q05 | 회귀 가림 방지 | skip/retry/forceExit/검출기 완화 금지; 가짜 RED 요구 없음 | MANUAL_REVIEW |
| Q06 | 불변조건 연결 | I01~I12 각각 F 시나리오에 연결 | STRUCTURAL_CHECK |
| Q07 | 후속 단계 선행성 | PF00/PF01 병행, DB major/driver before PF02-A | STRUCTURAL_AND_MANUAL |
| Q08 | 실데이터/법률 한계 | 공급자·보유/삭제·실관리권 확인·운영시간 결정 전 파일럿 보류 | MANUAL_REVIEW |
| Q09 | 최종 파일 무결성 | UTF-8/필수문서/로컬링크/식별자/중복/해시 검사 | STRUCTURAL_CHECK |
| Q10 | 실행 사실 분리 | C01~C12/F01~F44 전부 NOT_RUN; 앱테스트 수행 주장 없음 | STRUCTURAL_CHECK |
| Q11 | 공개/원격 권한 | GitHub/DB/IAM/계정연결 쓰기 없음; local artifact만 | OBSERVED_ACTIONS |
| Q12 | 출처/동기화 | 새 primary 출처와 이전 연구 provenance 구분; Sheets/Drive PENDING | MANUAL_REVIEW |

## 5. 예정 검증 시나리오

**총 56개: PF00 12개 + PF02 관계/권한 44개. 전부 NOT_RUN이다.** 아래 행은 만들어야 할 시험/증거 계약이며 실제 테스트 코드가 이미 있거나 통과했다는 뜻이 아니다. source-of-truth는 acceptance_cases.json이다.

| ID | 단계 | 요구조건 | 사전 상태·행동 | 기대 결과 |
|---|---|---|---|---|
| C01 | PF00-A | install | 동일 SHA의 새 Linux/Windows 작업환경 → npm ci + Web build + dependency 검사 | 양쪽 성공, 추가 tracked diff 0, 실제 OS/runtime/lock hash 기록 |
| C02 | PF00-A | toolchain | Node24 계열/지정 npm/runtime image → 실행계획의 exact pin과 실제 설치 비교 | Node/npm/action/ref가 계획과 일치, 이동 alias만으로 동일 주장 금지 |
| C03 | PF00-B | cold-diagnosis | 새 Jest cacheDirectory의 전체 Mobile → cold 실행과 같은 cache warm 실행 대조 | 최초 실패 원인과 suite/시간 보존, warm 성공으로 cold 실패를 삭제하지 않음 |
| C04 | PF00-B | cold-acceptance | 고정 수정 후보와 독립 새 cache 3개/OS → Linux/Windows 전체 Mobile 각각 3회 | 모든 예정 run 첫 실행 성공, 필수 skip/todo 없음; 무결함 통계 주장은 하지 않음 |
| C05 | PF00-C | scanner-regression | 두 scanner unittest 위치 → tests와 scripts/tests의 test ID 발견 및 실행 | 0-test 성공 불가; 양쪽 scanner regression 실제 실행 |
| C06 | PF00-C | coverage | 일반 PR와 merged main 후보 → Web 단위/Mobile/Shared/E2E/lint/type/build/dependency job 실행 | 필수 job 누락/skipped/cancelled는 gate 실패 |
| C07 | PF00-C | ci-security | untrusted PR 입력 → 권한과 checkout/action source 검사 | production secret 없음; reviewed full SHA; 검증 없던 artifact 실행 안 함 |
| C08 | PF00-C | doctor | same candidate의 health 환경 → Doctor pin/version과 실제 결과 기록 | exit0/failed0; 원격 metadata 변동을 구분, exclude 우회 없음 |
| C09 | PF00-C | bundle | 동일 SHA와 새 export 출력경로 → Android/iOS JS export | 새 비어있는 경로 생성물과 SHA 연결; native/device 주장 금지 |
| C10 | PF00-D | public-gate | 공개될 후보 index와 reachable history → repository/tree/history/whitespace 검사 | 0 findings, actual checked 범위를 명시; scanner 종합보안 인증 아님 |
| C11 | PF00-D | evidence | docs와 current workflows → STATUS/검사 진입점/영수증 대조 | 실행한 검사와 누락/OPEN RISK를 분리하고 raw log 비밀 제거 |
| C12 | PF00-D | publication | 최종 publication 직전/직후 → exact ref와 scope/diff 확인 | 기존 frozen history 보존, 비승인 경로 없음, 실제 checked tree와 원격 대응 |
| F01 | PF02-A | I02 | 활성 ORG_ADMIN과 자기 조직 → 건물·호실 생성 후 다른 조직에서 조회 | 자기 조직만 생성/조회, 다른 조직 응답에 없음 |
| F02 | PF02-B | I01 | 일반 입주자 세션 → role/view/actorUserId 주입 | 권한 상승·actor 변경 없음; strict schema 또는 현재 서버 정책으로 거부 |
| F03 | PF02-D | I02 | 다른 조직의 실재 ticketId를 앎 → 상세 API 호출 | 404 비노출, 본문/관계 정보/DB변경 없음 |
| F04 | PF02-D | I02 | 조직A 세션 → 목록의 orgId/page/filter를 B로 치환 | B 데이터 없음; 페이지 개수/오류로 B 존재를 공개하지 않음 |
| F05 | PF02-D | I03 | staff는 건물A만 배정 → 건물B 티켓 읽기/답변 | 거부, 변경 없음 |
| F06 | PF02-C | I05 | 미수락 초대가 만료 또는 철회 → 정상 로그인 사용자 수락 | 새 관계 없음, 비노출 오류 |
| F07 | PF02-C | I05 | 같은 토큰으로 두 동시 요청 → 두 DB connection의 수락 경합 | OccupancyMember 하나; 현재 유효한 동일 사용자 재요청만 기존 결과 |
| F08 | PF02-C | I06 | 발급자 권한철회와 초대 수락 동시 → 두 commit 순서를 각각 barrier로 재현 | 철회 먼저면 거부; 수락 먼저면 유효관계 유지, 발급자 퇴사로 자동퇴거 안 됨 |
| F09 | PF02-D | I04 | 유효 입주자와 자기 occupancy → 텍스트 신고 | 서버가 자기 unit/member/actor를 확정하고 FK 관계 일치 |
| F10 | PF02-D | I03 | 유효 입주자 → 다른 unit/occupancy ID 신고 | 거부, 다른 호실 요청 생성 없음 |
| F11 | PF02-D | I07 | DB commit 뒤 응답만 유실 → 같은 clientRequestId와 내용으로 재시도 | 원래 티켓 하나와 같은 결과; 중복 티켓 없음 |
| F12 | PF02-D | I03 | 첫 구현에서 대리접수는 유예 → resident가 onBehalfOf/creator 값으로 다른 사람 위장 | 서버 소유 필드 거부; 본인 신고자 변조 없음 |
| F13 | PF02-C | I06 | 입주기간 종료 commit 완료 → 이전 세션으로 읽기/쓰기 | 현재 호실의 새 요청 거부; User의 다른 활성 관계는 유지 |
| F14 | PF02-D | I08 | 같은 Unit에 새 Occupancy → 새 입주자가 과거 티켓 ID/이력 조회 | 과거 개인대화/주소세부/파일 메타데이터 없음; 옛 티켓 FK 재연결 없음 |
| F15 | PF02-B | I06 | 직원 담당범위 철회 또는 membership 종료 → 이전 로그인 토큰으로 티켓 읽기/답변 | 새 요청 거부; 단순 JWT role로 이전 허용 유지하지 않음 |
| F16 | PF02-A | I09 | 관계 생성 중 DB 실패 injection → 초대소비/관계생성 중간단계 오류 | 전체 rollback, 소비된 초대만 남거나 거짓 성공하지 않음 |
| F17 | PF02-E | I10 | production mode의 synthetic DB만 사용 → v1 read/write/reset/test identity 경로를 시도 | 업무 데이터 접근 불가; reset이 실제 DB에 연결되지 않음 |
| F18 | PF02-A | I02 | poolSize=1의 app runtime role → A→rollback→B→missing context 요청 순서 | A row가 B/missing context에 보이지 않음; transaction context 누수 없음 |
| F19 | PF02-A | I10 | migration owner와 app runtime role 분리 → 같은 격리 시험을 비특권 app role로 실행 | owner/superuser/BYPASSRLS 사용 안 함; tenant context 없는 일반 업무 거부 |
| F20 | PF02-E | I12 | Web/Mobile 세션과 invitation return → 앱 재시작·재로그인·다른 계정 deep link | 정확한 현재 User에만 연결; 다른 계정에 자동 부여 없음 |
| F21 | PF02-B | I01 | 같은 User는 조직A admin·조직B resident → 두 context 교대 및 섞인 요청 | 각 관계 권한만 적용; A admin이 B admin으로 전이되지 않음 |
| F22 | PF02-D | I08 | 같은 Occupancy에 여러 구성원 → 주민A가 주민B의 티켓 조회 | 기본 거부; 공동거주가 개인대화 자동열람으로 이어지지 않음 |
| F23 | PF02-A | I04 | 같은 Unit에 두 startOccupancy 동시 → 별도 transaction으로 ACTIVE 추가 | active 기간 하나; 승자 외는 명시적 충돌 |
| F24 | PF02-C | I04 | 두 구성원 중 한 구성원만 종료 → 각 세션으로 자기 신고와 context 확인 | 종료자 차단, 다른 구성원과 그 티켓은 유지 |
| F25 | PF02-B | I06 | User/Organization 정지 또는 Property/Unit 비활성화 → 새 읽기/쓰기 명령 | 해당 일반업무 접근 차단; 보안 정지가 last-admin guard로 막히지 않음; 본인 개인정보 요청은 별도 경로 유지 |
| F26 | PF02-B | I10 | Organization PENDING 또는 mode 미승인 → 실데이터 업무 API 활성화 시도 | 업무 거부; 운영 확인 없이 self-signup을 실권한 증명으로 취급 안 함 |
| F27 | PF02-C | I05 | 초대 수신대상과 다른 verified identity → 전달받은 초대 링크 수락 | 관계 생성 없음, 원 수신대상/건물 상세 비노출 |
| F28 | PF02-C | I05 | 토큰이 유효했으나 잠금 대기 중 만료 → 잠금 해제 후 수락 | 대기 후 DB 시간으로 만료 판정; 관계 생성 없음 |
| F29 | PF02-D | I06 | 권한검사·쓰기와 입주 종료 경합 → 두 connection barrier로 commit 순서를 교대 | 쓰기 먼저면 당시 유효; 종료 먼저면 재검증 거부; 종료 후 새 쓰기 없음 |
| F30 | PF02-D | I07 | 한때 성공한 요청과 이후 퇴거 → 기존 idempotency key로 replay | 권한 확인 후 거부; 과거 receipt가 body를 유출/관계를 재활성화하지 않음 |
| F31 | PF02-D | I07 | 같은 org/actor/operation/request key → payload만 바꿔 재제출 | 409, 원래 리소스 유지; 다른 org/actor receipt는 별도 scope |
| F32 | PF02-D | I09 | 서로 다른 client가 같은 version을 읽음 → If-Match로 동시 수정 | 하나 성공, stale은412; last-write-wins로 덮어쓰지 않음 |
| F33 | PF02-D | I08 | internal과 resident-visible 메시지 혼재 → resident 응답/페이지/쓰기 검사 | INTERNAL 원문이 payload에 없음; resident INTERNAL 생성 거부 |
| F34 | PF02-E | I11 | 초대/입주/세션 철회 뒤 이전 backup 복원 → 격리된 복원환경에서 조정 후 접근시도 | 최신 철회/삭제 조정·세션무효화 전 공개금지; 복원으로 접근 부활 안 됨 |
| F35 | PF02-B | I01 | identity provider/JWKS 검증 오류 → 보호된 API 호출 | fail closed, mock identity/demo fallback 없음, 재시도 오류도 비밀 미노출 |
| F36 | PF02-E | I10 | 실패 경로·입력 공격·초대 요청 → 로그/오류/감사/아티팩트 조사 | 원문/토큰/파일URL/실연락처 미복제; 내부 식별자도 접근통제 |
| F37 | PF02-D | I10 | UTF-8/한글/emoji 및 본문 경계 → 2,000 codepoints/64KiB/page50 위아래 시험 | 동일 계약의 경계 처리, 초과 무음 절삭·거짓접수 없음 |
| F38 | PF02-E | I10 | production에서 DB/mode 설정 누락 → 서비스 조립/연결실패 | 시작/요청 실패; fixture seed와 SQLite fallback 없음 |
| F39 | PF02-B | I03 | 마지막 admin 두 개의 권한제거 요청 경합 → 자발적 탈퇴/강등 명령 동시 | org lock으로 0 active admin 방지; 보안 계정정지는 별도로 허용하고 org 업무 잠금 |
| F40 | PF02-E | I12 | 실제 Web 로그인과 Mobile 개발빌드, 같은 staging API → Web/앱 교대 신고·답변·조회 및 퇴거 | 같은 ticketId·DB결과와 권한을 사용; mock DTO만으로 대체 안 됨, emulator/수동 여부 기록 |
| F41 | PF02-A | I02 | orgA의 unit/occupancy/member와 orgB 부모 조합 → runtime DB role에서 교차조직·불일치 FK insert/update 시도 | application guard와 복합 FK/쓰기 정책이 모두 거부; 부모 관계 불일치가 저장되지 않음 |
| F42 | PF02-C | I04 | 상태 ACTIVE지만 시작 전 또는 종료시각 경과 → UTC 시간 경계에서 신규 권한검사 | status만으로 허용하지 않고 시간조건까지 검사; 이전 판단을 cache로 재사용하지 않음 |
| F43 | PF02-A | I02 | 두 조직이 같은 공공주소를 입력 → 각각 건물을 등록하고 검색 | org-scoped 개별 자원; 타 조직 데이터/입주자 자동 합병·노출 없음 |
| F44 | PF02-B | I03 | 일반 플랫폼 지원 계정 → 조직 티켓 API 직접 접근 | 기본 거부; global superadmin 화면 우회 없음; 별도 break-glass 승인/구현 전 데이터 열람 불가 |

## 6. 실행·판정 경계

문서 승인 이후에만 PF00-A/B의 실제 implementation plan을 만든다. rootcause 조사부터 수행하며, 문제를 숨기는 timeout/skip 변경을 허용하지 않는다. PF01 세부모델 승인과 D02a/D01 결정은 별개다.

현재 main은 historical baseline으로 보존한다. PF02에서 신규 production 요구를 구현할 때에는 범위가 정해진 새 변경 승인을 사용한다. '기존 FROZEN이므로 영구히 새 데이터모델 금지' 또는 '실제 출시 목표이므로 모두 수정 가능' 어느 쪽으로도 해석하지 않는다.

검증 결과는 audit/validation_receipt.json에 기록한다. 거기에 있는 structural PASS는 문서 정합성 검사 결과다. 앱/DB의 NOT_RUN을 PASS로 바꾸지 않는다.
