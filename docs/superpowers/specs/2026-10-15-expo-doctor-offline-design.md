# Expo Doctor 오프라인 점검과 매주 패치 알림 설계

- 등급: 고위험. B5 AC17이 고정한 `.github/workflows/app-check.yml`(`STATUS.md`의 FROZEN 범위)을 바꾸고, 새 워크플로를 더합니다(개발 규칙 DEV-01, DEV-10). 흐름은 DEV-04를 따릅니다.
- 앞선 설계: `docs/superpowers/specs/2026-10-13-expo-sdk57-patch-design.md`, `docs/superpowers/specs/2026-10-15-expo-sdk57-patch-design.md`("따로 두는 것" 절에 이 일이 남아 있었습니다)
- 운영자 결정
  - 2026-10-15: 개발 세션이 다음 일 네 가지를 내고 "Expo 패치 재발 막기"를 추천했고, 운영자가 "이어서 진행해줘"라고 답했습니다. 이 설계 문서의 승인은 아래 "결정" 절에 적습니다.

## 문제

- CI `mobile-health`는 고정한 Expo Doctor 1.20.4로 21가지를 점검합니다. 그중 "설치된 패키지가 SDK 57이 기대하는 버전과 맞는가"는 Expo 서버에서 SDK 57의 최신 목록을 받아 비교합니다.
- Expo가 SDK 57 패치판을 내면 서버 목록이 바뀝니다. 우리 저장소는 그대로인데도 그 순간부터 모든 PR이 막힙니다.
  - 2026-10-12 패치판: 모든 PR이 막혔고, 고위험 PR #130(10-13 병합)으로 풀었습니다.
  - 2026-10-14 패치판: 모든 PR이 막혔고(#155, #156 포함), 고위험 PR #158(10-15 병합)으로 풀었습니다.
- 두 번 모두 설계 승인, 잠금 파일 검토 기록, 독립 리뷰를 거치느라 반나절씩 다른 일이 멈췄습니다.

## 확인한 사실

설치된 버전의 코드를 직접 읽고(REF-02 기술 구현), 이 PC에서 돌려 봤습니다(2026-10-15).

- Expo Doctor 1.20.4는 버전 점검을 직접 하지 않습니다. 프로젝트에 설치된 Expo 명령(`expo/bin/cli`)으로 `install --check --json`을 돌리고, 환경 변수를 그대로 넘깁니다.
- 설치된 Expo 명령(@expo/cli 57.0.30, 잠금 파일 값)은 `EXPO_OFFLINE`이 있으면
  - 서버 목록 두 가지(네이티브 모듈 목록, SDK 관련 패키지 목록)를 받지 않습니다.
  - 대신 설치된 `expo` 57.0.29 꾸러미에 들어 있는 `expo/bundledNativeModules.json`과 비교합니다. 이 파일은 잠금 파일이 고정하므로, Expo가 새 패치판을 내도 결과가 바뀌지 않습니다.
  - "Dependency validation is unreliable in offline-mode" 경고를 남깁니다(Doctor가 출력을 감춰서 CI 기록에는 안 보입니다).
- Doctor 자체 코드에는 오프라인 설정이 없습니다(React Native Directory 점검 등은 그대로 인터넷을 씁니다). 이 변수는 모든 점검이 쓰는 `expo config` 실행에도 넘어가지만, 결과는 온라인과 같았습니다(21/21).
- Expo 명령은 Expo 서버에 닿지 못하면(DNS 실패, 연결 시간 초과) 스스로 오프라인으로 바꾸고, 경고만 남긴 채 통과합니다(종료 코드 0). 이 PC에서 캐시 없이 DNS 실패를 흉내 내 확인했습니다. 연결 거부는 그냥 실패합니다.
- 오프라인에서도 계속 비교하는 것: 모바일 의존성 32개 중 24개(react, react-native, expo-router 등)
- 오프라인에서 빠지는 것: `expo` 본체가 최신 패치인지, `typescript`·`@types/react`(서버 목록에만 있음). 나머지 5개(@build-manager/api-client, @build-manager/api-contracts, @testing-library/react-native, @types/jest, eslint)는 원래 Expo 목록에 없습니다.
- main `1684080`, 이 PC(Node 24.21.0): 온라인 21/21, `EXPO_OFFLINE=1` 21/21 통과

참고: expo-doctor 1.20.4 — npm 레지스트리 패키지(로컬 캐시의 `build/index.js`, `InstalledDependencyVersionCheck`와 `spawnExpoCLI`), 확인 2026-10-15
가져온 것: 버전 점검이 프로젝트의 Expo 명령을 부르고 환경 변수를 넘긴다는 동작 사실
일부러 가져오지 않은 것: 코드(우리 저장소에 복사하지 않음)
라이선스: MIT

참고: @expo/cli 57.0.30 — `node_modules/@expo/cli/build/src/start/doctor/dependencies/bundledNativeModules.js`, `getVersionedPackages.js`, 확인 2026-10-15
가져온 것: `EXPO_OFFLINE`일 때 서버 목록 대신 `expo/bundledNativeModules.json`을 쓴다는 동작 사실
일부러 가져오지 않은 것: 코드
라이선스: MIT

## 선택지

| 선택지 | PR이 막히는가 | 새 패치판을 알게 되는가 | 비용 |
| --- | --- | --- | --- |
| A. 오프라인 점검 + 매주 알림 (추천) | 안 막힘 | 매주 월요일 실패 알림 메일 | 워크플로 1줄 + 새 워크플로 1개 |
| B. 오프라인 점검만 | 안 막힘 | 누가 직접 `npx expo install --check`를 돌릴 때만 | 워크플로 1줄 |
| C. 지금처럼 두기 | 패치판마다 막힘 | 막혀서 알게 됨 | 패치판마다 고위험 PR 하나 |

A를 추천합니다. PR은 우리 저장소가 바뀔 때만 실패하고, 새 패치판 소식은 매주 받아 올릴지를 운영자가 정합니다.

## 바꾸는 것 (A안)

1. `.github/workflows/app-check.yml`의 `mobile-health` 작업
   - "Verify pinned Expo Doctor and run health checks" 단계에만 `env: EXPO_OFFLINE: "1"`를 더합니다.
   - 같은 작업의 Android·iOS 내보내기 단계와 다른 모든 작업은 그대로입니다.
2. `tests/architecture/b5-boundary.test.ts`(AC17)
   - 고정 해시와 비교하기 전에 이 추가분만 글자 그대로 되돌리는 투영을 더합니다. 기존 Task12 투영과 같은 방식입니다. 그 밖의 모든 글자는 계속 해시로 묶입니다.
   - 부정 시험: 값이 `"1"`이 아님, 내보내기 단계에 붙음, 같은 단계에 다른 환경 변수가 더 붙음, Doctor 고정 버전이 바뀜, 추가분이 두 번 있음 → 모두 실패해야 합니다.
3. 새 `.github/workflows/expo-updates.yml`("Expo updates")
   - 매주 월요일 00:41 UTC(한국 시각 09:41)와 손으로 돌리기(`workflow_dispatch`)로만 돕니다. 이 저장소에서만 돕니다.
   - `contents: read` 권한만, 비밀 값 없음, 액션은 `app-check.yml`과 같은 커밋 SHA로 고정, `persist-credentials: false`
   - Node 24.21.0·npm 11.19.0 확인 → `npm ci` → `apps/mobile`에서 `npx expo install --check`(온라인, 캐시 없이 `EXPO_NO_CACHE: "1"`)
   - Expo 서버에 닿지 못해 Expo 명령이 오프라인으로 넘어간 경우("Networking has been disabled", "Unable to reach well-known versions endpoint", "offline-mode" 경고)에도 실패합니다. 그런 실행은 패치판 소식을 알려 주지 못하기 때문입니다(독립 리뷰 지적으로 더함).
   - 새 패치판이 나와 있으면 실패하고, GitHub가 cron 줄을 마지막으로 고친 사람(운영자 계정)에게 알립니다. `demo-health.yml`과 같은 방식입니다.
   - 공개 저장소에서 60일 동안 활동이 없으면 GitHub가 정기 워크플로를 끕니다. 그때는 `gh workflow enable expo-updates.yml`로 다시 켭니다(파일 머리말에 적음).
4. `tests/architecture/expo-updates-workflow.test.ts`: `demo-health-workflow.test.ts`처럼 트리거, 읽기 전용 권한, SHA 고정, 비밀 값 없음, 온라인 점검(`EXPO_OFFLINE` 없음), 시간 제한을 고정합니다.
5. 기록: `ops/` 수락 기록, `STATUS.md` 한 줄, 실행 로그 한 줄, 이 설계 문서의 "결정" 절

- 바꾸지 않는 것: 잠금 파일, `package.json`들, 앱 코드, 웹, 배포, 데모
- Expo 패키지를 올리는 PR은 지금처럼 온라인으로 `npx expo install --fix`/`--check`를 돌립니다(DEV-10).

## 위협·남용 사례

| 누가, 어떻게 | 막는 방법 |
| --- | --- |
| 오프라인 점검이 진짜 버전 문제를 놓침 | 설치된 `expo`가 기대하는 목록(24개)과는 계속 비교합니다. 서버 목록과의 비교는 매주 알림으로 옮깁니다. 아래 "시험 3·4"가 두 경우를 실제로 보여 줍니다. |
| 고정 범위를 바꾸는 김에 다른 변화가 섞임 | 투영은 정확히 그 2줄만 되돌리고, 나머지 글자는 계속 해시로 묶습니다. 부정 시험이 위치·값·추가 변수를 확인합니다. |
| Expo 서버에 닿지 못한 주에 매주 점검이 조용히 통과함 | 캐시를 쓰지 않고(`EXPO_NO_CACHE: "1"`), 출력에 오프라인 전환 경고가 있으면 실패합니다(독립 리뷰 지적으로 더함). |
| 새 워크플로가 권한을 남용하거나 남의 PR 코드로 돔 | 정기 실행과 손 실행만, 읽기 전용 토큰, 비밀 값 없음, SHA 고정, `pull_request_target` 없음. 시험이 이를 고정합니다. |
| 매주 알림이 조용히 꺼짐 | 60일 비활성 규칙을 파일 머리말에 적고, 수락 기록에 확인 방법(`gh workflow list`)을 남깁니다. |
| 알림을 받고도 패치판을 계속 안 올림 | 알림은 알리기만 합니다. 올릴지는 운영자가 정하고, 올릴 때는 #158과 같은 고위험 흐름을 씁니다. |
| Expo가 서버 목록만 바꾸고 `expo` 꾸러미 안 목록은 안 바꿈 | 매주 알림의 온라인 점검이 잡습니다. |

## 되돌리기

- 병합 커밋을 `git revert -m 1`로 되돌리면 워크플로 한 줄, 투영, 시험, 새 워크플로가 함께 돌아갑니다. 데이터·배포·잠금 파일은 바뀌지 않습니다.
- 되돌리면 다음 Expo 패치판 때 다시 모든 PR이 막힙니다.

## 시험 순서

1. 실패부터(AC17): `app-check.yml`에 2줄을 먼저 더하면 AC17 고정 시험이 해시 불일치로 실패하는지 봅니다. 투영을 더한 뒤 통과, 부정 시험 통과
2. 실패부터(새 워크플로): 시험을 먼저 쓰면 파일이 없어 실패합니다(구조적 실패). 워크플로를 더한 뒤 통과. 행동 증거는 각 고정 항목을 하나씩 깨뜨리는 변형 시험으로 확인합니다.
3. 사고 재현: 10-14 패치판 직전 상태(main `1d88457`)를 따로 복제해 `npm ci`
   - 온라인 Doctor: 실패해야 함("packages out of date") — 그날 CI가 막힌 그대로
   - `EXPO_OFFLINE=1` Doctor: 통과해야 함 — 이 설계라면 막히지 않았음
   - 온라인 `npx expo install --check`: 실패해야 함 — 매주 알림이 잡았을 내용
4. 오프라인도 진짜 점검인지: 같은 복제본에서 `expo/bundledNativeModules.json`의 버전 하나를 바꾸면 `EXPO_OFFLINE=1` Doctor가 실패하고, 되돌리면 통과하는지 봅니다.
5. DEV-06: `verify_repository.py --history`, `test:shared`, `lint`, `typecheck`, `npm ci` 뒤 패키지 파일 변화 없음. DEV-04 4단계의 `test:postgres`와 화면 시험은 PR CI(`postgres-integration`, `web-e2e`)가 돌립니다(DB·화면 코드를 건드리지 않음).
6. CI: PR의 `mobile-health`가 오프라인으로 21/21 통과하는지 기록을 봅니다.
7. 병합 뒤: `gh workflow run expo-updates.yml`로 한 번 손으로 돌려 통과하는지 봅니다(지금 main은 최신 패치판).
8. 새 문맥 독립 리뷰

## 결정

- 2026-10-15 운영자가 이 설계를 승인했습니다("A안 승인 (추천)"). 시각 설명 페이지(설계서와 같은 내용)를 보고 결정했습니다. 다른 선택지는 "B안: 오프라인 점검만"과 "C안: 지금처럼 두기"였습니다.
- 2026-10-15 독립 리뷰 뒤(운영자 새 결정 아님, 승인한 A안의 "새 패치판을 알린다"를 지키는 보강): 매주 점검이 Expo 서버에 닿지 못하면 조용히 통과하던 구멍을 막았습니다(캐시 끄기, 오프라인 전환 경고에서 실패).
