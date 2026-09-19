# 출시 기반 기획 (production foundation)

Revision: **0.6 (PF00 freeze 기록; supersedes 0.5)**
Snapshot: 2026-09-19
POLICY_REF: `main@333228163227d55d13e514fb9311ecb8b9dea615`
TARGET_REF / PF00-D publication: `6669c50ee5c2a07d40412a7162ddf381fa4698b1`
상태: **PF00 = FROZEN / VERIFIED BASELINE; PF00-D = ACCEPTED_AND_INTEGRATED**. PF01 = REVIEW_DRAFT; PF02 = NOT_AUTHORIZED / NOT_STARTED.

이 디렉터리는 production-foundation의 canonical 기획·검증 기록이다. PF00 구현은 PR #23으로 main에 통합됐고 실제 merged-main CI가 통과했다. PF00-D는 PR #24의 운영자 측 독립 인수, merge commit, 새 actual-main CI 통과를 완료했다. 이번 revision은 이미 충족된 freeze를 기록하며 새로운 제품 구현을 승인하지 않는다.

## 현재 상태와 증거

| 대상 | 상태 | 근거 |
| --- | --- | --- |
| Prototype / baseline MVP | INTEGRATED | 합성 Web/Mobile 흐름과 현재 main CI |
| PF00-A | VERIFIED_FROM_ACCEPTED_EXECUTOR_EVIDENCE | [A/B 인수 기록](../../ops/pf00_ab_acceptance.md); 로컬 재실행과 구분 |
| PF00-B | NOT_REPRODUCED_AT_SELECTED_TOOLCHAIN | OS별 독립 cold 3회 통과; root cause 미확정; timeout 변경 없음 |
| PF00-C | ACCEPTED_AND_INTEGRATED | [인수·실제 main 공개 증거](../../ops/pf00_c_acceptance.md) |
| PF00-D | ACCEPTED_AND_INTEGRATED | [독립 인수·freeze 기록](../../ops/pf00_d_acceptance.md); PR #24 병합과 실제 main 검증 |
| PF01 | REVIEW_DRAFT | [관계·권한 설계](PF01_data_authorization.md); 구현 승인 아님 |
| PF02 | NOT_AUTHORIZED / NOT_STARTED | F01–F44 모두 NOT_RUN |

Node **24.21.0 / bundled npm 11.19.0**을 유지한다. PF00-C에서 별도 승인한 Expo SDK 57 패치 네 개와 필요한 lockfile 변경은 통합됐으며, 보호 대상 플랫폼 키 67개가 모두 남아 있다. 이 숫자는 현재 관측값이며 영구 고정 규칙이 아니다.

## 읽는 순서

1. [PF00-D 독립 인수·freeze 기록](../../ops/pf00_d_acceptance.md) — 운영자 측 인수, PR #24 병합, 새 main CI와 freeze 경계.
2. [PF00-C 인수·공개 기록](../../ops/pf00_c_acceptance.md) — PR RED/GREEN, 실제 main CI, 독립 인수와 한계.
3. [A/B 승인된 실행자 증거](../../ops/pf00_ab_acceptance.md) — 실제 hosted-runner 증거와 구분.
4. [검증표](acceptance_cases.json) — C01–C12의 출처별 상태와 F01–F44 NOT_RUN.
5. [감사 기록](AUDIT_REPORT.md) — revision 0.6 freeze 정리와 보존된 revision 0.5·역사적 설계 감사.
6. [전체 기획](00_foundation_blueprint.md), [PF00 계획](PF00_verification_foundation.md), [D06](D06_runtime_decision.md), [A/B 계획](PF00-A-B_implementation_plan.md) — 각 작성 시점의 설계·승인·실행계획.
7. [PF01 설계](PF01_data_authorization.md), [단계 의존관계](phase_dependencies.json), [출처](sources/README.md) — 후속 검토 자료.

기존 blueprint/PF00/D06/A-B 계획의 과거 상태 문구는 역사적 snapshot으로 보존했다. 이후 실제 수행·현재 상태는 이 README, canonical 검증표, 연결된 ops 인수 기록을 따른다. 과거 NOT_RUN 문구를 현재 결과로 읽거나 PF01/PF02 실행 승인으로 확대하지 않는다.

## C01–C12 상태의 의미

C01–C04는 `PASS_ACCEPTED_EXECUTOR_EVIDENCE`, C05–C09는 `PASS_GITHUB_CI`, C10은 `PASS_MERGED_MAIN_PUBLIC_GATE`, C11은 `PASS_PF00_D_EVIDENCE_RECONCILIATION`, C12는 `PASS_PF00_C_PUBLICATION`이다. C12는 PR #23의 실제 main 공개를 가리키며 PF00-D 문서 PR의 병합을 뜻하지 않는다.

첫 PR 시도의 Doctor mismatch와 export NOT_RUN을 보존했다. 새 PR head의 GREEN과 실제 main push CI도 각각 기록했다. CodeRabbit은 **SUCCESS_STATUS / SKIPPED**이며 독립 코드 리뷰가 아니다. PF00-C와 PF00-D 독립 인수는 운영자 측 검토다. PF00-D는 원격 UTF-8 bytes에서 revision 0.5의 12/12 hash·byte 일치와 C/F 상태를 독립 확인했다. 실행자의 재조회와 운영자 측 인수는 구분한다.

## 검사 범위와 한계

현재 workflow는 scanner 직접 파일 실행(3 + 14), Shared/Web 단위, Linux/Windows cold Mobile, Web E2E, lint, typecheck, build, dependency, pinned Doctor와 Android/iOS JS export를 실행한다. `typecheck`에는 `typecheck:tests`가 포함되지만 타입 검사는 런타임 테스트가 아니다. 사례 수 비중은 코드 커버리지나 제품 완성률이 아니다.

`foundation-gate`는 필수 결과가 모두 success일 때만 통과한다. `CHECKS_AVAILABLE`과 `CHECKS_EXECUTED`는 확인됐고, `MERGE_ENFORCED`는 변경하지 않았다. branch protection을 새로 설정했다는 뜻이 아니다.

PF00 완료는 개발·검증 기반의 재현성과 사용 가능한 자동 검사 gate를 뜻한다. production-ready, launch-ready, real-user-ready를 뜻하지 않는다. Production auth/database, real identity와 real property/unit/occupancy persistence는 미구현이다. 실제 임차인 데이터는 승인되지 않았다. 보안·개인정보 작업은 완료되지 않았다.

## 남은 위험

- **OPEN_RISK / dependency-security-triage:** npm 14 moderate vulnerabilities 및 unrs-resolver install-script 경고. 별도 검토 전 audit fix/script 승인을 하지 않는다.
- **OPEN_RISK / ci-supply-chain-maintenance:** pinned v4 Actions의 오래된 내부 Node 대상과 hosted Node24 강제 실행 경고. Action major 갱신은 별도 범위다.

이 위험은 관측된 PF00-C 통과 증거를 소급 취소하지 않지만 private beta/release 전까지 명시적으로 유지한다.

## 무결성과 원본 보존

[SHA256SUMS.json](SHA256SUMS.json)은 기존 12개 항목의 최종 UTF-8 bytes/hash를 revision 0.6에서 모두 다시 계산한 manifest다. acceptance_cases.json은 bytes와 의미 모두 변경하지 않았다. 설계와 항목 집합은 유지하며 자기 자신을 해시하지 않는다. 변경 없는 파일의 해시가 같더라도 이번 바이트에서 재계산했다. 모든 값은 각 최종 파일의 현재 바이트에서 재계산했다. revision 0.5/원본 ZIP의 해시는 역사적 증거로 유지한다.

원본 ZIP, raw receipt/log, 로컬 절대경로, 외부 Google 목적지, 인증값은 공개하지 않는다. Google Sheets/Drive는 **PENDING**이며 [기존 대기 큐](../../ops/pending_external_sync.md)를 사용한다.

다음 활동은 **PF01 consequential-decision review**다. 운영자가 이미 해결한 결정을 유지하고, 실제 미해결 고영향 제품·보안·개인정보 결정만 검토한다. 사소한 구현 선택은 다시 질문하지 않는다. PF01 구현 또는 PF02를 시작하지 않는다.
