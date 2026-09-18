# D06 — 검증 런타임·러너·Action 고정

상태: **PLAN_DRAFT / DECISION_REQUIRED — 조회 근거 확보, 운영자 확정 대기**
날짜: 2026-09-18
조사 기준: `main@6d0eaab3356b901e5ec8627c3a49e8730dd75a79`

이 문서는 PF00-A/B 실행계획이 사용할 exact 런타임을 정한다. 이번 단계에서 수행한 것은 공식 배포 조회와 GitHub API 조회뿐이다. Node 설치, `npm ci`, 제품 테스트, workflow 수정은 수행하지 않았다.

## 1. 재현 환경과 지속 운영 환경의 분리

두 환경을 같은 값으로 두지 않는다.

| 구분 | 목적 | 값 | 근거 |
|---|---|---|---|
| 대조군 (재현용) | cold Mobile 최초 실패를 원래 조건에서 다시 만들기 | Node 24.14.0 / npm 11.9.0 | 과거 실행 보고에서 실패가 관측된 조합. 성능·보안 기준이 아님 |
| 지속 운영 후보 (CI) | PF00 이후 계속 사용할 검증 기준 | Node 24.21.0 / npm 11.19.0 | 아래 §2 |

과거 보고의 24.14.0을 "성공했으니 기준"으로 승격하지 않는다. 그 조합은 실패를 재현하기 위한 대조군이다.

## 2. Node 지속 운영 후보

공식 배포 index(`https://nodejs.org/dist/index.json`)를 조회한 결과다.

- 24.x 계열 릴리스: 29개
- 최신 24.x: **v24.21.0**, 2026-09-07, 동봉 npm **11.19.0**, LTS 코드네임 Krypton
- 과거 보고의 v24.14.0: 2026-02-24, 동봉 npm 11.9.0, `security: false`

**24.14.0 이후 24.x 계열에서 보안 릴리스로 표시된 것이 3건이다.**

| 버전 | 날짜 | 동봉 npm |
|---|---|---|
| v24.14.1 | 2026-03-24 | 11.11.0 |
| v24.17.0 | 2026-06-17 | 11.13.0 |
| v24.18.1 | 2026-07-28 | 11.16.0 |

즉 24.14.0은 자기 계열 안에서 보안 릴리스 3건만큼 뒤에 있다. 이것이 대조군을 지속 운영 기준으로 쓰지 않는 직접 근거다.

### 다운로드 무결성

`https://nodejs.org/dist/v24.21.0/SHASUMS256.txt`에서 확인했다. 총 34개 항목 중 대상 플랫폼 두 개는 다음과 같다.

| 파일 | SHA-256 |
|---|---|
| `node-v24.21.0-linux-x64.tar.xz` | `fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6` |
| `node-v24.21.0-win-x64.zip` | `158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541` |

**미확인 항목:** 실제 내려받아 설치하고 `node --version` / `npm --version` 영수증을 확보하는 일은 하지 않았다. PF00-A의 첫 단계가 이것이며, 그 전까지 이 조합을 `READY_FOR_EXECUTION`으로 쓰지 않는다.

## 3. 러너

| OS family | 제안 label | 성격 |
|---|---|---|
| Linux x64 | `ubuntu-24.04` | hosted runner의 OS label |
| Windows x64 | `windows-2025` | hosted runner의 OS label |

이 둘은 **immutable image digest가 아니다.** 같은 label이라도 이미지가 갱신된다. 따라서 실행마다 실제 image version, runner version, architecture, 도구 버전을 수집해 영수증에 남긴다. 표준 hosted runner에서 과거 image를 지정해 고정할 수 있다고 주장하지 않는다.

유료 custom runner나 자체 운영 runner 도입은 이번 범위가 아니다.

현재 workflow 두 개는 모두 `ubuntu-latest`를 쓴다. `latest`는 이동하는 별칭이므로 검증 기준으로 쓰지 않는다.

## 4. Action 고정

기존 major 유지가 기본이다. GitHub API로 tag를 실제 commit으로 해석한 값이다.

| Action | 사용 중 major | 해석된 full commit SHA |
|---|---|---|
| `actions/checkout` | v4 | `11d5960a326750d5838078e36cf38b85af677262` |
| `actions/setup-node` | v4 | `49933ea5288caeca8642d1e84afbd3f7d6820020` |

두 저장소의 최신 릴리스는 각각 v7 계열이다. major 상향은 이번 D06의 결정 대상이 아니며, 필요하면 별도 변경으로 다룬다. 이동하는 tag만으로 "고정했다"고 표현하지 않는다.

## 5. cold-test 변경 범위

### 진단 단계에서 허용

- 새 임시 `cacheDirectory`를 지정한 Mobile 전체 실행
- 같은 cache를 재사용한 warm 대조 실행
- 실행별 출력·소요시간·최초 실패 suite 보존

### 진단 단계에서 금지

- 기존 사용자 cache 삭제
- `--no-cache`를 새 cacheDirectory 진단의 대체물로 사용
- 실패 후 warm 성공만 보고
- `skip`, retry-until-green, `forceExit`, `passWithNoTests`
- 제품 코드·테스트 expectation 수정

### 수정 후보 (원인 입증 후에만)

초기 변환/부트스트랩 비용만이 원인으로 입증된 경우에 한해 다음을 후속 delta로 제안할 수 있다.

- `apps/mobile/package.json`의 Jest 설정 블록
- 필요성이 입증된 정확한 test-only setup/helper 경로

포함되지 않는 권한: `dependencies`/`devDependencies` 변경, 제품 코드 변경, 기존 Tenant assertion 변경.

최종 timeout 값은 측정 근거가 있어야 한다. 열린 handle, cleanup 누락, race, 제품 결함을 timeout으로 덮지 않는다. "30초로 늘리면 된다" 같은 선결론을 계획에 넣지 않는다.

## 6. 확정 대기 항목

| 항목 | 상태 | 확정 시점 |
|---|---|---|
| Node 24.21.0 / npm 11.19.0 채택 | 제안 | 운영자 확정 + PF00-A 설치 영수증 |
| `ubuntu-24.04` / `windows-2025` 채택 | 제안 | 운영자 확정 |
| action major 상향 여부 | 미결 | 별도 변경 |
| cold 원인과 최종 timeout 값 | 미결 | PF00-B 진단 결과 |
