# PF00-A / PF00-B 실행계획

상태: **READY_FOR_BOOTSTRAP — 운영자 승인, merge/baseline gate 후 A 설치 및 B 진단만 실행**
정정일: 2026-09-19 (supersedes registered revision 0.3 실행 조건)
조사 기준: `main@6d0eaab3356b901e5ec8627c3a49e8730dd75a79`
선행 문서: [D06 런타임 결정](D06_runtime_decision.md), [PF00 검증 기반](PF00_verification_foundation.md)

이 계획의 범위는 **PF00-A와 PF00-B뿐이다.** PF00-C는 §6에 의존관계만 기록한다. 이 계획을 작성하는 동안 workflow 파일을 수정하지 않았고 제품 테스트를 실행하지 않았다.

## 1. 실행 조건

| 항목 | 값 |
|---|---|
| 작업 디렉터리 | 저장소 root. 명령마다 명시하며 상대경로에 의존하지 않는다 |
| shell | POSIX sh 또는 PowerShell. 두 OS에서 각각의 정확한 명령을 기록한다 |
| 실행 baseline | PR #22 merge commit 이후 fetch한 실제 main SHA를 PF00_EXECUTION_BASELINE으로 기록. 두 lane은 정확히 같은 SHA 사용. 이전 main/PR head 사용 금지 |
| 종료코드 | 모든 단계에서 exit code를 직접 확인한다. 파이프 뒤 종료코드를 원본 명령의 결과로 쓰지 않는다 |
| 중단 규칙 | 승인되지 않은 파일 변경이 필요해지면 즉시 중단하고 보고한다. 범위를 넓히지 않는다 |

착수 전 `git status --short --untracked-files=all`로 사용자 소유의 미설명 변경이 없음을 확인한다. 있으면 보존하고 보고한다.

### 1.1 PR #22 merge gate

문서·ops 로그 경로만 변경됐는지 확인하고 candidate index/public tree/reachable history 및 whitespace gate를 실행한다. PR head와 checks를 재조회하고, merge 직전 origin/main을 fetch하여 검토 base `6d0eaab3356b901e5ec8627c3a49e8730dd75a79`와 비교한다. 이동했다면 STOP_AND_REPORT; 자동 reconciliation 금지. 모든 gate가 유효하면 merge commit으로 병합하고 문서 브랜치를 보존한다. force push/amend/rebase/history rewrite는 금지한다. 병합 후 fetch한 exact main SHA와 merge parents를 확인해 PF00_EXECUTION_BASELINE으로 기록한다.

## 2. PF00-A — 지원 환경·설치 재현성

### A-1. 런타임 영수증

D06에서 선택한 Node 24.21.0 / bundled npm 11.19.0을 각 OS private tool 디렉터리에 설치한다. 사용자 전역 Node는 교체하지 않는다. READY_FOR_BOOTSTRAP은 설치를 검증하기 위한 실행 권한이며 설치 성공을 사전 조건으로 요구하지 않는다.

1. 공식 배포를 내려받고 `SHASUMS256.txt`의 SHA-256과 대조한다. 대조 실패는 중단 사유다.
2. `node --version`, `npm --version` 출력을 그대로 기록한다.
3. OS/environment type, architecture, node/npm executable path를 수집한다. hosted runner인 경우에만 실제 image/runner version도 기록한다.
4. WSL은 process.platform=linux, arch=x64, Linux binary와 Linux-linked npm을 입증한다. Windows node.exe/npm.cmd 호출은 Linux 증거가 아니다. 로컬 WSL을 GitHub-hosted ubuntu-24.04라고 보고하지 않는다.
5. checksum·버전·경로/플랫폼 검증 성공 후 lane별 TOOLCHAIN_VERIFIED를 기록한다.

기대: Node `v24.21.0`, npm `11.19.0`. 다른 값이 나오면 그 값을 기록하고 D06을 갱신한 뒤 재확정한다. alias(`24`, `latest`)만으로 동일하다고 쓰지 않는다.

### A-2. 깨끗한 설치

Linux와 Windows 각각에서, 동일 PF00_EXECUTION_BASELINE의 독립 fresh workspace를 사용한다. node_modules, Jest cache, 작업 디렉터리는 공유하지 않는다. 각 lane에서 source HEAD와 package-lock SHA-256을 설치 전후 기록한다.

저장소 root에서:

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

Linux/Windows 양쪽에서 npm ci/build:web/check:deps가 각각 exit 0이고 전체 tracked diff 및 manifest/lock diff가 0이며, 실제 OS·architecture·runtime 버전/경로·source HEAD·lock 해시가 영수증에 남았을 때 PF00_A_VERIFIED다. 한 필수 환경이 불가하면 그 lane은 ENVIRONMENT_BLOCKED이고 다른 lane 성공을 전체 A 성공으로 승격하지 않는다. B는 A의 선행 검사를 모두 통과한 lane에서만 시작한다.

## 3. PF00-B — cold Mobile 원인 진단

### B-1. 진단 원칙

이 단계는 **진단·측정만 승인**됐다. apps/mobile/package.json의 Jest 설정, testTimeout, Tenant assertion/test, 제품 코드, dependencies/devDependencies, workflow는 변경하지 않는다. systematic root-cause debugging으로 원인을 조사하며 설정 수정 전에 멈춰 증거와 최소 후속 제안만 보고한다.

- 최초 cold 실패는 실패로 보존한다. warm 재실행은 대조 자료로만 기록하며 cold 실패를 대체하지 않는다.
- 새 임시 `cacheDirectory`를 쓰는 진단과 `--no-cache`는 **다른 것**이다. 전자는 "비어 있는 캐시에서 시작"이고 후자는 "캐시를 쓰지 않음"이다. 전자를 기본으로 하고, 후자를 썼다면 그렇게 적는다.
- 기존 사용자 캐시를 삭제하지 않는다.

### B-2. 관측

각 실행마다 다음을 남긴다.

- 최초로 실패한 suite와 테스트 이름
- 해당 실행의 총 소요시간과 각 suite/test의 이름·상태·소요시간, exit code
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

첫 cold가 성공하면 두 개의 별도 새 cache를 더 사용해 lane별 독립 cold 총 3회를 측정한다. 매 cold 직후 동일 cache로 warm 1회를 비교한다. cache는 생성 전 부재 및 생성 직후 비어 있음을 기록하며 기존 cache를 삭제·변경하지 않는다. cold 실패가 생기면 원래 결과와 바로 다음 warm을 보존하고 근본원인을 조사한 뒤 수정 없이 보고한다. paired warm이 실패해도 해당 pair를 그대로 보존하고 진단 후 수정 없이 중단·보고하며, cold 성공으로 warm 실패를 가리지 않는다. 실패를 만들거나 성공까지 반복하지 않는다.

모든 cold 3회와 paired warm 3회가 성공하고 필수 skip/todo가 없으면 해당 lane은 NOT_REPRODUCED_AT_SELECTED_TOOLCHAIN이다. cold 3회는 성공했지만 warm이 실패했다면 cold 미재현 사실과 warm 실패를 별도로 기록하고 해당 lane 전체를 성공으로 판정하지 않는다. 이 경우 timeout 변경을 제안하지 않는다. 일부 lane만 실행되면 그 범위만 보고하며 PF00 전체 완료로 표현하지 않는다.

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

PF00-C의 미래 canonical 명령은 각 파일의 `unittest.main()`을 **별도 process**에서 직접 실행한다. 이번 A/B 작업에서는 실행하지 않으며 두 scanner unittest는 NOT_RUN이다.

POSIX (저장소 root):

```bash
PYTHONPATH="$PWD" python3 tests/test_verify_repository.py -v
PYTHONPATH="$PWD" python3 scripts/tests/test_verify_repository.py -v
```

PowerShell (저장소 root; 기존 환경은 finally에서 복원):

```powershell
$pf00HadPythonPath = Test-Path Env:PYTHONPATH
$pf00PreviousPythonPath = $env:PYTHONPATH
try {
    $env:PYTHONPATH = (Get-Location).Path
    python3 tests/test_verify_repository.py -v
    $pf00RootScannerExit = $LASTEXITCODE
    python3 scripts/tests/test_verify_repository.py -v
    $pf00ScriptScannerExit = $LASTEXITCODE
    if ($pf00RootScannerExit -ne 0 -or $pf00ScriptScannerExit -ne 0) {
        throw 'Scanner regression process failed'
    }
} finally {
    if ($pf00HadPythonPath) {
        $env:PYTHONPATH = $pf00PreviousPythonPath
    } else {
        Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue
    }
}
```

각 process는 repository root의 `scripts` import를 PYTHONPATH로 해석한다. 실제 verbose test ID·개수와 각각의 exit code를 기록하며 0-test 성공은 인정하지 않는다. unittest discover의 top-level import 가능성에 기대는 명령을 canonical로 사용하지 않는다.

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
