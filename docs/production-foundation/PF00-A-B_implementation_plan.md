# PF00-A / PF00-B 실행계획

상태: **PLAN_DRAFT / DECISION_REQUIRED — D06 확정 전 실행 금지**
날짜: 2026-09-18
조사 기준: `main@6d0eaab3356b901e5ec8627c3a49e8730dd75a79`
선행 문서: [D06 런타임 결정](D06_runtime_decision.md), [PF00 검증 기반](PF00_verification_foundation.md)

이 계획의 범위는 **PF00-A와 PF00-B뿐이다.** PF00-C는 §6에 의존관계만 기록한다. 이 계획을 작성하는 동안 workflow 파일을 수정하지 않았고 제품 테스트를 실행하지 않았다.

## 1. 실행 조건

| 항목 | 값 |
|---|---|
| 작업 디렉터리 | 저장소 root. 명령마다 명시하며 상대경로에 의존하지 않는다 |
| shell | POSIX sh 또는 PowerShell. 두 OS에서 각각의 정확한 명령을 기록한다 |
| 실행 baseline | 착수 직전 원격에서 다시 조회한 feature/문서 ref. 과거 SHA를 재사용하지 않는다 |
| 종료코드 | 모든 단계에서 exit code를 직접 확인한다. 파이프 뒤 종료코드를 원본 명령의 결과로 쓰지 않는다 |
| 중단 규칙 | 승인되지 않은 파일 변경이 필요해지면 즉시 중단하고 보고한다. 범위를 넓히지 않는다 |

착수 전 `git status --short --untracked-files=all`로 사용자 소유의 미설명 변경이 없음을 확인한다. 있으면 보존하고 보고한다.

## 2. PF00-A — 지원 환경·설치 재현성

### A-1. 런타임 영수증

D06에서 제안한 조합을 실제로 설치해 확인한다.

1. 공식 배포를 내려받고 `SHASUMS256.txt`의 SHA-256과 대조한다. 대조 실패는 중단 사유다.
2. `node --version`, `npm --version` 출력을 그대로 기록한다.
3. 러너에서는 image version, runner version, architecture를 함께 수집한다.

기대: Node `v24.21.0`, npm `11.19.0`. 다른 값이 나오면 그 값을 기록하고 D06을 갱신한 뒤 재확정한다. alias(`24`, `latest`)만으로 동일하다고 쓰지 않는다.

### A-2. 깨끗한 설치

Linux와 Windows 각각에서, 같은 SHA의 새 작업 디렉터리에:

```
npm ci
git status --short --untracked-files=all
git diff -- package.json package-lock.json apps/mobile/package.json apps/mobile/app.json
```

기대: 양쪽 exit 0, tracked diff 0건. lockfile/manifest가 바뀌면 중단한다. 설치 실패는 환경·도구 문제로 분류하며 의존성 메타데이터 수정 허가가 아니다.

`package-lock.json`은 2026-09-18에 모든 플랫폼 바이너리를 포함하도록 보정되었다(63개 항목 추가). A-2는 그 보정이 두 OS에서 실제로 성립하는지 확인하는 단계이기도 하다.

### A-3. Web 빌드

```
npm run build:web
npm run check:deps
```

기대: 양쪽 exit 0. Linux에서 native 바이너리 누락으로 실패하면 §1의 중단 규칙을 따른다.

### A-4. 완료 조건

Linux/Windows 양쪽에서 설치·빌드·의존성 검사가 성공하고, 실제 OS·runtime·lock 해시가 영수증에 남았을 때.

## 3. PF00-B — cold Mobile 원인 진단

### B-1. 진단 원칙

이 단계의 목적은 **원인 규명**이지 초록불 만들기가 아니다.

- 최초 cold 실패는 실패로 보존한다. warm 재실행은 대조 자료로만 기록하며 cold 실패를 대체하지 않는다.
- 새 임시 `cacheDirectory`를 쓰는 진단과 `--no-cache`는 **다른 것**이다. 전자는 "비어 있는 캐시에서 시작"이고 후자는 "캐시를 쓰지 않음"이다. 전자를 기본으로 하고, 후자를 썼다면 그렇게 적는다.
- 기존 사용자 캐시를 삭제하지 않는다.

### B-2. 관측

각 실행마다 다음을 남긴다.

- 최초로 실패한 suite와 테스트 이름
- 해당 실행의 총 소요시간과 그 suite의 소요시간
- 실패 메시지 원문 분류(타임아웃 / 열린 handle / 단언 실패 / 기타)
- 사용한 cacheDirectory 경로와 그것이 비어 있었다는 근거

paired 실행: 같은 cacheDirectory로 곧바로 한 번 더 돌려 warm 결과를 기록한다. cold 실패 + warm 성공 조합은 "초기 변환 비용" 가설을 **지지할 뿐 증명하지 않는다.**

### B-3. 가설 분기

| 관측 | 다음 행동 |
|---|---|
| 최초 실패가 항상 첫 RN 렌더 suite이고 warm에서 사라짐 | 초기 변환/부트스트랩 비용 가설. B-4로 |
| 특정 suite에서만 재현 | 그 suite의 열린 handle·cleanup·race를 먼저 조사. timeout 조정 금지 |
| 실패 메시지가 타임아웃이 아님 | 제품 결함 가능성. 중단하고 보고 |

이전 실행 보고는 첫 RN 렌더 suite가 실패하고 warm에서 133/133 통과한 사례를 기록했다. 그것은 **실행자 보고이며 이번 계획의 재현 결과가 아니다.**

### B-4. 최소 수정 후보

원인이 초기 변환 비용으로 입증된 경우에만, 다음 범위에서 가장 작은 변경을 제안한다.

- `apps/mobile/package.json`의 Jest 설정 블록
- 필요성이 입증된 정확한 test-only setup/helper 경로

허가에 포함되지 않는 것: `dependencies`/`devDependencies`, 제품 코드, 기존 Tenant assertion.

timeout 값을 조정하는 경우 측정된 cold 소요시간을 근거로 제시한다. 근거 없는 고정값을 쓰지 않는다.

### B-5. 완료 조건

독립된 새 cache 3개, 두 OS에서 Mobile 전체 실행의 **첫 실행**이 모두 성공하고 필수 skip/todo가 없을 때. "무결함"이라는 통계적 주장은 하지 않는다.

## 4. 이 단계에서 하지 않는 것

- workflow 파일 수정
- PF00-C의 job 연결
- 제품 코드·Tenant 테스트 수정
- 의존성 추가·상향
- 실제 DB·인증 공급자 연결

## 5. Scanner 회귀 — 위치와 발견 방법 (PF00-C 준비)

현재 두 위치에 scanner unittest가 있고, **어느 workflow나 npm script에서도 호출되지 않는다.**

| 경로 | 프레임워크 | 정적 카운트 |
|---|---|---|
| `tests/test_verify_repository.py` | `unittest` | `def test` 3개 |
| `scripts/tests/test_verify_repository.py` | `unittest` | `def test` 14개 |

두 파일은 서로 다르다. 위 숫자는 소스를 읽어 센 값이며 **실행 결과가 아니다(NOT_RUN).**

PF00-C에서 실제 test ID로 발견할 때 쓸 명령:

```
python3 -m unittest discover -s tests -t . -v
python3 -m unittest discover -s scripts/tests -t . -v
```

두 파일 모두 저장소 root를 기준으로 `scripts` 패키지를 import하므로 top-level 디렉터리를 root(`-t .`)로 지정한다. 발견된 test ID 수가 0이면 성공으로 판정하지 않는다. 수집 0건과 통과 0건을 구분한다.

"현재 자동 실행 연결이 없음"과 "과거 어느 환경에서도 실행된 적 없음"은 다르다. 후자는 이력을 확인하지 않았으므로 주장하지 않는다.

## 6. PF00-C 의존관계 (최우선 후속)

PF00-C는 PF02 진입 전에 반드시 닫아야 하는 검증 공백이다. 다만 그것을 이유로 A/B 범위에 몰래 넣지 않는다.

| 항목 | 선행 | 이유 |
|---|---|---|
| **PF00-C-early** — Web 단위·E2E·scanner 회귀 연결 | PF00-A | B의 cold Mobile 결론을 기다릴 필요가 없다 |
| **PF00-C-mobile** — cold Mobile 및 나머지 health/bundle gate 연결 | PF00-A, PF00-B | B의 수정 결과를 반영해야 한다 |

현재 CI가 직접·간접으로 연결하지 않은 주요 그룹: `test:web`, `test:mobile`, `test:e2e:web`, 그리고 위 두 scanner unittest.

`typecheck:tests`는 예외다. root `typecheck`가 내부에서 호출하므로 **CI 미실행 항목이 아니다.** 다만 타입 검사는 테스트의 런타임 실행을 대체하지 않는다.

동일 workflow 파일을 여러 작업자가 동시에 수정하지 않는다. 실패 검사를 `skip`이나 `continue-on-error`로 덮어 성공으로 포장하지 않는다.

## 7. PF00 완료 판정

최종 집계에서 **모든 필수 검사가 실제로 실행되어 성공**해야 한다. 누락·`skipped`·`cancelled`인 필수 검사가 있으면 완료로 판정하지 않는다. 단계 중간의 제한된 CI 성공을 PF00 완료라고 표현하지 않는다.
