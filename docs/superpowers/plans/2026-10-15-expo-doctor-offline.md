# Expo Doctor 오프라인 점검과 매주 패치 알림 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- 작성 시점: 설계 승인 뒤, 구현 전에 썼다(DEV-04 2단계).

**Goal:** CI `mobile-health`의 Expo Doctor가 Expo의 새 패치판 때문에 실패하지 않게 하고, 새 패치판 소식은 매주 정기 실행의 실패 알림으로 받는다.

**Architecture:** Doctor 단계에만 `EXPO_OFFLINE: "1"`을 더한다. AC17은 그 2줄만 글자 그대로 되돌리는 투영으로 허용한다. 새 정기 워크플로가 매주 온라인 `npx expo install --check`를 돌린다.

**Tech Stack:** GitHub Actions(ubuntu-24.04), Node 24.21.0, npm 11.19.0, Expo Doctor 1.20.4, @expo/cli 57.0.30, vitest(`vitest.shared.config.ts`).

## Global Constraints

- 설계: `docs/superpowers/specs/2026-10-15-expo-doctor-offline-design.md`(운영자 2026-10-15 "A안 승인 (추천)")
- 위험 등급: 고위험(AC17 고정 워크플로, 새 워크플로)
- 바꾸지 않는 것: 잠금 파일, `package.json`들, 앱·웹 코드, 배포, `app-check.yml`의 다른 모든 글자
- 새 워크플로: `contents: read`만, 비밀 값 없음, 액션은 `app-check.yml`과 같은 커밋 SHA, `persist-credentials: false`, `pull_request_target` 없음(DEV-10)

### Task 1: AC17 실패부터

**Files:** `.github/workflows/app-check.yml`, `tests/architecture/b5-boundary.test.ts`

- [ ] Doctor 단계(`Verify pinned Expo Doctor and run health checks`)의 `working-directory: apps/mobile` 다음 줄에 `env:`와 `EXPO_OFFLINE: "1"`을 더한다.
- [ ] `npx vitest run --config vitest.shared.config.ts tests/architecture/b5-boundary.test.ts`: AC17 고정 시험과 Task12 투영 시험이 해시 불일치로 실패하는지 본다(행동 실패: 검토하지 않은 워크플로 변화를 막음).
- [ ] `projectExpoDoctorOffline(source)`: Doctor 단계의 정확한 새 글자(이름·shell·working-directory·env 2줄·run)가 한 번만 있어야 하고, 이를 예전 글자로 바꾼다. 고정 시험과 Task12 투영 시험이 해시 전에 이 투영을 먼저 적용한다.
- [ ] 부정 시험: 값 `"0"`, 값 따옴표 없음(`1`), 내보내기 단계에 붙음, 같은 단계에 변수 하나 더, Doctor 고정 버전 변경, 추가분 두 번 → 모두 실패
- [ ] 9/9 + 새 시험 통과

### Task 2: 새 워크플로 시험부터

**Files:** `tests/architecture/expo-updates-workflow.test.ts`, `.github/workflows/expo-updates.yml`

- [ ] 시험을 먼저 쓴다: 트리거는 `schedule`(주 1회 cron)과 `workflow_dispatch`만, 저장소 조건, `contents: read`만·쓰기 권한 없음, 액션 SHA 고정·`persist-credentials: false`, 비밀 값 없음, Node 24.21.0·npm 11.19.0 확인, `npm ci`, `apps/mobile`에서 `npx expo install --check`, `EXPO_OFFLINE` 없음, `concurrency`, `timeout-minutes`
- [ ] 실행: 파일이 없어 실패(구조적 실패)
- [ ] 워크플로를 쓴다. 머리말에 설계 경로, 알림 방식, 60일 비활성 규칙과 `gh workflow enable expo-updates.yml`
- [ ] 통과. 변형 시험: 고정 항목(트리거 추가, 쓰기 권한, 태그로 된 액션, 비밀 값, `EXPO_OFFLINE` 추가, 명령 바꿈)을 하나씩 깨뜨린 사본으로 시험이 잡는지 본다(scratchpad 스크립트, 파일은 되돌림).

### Task 3: 사고 재현과 오프라인 점검 확인

- [ ] 다른 세션에 무거운 실행을 알린다.
- [ ] main `1d88457`(10-14 패치판 직전)을 scratchpad에 단일 브랜치로 복제하고 고정 Node로 `npm ci`
- [ ] `apps/mobile`에서 온라인 `npx --yes expo-doctor@1.20.4 .` → 실패 기대, `EXPO_OFFLINE=1` → 통과 기대, 온라인 `npx expo install --check` → 실패 기대
- [ ] 같은 복제본의 `node_modules/expo/bundledNativeModules.json`에서 `expo-router` 값 하나를 바꾸고 `EXPO_OFFLINE=1` Doctor → 실패 기대, 되돌리고 → 통과 기대
- [ ] 결과를 수락 기록에 적고 복제본을 지운다.

### Task 3b: 독립 리뷰 반영(리뷰 뒤 추가)

- [x] 매주 점검: `EXPO_NO_CACHE: "1"`, 출력 저장, 오프라인 전환 경고("Networking has been disabled", "Unable to reach well-known versions endpoint", "offline-mode")에서 실패. 워크플로의 단계 글자를 그대로 꺼내 정상·서버 닿지 않음(DNS 실패 흉내)·패키지 뒤처짐 세 경우로 돌림
- [x] 워크플로 시험 강화(트리거 전체, `if:` 하나, `uses:` 공백, `secrets[...]`, 마지막 단계 전체 고정), 변형 28개
- [x] AC17 시험: 단계를 실제로 옮기는 경우와 복사하는 경우를 따로
- [x] 기록: "3줄" → "2줄", 재현 때 @expo/cli 57.0.29, 검사 시점

### Task 4: 검사와 기록

- [ ] DEV-06: `python scripts/verify_repository.py --history`(필요하면 단일 브랜치 복제본), `npm run test:shared`, `npm run lint`, `npm run typecheck`, `npm ci` 뒤 패키지 파일 변화 없음
- [ ] `ops/expo_doctor_offline_20261015_acceptance.md`, `STATUS.md` 한 줄, 실행 로그·대기 동기화 한 줄
- [ ] PR(본문 첫 줄 등급) → CI(`mobile-health` 로그에서 21/21) → 새 문맥 독립 리뷰 → 반영 → 병합
- [ ] 병합 뒤 `gh workflow run expo-updates.yml` 한 번, 결과를 실행 로그 후속 줄로
