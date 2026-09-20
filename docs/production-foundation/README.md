# 출시 기반 기획 (production foundation)

Revision: **0.8 (PF02-A freeze closure; supersedes 0.7)**
Snapshot: 2026-09-20
POLICY_REF: `main@63c619c6bfa451155249ebc458b9d3ac053d0ed7` (PR #28 병합 전 확인한 정책)
TARGET_REF / PF02-A freeze closure: `bfef69cc35b23a1fb5077a6fc73f54bfaa12133e`
상태: **PF00 = FROZEN; PF02-A = VERIFIED / FROZEN**. PF01 = REVIEW_DRAFT; PF02-B = NOT_STARTED / D01 REQUIRED.

이 디렉터리는 production-foundation의 canonical 기획·검증 기록이다. 운영자 측 독립 재검토가 승인한 PR #27 head를 merge commit으로 통합한 뒤, 실제 merge SHA의 새 main CI 9개가 모두 성공했다. PR #28 head `07499b11b9117ca1642e9e02de9ff0e32ff3b8c3`도 운영자 측 독립 인수를 완료했고 merge commit으로 병합됐다. 실제 merge SHA의 새 main CI 9개가 모두 SUCCESS여서 PF02-A는 VERIFIED / FROZEN이다. Next gate는 PF02-B D01이며, PF02-B 구현은 시작하지 않았다.

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
| PF02-B | NOT_STARTED / D01 REQUIRED | 실제 identity/auth 및 후속 구현 시작 안 함 |

Node **24.21.0 / npm 11.19.0**, PostgreSQL **18.6**, pg **8.23.0**, @types/pg **8.23.1**, Testcontainers **12.1.0**, node-pg-migrate **9.0.0**을 유지한다. PostgreSQL adapter는 explicit SQL과 application ports를 사용하며 ORM을 도입하지 않았다. 보호 대상 플랫폼 lock key는 실제 집합 비교에서 67/67, 누락 0이었다. 숫자는 영구 계약이 아니다.

## 읽는 순서

1. [PF02-A 인수·공개 기록](../../ops/pf02_a_acceptance.md) — operator-side independent acceptance, merge parents, 이전 PR/RED와 새 main 증거 구분.
2. [현재 검증표](acceptance_cases.json) — C01–C12 출처 유지; F18/F19/F23만 PASS_POSTGRES_INTEGRATION, 나머지 41개 F-case NOT_RUN.
3. [revision 0.7 감사 기록](AUDIT_REPORT.md) — 당시 인수 후보 snapshot과 그대로 보존한 역사적 감사; 현재 freeze closure는 이 README를 따른다.
4. [승인된 PF02-A spec](../superpowers/specs/2026-09-19-pf02-a-postgres-foundation-design.md), [계획](../superpowers/plans/2026-09-19-pf02-a-postgres-foundation.md) — Separate Acceptance/Publication Phase 및 범위 경계.
5. [PF00-D freeze](../../ops/pf00_d_acceptance.md), [PF00-C 인수](../../ops/pf00_c_acceptance.md), [A/B 실행자 증거](../../ops/pf00_ab_acceptance.md).
6. [전체 기획](00_foundation_blueprint.md), [PF00 계획](PF00_verification_foundation.md), [D06](D06_runtime_decision.md), [A/B 계획](PF00-A-B_implementation_plan.md) — 각 작성 시점의 snapshot.
7. [PF01 설계](PF01_data_authorization.md), [단계 의존관계](phase_dependencies.json), [출처](sources/README.md) — 후속 검토 자료.

역사적 설계의 NOT_RUN/미승인 문구를 현재 결과로 읽거나 후속 구현 승인으로 확대하지 않는다. 이후 실제 수행·현재 상태는 이 README, canonical 검증표 및 연결된 ops 기록을 따른다.

## 증거 승격과 검사 범위

PF02-A 운영자 측 독립 재검토는 정확한 head `0fa5a9c14c9b57c6362f048b611c0148a3a76132`를 ACCEPTED했다. 실행자의 Git/로그 재조회 및 내부 코드 리뷰와 구분한다. 새 main push runs **35491995616 / 35491995683**은 실제 merge SHA에서 실행됐다. PR CI를 main 증거로 재사용하지 않았다.

PR #28 freeze publication은 별도 실제 main SHA `bfef69cc35b23a1fb5077a6fc73f54bfaa12133e`에서 실행된 [App 35496169603](https://github.com/edward321416-maker/build-manager/actions/runs/35496169603) / [Repository 35496169579](https://github.com/edward321416-maker/build-manager/actions/runs/35496169579)로 확인했다. 두 run 모두 push/main attempt 1 SUCCESS이며 필수 9개 check와 foundation-gate 내부 7개 dependency가 모두 성공했다. PostgreSQL 86 tests, H01/H02 및 F23도 이 새 main 로그에서 PASS를 확인했다. 최종 병합·freeze 사건 2건은 [실행 로그](../../ops/AI_Execution_Log.csv)에 보존한다.

실제 PostgreSQL job은 **86 tests PASS**, PostgreSQL 18.6 및 실행된 numeric version assertion **180006**을 확인한다. R27-H01 swallowed-error 거부와 SAVEPOINT 복구, R27-H02 실제 idle backend 종료 뒤 복구, F23의 실제 Lock 관측 → SQLSTATE23505 → ACTIVE1이 포함된다. F18/F19/F23만 canonical PASS로 승격한다. F01/F16/F41/F43는 DB prerequisite만 존재하므로 계속 NOT_RUN이다.

C01–C04 PASS_ACCEPTED_EXECUTOR_EVIDENCE, C05–C09 PASS_GITHUB_CI, C10 PASS_MERGED_MAIN_PUBLIC_GATE, C11 PASS_PF00_D_EVIDENCE_RECONCILIATION, C12 PASS_PF00_C_PUBLICATION은 변경하지 않았다. C12는 PR #23의 PF00-C 공개를 의미한다.

현재 9개 project check는 기존 scanner3+14, Shared/Web 단위, Linux/Windows cold Mobile, Web E2E, lint/typecheck/build/dependency, pinned Doctor/Android·iOS JS export에 PostgreSQL integration을 포함한다. foundation-gate의 내부 dependency 7개는 모두 success여야 한다. CHECKS_AVAILABLE과 CHECKS_EXECUTED는 확인됐고 MERGE_ENFORCED/branch protection은 변경하지 않았다. 타입 검사·bundle export는 런타임 테스트·native build와 구분한다.

CodeRabbit은 **SUCCESS_STATUS / REVIEW_SKIPPED**이며 독립 검토 증거가 아니다. 실제 operator-side acceptance는 PF00-C/D, 수정된 PF02-A 구현 및 PR #28 evidence-finalization에 대해 별도로 제공됐다.

## 경계와 남은 위험

PF02-A는 합성·폐기 가능한 PostgreSQL 환경에서 승인된 7개 테이블, migration owner/runtime role 분리, transaction/RLS/FK/concurrency 기반을 검증했다. 서비스의 production-ready, launch-ready, real-user-ready, 보안·개인정보 검토 완료를 의미하지 않는다. Production DB hosting과 실제 tenant data는 NOT_AUTHORIZED, real identity/auth는 NOT_IMPLEMENTED다. 실제 property/unit/occupancy 운영 및 API 권한 흐름은 후속 범위다.

- **OPEN_RISK / dependency-security-triage:** npm 14 moderate vulnerabilities, unrs-resolver install-script 경고 및 기존 PF02-A dependency hook/optional build 제한을 인수 기록에 유지한다. audit fix나 script 승인을 하지 않는다.
- **OPEN_RISK / ci-supply-chain-maintenance:** pinned v4 Actions의 오래된 내부 runtime 및 hosted Node24 forcing 경고. major upgrade는 별도 범위다.
- **보존된 Mobile RED:** 첫 Windows-mounted Ubuntu 실행에서 2/133 tests, 2/13 suites timeout 실패. 당시 cache 상태 UNKNOWN, ROOT_CAUSE_NOT_ESTABLISHED. Native ext4 및 hosted PASS는 별도 증거이며 TIMEOUT_NOT_REPRODUCED_ON_NATIVE_EXT4 분류를 바꾸지 않았다. timeout/config 수정이나 warm retry로 지운 실패가 아니다.
- **OPEN / LOW:** container startup/cleanup failure injection 및 concurrent stop은 별도 검증되지 않았다.

## 무결성과 다음 gate

[SHA256SUMS.json](SHA256SUMS.json)은 기존 **12개** 항목을 최종 UTF-8 bytes에서 다시 읽어 SHA-256/길이를 계산한 revision **0.8** manifest다. 항목 집합과 자기 자신 제외 설계는 유지한다. 변경하지 않은 파일도 새로 계산했으며 이전 0.7 값의 재사용을 증거로 삼지 않는다. 역사적 감사는 그대로 보존했다.

원본 ZIP/raw receipt/log/로컬 절대경로/인증값/외부 Google 목적지는 공개하지 않는다. Google Sheets/Drive는 **PENDING**이고 [기존 대기 큐](../../ops/pending_external_sync.md)를 유지한다.

PR #28은 MERGED이고 PF02-A는 VERIFIED / FROZEN이다. 다음 gate는 PF02-B D01 identity-provider/account-recovery consequential-decision review다. 운영자가 이미 해결한 결정을 반복 질문하지 않으며 PF02-B 구현은 시작하지 않는다.
