# 건물 정보 없는 건물도 접수되게 (C1 1단계) 설계

- 날짜: 2026-10-14. 작성: Claude Opus 5.5 (Claude Code).
- 위험 등급: 고위험. DB 함수(권한 함수 포함 `SECURITY DEFINER`)를 바꾸는 마이그레이션이고, FROZEN 범위인 RC1 Core 흐름에 닿는다(DEV-01, DEV-04, DEV-08).
- 근거
  - [기능 연결·누락 분석](../../../research/ux/2026-10-14-feature-connection-gap-analysis.md) 4절 L-01과 CLM-113–CLM-115.
  - 재현: `tests/postgres/c1-building-context-repro.test.ts`(브랜치 `test/building-context-c1-repro`, 로컬 커밋 `8900ddc`). 2026-10-14 17:13 KST, Node 24.21.0 / npm 11.19.0에서 실행했다.
    - 재현 시험은 실패했다. 등록 기능으로 만든 건물·호실에 초대로 세입자를 연결하면, 세입자는 `TENANT` 역할을 받지만 `core_flow.units`가 `[]`를 돌려준다.
    - 대조 시험은 통과했다. 같은 호실에 건물 정보 행을 넣으면 호실이 보이고 `core_flow.building`도 읽힌다.
  - 운영자 결정 2026-10-14
    - "건물 정보 확인부터 (추천)", "지금 시작 (추천)": P5 PR 2보다 먼저 재현했다.
    - 고치는 방법은 "둘 다, 나눠서 (추천)"이다. 1단계(이 문서)는 건물 정보가 없어도 호실이 보이게 한다. 2단계는 건물·호실 화면을 합칠 때(P6) 건물 정보 입력 칸을 넣는다. 다른 선택지는 "없어도 보이게만"과 "등록 때 입력받기만"이었다.
- 결정: 운영자가 2026-10-14에 이 스펙을 승인했다("승인 (추천)"). D1–D3은 권고대로 정해졌다. 자세한 내용은 아래 "결정" 절에 있다.

## 원인 (코드와 재현으로 확인함)

1. 건물 등록(`/workspace`, B3)은 `app.property`(주소 메모 `address_reference`)와 `app.unit`만 쓴다(`packages/persistence-postgres/src/b3/registration.ts`). `core_flow.building_context`는 쓰지 않는다.
2. `core_flow.building_context`에 행을 넣는 곳은 시험 fixture(`packages/persistence-postgres/src/testing/core-flow-fixture.ts` 24행)와 데모 준비 스크립트뿐이다. 그래서 데모와 기존 시험에서는 문제가 드러나지 않는다.
3. Core 흐름의 함수 다섯 곳이 이 행이 있다고 가정한다. 다섯 함수 모두 `bm_core_flow_owner`가 만들었고, 각각 한 번만 정의됐다(나중 마이그레이션에서 다시 정의하지 않음).

| 함수 | 위치 | 행이 없을 때 지금 동작 |
| --- | --- | --- |
| `core_flow.units(bytea)` | `0011` 94행 | 안쪽 조인이라 그 건물의 호실이 목록에서 빠진다(재현됨) |
| `core_flow.building(bytea,uuid)` | `0011` 106행 | `NOT_FOUND` 예외. 접수 만들기와 `read_ticket`(130행)이 이 함수를 부른다 |
| `core_flow.manager_work_json(core_flow.ticket)` | `0015` 48행 | 안쪽 조인이라 `NULL`. 업무함 목록이 `jsonb_agg`로 묶으므로 목록에 `null`이 섞인다 |
| `core_flow.maintenance_fact_json(core_flow.unit_maintenance_fact)` | `0018` 53행 | 안쪽 조인이라 `NULL`. 정비 이력 목록에 `null`이 섞인다 |
| `core_flow.vendor_handoff_source(bytea,text,uuid[],boolean)` | `0019` 259행 | `'building'`이 `null`. 업체 칸이 읽는 `buildingName`이 `null`이 되어 계약(`plainSingle(200)`) 검사에서 실패한다 |

- 지금은 2번 때문에 이런 호실에 접수가 생길 수 없다. 그래서 3번의 `null`은 아직 아무 화면도 깨뜨리지 않는다. 1번만 고치면 접수가 생기기 시작하고, 그때부터 관리자 업무함 전체가 깨진다. 그래서 다섯 곳을 한 마이그레이션에서 함께 고친다.
- 입주 초대 함수(`0014` 92행, 178행)는 이미 바깥 조인과 `coalesce(c.body->>'displayName','건물')`을 쓴다. 이 설계는 그 방식을 따른다.

## 건물 정보가 없을 때 도메인은 이미 안전하다 (코드로 확인함)

빈 건물 정보(`context: []`)는 "확인된 건물 사실이 없음"이다. 도메인은 이 경우를 이미 정해 두었다. 이 설계는 도메인·질문·추천 코드를 바꾸지 않는다.

- 난방: `selectHeatingProtocol`(`packages/domain/src/protocol/select-protocol.ts`)은 확인된 난방 방식이 정확히 하나가 아니면 `heatingUnknownV1`을 고른다. 이 질문 세트는 세입자에게 난방 방식을 묻고, 마지막 규칙 `heating.unknown.landlordReview`로 관리자 검토를 추천한다.
- 누수: 관리사무소 규칙(`leak.ceiling.managementOffice`)은 확인된 `managementMode`가 있어야 맞는다. 없으면 `leak.default.landlordReview`로 관리자 검토를 추천한다.
- 추천: `recommendRoute`(`packages/domain/src/routing/recommend-route.ts`)는 `verified && routingEligible`인 사실만 규칙에 넣는다. 맞는 규칙이 없으면 `null`이다("never a guess"). 추천은 늘 `humanReviewRequired: true`다.
- 안전 질문과 긴급 판정은 건물 정보를 쓰지 않는다.

## 목표

- 등록 기능으로 만든 건물의 호실에 연결된 세입자가 그 호실을 보고 수리 요청을 할 수 있다.
- 그 요청은 관리자 업무함, 요청 상세, 호실 정비 이력에 다른 요청과 똑같이 보인다.
- 건물 정보가 없는 건물의 요청은 추천 없이 또는 관리자 검토 추천으로 간다. 건물 사실을 지어내지 않는다.
- 업체 칸은 깨지지 않는다. 주소가 없으면 지금처럼 "주소 확인 필요"를 보여 주고 업체 전달을 막는다.
- 건물 정보가 있는 건물(데모, 기존 시험)의 동작은 한 글자도 바뀌지 않는다.

## 범위

### 이번 PR (1단계)

1. 새 마이그레이션 `0025_core_building_context_fallback.sql` 하나
   - `bm_core_flow_owner`로 도우미 함수 `core_flow.building_body(p_org uuid,p_property uuid) RETURNS jsonb`를 만든다.
     - 행이 있으면 저장된 `body`를 그대로 돌려준다.
     - 없으면 `{"id":<property id 문자열>,"displayName":"건물","demo":false,"sourceNativeIds":{},"context":[]}`를 돌려준다.
     - `LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog`. `PUBLIC`의 실행 권한을 빼고, 다른 역할에 주지 않는다. 다섯 함수 안에서만 쓴다.
   - 위 표의 다섯 함수를 같은 이름·인자·반환형·소유자·`SECURITY DEFINER`·`search_path`로 `CREATE OR REPLACE`한다. 바꾸는 것은 건물 정보를 읽는 부분뿐이다.
     - `units`, `manager_work_json`, `maintenance_fact_json`: 안쪽 조인을 바깥 조인으로 바꾸고 `buildingName`에 `coalesce(c.body->>'displayName','건물')`을 쓴다.
     - `building`: 호실 권한 검사(`can_unit`)는 그대로 두고, 호실이 있으면 `building_body`를 돌려준다. 호실이 없거나 권한이 없으면 지금처럼 `NOT_FOUND`다.
     - `vendor_handoff_source`: `b`를 `building_body`로 읽는다. 주소(`serviceAddress`)는 저장된 행에만 있으므로, 행이 없으면 주소는 비어 있다.
   - 0015·0018과 같은 방식으로 `GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner`로 시작하고 끝에서 `REVOKE`한다.
2. `tests/postgres/`에 이 마이그레이션의 시험(아래 "테스트")
3. 연구 레지스트리의 CLM-115 검증 상태 갱신, `ops/` 수락 기록, 실행 로그

### 범위 밖

- 건물 정보 입력 칸(이름·난방 방식·관리 방식·업체용 주소). 2단계(P6과 함께)의 별도 스펙이다.
- 화면 문구 변경. 이름 없는 건물은 이미 있는 이름 `건물`로 보인다(입주 초대 화면과 같음).
- 도메인·질문·추천·안전 판정 코드
- `app.property`와 B3 등록 코드(FROZEN B3), 권한 정책(RLS)과 역할·권한 부여
- 기존 마이그레이션 수정(DEV-08)

## 위협·남용 사례

| ID | 누가 어떻게 | 막는 방법 | 시험 |
| --- | --- | --- | --- |
| T1 | 다른 조직 사용자가 바깥 조인으로 남의 건물·호실을 본다 | 호실 범위 조건(`org_id`, `can_unit`, `app.current_org_id()`)은 그대로 두고, 조인 대상만 바꾼다. 도우미는 `(org, property)`로만 찾는다. | 다른 조직 세입자·관리자가 새 호실을 못 보고 `NOT_FOUND`를 받는다 |
| T2 | 같은 조직의 다른 세입자나 배정 없는 직원이 새 호실을 본다 | `units`의 `can_unit` 필터를 바꾸지 않는다 | `tenantOther`와 배정 없는 `staff`의 목록에 새 호실이 없다 |
| T3 | 대체 정보가 확인된 건물 사실처럼 쓰여 잘못된 처리 방법이 추천된다 | 대체 본문의 `context`는 빈 배열이다. 확인됨·추천 근거 표시가 있는 사실이 하나도 없다. | 새 호실의 난방 요청은 `heatingUnknownV1`을 받고, 추천은 관리자 검토이거나 없다 |
| T4 | 주소가 확인되지 않은 건물의 업체 전달이 주소 없이 나간다 | 주소는 저장된 건물 정보에만 있다. 없으면 기존 `ADDRESS_REQUIRED` 검사가 막는다. | 업체 칸 읽기는 성공하고 `serviceAddress`가 `null`이다. 전달 게시는 `ADDRESS_REQUIRED`다 |
| T5 | 새 도우미 함수를 다른 역할이 불러 건물 정보를 읽는다 | 도우미의 실행 권한을 `PUBLIC`에서 빼고 아무에게도 주지 않는다 | `bm_b1_web`이 도우미를 부르면 권한 오류다 |
| T6 | `CREATE OR REPLACE`가 소유자·권한·`search_path`를 바꾼다 | 같은 역할로 같은 서명을 바꾼다 | 마이그레이션 전후 다섯 함수의 소유자, `prosecdef`, `proconfig`, ACL이 같다 |
| T7 | 업무함·정비 이력 목록에 `null`이 섞여 화면 전체가 깨진다(서비스 거부) | 다섯 함수를 한 마이그레이션에서 함께 바꾼다 | 새 호실의 요청과 정비 사실이 있는 상태에서 업무함·정비 이력 목록이 계약 검사를 통과한다 |

## 롤백 계획

- 앱 코드는 바꾸지 않는다. 그래서 이미지를 되돌려도 DB 함수는 그대로다.
- DB는 앞으로만 간다(DEV-08). 되돌리려면 새 마이그레이션 `0026`으로 다섯 함수를 0011·0015·0018·0019의 본문으로 다시 만들고 도우미를 지운다.
  - 주의: 1단계 뒤에 건물 정보 없는 호실의 요청이 생겼다면, 예전 본문으로 돌아가는 순간 T7(목록의 `null`)이 생긴다. 그런 요청이 있으면 되돌리기 전에 그 건물들에 건물 정보 행을 먼저 넣는다.
- 호스팅 데모의 건물은 모두 건물 정보가 있다. 그래서 데모의 화면 동작은 바뀌지 않는다. 배포는 운영자에게 따로 확인한다(DEV-04).

## 테스트 (실패부터)

`tests/postgres/c1-building-context-repro.test.ts`를 이 마이그레이션의 시험으로 키운다. 마이그레이션 전에는 1–5가 실패해야 하고, 실패 이유가 건물 정보 누락이어야 한다(R06).

1. 재현: 등록 → 초대 → 승인한 세입자의 `units`에 새 호실이 있고, `building`이 대체 본문(`displayName` `건물`, `context` `[]`, `id` = 건물 id)을 돌려준다.
2. 접수: 그 세입자가 난방 요청을 만들 수 있고, 질문 세트가 `heatingUnknownV1`이다. 답을 마치면 추천이 관리자 검토이거나 없다. 누수 요청도 같은 방식으로 확인한다.
3. 관리자: 업무함 목록과 `read_manager_work`에 그 요청이 `buildingName` `건물`로 있고, 목록 전체가 계약 검사를 통과한다.
4. 정비 이력: 그 요청에 정비 사실을 기록하면 호실 정비 이력과 요청별 읽기가 성공한다.
5. 업체: 관리자가 처리 방법을 업체로 정한 뒤 업체 칸을 읽으면 성공하고 `serviceAddress`가 `null`이다. 게시하면 `ADDRESS_REQUIRED`다.
6. 격리(T1, T2): 다른 조직, 같은 조직의 다른 세입자, 배정 없는 직원은 새 호실·요청을 못 본다.
7. 권한(T5, T6): 도우미 실행 권한, 다섯 함수의 소유자·`SECURITY DEFINER`·`search_path`·ACL을 마이그레이션 전후로 비교한다.
8. 회귀: 건물 정보가 있는 건물은 `units`·`building`·업무함 결과가 마이그레이션 전과 같다(기존 시험 전체 통과로 확인).
9. 대조: 건물 정보 행을 넣으면 그 값이 대체 본문 대신 쓰인다(재현 커밋의 대조 시험).

실행할 검사(DEV-04, DEV-06): `npm run test:postgres`, `npm run test:e2e:core`, `npm run test:e2e:b1`, `npm run test:e2e:vendor`, `npm run test:shared`, `npm run test:web`, `npm run lint`, `npm run typecheck`, `npm run build:web`, `npm run check:deps`, `python scripts/verify_repository.py --history`. 그 뒤 새 문맥의 독립 리뷰를 받고 `ops/`에 수락 기록을 남긴다.

## 결정

[DECISION] 운영자가 2026-10-14에 "승인 (추천)"을 골랐다. 아래 세 가지 모두 권고대로 정해졌다. 검토한 다른 선택지는 "이름은 주소 메모로"와 "고칠 점 있음"이었다.

| ID | 질문 | 결정(권고안) | 이유 | 다른 안 |
| --- | --- | --- | --- | --- |
| D1 | 이름 없는 건물을 무엇이라고 보여 줄까? | 고정된 이름 `건물` | 입주 초대 화면이 이미 쓰는 이름이다. 주소 메모(`address_reference`)는 B3 화면이 "확인되지 않은 수동 건물 참조"라고 부르는 최대 512자의 자유 입력이다. 상세 주소가 들어 있을 수 있다. 이것을 이름으로 쓰면 관리자가 적은 메모가 세입자 화면과 업체 칸에 그대로 나간다. | 관리자의 주소 메모를 이름으로 쓰기. Core 함수 소유 역할은 `app.property`의 SELECT 권한이 있다(`0011` 11행). 다만 `app.property`의 행 보안 정책(`0003` 35행, `0006` 104행, `0007` 98행) 아래에서 그 역할이 이 칸을 읽을 수 있는지는 확인하지 않았다. 한계: 이름 없는 건물이 여럿이면 관리자 목록에서 `건물 · 101호`처럼 구분이 어렵다. 2단계의 이름 입력이 이것을 푼다. |
| D2 | 주소가 없는 건물의 업체 전달은? | 지금처럼 막는다("주소 확인 필요", `ADDRESS_REQUIRED`) | 확인되지 않은 주소를 업체에 보내지 않는다. 업체용 주소는 2단계에서 입력받는다. | 관리자의 주소 메모를 업체 주소로 쓰기 |
| D3 | 1단계에서 화면 문구를 바꿀까? | 바꾸지 않는다 | DB만 바꿔 위험 범위를 줄인다. 디자인 규칙 작업이 따로 필요 없다. | 관리자 요청 상세에 "건물 정보가 없어 추천 없이 검토해요" 안내를 더하기 |

## 보완: 관리자 응답의 건물 칸 (2026-10-14)

- **발견**: PR #147(head `c15a19b`)의 새 문맥 독립 리뷰가 HIGH를 찾았고, 코드로 확인했다.
  - 관리자 응답은 `presentLandlordTicket`이 `presentBuildingPassport`로 만든다(`apps/web/src/server/http/presenters.ts`). 이 형식(`BuildingPassportDtoSchema`)은 `demo`가 `true`여야 하고, `primaryUse`·`approvalYear`·`managementMode`·`heatingType`이 꼭 있어야 한다.
  - 대체 건물은 이 검사를 통과하지 못한다. 검사 오류는 `DEPENDENCY_UNAVAILABLE`(503)로 바뀐다.
  - 그래서 이름 없는 건물의 요청이 하나라도 생기면 그 조직 관리자의 `GET /api/v2/core/tickets`(목록 전체), 요청 상세, 처리·결정 POST가 모두 503이 된다. T7이 SQL 밖에서 다시 생기는 것이다. 0025 전에는 이런 요청이 생길 수 없어서 드러나지 않았다.
- **결정**: [DECISION] 운영자가 2026-10-14에 "이 PR에 같이 고치기 (추천)"를 골랐다. 다른 안은 "0025 멈추고 형식부터 따로", "PR 닫고 다시 설계"였다.
  - 이 절은 범위 1번과 롤백 계획의 "앱 코드는 바꾸지 않는다"를 대체한다.
  - D3(화면 문구 그대로)는 유지한다. 보이는 화면은 바뀌지 않는다.
- **바꾸는 것**
  1. `packages/api-contracts/src/building.ts`에 `UnverifiedBuildingDtoSchema`를 더한다. 필드는 `buildingId`, `displayName`, `demo: false`, `contextVerified: false`, `routingEligibleFields: []`(빈 배열만)이고 `strict`다. 건물 사실 칸은 아예 없다.
  2. `LandlordTicketDetailDtoSchema.building`은 "건물 여권 또는 확인 안 된 건물"이다. `BuildingPassportDtoSchema` 자체는 바꾸지 않는다. 옛 건물 목록 응답은 지금처럼 엄격하다.
  3. `presentLandlordTicket`은 건물이 데모가 아니고 건물 정보(`context`)가 빈 배열일 때만 확인 안 된 건물을 돌려준다. 그 밖에는 지금처럼 건물 여권이고, 형식이 맞지 않는 예상 밖 데이터는 지금처럼 실패한다.
  - 응답을 쓰는 화면은 `ticket.building.displayName`만 읽는다(웹 옛 관리자 목록, 모바일 관리자 홈·요청 검토). `/core`의 요청 검토는 건물 칸을 읽지 않는다. 앱 전체 타입 검사로 확인했다.
- **위협 추가**
  - T8: 확인 안 된 건물이 확인된 사실처럼 보인다. 막는 방법: 이 형식에는 사실 칸이 없고 `contextVerified`와 `routingEligibleFields`가 고정값이다. 시험: 사실 칸, `demo: true`, `contextVerified: true`, 추천 근거 필드가 있으면 계약이 거절한다.
  - T7을 넓힌다: 관리자 HTTP 목록·상세·처리 응답도 200이어야 한다.
- **시험 추가** (실패부터)
  10. 계약: 확인 안 된 건물이 들어간 관리자 요청 상세는 통과하고, 위 T8의 네 경우는 거절된다. 건물 여권 형식은 확인 안 된 건물을 받지 않는다.
  11. presenter: 대체 건물이면 확인 안 된 건물, 데모 건물이면 지금과 같은 건물 여권
  12. HTTP(PostgreSQL과 실제 `handleCoreFlow`): 이름 없는 건물의 요청이 있는 조직에서 관리자 목록·상세·처리 응답이 200이고, 그 요청의 건물 칸이 확인 안 된 건물이다.
- **롤백 보완**: 0025가 적용된 DB에서 앱 이미지만 이 PR 전으로 되돌리면 HIGH가 다시 생긴다. 앱을 되돌리기 전에 0026 되돌리기 마이그레이션이나 건물 정보 행 넣기를 먼저 한다.
- **2단계에 넘길 조건**: 확인 안 된 건물 형식은 건물 정보가 하나도 없는 건물에만 쓴다. 2단계에서 데모가 아닌 건물에 사실을 하나라도 저장하면 그 건물은 건물 여권 검사(`demo`가 true, 사실 네 칸 필수)로 가서 관리자 응답이 다시 503이 된다. 그래서 2단계는 사실을 저장하기 전에 관리자 응답의 건물 형식부터 넓혀야 한다(2차 리뷰 MEDIUM).
- **남은 위험 추가**: 0025 뒤에는 건물 정보 없는 호실도 `units`의 `LIMIT 200` 자리를 같이 쓴다. 호실이 200개를 넘는 조직에서는 건물 정보가 있는 호실이 목록에서 밀릴 수 있다. 개발 세션이 운영자 승인을 받은 0026(제한 없애기)이 이것을 함께 푼다.

## 남은 위험

- 이름 없는 건물이 여럿이면 관리자 목록에서 구분이 어렵다(D1). 2단계 전까지의 한계다.
- 주소가 없는 건물은 업체에 맡길 수 없다(D2). 관리자는 직접 처리하거나 2단계를 기다려야 한다.
- 2단계(건물 정보 입력)는 아직 스펙이 없다. P6 셋업 통합과 함께 쓴다.
- 이 설계는 코드를 읽고 재현 시험 하나를 돌려서 썼다. 바깥 조인으로 바꾸는 다른 영향은 구현 PR의 전체 `test:postgres`와 e2e로 확인한다.
- AI가 작성했다. 독립 리뷰는 구현 PR에서 받는다.
