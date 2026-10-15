# Expo SDK 57 패치판 올리기 (2026-10-15) 설계

- 등급: 고위험. B5 AC17의 고정 의존성 목록(`STATUS.md`의 FROZEN 범위)을 다시 엽니다(개발 규칙 DEV-01). #97, #110, #130과 같은 흐름(DEV-04)을 따릅니다. 앞선 설계: `docs/superpowers/specs/2026-10-13-expo-sdk57-patch-design.md`
- 운영자 결정
  - 2026-10-15: Expo 패치판을 올리기로 했습니다("패치 올리기 (추천)").
  - 이 설계 문서의 승인은 아래 "결정" 절에 적습니다.

## 문제

- Expo가 2026-10-14 16:31–16:50 UTC에 SDK 57 패치판을 냈습니다.
- CI `mobile-health`의 고정 Expo Doctor 1.20.4가 "패키지 5개가 SDK 57이 기대하는 버전과 다르다"고 실패합니다(@expo/ui, expo, expo-constants, expo-linking, expo-router). `foundation-gate`도 이 결과를 모아 실패합니다.
- 저장소가 바뀌지 않았는데도 모든 PR이 막힙니다(확인: #156 run 38661248322, #155 run 38660815789). main `1d88457`의 마지막 CI는 통과했습니다.

## 바꾸는 것

- DEV-10대로 `apps/mobile`에서 `npx expo install --fix`(Node 24.21.0, npm 11.19.0)
  - 매니페스트 범위 4줄: @expo/ui `~57.0.24`, expo `~57.0.29`, expo-linking `~57.0.13`, expo-router `~57.0.27`
  - expo-constants 57.0.22는 지금 범위 `~57.0.20`에 맞으므로 잠금 파일만 바뀝니다.
  - `app.json`은 바뀌지 않았습니다. jest-expo는 그대로입니다(`57.0.6`).
- 잠금 파일에서 바뀐 항목은 13개입니다(`apps/mobile` 작업공간 항목 포함). 새로 생기거나 없어지는 항목은 없습니다.
  - @expo/cli 57.0.30, @expo/metro-runtime 57.0.17, @expo/prebuild-config 57.0.19, @expo/ui 57.0.24, @expo/xcpretty 4.4.7, expo 57.0.29, expo-asset 57.0.20, expo-constants 57.0.22, expo-linking 57.0.13, expo-modules-autolinking 57.0.16, expo-modules-core 57.0.23, expo-router 57.0.27
- AC17
  - `tests/architecture/expo-sdk57-patch-20261015-lock.json`: 13개 항목의 이전 값과 새 값의 해시
  - 시험은 검토 기록을 최신 것부터(10-15 → 10-13 → 10-10 → 10-08) 되돌린 뒤 원래 고정 해시와 비교합니다. 매니페스트도 10-15, 10-13 순서로 바뀐 줄만 글자 그대로 되돌립니다.
  - 10-15 기록 전용 부정 시험을 더합니다. 이번에 다시 바뀐 항목(expo-asset, expo-linking, expo)을 쓰던 예전 부정 시험은, 그 기록만 검토한 다른 항목으로 옮겨 원래 의도를 지킵니다.

## 위협·남용 사례

| 누가, 어떻게 | 막는 방법 |
| --- | --- |
| 패키지 계정이 털려 패치판에 악성 코드가 들어옴(공급망) | 공식 레지스트리입니다. 11개는 이전 판과 같은 게시자(alanhughes)가 냈습니다. @expo/xcpretty 4.4.7은 philpl이 냈는데, 등록된 관리자 13명 중 한 명이고 지금 쓰는 4.4.6도 같은 사람이 냈습니다. 바뀐 13개 항목에 설치 스크립트가 없고, 잠금 파일의 무결성 값이 파일을 고정합니다. 설치 때 나온 설치 스크립트 경고 4건(unrs-resolver, cpu-features, protobufjs, ssh2)은 원래 있던 패키지입니다. |
| 이 갱신에 섞여 검토하지 않은 다른 변화가 들어옴 | AC17이 13개 항목을 정확히 확인하고, 그 밖의 잠금 파일 변화는 모두 실패시킵니다. 부정 시험이 이를 확인합니다. |
| 운영 중인 웹 서버가 바뀐 코드를 실행함 | 웹(`apps/web`)은 Expo에 의존하지 않습니다. 이 PR만으로는 배포하지 않습니다. |
| 패치판의 동작 변화로 앱이 깨짐 | 앱 단위 시험, CI의 Android·iOS 내보내기로 확인합니다. 실제 기기 확인은 하지 않습니다(NOT_RUN). |
| 라이선스가 바뀜 | 13개 모두 MIT입니다(REF-07 허용). |

## 되돌리기

- 병합 커밋을 `git revert -m 1`로 되돌리면 잠금 파일, `apps/mobile/package.json`, 검토 기록, 시험이 함께 돌아갑니다. 데이터와 배포는 바뀌지 않습니다.
- 되돌리면 CI `mobile-health`는 다시 실패합니다.

## 시험

- 실패부터: 갱신한 잠금 파일에서 AC17 시험 5개가 실패했습니다(검토하지 않은 변화를 막음). 검토 기록을 더한 뒤 9/9 통과합니다. `npx expo install --check`는 "Dependencies are up to date", 고정 Expo Doctor 1.20.4는 21/21 통과합니다.
- DEV-06(코드·모바일): `test:shared`, `test:web`, `test:mobile`, `lint`, `typecheck`, `build:web`, `check:deps`, `verify_repository.py --history`
- DEV-04: `test:postgres`를 로컬에서도 돌립니다. 화면 시험은 CI(`web-e2e`)가 돌립니다. 바뀐 패키지가 웹 경로에 없습니다.
- DEV-10: `npm audit --omit=dev` 결과가 main과 같은지 확인합니다.

## 따로 두는 것

- Expo가 패치판을 낼 때마다 CI가 막히는 문제는 그대로입니다. Expo Doctor를 `EXPO_OFFLINE=1`로 돌리는 방법이 #130 때 제안됐지만, 워크플로가 AC17 고정 대상이고 새 패치판 소식을 놓치게 되어 운영자 결정이 필요한 별도 작업으로 남아 있습니다.

## 결정

- 2026-10-15 운영자가 이 설계를 승인했습니다("승인 (추천)"). 요약을 보고 결정했습니다: 공식 설치 명령으로 패키지 맞추기, 13개 항목만 허용하는 시험, 위 위험 점검과 되돌리기. 다른 선택지는 "승인, 재발 막기도 따로 제안"이었습니다.
