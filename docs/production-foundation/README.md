# 출시 기반 기획 (production foundation)

Revision: **1.1 (PF02-B B2 post-closure finalization; supersedes 1.0)**
Snapshot: 2026-09-24
POLICY_REF: `main@5670a6246805cadc9e6cb2c0ccff3eaaf01a2c2d`
TARGET_REF / B2 closure main: `5670a6246805cadc9e6cb2c0ccff3eaaf01a2c2d`
B2 implementation main: `f0c6e80c9e1072f5b6a98bacc7697af01da9c7d1`
상태: **PF00 = FROZEN; PF02-A = VERIFIED / FROZEN; PF02-B = IN_PROGRESS; B1 = VERIFIED / FROZEN; B2 = VERIFIED / FROZEN**. PF01 = REVIEW_DRAFT.

PR #34 후보 `d074741e8212ebb2fdb8d0ea7f46a100fd58f24a`는 독립 Opus 구현 검토 NO_BLOCKING_FINDINGS (BLOCKER/HIGH/MEDIUM 0, LOW4 deferred)를 받았고 `f0c6e80c9e1072f5b6a98bacc7697af01da9c7d1`로 실제 merge됐다. 리뷰 SHA-256은 `5b830146be30e3a05675537d35bfe1a85f1b002ed5e804f777e7007abb1d2d32`다. 실제 main push [App 35944851872](https://github.com/edward321416-maker/build-manager/actions/runs/35944851872) / [Repository 35944851923](https://github.com/edward321416-maker/build-manager/actions/runs/35944851923)가 필수 9/9 SUCCESS다. [B2 인수 기록](../../ops/pf02_b_b2_acceptance.md)은 candidate CI, independent review, implementation-main CI, closure-main CI를 분리한다. canonical closure PR #35는 MERGED이며 closure main `5670a6246805cadc9e6cb2c0ccff3eaaf01a2c2d`의 push CI [App 35947253215](https://github.com/edward321416-maker/build-manager/actions/runs/35947253215) / [Repository 35947253217](https://github.com/edward321416-maker/build-manager/actions/runs/35947253217)가 필수 9/9 SUCCESS다. PF02-B 전체는 IN_PROGRESS이고 later slices는 NOT_STARTED / NOT_YET_SCOPED다.

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
| PF02-B | IN_PROGRESS | B1/B2 완료; later slices NOT_STARTED / NOT_YET_SCOPED |
| PF02-B / B1 | VERIFIED / FROZEN | [PR #31 인수 기록](../../ops/pf02_b_b1_acceptance.md); 실제 main CI 9/9 SUCCESS |
| PF02-B / B2 | VERIFIED / FROZEN | [인수 기록](../../ops/pf02_b_b2_acceptance.md); implementation-main CI9/9; closure PR #35 MERGED, closure-main CI9/9 |
| D01 | RESOLVED_FOR_B1 | Auth0 선택과 Database-only Web identity 한정 |

Node **24.21.0 / npm 11.19.0**, PostgreSQL **18.6**, pg **8.23.0**, @types/pg **8.23.1**, Testcontainers **12.1.0**, node-pg-migrate **9.0.0**을 유지한다. PostgreSQL adapter는 explicit SQL과 application ports를 사용하며 ORM을 도입하지 않았다. 보호 대상 플랫폼 lock key는 실제 집합 비교에서 67/67, 누락 0이었다. 숫자는 영구 계약이 아니다.

## 읽는 순서

1. [PF02-A 인수·공개 기록](../../ops/pf02_a_acceptance.md) — operator-side independent acceptance, merge parents, 이전 PR/RED와 새 main 증거 구분.
2. [현재 검증표](acceptance_cases.json) — C01–C12 출처 유지; F18/F19/F23만 PASS_POSTGRES_INTEGRATION, 나머지 41개 F-case NOT_RUN.
3. [revision 1.1 감사 기록](AUDIT_REPORT.md)과 [B2 인수 기록](../../ops/pf02_b_b2_acceptance.md) — 현재 B2 closure 및 그대로 보존한 B1/이전 감사.
4. [승인된 PF02-A spec](../superpowers/specs/2026-09-19-pf02-a-postgres-foundation-design.md), [계획](../superpowers/plans/2026-09-19-pf02-a-postgres-foundation.md) — Separate Acceptance/Publication Phase 및 범위 경계.
5. [PF00-D freeze](../../ops/pf00_d_acceptance.md), [PF00-C 인수](../../ops/pf00_c_acceptance.md), [A/B 실행자 증거](../../ops/pf00_ab_acceptance.md).
6. [전체 기획](00_foundation_blueprint.md), [PF00 계획](PF00_verification_foundation.md), [D06](D06_runtime_decision.md), [A/B 계획](PF00-A-B_implementation_plan.md) — 각 작성 시점의 snapshot.
7. [PF01 설계](PF01_data_authorization.md), [단계 의존관계](phase_dependencies.json), [출처](sources/README.md) — 후속 검토 자료.

역사적 설계의 NOT_RUN/미승인 문구를 현재 결과로 읽거나 후속 구현 승인으로 확대하지 않는다. 이후 실제 수행·현재 상태는 이 README, canonical 검증표 및 연결된 ops 기록을 따른다.

## 증거 승격과 검사 범위

B2 actual-main logs: PostgreSQL151, demo Web21, B1+B2 Web21 및 exact named-case gate(skip/retry/failure0, negative controls6). B2는 SYNTHETIC_AUTH + ACTUAL_WEB + ACTUAL_POSTGRES이며 LIVE_AUTH0_B2=NOT_RUN이다. 독립 reviewer는 PostgreSQL/Playwright/npm을 재실행하지 않았다. Runtime은 HOSTED_CI_EVIDENCE / EXECUTOR_EVIDENCE로 귀속한다. 아래 B1/PF02-A 결과는 각각 당시의 역사적 publication 증거다. Canonical F-case는 추가 승격하지 않는다.

B1 실제 main `2ede1520e681c3fe02cb5ac2b85847ea803282d8`에서 [App 35838146830](https://github.com/edward321416-maker/build-manager/actions/runs/35838146830) / [Repository 35838146810](https://github.com/edward321416-maker/build-manager/actions/runs/35838146810), push/main attempt 1, 필수 9개 SUCCESS를 확인했다. Shared358, Web313, PostgreSQL124(기존 foundation86 포함), DEMO E2E21 및 B1 E2E12가 실제 실행됐다. Foundation 내부 dependency7개 모두 success다. Live Auth0는 EXECUTOR_LIVE_EVIDENCE; LIVE_AUTH0_INDEPENDENT_REPRO=NOT_RUN이다. B1 결과로 canonical F-case를 추가 승격하지 않는다.

아래 PF02-A 결과는 당시 publication 증거로 보존한다.

PF02-A 운영자 측 독립 재검토는 정확한 head `0fa5a9c14c9b57c6362f048b611c0148a3a76132`를 ACCEPTED했다. 실행자의 Git/로그 재조회 및 내부 코드 리뷰와 구분한다. 새 main push runs **35491995616 / 35491995683**은 실제 merge SHA에서 실행됐다. PR CI를 main 증거로 재사용하지 않았다.

PR #28 freeze publication은 별도 실제 main SHA `bfef69cc35b23a1fb5077a6fc73f54bfaa12133e`에서 실행된 [App 35496169603](https://github.com/edward321416-maker/build-manager/actions/runs/35496169603) / [Repository 35496169579](https://github.com/edward321416-maker/build-manager/actions/runs/35496169579)로 확인했다. 두 run 모두 push/main attempt 1 SUCCESS이며 필수 9개 check와 foundation-gate 내부 7개 dependency가 모두 성공했다. PostgreSQL 86 tests, H01/H02 및 F23도 이 새 main 로그에서 PASS를 확인했다. 최종 병합·freeze 사건 2건은 [실행 로그](../../ops/AI_Execution_Log.csv)에 보존한다.

실제 PostgreSQL job은 **86 tests PASS**, PostgreSQL 18.6 및 실행된 numeric version assertion **180006**을 확인한다. R27-H01 swallowed-error 거부와 SAVEPOINT 복구, R27-H02 실제 idle backend 종료 뒤 복구, F23의 실제 Lock 관측 → SQLSTATE23505 → ACTIVE1이 포함된다. F18/F19/F23만 canonical PASS로 승격한다. F01/F16/F41/F43는 DB prerequisite만 존재하므로 계속 NOT_RUN이다.

C01–C04 PASS_ACCEPTED_EXECUTOR_EVIDENCE, C05–C09 PASS_GITHUB_CI, C10 PASS_MERGED_MAIN_PUBLIC_GATE, C11 PASS_PF00_D_EVIDENCE_RECONCILIATION, C12 PASS_PF00_C_PUBLICATION은 변경하지 않았다. C12는 PR #23의 PF00-C 공개를 의미한다.

현재 9개 project check는 기존 scanner3+14, Shared/Web 단위, Linux/Windows cold Mobile, Web E2E, lint/typecheck/build/dependency, pinned Doctor/Android·iOS JS export에 PostgreSQL integration을 포함한다. foundation-gate의 내부 dependency 7개는 모두 success여야 한다. CHECKS_AVAILABLE과 CHECKS_EXECUTED는 확인됐고 MERGE_ENFORCED/branch protection은 변경하지 않았다. 타입 검사·bundle export는 런타임 테스트·native build와 구분한다.

CodeRabbit은 **SUCCESS_STATUS / REVIEW_SKIPPED**이며 독립 검토 증거가 아니다. 실제 operator-side acceptance는 PF00-C/D, 수정된 PF02-A 구현 및 PR #28 evidence-finalization에 대해 별도로 제공됐다.

## 경계와 남은 위험

PF02-A는 합성·폐기 가능한 PostgreSQL 환경에서 승인된 7개 테이블, migration owner/runtime role 분리, transaction/RLS/FK/concurrency 기반을 검증했다. 서비스의 production-ready, launch-ready, real-user-ready, 보안·개인정보 검토 완료를 의미하지 않는다. Production DB hosting과 실제 tenant data는 NOT_AUTHORIZED다. B1의 Database-only Web identity/session 및 ORG_ADMIN 조회 API는 검증됐지만 production identity 운영, real-data pilot, 최종 운영 session/retention, 실제 property/unit/occupancy 운영은 미완료다. B2의 PROPERTY_STAFF assignment read scope는 완료됐으며 current exact app table inventory는 property_assignment를 포함한8개다. 기존7개 semantics/runtime matrix와 migration0001–0006 bytes는 보존된다. Staff invitation/assignment mutation·management UI, resident/ticket, Kakao/account linking/Mobile auth는 미완료 범위다.

- **OPEN_RISK / dependency-security-triage:** npm 14 moderate vulnerabilities, unrs-resolver install-script 경고 및 기존 PF02-A dependency hook/optional build 제한을 인수 기록에 유지한다. audit fix나 script 승인을 하지 않는다.
- **OPEN_RISK / ci-supply-chain-maintenance:** pinned v4 Actions의 오래된 내부 runtime 및 hosted Node24 forcing 경고. major upgrade는 별도 범위다.
- **보존된 Mobile RED:** 첫 Windows-mounted Ubuntu 실행에서 2/133 tests, 2/13 suites timeout 실패. 당시 cache 상태 UNKNOWN, ROOT_CAUSE_NOT_ESTABLISHED. Native ext4 및 hosted PASS는 별도 증거이며 TIMEOUT_NOT_REPRODUCED_ON_NATIVE_EXT4 분류를 바꾸지 않았다. timeout/config 수정이나 warm retry로 지운 실패가 아니다.
- **OPEN / LOW:** container startup/cleanup failure injection 및 concurrent stop은 별도 검증되지 않았다.

## 무결성과 다음 gate

[SHA256SUMS.json](SHA256SUMS.json)은 기존 **12개** 항목을 최종 UTF-8 bytes에서 다시 읽어 SHA-256/길이를 계산한 revision **1.1** manifest다. 항목 집합과 자기 자신 제외 설계는 유지한다. 변경하지 않은 파일도 새로 계산했으며 이전 1.0 값의 재사용을 증거로 삼지 않는다. 역사적 감사는 그대로 보존했다.

원본 ZIP/raw receipt/log/로컬 절대경로/인증값/외부 Google 목적지는 공개하지 않는다. Google Sheets/Drive는 **PENDING**이고 [기존 대기 큐](../../ops/pending_external_sync.md)를 유지한다.

PR #34 구현과 PR #35 canonical closure는 모두 MERGED이며 B1/B2는 VERIFIED / FROZEN, PF02-B 전체는 IN_PROGRESS다. Later PF02-B slices는 NOT_STARTED / NOT_YET_SCOPED이고 B3 범위는 정의하지 않으며, **현재 승인된 제품 구현 task는 없다**. operator가 later PF02-B slice를 별도로 scope/approve해야 한다. B1I-M01=CLOSED_BY_B2 (명시 discovery predicate + non-vacuous AC16 + candidate/main PostgreSQL 증거). 역사적 B1 receipt의 OPEN_HARDENING_BACKLOG는 수정하지 않는다. B1I-M02는 DOCUMENT_RECONCILED; B1 LOW6/B2 LOW4는 deferred/non-blocking이다. Auth0 Free entitlement, operational session/retention, real-data pilot, production hosting/credentials 및 complete security/privacy review는 계속 미검증/미완료다.
