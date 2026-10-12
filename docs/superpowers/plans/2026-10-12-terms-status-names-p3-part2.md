# 용어·상태 이름 정리 묶음 2 구현 계획 (날짜 형식과 진행 이력)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 웹의 모든 날짜·시간이 디자인 규칙 14절 형식 하나로 보이고, 진행 이력이 같은 사람의 이어진 같은 기록을 한 줄로 묶는다.

**Architecture:** `apps/web/src/lib/date-text.ts`가 글자 모양을 만든다. `/core`는 브라우저 시간대, 업체 관련 화면은 지금처럼 서울 시간(`lib/vendor-time.ts`)이고, 둘 다 같은 글자 모양 함수를 쓴다. 화면은 `components/date-time.tsx`의 `<DateTime>`으로 `<time>`을 그린다. 진행 이력 묶기는 `app/core/history-lines.ts`의 순수 함수다.

**Tech Stack:** Next.js 16, React 19, `Intl.DateTimeFormat`, vitest, Playwright

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-10-12-terms-status-names-p3-design.md` 묶음 2 (운영자 승인 2026-10-12)
- 위험 등급: 일반. 서버·DB·API는 그대로다.
- 형식(규칙 14절): 올해 `10월 12일 (토) 오후 2:00`, 다른 해 `2025년 3월 2일 오후 2:00`, 정오 `오후 12:00`, 자정 `오전 12:00`, 1시간 안의 지난 시각 `방금`·`10분 전`, 앞으로의 시각은 날짜와 시간. 방문 시간대는 `오후 2:00–4:00`(지금 업체 형식 유지).
- 상대 시간을 보이는 곳은 `title`에 날짜와 시간을 둔다.
- 화면 코드는 상대 경로만 쓴다(vitest가 `@/` 별칭을 풀지 못함).
- 규칙 대상 파일(`apps/**`, `docs/**`)은 편집 도구로만 고친다(DEV-05).

---

### Task 1: 날짜 글자 함수

**Files:** Create `apps/web/src/lib/date-text.ts`, `apps/web/src/lib/date-text.test.ts`

**Produces:** `ClockParts`, `clockParts(at, timeZone?)`, `dateText(parts, currentYear)`, `timeText(parts)`, `clockText(parts)`, `meridiem(parts)`, `formatDateTime(at, {now?, timeZone?, relative?})`

- [ ] 시험: 올해·다른 해, 정오·자정, 방금(30초 전), 59분 전, 61분 전(날짜와 시간), 앞으로 10분 뒤(날짜와 시간), `relative:false`, 같은 순간을 `Asia/Seoul`과 `UTC`로 다르게 그림. 파일 없음으로 실패 확인
- [ ] 구현: `Intl.DateTimeFormat("en-US",{timeZone,year,month,day,weekday:"short",hour,minute,hourCycle:"h23"}).formatToParts`로 숫자를 얻고, 요일은 `일월화수목금토`로 바꾼다.
- [ ] 통과 확인, 커밋 `feat(web): add one formatter for dates and times`

### Task 2: 업체 시간 글자를 같은 함수로

**Files:** Modify `apps/web/src/lib/vendor-time.ts`. Tests: `lib/vendor-time.test.ts`, `app/core/vendor-handoff-manager-schedule.test.tsx`, `app/core/vendor-handoff-manager.test.tsx`, `app/core/vendor-handoff-tenant.test.tsx`, `app/vendor/job/vendor-job-screen.test.tsx`

- [ ] 시험 기대값을 바꾼다: `일(요` → `일 (요`. 각 파일에서 `일(`은 모두 날짜다(개수 확인함). 다른 해 날짜는 요일 없이 `2027년 1월 3일 오후 10:00`. 실패 확인
- [ ] `vendor-time.ts`의 `datePart`·`meridiem`·`clock`을 `dateText`·`meridiem`·`clockText`로 바꾼다. 서울 고정 시차 계산은 그대로 둔다.
- [ ] 통과 확인, 커밋 `fix(web): space the weekday and drop it for other years in Vendor times`

### Task 3: `<DateTime>`과 `/core` 적용

**Files:** Create `apps/web/src/components/date-time.tsx`. Modify `app/core/core-screen.tsx`(진행 이력), `app/core/ticket-communication.tsx`(메시지), `app/core/ticket-outcome.tsx`(결과 시각), `app/core/manager-work.tsx`(처리 예정, `relative={false}`), `app/core/manager-maintenance-timeline.tsx`, `app/core/ui/core-display.tsx`(초대 시각). Test: `components/date-time.test.tsx`, 바뀐 화면의 기존 시험

- [ ] `<DateTime at now? relative?>`: `<time dateTime={at} title={상대 시간일 때만 날짜와 시간}>`. 시험: 상대 시간에 title, 날짜 표시에는 title 없음
- [ ] 위 파일의 `toLocaleString`을 모두 `<DateTime>`으로 바꾼다. `rg toLocaleString apps/web/src/app/core` 결과가 비어야 한다.
- [ ] 커밋 `fix(web): show /core dates in the design rules format`

### Task 4: 진행 이력 묶기와 보낸 요청 판단 하나로

**Files:** Create `app/core/history-lines.ts`, `app/core/history-lines.test.ts`. Modify `core-screen.tsx`, `app/core/ui/work-status-badge.tsx`

- [ ] `historyLines(events)`: 같은 사람·같은 종류·메시지 없음이 이어지면 한 줄, `{이름} {n}건`, 시각은 마지막 기록. 이름: 접수 내용 저장, 질문 답변, 증빙 사진 지정, 수리 요청 제출, 추가 확인 요청, 처리 방법 결정, 처리 기록, 그 밖은 접수 정보 변경. 시험: 이어진 답변 8건 → 한 줄, 사람이 바뀌면 끊김, 메시지가 있으면 따로, 순서 유지
- [ ] `intakeDisplayStatus`가 `sentIntakeStatus`를 쓴다(묶음 1 차이 재리뷰 Nit). 기존 시험 통과 확인
- [ ] 커밋 `fix(web): group repeated history lines and keep one sent-request rule`

### Task 5: 검사, 기록, PR

- [ ] `npm run test:web`, `test:shared`, `lint`, `typecheck`, `build:web`, `check:deps`, `python scripts/verify_repository.py --history`
- [ ] `test:e2e:core`, `test:e2e:sdk`, `test:e2e:vendor`를 하나씩. 로컬 공용 DB 때문에 알려진 세 실패는 CI로 확인
- [ ] 디자인 점검 발견 0건(처리 예정 칸이 길어지므로 `clipped` 확인)
- [ ] 디자인 규칙 16절의 날짜 항목 지우기, STATUS, 실행 기록
- [ ] PR(`Risk tier: 일반`), CI, 새 문맥 끝 리뷰, 병합
