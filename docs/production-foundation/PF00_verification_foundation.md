# PF00 — 재현 가능한 개발·CI·검증 기반

버전: 0.1 / 2026-09-18
상태: **REVIEWED_FOR_APPROVAL — 구현 지시서 아님, 실행 전 세부 plan 필요**
기준: `main@6d0eaab3356b901e5ec8627c3a49e8730dd75a79`
관련: [전체 기획](00_foundation_blueprint.md), [감사 결과](AUDIT_REPORT.md)

## 1. 목표

다른 개발 PC와 CI 러너에서도 동일한 커밋을 설치하고, 같은 제품 동작과 보안 회귀를 검사할 수 있게 한다. 단순히 현재 초록불을 유지하는 것이 아니라 **누락된 검사·첫 실행 실패·증거 재사용**을 막는다.

현재 App checks는 Shared/lint/typecheck/Web build/dependency만 실행한다. Repository checks는 history scan/whitespace만 실행하며 scanner의 unittest는 실행하지 않는다. root `verify`도 전체 제품 시험이 아니다. [G02–G04]

Mobile cold-cache 타임아웃은 사용자 전달 실행 보고에서 확인된 현상이다. lazy transform이 원인이라는 설명은 아직 본 작업자가 재현하지 않았으므로 **가설**로 취급한다. 원인을 확인하기 전에 timeout을 올리거나 Tenant test를 수정하지 않는다.

## 2. 현재 단계의 비목표

로그인/실DB/권한/사진/알림/AI 구현, SDK 대규모 upgrade, 제품 UI 변경, scanner 예외 확대, 원격 branch protection/IAM 변경은 PF00에 포함하지 않는다. 과거 frozen 커밋을 수정하지 않는다.

## 3. 조사·수정 후보 파일과 경계

| 파일/경로 | 역할 | 제안된 변경 허용 조건 |
|---|---|---|
| `.github/workflows/app-check.yml` | 실제 제품 검사 연결 | 잡 분리·실행 SHA·기존 major action의 verified full SHA pin |
| `.github/workflows/repository-check.yml` | 공개 검사와 scanner 회귀 | 두 unittest 발견 경로 추가·0 tests 성공 방지 |
| `.nvmrc`, `package.json` | 실행 도구·검사 진입점 | 선택된 Node24 patch/npm 기록 또는 검증 script 연결만; dependency upgrade 아님 |
| `apps/mobile/package.json` | Jest 환경 | 입증된 cold initialization만 최소 조정; dependencies/devDependencies는 불변 |
| `scripts/ci/**` (신규 후보) | cross-platform 검증 wrapper | 실제 실행계획에서 정확한 파일명·기능·검증을 승인 |
| `tests/test_verify_repository.py`, `scripts/tests/test_verify_repository.py` | 기존 scanner regression | 먼저 그대로 실행; 실패를 PASS로 만드는 expectation 변경 금지 |
| `STATUS.md`, `ops/**` | 검증 범위·미해결 이슈·영수증 | 실제 실행과 보고를 구분, 과거 로그 원문 보존 |

위 표는 실행 승인 전 설계 working set이다. wildcard 전체를 수정 허용한 것이 아니다. 새 helper·설정 변화의 정확한 경로는 다음 plan에서 고정한다. scanner 구현 `scripts/verify_repository.py`는 기본 read-only다. 회귀가 scanner 문제를 입증하면 별도 제한 범위로 판단한다.

## 4. PF00-A — 설치와 실행 환경

### 4.1 런타임 계약

Node는 현재 repository의 24.x 범위 내에서 고정한다. 실제 후보 patch의 지원·보안 상태와 npm 호환을 공식 자료로 확인한 뒤, 실행계획에 exact Node/npm을 기록한다. 이전 실행자의 `24.14.0 / 11.9.0`은 과거 영수증일 뿐 현재 권장 최신값으로 자동 승격하지 않는다. patch 선택이 보안 업데이트를 요구하면 작은 변경으로 별도 기록한다.

지원 기본 환경은 Linux x64(glibc, 서버/CI)와 Windows x64(개발)다. macOS/iOS native 검증은 후속 실기기·서명 단계이며 Android/iOS JS export와 같지 않다. 지원 OS runner image와 실제 image version을 기록하고 `ubuntu-latest` 등 이동 alias만으로 재현 가능성을 주장하지 않는다.

### 4.2 깨끗한 설치

실행 승인이 난 뒤 새 disposable worktree/CI workspace에서 npm ci를 사용한다. 이것이 기존 node_modules를 지우는 명령이라는 점을 고려해 사용자 작업 폴더의 임의 설치 상태를 덮어쓰지 않는다. npm cache와 Jest transform cache는 별도다. npm 다운로드 cache는 써도 되지만 node_modules를 작업 간 복사하지 않는다. [S03]

설치 전후 전체 tracked tree diff 및 package/lock bytes를 비교한다. optional platform package가 빠지는지 Linux/Windows 각각에서 설치·Web build를 실행한다. 플랫폼 패키지 수 63개를 영구 목표로 고정하지 않는다. 락파일은 JSON 파싱과 무결성 메타데이터, 동일한 직접의존성 graph, 실제 플랫폼 로딩을 함께 확인한다.

다음 의존성 업데이트에서 문제가 재발하면 수동 lock 주입을 상시 운영 규칙으로 만들지 않고 npm 버전/생성 환경/재현 절차를 조사한다. npm 일반 동작을 '항상 호스트 패키지만 기록'한다고 단정하지 않는다.

## 5. PF00-B — cold Mobile 진단과 개선

### 5.1 삭제 없는 cold 재현

매 실행에 **존재하지 않던 새 임시 cacheDirectory**를 할당한다. shared Jest cache 삭제, 전체 폴더 청소, node_modules 무단 삭제는 하지 않는다. --no-cache는 cache disabled 조건이며 '처음 비어 있다가 채워지는 cache'와 다르므로 cold 기준을 대신하지 않는다. Jest 29.7은 설정을 CLI로 전달할 수 있고 cacheDirectory 및 timeout 관련 설정을 제공한다. [S01–S02]

동일 커밋·설치·runner에서 다음을 구분한다.

1. 전체 Mobile suite + 새 cacheDirectory.
2. 같은 cacheDirectory의 warm 진단 실행.
3. 새 cacheDirectory에서 frozen Tenant의 최초 렌더 대표 test만 실행.
4. 다른 새 cacheDirectory에서 Hero B 최초 렌더 test만 실행.

실행 순서, Jest/transformer 버전, 원래 timeout, 시작 suite, 시작/종료 시각, 전체 결과와 실패 이름, 비밀 제거된 stack 범주를 남긴다. warm 재실행 성공이 앞선 cold 실패를 지우지 않는다. cache 초기화와 lazy import/render, 열린 handle·미완료 Promise·실제 UI 오류를 구분한다. 일부 파일에만 큰 timeout을 준 기존 Hero B correction도 범위를 조사하되 승인 없이 지우거나 과거 의미를 바꾸지 않는다.

### 5.2 수정 허용 기준

- 열린 handle, cleanup 누락, 외부 요청, assertion race라면 해당 원인부터 해결한다. timeout 확대를 기본값으로 삼지 않는다.
- 초기 변환/부트스트랩 비용만 입증되면 test bootstrap을 test setup으로 분리하거나 공통 테스트 timeout을 정당화하는 두 안 중 부작용이 작은 안을 택한다.
- 테스트 환경 변경은 제품 성능 최적화라고 부르지 않는다. 앱 응답시간 성능시험은 별도다.
- 원래 test expectation, Safety/Protocol/권한 경계, 오류 검증, test discovery를 완화하지 않는다. skip, retry-until-green, forceExit, passWithNoTests, snapshot 일괄 갱신은 금지한다.
- 최종 timeout 숫자는 측정 후 plan delta에 근거를 남긴다. 진단용 임시 CLI timeout 성공과 최종 공통설정 성공을 분리한다. 측정 없이 '30초면 충분하다'고 먼저 고정하지 않는다.
- frozen 제품 파일을 바꿔야 한다면 작은 결함 보고와 변경 범위를 먼저 승인받는다.

### 5.3 수용 기준

커미셔닝 기준으로 Linux/Windows 각각 독립된 새 cacheDirectory의 전체 Mobile suite **3회**를 요구하는 것을 제안한다. 3회는 우리 회귀 기준이지 통계적 무결함 증명은 아니다. 매번 전체 suite가 발견되고, failed/skipped/todo로 누락된 필수 시험이 없고, Node 프로세스가 정상 종료되어야 한다. 반복 실패는 하나라도 기록하며 성공한 run만 선택하지 않는다.

이후 일반 PR마다 각 OS에서 한 번씩 cold Mobile 전체 실행을 기본으로 한다. time budget이 부족하면 job을 분리하며 검사를 몰래 없애지 않는다. 지원 OS 축소는 명시적 결정이다.

## 6. PF00-C — CI 검사 행렬

| 잡 | 환경 | 필수 내용 | 금지되는 과장 |
|---|---|---|---|
| repository-safety | Linux | staged/tree/history 검사 + 두 scanner unittest 경로 + whitespace | regex scanner = 종합 보안검사 아님 |
| core-web | Linux | Shared, Web 단위, lint, packages/tests/Web/Mobile typecheck, Web build, dependency | typecheck = 실제 Mobile 실행 아님 |
| mobile-cold-linux | Linux | fresh install + 새 Jest cache 전체 Mobile | warm 성공으로 대체 안 됨 |
| install-mobile-windows | Windows | fresh install, lock 불변, Web build, dependency, 새 cache 전체 Mobile | WSL의 Windows npm을 Linux 시험으로 세지 않음 |
| web-e2e | Linux | 현재 Playwright 전체, Hero B 포함, 실제 Web/API | mock fixture 테스트만으로 대체 안 됨 |
| mobile-health | Linux | pinned Doctor + Android/iOS 새 JS export | native build/device 검증 아님 |
| foundation-gate | 의존 잡 집계 | 모든 필수 잡 완료/성공, skipped/cancelled/missing는 승인 실패 | 초록이 아닌 '검사 없음'을 PASS로 세지 않음 |

현재 repository scripts의 실제 명칭은 `test:shared`, `test:web`, `test:mobile`, `test:e2e:web`, `lint`, `typecheck`, `typecheck:tests`, `build:web`, `check:deps`다. typecheck가 tests를 이미 호출하는 중복은 plan에서 실행 의미를 유지하면서 제거 가능하다. [G04]

scanner regression은 기존 `tests`와 `scripts/tests` 두 발견 위치를 모두 확인한다. 명령 exit 0뿐 아니라 실제 test id 목록/개수도 남긴다. test 0개가 발견되어 성공하는 상황을 금지한다. repository-check 현재 코드를 변경해 scan 패턴을 완화하는 작업과, 그 코드의 시험을 CI에 연결하는 작업은 별개다. [G03]

합성 E2E DB/포트는 동시 작업마다 격리한다. 테스트 reset은 disposable synthetic DB에서만 가능해야 한다. 실제 데이터 삭제를 허가하는 것과 다르다.

### 6.1 외부 Doctor의 변동성

Doctor 실행파일 pin과 SDK 호환성 원격 메타데이터의 고정은 다르다. `expo-doctor@1.20.4`는 기존 기준 도구이며 exact 버전·관측 시각·설치 dependency·사용된 매핑의 확인 가능한 식별자를 함께 기록한다. 원격 기대값이 바뀌어 실패해도 제외 설정이나 자동 upgrade로 숨기지 않는다. 프로젝트 실패와 도구/네트워크 실패를 분류하고 release gate는 통과시키지 않는다. 도구 또는 SDK patch 갱신은 별도 최소 변경으로 제안한다.

### 6.2 CI 공급망·권한

PR에는 production secret을 주입하지 않는다. `pull_request_target`로 비신뢰 branch를 받아 실행하지 않는다. third-party action은 공식 저장소에서 확인한 full commit SHA를 사용하고 최소 `contents: read` 권한을 유지한다. 실패 artifact에는 실제 사람 자료·토큰·환경변수 값이 들어가지 않는다. [S04]

필수 job 집계는 workflow 산출물이다. 이것과 GitHub branch rules로 merge를 강제 차단하는 것은 다르다. 현재 Write 협업·merge 원칙은 유지하며, 보호 규칙 변경은 실제 대상/효과를 설명한 별도 승인 없이는 하지 않는다. 기록에서는 `CHECKS_AVAILABLE`, `CHECKS_EXECUTED`, `MERGE_ENFORCED`를 구분한다.

## 7. PF00-D — 증거와 문서 정리

모든 결과에 commit/tree SHA, OS/image, exact Node/npm/Jest/Doctor, lock hash, 실행 명령·작업 디렉터리, 시작/끝, exit code, test discovery와 결과 수를 남긴다. 임시 경로에는 새 run 식별자를 쓰고 이전 생성물은 재사용하지 않는다. 아티팩트를 제출하기 전 비밀·개인정보를 검사한다.

STATUS에는 '구현 시작'이라는 과거 snapshot 대신 main 통합 완료, 전체 자동검증의 실제 범위, 실서비스 기반 미완료를 구분한다. ops 실행 로그는 과거행 재작성 없이 새 이벤트를 추가한다. 과거 숫자를 현재 runtime 실행처럼 복사하지 않는다.

검증된 입력 tree와 실제 원격 publication tree의 차이를 확인한다. 다른 파일이 뒤늦게 바뀌었으면 의존되는 gate를 다시 실행한다. main에 code를 직접 덮어쓰거나 기존 feature를 reset하지 않는다.

## 8. 완료 Gate와 중단 조건

검증 사례는 acceptance_cases.json의 C01~C12다. 모두 실제 실행 증거가 있어야 `PF00_VERIFIED`가 된다. 지금은 **12개 모두 NOT_RUN**이다.

중단: runtime/lock 드리프트, 새 product defect, discovery 누락, scanner 회귀 실패, 새 캐시 실패, 실패 은폐 설정, 원격 SHA 이동, 비승인 경로 수정, secret/개인정보 탐지. 중단은 이미 작성한 기획 초안을 버리거나 다른 모듈을 재설계할 근거는 아니다.

PF00 완료는 production launch 완료가 아니다. 다음 구현은 승인된 PF01 계약을 사용하는 PF02다.
