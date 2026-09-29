# 출시 기반 기획 (production foundation)

Revision: **1.4 (PF02-B B4 canonical closure candidate; supersedes 1.3)**
Snapshot: 2026-09-29
B4 closure evidence main: `main@6cf71049c479d100ec6e949002c2e30c8df81eba` (PR #58 merge; accepted HEAD `6f8d98e5abaf8edb68585f3029459c4df0d91307`)
B3 closure evidence main: `main@42a7d2ce02a51b6f71ad47d9274bb5c3d7ab5ab3`
F01 evidence provenance: `6706afe3a2cc5bdd2fd7204ce7944fafdd422065`
B2 implementation main: `f0c6e80c9e1072f5b6a98bacc7697af01da9c7d1`
상태: **PF00 = FROZEN; PF02-A = VERIFIED / FROZEN; PF02-B = IN_PROGRESS; B1 = VERIFIED / FROZEN; B2 = VERIFIED / FROZEN; B3 = VERIFIED / FROZEN; B4 = VERIFIED / FROZEN; F01 = PASS_POSTGRES_INTEGRATION; F43 = NOT_RUN**. PF01 = REVIEW_DRAFT.

F01은 PR #47 merge main `6706afe3a2cc5bdd2fd7204ce7944fafdd422065`의 Web/API/PostgreSQL 생성·readback·cross-org isolation 증거와 고정 HEAD 독립 reconciliation을 근거로 [F01 promotion receipt](../../ops/pf02_b_f01_promotion_acceptance.md)에 따라 `PASS_POSTGRES_INTEGRATION`으로 승격됐다. 이후 [B3 closure receipt](../../ops/pf02_b_b3_closure.md)가 accepted implementation/remediation/F01 evidence를 종합해 B3를 `VERIFIED / FROZEN`으로 닫는다. F43 search, later slice, real data/hosting은 이 closure에 포함되지 않는다.

[B4 closure receipt](../../ops/pf02_b_b4_closure.md)는 PR #58 accepted HEAD `6f8d98e5abaf8edb68585f3029459c4df0d91307`(candidate PR CI 9/9, 독립 구현 검토 ACCEPTED HIGH0/MEDIUM0/LOW1)와 실제 merge `6cf71049c479d100ec6e949002c2e30c8df81eba`의 implementation-main push CI [App 36557551079](https://github.com/edward321416-maker/build-manager/actions/runs/36557551079) / [Repository 36557550998](https://github.com/edward321416-maker/build-manager/actions/runs/36557550998) 9/9 SUCCESS를 분리된 증거로 기록하고 B4를 `VERIFIED / FROZEN`으로 닫는다. B4I-L01/B4R-L01은 retained non-blocking LOW이며 B4D-L01..L04 경계도 유지된다. global lifecycle serialization, exactly-once/CommandReceipt, request-arrival eligibility snapshot은 주장하지 않는다. staff roster/search/onboarding/invitation, membership mutation, PF02-C, F43, real data/hosting/provider 작업은 포함되지 않는다.

PR #34 후보 `d074741e8212ebb2fdb8d0ea7f46a100fd58f24a`는 독립 Opus 구현 검토 NO_BLOCKING_FINDINGS (BLOCKER/HIGH/MEDIUM 0, LOW4 deferred)를 받았고 `f0c6e80c9e1072f5b6a98bacc7697af01da9c7d1`로 실제 merge됐다. 리뷰 SHA-256은 `5b830146be30e3a05675537d35bfe1a85f1b002ed5e804f777e7007abb1d2d32`다. 실제 main push [App 35944851872](https://github.com/edward321416-maker/build-manager/actions/runs/35944851872) / [Repository 35944851923](https://github.com/edward321416-maker/build-manager/actions/runs/35944851923)가 필수 9/9 SUCCESS다. [B2 인수 기록](../../ops/pf02_b_b2_acceptance.md)은 candidate CI, independent review, implementation-main CI, closure-main CI를 분리한다. canonical closure PR #35는 MERGED이며 closure main `5670a6246805cadc9e6cb2c0ccff3eaaf01a2c2d`의 push CI [App 35947253215](https://github.com/edward321416-maker/build-manager/actions/runs/35947253215) / [Repository 35947253217](https://github.com/edward321416-maker/build-manager/actions/runs/35947253217)가 필수 9/9 SUCCESS다. PF02-B 전체는 IN_PROGRESS이고 B1/B2/B3/B4는 VERIFIED / FROZEN이며, B4 이후 slice는 NOT_STARTED / NOT_YET_SCOPED다.

[승인 A+ spec](../superpowers/specs/2026-09-23-pf02-b-b2-property-staff-scope-design.md)은 PR #33의 `1a056151d908a8d7bebb76100a2307e6555621b7`에서 exact32,600 bytes / SHA-256 `ec9fc095767624fdc4098447bd8b00bc65f90b5456f6570378d704fe41b63557`로 복사했고, 현재 main에 blob `b6fd0ce3c15d2255105434911889dd61693dbdb7`로 canonical하게 존재한다. PR #33은 **CLOSED / NOT_MERGED / SUPERSEDED_BY_CANONICAL_SPEC_IN_MAIN**이다. execution-log append overlap 때문에 직접 merge하지 않았을 뿐 설계가 거부된 것이 아니며, branch/history는 보존됐다. D01의 RESOLVED_FOR_B1 경계는 그대로다.

## 현재 상태와 증거

| 대상 | 상태 | 근거 |
| --- | --- | --- |
| Prototype / baseline MVP | INTEGRATED | 합성 Web/Mobile 흐름과 실제 main CI; demo-v1 SQLite 동작 유지 |
| PF00 | FROZEN / VERIFIED BASELINE | 아래 PF00-A–D 인수 기록; 기존 freeze 경계 유지 |
| PF00-A | VERIFIED_FROM_ACCEPTED_EXECUTOR_EVIDENCE | [A/B 인수 기록](../../ops/pf00_ab_acceptance.md); 현재 실행자의 독립 재실행 아님 |
| PF00-B | NOT_REPRODUCED_AT_SELECTED_TOOLCHAIN | OS별 cold 3회 통과; root cause 미확정; timeout 변경 없음 |
| PF00-C | ACCEPTED_AND_INTEGRATED | [인수·실제 main 공개 증거](../../ops/pf00_c_acceptance.md) |
| PF00-D | ACCEPTED_AND_INTEGRATED | [독립 인수·freeze 기록](../../ops/pf00_d_acceptance.md) |
| PF01 | REVIEW_DRAFT | [관계·권한 설계](PF01_data_authorization.md); PF02-A에 필요한 제약만 해당 범위에서 승인 |
| PF02-A | VERIFIED / FROZEN | [구현 인수 기록](../../ops/pf02_a_acceptance.md); [PR #28](https://github.com/edward321416-maker/build-manager/pull/28) 독립 인수 완료 / MERGED; 아래 freeze main CI |
| PF02-B | IN_PROGRESS | B1/B2/B3/B4 VERIFIED / FROZEN; beyond B4 NOT_STARTED / NOT_YET_SCOPED |
| PF02-B / B1 | VERIFIED / FROZEN | [PR #31 인수 기록](../../ops/pf02_b_b1_acceptance.md); 실제 main CI 9/9 SUCCESS |
| PF02-B / B2 | VERIFIED / FROZEN | [인수 기록](../../ops/pf02_b_b2_acceptance.md); implementation-main CI9/9; closure PR #35 MERGED, closure-main CI9/9 |
| PF02-B / B3 | VERIFIED / FROZEN | [closure receipt](../../ops/pf02_b_b3_closure.md); prior [implementation](../../ops/pf02_b_b3_acceptance.md), [LOW remediation](../../ops/pf02_b_b3_low_remediation_acceptance.md), [F01 promotion](../../ops/pf02_b_f01_promotion_acceptance.md) evidence retained; disclosed risks remain open |
| PF02-B / B4 | VERIFIED / FROZEN | [closure receipt](../../ops/pf02_b_b4_closure.md); [erratum publication](../../ops/pf02_b_b4_erratum_publication.md) 보존; implementation-main CI9/9, PostgreSQL217, authenticated Web/PostgreSQL57; B4I-L01/B4R-L01 및 B4D-L01..L04 retained |
| D01 | RESOLVED_FOR_B1 | Auth0 선택과 Database-only Web identity 한정 |

Node **24.21.0 / npm 11.19.0**, PostgreSQL **18.6**, pg **8.23.0**, @types/pg **8.23.1**, Testcontainers **12.1.0**, node-pg-migrate **9.0.0**을 유지한다. PostgreSQL adapter는 explicit SQL과 application ports를 사용하며 ORM을 도입하지 않았다. 보호 대상 플랫폼 lock key는 실제 집합 비교에서 67/67, 누락 0이었다. 숫자는 영구 계약이 아니다.

## 읽는 순서

1. [현재 상태](../../STATUS.md), [B4 closure receipt](../../ops/pf02_b_b4_closure.md), [B3 closure receipt](../../ops/pf02_b_b3_closure.md), [F01 promotion receipt](../../ops/pf02_b_f01_promotion_acceptance.md), [B3 LOW remediation receipt](../../ops/pf02_b_b3_low_remediation_acceptance.md), [B3 implementation receipt](../../ops/pf02_b_b3_acceptance.md) — 현재 B3/F01 disposition과 고정 evidence provenance.
2. [현재 검증표](acceptance_cases.json) — C01–C12 출처 유지; F01/F18/F19/F23 `PASS_POSTGRES_INTEGRATION`, 나머지 40개 F-case `NOT_RUN`.
3. [revision 1.1 감사 기록](AUDIT_REPORT.md)과 [B2 인수 기록](../../ops/pf02_b_b2_acceptance.md) — B2 closure 시점과 그대로 보존한 B1/이전 감사.
4. [승인된 PF02-A spec](../superpowers/specs/2026-09-19-pf02-a-postgres-foundation-design.md), [계획](../superpowers/plans/2026-09-19-pf02-a-postgres-foundation.md) — Separate Acceptance/Publication Phase 및 범위 경계.
5. [PF00-D freeze](../../ops/pf00_d_acceptance.md), [PF00-C 인수](../../ops/pf00_c_acceptance.md), [A/B 실행자 증거](../../ops/pf00_ab_acceptance.md).
6. [전체 기획](00_foundation_blueprint.md), [PF00 계획](PF00_verification_foundation.md), [D06](D06_runtime_decision.md), [A/B 계획](PF00-A-B_implementation_plan.md) — 각 작성 시점의 snapshot.
7. [PF01 설계](PF01_data_authorization.md), [단계 의존관계](phase_dependencies.json), [출처](sources/README.md) — 후속 검토 자료.

역사적 설계의 NOT_RUN/미승인 문구를 현재 결과로 읽거나 후속 구현 승인으로 확대하지 않는다. 이후 실제 수행·현재 상태는 이 README, canonical 검증표 및 연결된 ops 기록을 따른다.

## 증거 승격과 검사 범위

B2 actual-main logs: PostgreSQL151, demo Web21, B1+B2 Web21 및 exact named-case gate(skip/retry/failure0, negative controls6). B2는 SYNTHETIC_AUTH + ACTUAL_WEB + ACTUAL_POSTGRES이며 LIVE_AUTH0_B2=NOT_RUN이다. 독립 reviewer는 PostgreSQL/Playwright/npm을 재실행하지 않았다. Runtime은 HOSTED_CI_EVIDENCE / EXECUTOR_EVIDENCE로 귀속한다. 아래 B1/PF02-A 결과는 각각 당시의 역사적 publication 증거다. B2 closure 자체로는 canonical F-case 추가 승격이 없었다. 이후 별도 B3/PR47 고정증거 reconciliation으로 F01만 `PASS_POSTGRES_INTEGRATION`에 승격됐다; F43은 `NOT_RUN`이다.

F01 fixed evidence main `6706afe3a2cc5bdd2fd7204ce7944fafdd422065`의 hosted PostgreSQL은 16 files / 185 tests PASS이고, B3 registration 10/10, Unit 6/6, capability 4/4를 포함한다. 같은 main의 authenticated Web/PostgreSQL gate는 51 PASS / failed0 / skipped0 / retries0이며 AC01/03/05/07/10/19 named cases를 포함한다. PR47은 새 Property를 양 조직에서 실제 등록한 뒤 exact foreign IDs가 양방향 `NOT_FOUND`임을 직접 보강했다. 세부 evidence class와 한계는 [F01 promotion receipt](../../ops/pf02_b_f01_promotion_acceptance.md)를 따른다.

B1 실제 main `2ede1520e681c3fe02cb5ac2b85847ea803282d8`에서 [App 35838146830](https://github.com/edward321416-maker/build-manager/actions/runs/35838146830) / [Repository 35838146810](https://github.com/edward321416-maker/build-manager/actions/runs/35838146810), push/main attempt 1, 필수 9개 SUCCESS를 확인했다. Shared358, Web313, PostgreSQL124(기존 foundation86 포함), DEMO E2E21 및 B1 E2E12가 실제 실행됐다. Foundation 내부 dependency7개 모두 success다. Live Auth0는 EXECUTOR_LIVE_EVIDENCE; LIVE_AUTH0_INDEPENDENT_REPRO=NOT_RUN이다. B1 결과로 canonical F-case를 추가 승격하지 않는다.

아래 PF02-A 결과는 당시 publication 증거로 보존한다.

PF02-A 운영자 측 독립 재검토는 정확한 head `0fa5a9c14c9b57c6362f048b611c0148a3a76132`를 ACCEPTED했다. 실행자의 Git/로그 재조회 및 내부 코드 리뷰와 구분한다. 새 main push runs **35491995616 / 35491995683**은 실제 merge SHA에서 실행됐다. PR CI를 main 증거로 재사용하지 않았다.

PR #28 freeze publication은 별도 실제 main SHA `bfef69cc35b23a1fb5077a6fc73f54bfaa12133e`에서 실행된 [App 35496169603](https://github.com/edward321416-maker/build-manager/actions/runs/35496169603) / [Repository 35496169579](https://github.com/edward321416-maker/build-manager/actions/runs/35496169579)로 확인했다. 두 run 모두 push/main attempt 1 SUCCESS이며 필수 9개 check와 foundation-gate 내부 7개 dependency가 모두 성공했다. PostgreSQL 86 tests, H01/H02 및 F23도 이 새 main 로그에서 PASS를 확인했다. 최종 병합·freeze 사건 2건은 [실행 로그](../../ops/AI_Execution_Log.csv)에 보존한다.

실제 PostgreSQL job은 **86 tests PASS**, PostgreSQL 18.6 및 실행된 numeric version assertion **180006**을 확인한다. R27-H01 swallowed-error 거부와 SAVEPOINT 복구, R27-H02 실제 idle backend 종료 뒤 복구, F23의 실제 Lock 관측 → SQLSTATE23505 → ACTIVE1이 포함된다. PF02-A publication 시점에는 F18/F19/F23만 canonical PASS로 승격했고 F01/F16/F41/F43는 NOT_RUN이었다. 이후 F01은 별도 B3 구현·PR47 직접 cross-org evidence와 고정 HEAD reconciliation을 거쳐 승격됐다. F16/F41/F43는 현재도 NOT_RUN이다.

C01–C04 PASS_ACCEPTED_EXECUTOR_EVIDENCE, C05–C09 PASS_GITHUB_CI, C10 PASS_MERGED_MAIN_PUBLIC_GATE, C11 PASS_PF00_D_EVIDENCE_RECONCILIATION, C12 PASS_PF00_C_PUBLICATION은 변경하지 않았다. C12는 PR #23의 PF00-C 공개를 의미한다.

현재 9개 project check는 기존 scanner3+14, Shared/Web 단위, Linux/Windows cold Mobile, Web E2E, lint/typecheck/build/dependency, pinned Doctor/Android·iOS JS export에 PostgreSQL integration을 포함한다. foundation-gate의 내부 dependency 7개는 모두 success여야 한다. CHECKS_AVAILABLE과 CHECKS_EXECUTED는 확인됐고 MERGE_ENFORCED/branch protection은 변경하지 않았다. 타입 검사·bundle export는 런타임 테스트·native build와 구분한다.

CodeRabbit은 **SUCCESS_STATUS / REVIEW_SKIPPED**이며 독립 검토 증거가 아니다. 실제 operator-side acceptance는 PF00-C/D, 수정된 PF02-A 구현 및 PR #28 evidence-finalization에 대해 별도로 제공됐다.

## 경계와 남은 위험

PF02-A는 합성·폐기 가능한 PostgreSQL 환경에서 승인된 7개 테이블, migration owner/runtime role 분리, transaction/RLS/FK/concurrency 기반을 검증했다. 서비스의 production-ready, launch-ready, real-user-ready, 보안·개인정보 검토 완료를 의미하지 않는다. Production DB hosting과 실제 tenant data는 NOT_AUTHORIZED다. B1의 Database-only Web identity/session 및 ORG_ADMIN 조회 API는 검증됐지만 production identity 운영, real-data pilot, 최종 운영 session/retention, 실제 property/unit/occupancy 운영은 미완료다. B2의 PROPERTY_STAFF assignment read scope는 완료됐으며 current exact app table inventory는 property_assignment를 포함한8개다. B3의 synthetic Property/Unit registration foundation은 VERIFIED / FROZEN이다. B3D-L01/L02, separate PG513 evidence limit, Local Mobile OPEN risk를 closure receipt에 보존하며 production/real-user readiness로 확대하지 않는다. 기존7개 semantics/runtime matrix와 migration0001–0006 bytes는 보존된다. B4는 ORG_ADMIN의 exact-resource PropertyAssignment GET/PUT/DELETE만 VERIFIED / FROZEN으로 추가했다. Staff invitation/roster/search/onboarding, membership mutation, assignment management UI/collection API, resident/ticket, Kakao/account linking/Mobile auth는 미완료 범위다.

- **OPEN_RISK / dependency-security-triage:** npm 14 moderate vulnerabilities, unrs-resolver install-script 경고 및 기존 PF02-A dependency hook/optional build 제한을 인수 기록에 유지한다. audit fix나 script 승인을 하지 않는다.
- **OPEN_RISK / ci-supply-chain-maintenance:** pinned v4 Actions의 오래된 내부 runtime 및 hosted Node24 forcing 경고. major upgrade는 별도 범위다.
- **보존된 Mobile RED:** 첫 Windows-mounted Ubuntu 실행에서 2/133 tests, 2/13 suites timeout 실패. 당시 cache 상태 UNKNOWN, ROOT_CAUSE_NOT_ESTABLISHED. Native ext4 및 hosted PASS는 별도 증거이며 TIMEOUT_NOT_REPRODUCED_ON_NATIVE_EXT4 분류를 바꾸지 않았다. timeout/config 수정이나 warm retry로 지운 실패가 아니다.
- **OPEN / LOW:** container startup/cleanup failure injection 및 concurrent stop은 별도 검증되지 않았다.

## 무결성과 다음 gate

[SHA256SUMS.json](SHA256SUMS.json)은 기존 **12개** 항목을 final UTF-8 bytes에서 다시 읽어 SHA-256/길이를 계산한 revision **1.4** manifest다. B4-closure README와 unchanged F01 registry를 포함해 전12개를 다시 확인했으며, 항목 집합과 자기 자신 제외 설계는 유지한다. 역사적 감사는 그대로 보존했다.

원본 ZIP/raw receipt/log/로컬 절대경로/인증값/외부 Google 목적지는 공개하지 않는다. Google Sheets/Drive는 **PARTIAL_SYNC**다: 이번 PR48 correction/sync/cache 이벤트는 검증된 write/readback이 있고, 역사적 pending queue는 그대로 남아 있다. [대기·sync 기록](../../ops/pending_external_sync.md)을 따른다.

PR #42 B3 implementation, PR #45 LOW remediation, PR #46 status reconciliation, PR #47 F01 direct-evidence test와 PR #48 F01 canonical publication은 모두 MERGED다. PR #58 B4 implementation도 MERGED다. B1/B2/B3/B4는 VERIFIED / FROZEN, PF02-B 전체는 IN_PROGRESS다. F01=`PASS_POSTGRES_INTEGRATION`, F43=`NOT_RUN`. **현재 승인된 추가 제품 task는 없다.** B4 closure candidate의 다음 gate는 `FRESH_CLAUDE_OPUS_B4_CLOSURE_REVIEW`이며 제품 작업이 아니다. B4 이후 slice는 별도 operator scope/approval 전에는 시작하지 않는다. B1I-M01=CLOSED_BY_B2; 역사적 B1 receipt의 OPEN_HARDENING_BACKLOG는 수정하지 않는다. B1I-M02는 DOCUMENT_RECONCILED; B1 LOW6/B2 LOW4, B3D-L01/L02, B4I-L01/B4R-L01 및 B4D-L01..L04는 retained/deferred다. B3 AC04 separate PG513 rejection과 Local Mobile FAILED / OPEN / ROOT_CAUSE_NOT_ESTABLISHED도 retained limit/risk다. Auth0 entitlement, operational session/retention, real-data pilot, production hosting/credentials 및 complete security/privacy review는 계속 미검증/미완료다.
