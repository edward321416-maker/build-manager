# 호실 목록 한국어 순서·건물별 묶기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `core_flow.units`가 건물 이름과 호실 이름을 ICU 한국어 규칙(숫자는 값으로)으로 정렬하고, 이름이 같은 건물의 호실을 건물별로 묶어 돌려준다.

**Architecture:** 마이그레이션 `0027_core_units_korean_order.sql`이 정렬 규칙 `core_flow.unit_name_order`(ICU `ko-u-kn-true`)를 만들고, `core_flow.units`를 0026과 같은 본문으로 다시 만들되 정렬 줄만 바꾼다.

**Tech Stack:** PostgreSQL 18.6(ICU 포함), plpgsql, vitest 5(`vitest.postgres.config.ts`), Node 24.21.0.

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-10-14-unit-list-korean-order-design.md`(운영자 2026-10-14 "승인 (추천)").
- 위험 등급: 고위험(DEV-04). 데모 배포는 이 계획에 없다.
- 바꾸는 것은 정렬 한 줄과 정렬 규칙 하나다. 권한 계산(0026의 `readable`/`visible`), 응답 모양, 다른 함수는 그대로다.
- 검사는 고정 Node: `export PATH="/c/Users/admin/AppData/Local/build-manager-b5-runtime/node-24.21.0/node-v24.21.0-win-x64:$PATH"`. 공용 로컬 시험 DB는 쓰지 않는다.
- 문서·계획에 커밋 공동 작성자 줄의 주소를 쓰지 않는다. 바꾼 경로만 이름으로 스테이징한다.

### Task 1: 실패하는 시험

**Files:** Create `tests/postgres/core-unit-order.test.ts`; Modify `tests/postgres/core-unit-list.test.ts`(순서 시험 두 곳)

- [ ] 새 파일: 건물 A에 `10호, 2호, 101호, 1001호, 가동 10호, 가동 2호, 나동 1호, B1호`를 넣고, 건물 정보에 `가나 빌라`라고 적힌 건물 하나와 이름 없는 건물 두 곳(`101호`, `102호`, 건물 id 역순·호실 이름 역순으로 넣음)을 더한다.
  - 기대 1: 건물 A의 호실 순서 `2호, 10호, 101호, 1001호, 가동 2호, 가동 10호, 나동 1호, 합성 호실 1, 합성 호실 2, B1호`
  - 기대 2: 전체 순서 `가나 빌라 1호` → `건물 101호, 102호`(id가 작은 건물) → `건물 101호, 102호`(다음 건물) → `RC1 합성 건물 A`의 호실들
  - 기대 3: 정렬 규칙의 소유자 `bm_core_flow_owner`, 종류 `i`, 지역 `ko-u-kn`
- [ ] `core-unit-list.test.ts`의 순서 시험은 돌려받은 행을 새 규칙(`COLLATE core_flow.unit_name_order`, 건물 id 포함)으로 다시 정렬한 결과와 비교하고, 이름이 같은 `건물` 두 호실은 건물 id 순으로 기대한다.
- [ ] 0026 위에서 RED: 새 파일 3개 실패(1·2는 순서, 3은 정렬 규칙 없음), 기존 순서 시험은 정렬 규칙이 없어 실패(구조적 실패, 행동 증거는 새 파일 1·2).
- [ ] 커밋 `test(db): pin Korean unit order and same-name buildings kept together (fails until 0027)`

### Task 2: 마이그레이션

**Files:** Create `packages/persistence-postgres/migrations/0027_core_units_korean_order.sql`; Modify `scripts/hosted-demo-provision.mjs` 주석(`0001-0026` → `0001-0027`)

- [ ] `GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner; SET LOCAL ROLE bm_core_flow_owner;`
- [ ] `CREATE COLLATION core_flow.unit_name_order (provider = icu, locale = 'ko-u-kn-true');`
- [ ] `CREATE OR REPLACE FUNCTION core_flow.units(p_digest bytea)`: 0026 본문과 같고 마지막 정렬만 `ORDER BY v.building_name COLLATE core_flow.unit_name_order, v.property_id, v.label COLLATE core_flow.unit_name_order, v.id`
- [ ] `RESET ROLE; REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;`
- [ ] GREEN: `core-unit-order` 3/3, `core-unit-list` 8/8, `core-building-context-fallback` 7/7. 그다음 `npm run test:postgres` 전체.
- [ ] 커밋 `fix(db): order Core units the Korean way and keep same-name buildings together`

### Task 3: 검사, 기록, 리뷰, PR

- [ ] DEV-06: `verify_repository.py --history`, `test:shared`(graph 시간 초과는 #119, 파일별 재실행), `test:web`, `lint`, `typecheck`, `build:web`, `check:deps`
- [ ] `ops/unit_list_korean_order_20261014_acceptance.md`, STATUS 36행(호실 목록 줄) 갱신, 실행 로그, 대기 동기화
- [ ] 새 문맥 독립 리뷰 → 고치기 → PR(`Risk tier: 고위험`) → CI → `--match-head-commit` 병합
