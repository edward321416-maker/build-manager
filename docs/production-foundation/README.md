# 출시 기반 기획 (production foundation)

Revision: **0.3 (저장소 등록본)**
상태: **REVIEWED_FOR_APPROVAL / IMPLEMENTATION_NOT_STARTED**
등록일: 2026-09-18
조사 기준: `main@6d0eaab3356b901e5ec8627c3a49e8730dd75a79` (등록 직전 원격에서 다시 확인함)

이 디렉터리는 출시 기반 기획의 canonical 위치다. 원본 패키지는 저장소 밖의 immutable reference로 보존하며, 여기에는 공개 검토를 통과한 문서만 등록한다.

## 읽는 순서

1. [전체 기획](00_foundation_blueprint.md) — 무엇을 먼저 만들고 어디에서 멈출지
2. [PF00 검증 기반](PF00_verification_foundation.md) — 설치·cold Mobile·전체 CI·증거 기반
3. [D06 런타임 결정](D06_runtime_decision.md) — exact Node/npm·러너·action 고정
4. [PF00-A/B 실행계획](PF00-A-B_implementation_plan.md) — 다음에 실행할 범위
5. [PF01 데이터·권한](PF01_data_authorization.md) — **검토 초안**, 승인된 정책이 아님
6. [기획 감사 기록](AUDIT_REPORT.md) — 16개 설계 보완과 56개 예정 검증 사례

기계 판독: [검증표](acceptance_cases.json), [단계 의존관계](phase_dependencies.json), [출처](sources/README.md).

## 승인 상태의 구분

| 대상 | 상태 |
|---|---|
| PF00 진단·검증 범위 | 승인 검토 대상 |
| D06 런타임 값 | **PLAN_DRAFT / DECISION_REQUIRED** — 운영자 확정 대기 |
| PF00-A/B 실행계획 | **PLAN_DRAFT** — D06 확정 전 실행 금지 |
| PF01 관계·권한 상세 | **검토 초안** — PF02 구현을 포괄 승인하지 않음 |
| PF02 이후 | 승인 대상 아님 |

문서 등록은 구현 승인이 아니다. 아래 56개 예정 시험(C01~C12, F01~F44)은 **전부 NOT_RUN**이다.

## 이번 등록에서 반영한 정정

앞선 검증 보고에 세 가지 정정이 필요했고, 실제 저장소에 대고 다시 확인했다.

**`typecheck:tests`는 CI 미실행 항목이 아니다.** root `package.json`의 `typecheck`가 내부에서 `npm run typecheck:tests`를 호출하고, `app-check.yml`이 `npm run typecheck`를 실행한다. 다만 타입 검사는 테스트의 런타임 실행을 대체하지 않는다.

**301/711 ≈ 42.3%는 코드 커버리지가 아니다.** 전달된 네 테스트 그룹의 **사례 수 비중**일 뿐이며, 검증된 기능 비율·안전성·출시 완성률이 아니다. 해당 개수는 과거 실행 보고에서 온 값이고 이번에 재실행한 수치가 아니다.

**Scanner는 "현재 자동 실행 연결이 없음"으로 기록한다.** `tests/test_verify_repository.py`와 `scripts/tests/test_verify_repository.py`가 존재하고 어느 workflow·npm script에서도 호출되지 않는 것은 확인했다. 그러나 과거 어느 환경에서도 실행된 적이 없다는 주장은 이력을 확인하지 않았으므로 하지 않는다.

현재 workflow가 직접·간접으로 연결하지 않은 주요 그룹은 `test:web`, `test:mobile`, `test:e2e:web`와 위 두 scanner unittest다.

## 등록에서 제외한 것과 이유

| 제외 | 이유 |
|---|---|
| 원본 ZIP | 저장소 밖 immutable reference로 보존 |
| 원본 `SHA256SUMS.json` | 등록본은 revision이 다르므로 새 checksum을 계산했다. 원본 16개 checksum을 수정본의 증거로 재사용하지 않는다 |
| `audit/AI_Execution_Log.csv` | raw 실행로그. 통째로 올리지 않고 이번 사건만 `ops/AI_Execution_Log.csv`에 append |
| `audit/tool_schema_index.json` | tool schema cache |
| `audit/pending_external_sync.md` | 저장소의 `ops/pending_external_sync.md`와 중복 canonical |
| `audit/baseline_receipt.json` 등 감사 영수증 | 이번 등록 직전의 fresh 확인으로 대체 |

로컬 절대경로, 외부 Google 목적지 ID, 인증값은 포함되지 않았음을 등록 전에 확인했다.

## 무결성

이 디렉터리의 등록 파일 해시는 [SHA256SUMS.json](SHA256SUMS.json)에 있다. 원본 패키지 16개 파일의 해시와는 **별개의 revision**이다.

## 외부 동기화

Google Drive/Sheets 전송은 수행하지 않았고 `PENDING`이다. 목적지 식별자와 인증값은 공개 문서에 포함하지 않는다.
