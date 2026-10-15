# 쓰기 확인이 스스로 닫기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- 작성 시점: 이 계획은 구현과 함께 썼다(DEV-04 2단계를 구현 전에 따로 쓰지 않았다는 사실을 남긴다). 순서는 아래와 같이 지켰다: 실패 시험 → 구현 → 변형 시험 → 검사 → 독립 리뷰.

**Goal:** `scripts/demo-smoke.mjs --write-check`가 저장한 시험용 접수를 관리자 처리 완료와 세입자 해결 확인으로 닫는다.

**Architecture:** 페이지 안에서 도는 두 함수(`closeAsManager`, `confirmAsTenant`)를 내보내고, 쓰기 확인 저장 단계 뒤에 역할별 단계 두 개가 `page.evaluate`로 부른다. 접수 번호는 그 실행의 201 응답에서만 얻는다.

**Tech Stack:** Node 24.21.0, Playwright 1.63(`@playwright/test`), vitest 5(`vitest.shared.config.ts`).

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-10-15-smoke-write-check-closes-design.md`(운영자 2026-10-15 "승인 (추천)").
- 위험 등급: 고위험. 서버·API·DB·화면과 매시간 점검(`--http-only`)은 바꾸지 않는다.
- 출력에 주소·CSRF 값을 쓰지 않는다. 처리 메시지는 안전 판정 단어를 피한다.

### Task 1: 실패 시험 (`a73b948`)

- [x] `tests/architecture/demo-smoke.test.ts`에 "write check closes its own request" 묶음: 관리자 닫기 순서·머리글·본문, 처리 시작 거절 때 완료를 보내지 않음, 세션 없음, 세입자 확인과 다시 읽기, 메시지 안전 판정
- [x] 첫 실행: 5개 모두 "함수 없음"(구조적 실패)

### Task 2: 구현 (`729831f`)

- [x] `WRITE_CHECK_CLOSE_MESSAGES`, `closeAsManager`, `confirmAsTenant`(페이지의 `fetch`를 기본값으로)
- [x] `step()`이 성공 여부를 돌려준다. `enterManager`·`enterTenant` 도우미. 저장 단계가 201 응답의 `ticketId`를 화면 확인 전에 읽어 둔다.
- [x] 번호가 있을 때만 관리자 닫기 단계, 그것이 통과했을 때만 세입자 확인 단계
- [x] `scripts/demo-smoke.d.mts` 타입

### Task 3: 변형 시험과 문서 (`2c11833`)

- [x] 변형 6개(거절돼도 완료, CSRF 머리글 빠짐, 번호 인코딩 안 함, clientRequestId 빠짐, 다시 읽기 무시, 세션 확인 안 함): 처음 5개를 잡았고, 살아남은 "다시 읽기 무시"를 잡는 시험을 더해 6개 모두 잡음
- [x] `deploy/vm/README.md`의 `--write-check` 설명

### Task 4: 검사, 리뷰, 기록, PR, 병합 뒤 데모 확인

- [ ] DEV-06 검사(고정 Node), 새 문맥 독립 리뷰
- [ ] 수락 기록 `ops/smoke_write_check_closes_20261015_acceptance.md`, STATUS 줄, 실행 로그, 대기 동기화
- [ ] PR → CI → 병합
- [ ] 병합 뒤 운영자 승인 범위 안에서 데모에 `--write-check`를 한 번 돌려, 저장 → 닫힘 → 세입자 알림 0건을 확인하고 기록한다
