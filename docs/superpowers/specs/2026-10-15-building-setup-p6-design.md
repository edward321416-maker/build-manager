# 건물·호실 관리 화면과 건물 정보 입력 (P6 + C1 2단계) 설계

- 날짜: 2026-10-15. 작성: Claude Opus 5.5 (Claude Code).
- 위험 등급: 고위험. 새 마이그레이션(권한 검사가 있는 `SECURITY DEFINER` 함수), 관리자 응답 형식(API 계약) 변경, 사용자에게 보이는 질문·추천 기준이 되는 건물 사실 저장, FROZEN 범위(B3 건물 등록, RC1 Core 흐름)에 닿는다(DEV-01, DEV-04, DEV-08).
- 근거
  - [기능 연결·누락 분석](../../../research/ux/2026-10-14-feature-connection-gap-analysis.md) 7절 순서 3 "P6 셋업 통합 + C1 수정"
  - [메뉴 점검](../../../research/ux/2026-10-10-menu-audit.md) P6, D4
  - [C1 1단계 설계](2026-10-14-building-context-fallback-c1-design.md)의 "범위 밖"과 "2단계에 넘길 조건"(관리자 응답의 건물 형식부터 넓히기)
  - [호실 200개 넘는 조직 설계](2026-10-14-unit-list-over-200-design.md) 남은 위험의 C(건물 → 호실 고르기)
- 운영자 결정(2026-10-15, 이 세션): 아래 "결정" 절

## 문제

- 건물·호실 등록은 옛 화면 `/workspace`(B3)에 있다. 디자인 규칙 밖이고, 건물 하나에 "확인되지 않은 수동 건물 참조" 글자 한 칸만 받는다(`app.property.address_reference`).
- 건물 이름·난방 방식·관리 방식·업체용 주소를 저장하는 화면이 없다. 이 정보는 `core_flow.building_context`에 있어야 하는데, 이 표에 쓰는 곳은 시험 fixture와 데모 준비 스크립트뿐이다. 그래서 실제로 등록한 건물은
  - 어디서나 이름이 `건물`이다(C1 1단계 D1).
  - 업체에 맡길 수 없다. 업체용 주소가 없어 "주소 확인 필요"로 막힌다(C1 1단계 D2).
  - 세입자는 늘 "난방 방식을 묻는" 질문을 받고, 추천은 늘 "관리자 검토"다.

## 확인한 사실 (코드)

- `core_flow.building_context(org_id, property_id, body jsonb)`는 `bm_core_flow_owner`가 소유하고, 행 보안 정책 `context_org`(조직 일치)가 있다(`0011` 25·50–52행). Core 함수는 `body`를 건물로 읽는다(`displayName`, `demo`, `context` 사실 목록, `serviceAddress`).
- 건물 사실의 모양은 `ContextValue`(`packages/domain/src/building/types.ts`)다. 추천과 질문 선택은 `verified && routingEligible`인 `heatingType`·`managementMode`만 쓴다(`select-protocol.ts`, `routingEligibleContextKeys`).
- 건물주 확인 규칙이 이미 있다(`packages/application/src/use-cases/verify-building-context.ts`, 옛 v1 체험용). `OWNER_VERIFIED`, `verified: true`, `routingEligible: true`로 저장하고, 다시 확인하면 앞의 확인을 바꾼다.
- 업체 전달은 건물 `serviceAddress`와 호실 이름이 둘 다 있어야 한다(`0019` 400·481행). 업체에게는 "주소 + 호실"이 함께 간다.
- 관리자 요청 응답의 건물은 "건물 여권"(`demo: true`, 사실 네 칸 필수) 아니면 "확인 안 된 건물"(사실 0개, C1 1단계)이다(`presentLandlordBuilding`). 데모가 아닌 건물에 사실을 하나라도 저장하면 지금은 관리자 응답이 503이 된다.
- 옛 `/workspace`가 하는 일: 조직 목록, 건물 목록·등록, 호실 목록·등록, 호실 상세(이름만). 담당자 배정 같은 다른 화면은 없다. API(`/api/v2/organizations/.../properties`, `.../units`)는 B3에 있다.
- 공개 체험의 관리자는 조직 관리자(`ORG_ADMIN`, B1)라서 지금도 `/workspace`에서 건물·호실을 추가할 수 있다(`core-flow-fixture.ts` 29행, `nav-config.ts` 51행).

## 목표

- 조직 관리자가 `/core`의 '더 보기 › 건물·호실 관리'에서 건물을 추가하고, 건물 정보를 넣고 고치고, 호실을 추가한다.
- 넣은 건물 이름이 세입자·관리자·업체 화면에 보인다. 업체용 주소가 있으면 업체에 맡길 수 있다.
- 넣은 난방 방식·관리 방식이 세입자 질문과 처리 경로 추천에 쓰인다. '모름'이면 지금과 같다.
- 공개 체험에서는 보기만 된다. 서버도 막는다.
- 옛 `/workspace`는 새 화면으로 보낸다.

## 결정

| ID | 질문 | 결정 | 다른 선택지 |
| --- | --- | --- | --- |
| D1 | 4번(화면 정리, 정보 입력, 큰 조직용 호실 고르기)의 순서 | 정보 입력 + 새 화면을 한 설계로 묶고 PR을 나눈다. 호실 고르는 칸은 그다음 설계 ("정보 입력 + 새 화면 먼저 (추천)") | 화면만 먼저 옮기기, 세 가지를 한 번에 |
| D2 | 관리자가 넣은 난방·관리 방식을 질문과 추천에 쓸까 | 쓴다. 건물주 확인 규칙과 같게 `OWNER_VERIFIED`, `verified: true`, `routingEligible: true`로 저장 ("추천에 쓴다 (추천)") | 화면에 보여 주기만 |
| D3 | 화면 구조 | 목록 → 건물 화면. 넓은 화면은 목록과 건물 화면을 나란히 ("A. 목록 → 건물 화면 (추천)", [시안](https://claude.ai/artifact/LqVL8zRQWoBhn3xZwFxM3z)) | 한 화면에서 펼치기 |
| D4 | 공개 체험에서 고치기·추가 | 보기만. 화면은 버튼 자리에 이유를 보이고, 서버는 체험 세션의 쓰기를 거절 ("체험에서는 보기만 (추천)") | 체험에서도 허용 |

- 2026-10-15 운영자가 이 설계를 승인했다("승인 (추천)"). [시각 설명 페이지](https://claude.ai/artifact/DDeoMxCmVQLK18LUvbfThL)(설계서와 같은 내용, 실제 크기 화면)를 보고 결정했다. 다른 선택지는 "고칠 것 있음"이었다.

설계 안에서 정한 것(운영자 결정이 아니라 기존 규칙을 따른 것):

- 고칠 수 있는 사람: 조직 관리자(`ORG_ADMIN`)만. 메뉴의 '건물·호실 관리' 행이 이미 조직 관리자에게만 보인다. 건물 담당자와 세입자는 고칠 수 없다.
- 체험용 건물(`demo: true`, 시험 fixture·데모 준비 스크립트가 만든 건물)은 누구도 이 기능으로 고칠 수 없다.
- '모름'은 사실을 저장하지 않는다(사실을 지운다). 그래서 '모름'은 지금 동작과 같다.

## 범위

### PR 1 (고위험): 저장과 응답

1. 관리자 응답의 건물 형식을 먼저 넓힌다(C1 1단계 "2단계에 넘길 조건").
   - `packages/api-contracts/src/building.ts`의 `UnverifiedBuildingDtoSchema`를 "데모가 아닌 건물" 형식으로 넓힌다: `demo: false`, `heatingType`·`managementMode`는 각각 있으면 값(지금 계약의 두 값), 없으면 빠짐. `contextVerified`는 두 값이 모두 확인됐을 때만 `true`. `routingEligibleFields`는 확인된 칸 이름.
   - `presentLandlordBuilding`은 `demo`가 아니면 늘 이 형식으로 내보낸다. 체험용 건물은 지금처럼 건물 여권이다.
   - 기존 "사실 0개" 응답은 넓힌 형식에도 그대로 맞는다(값 두 칸이 빠지고 `contextVerified: false`, `routingEligibleFields: []`).
2. 새 마이그레이션 `0028_core_building_info.sql`(`bm_core_flow_owner`, `SECURITY DEFINER`, `search_path=pg_catalog`, `PUBLIC` 실행 권한 없음, 웹 역할에만 실행 권한. 0015·0025처럼 `GRANT CREATE ON SCHEMA`로 시작해 끝에서 `REVOKE`)
   - `core_flow.org_buildings(p_digest bytea) RETURNS jsonb`: 조직 관리자에게 그 조직의 건물 목록. 건물마다 `buildingId`, `displayName`(저장된 이름 또는 `null`), `unitCount`, `needsInfo`(이름이나 업체용 주소가 없으면 `true`). 조직 관리자가 아니면 `FORBIDDEN`.
   - `core_flow.building_info(p_digest bytea, p_property uuid) RETURNS jsonb`: 건물 하나의 정보. `buildingId`, `displayName`, `serviceAddress`, `heatingType`, `managementMode`(확인된 값 또는 `null`), `demo`, `version`(행이 없으면 0), `unitCount`. 조직 관리자가 아니면 `FORBIDDEN`, 다른 조직의 건물이면 `NOT_FOUND`.
   - `core_flow.save_building_info(p_digest bytea, p_property uuid, p_expected_version integer, p_name text, p_service_address text, p_heating text, p_management text) RETURNS jsonb`
     - 조직 관리자만. 다른 조직 건물이나 없는 건물은 `NOT_FOUND`.
     - `demo: true`인 행은 `FORBIDDEN`으로 거절한다.
     - `p_expected_version`이 저장된 `version`(행이 없으면 0)과 다르면 `STATE_CONFLICT`로 거절한다(두 관리자가 동시에 고칠 때 덮어쓰지 않게). 행이 아직 없는 첫 저장도 건물별 잠금으로 차례를 지킨다.
     - 입력 검사: 이름은 앞뒤 공백이 없는 1–50자, 주소는 앞뒤 공백이 없는 1–200자 또는 `null`(빈 글자는 거절하므로 화면은 빈 칸을 `null`로 보낸다). 둘 다 유니코드 제어·서식 문자(`\p{Cc}\p{Cf}`, 업체 전달 계약과 같은 기준)가 없어야 한다. 난방은 `INDIVIDUAL`·`CENTRAL_SHARED`·`null`, 관리는 `OWNER_DIRECT`·`MANAGEMENT_OFFICE`·`null`.
     - 행이 없으면 만들고, 있으면 바꾼다. `body`는 `{"id":<property id>,"displayName":이름,"demo":false,"sourceNativeIds":{},"context":[확인된 사실],"serviceAddress":주소,"version":n+1,"updatedAt":지금}`. 사실은 `{"key":"heatingType","value":값,"sourceType":"OWNER_VERIFIED","sourceRef":"org_admin","verified":true,"routingEligible":true,"fetchedAt":null,"updatedAt":지금}` 모양이고, `null`인 칸은 사실을 넣지 않는다.
     - 돌려주는 값은 `building_info`와 같은 모양이다.
3. API(기존 Core 경로 `apps/web/src/app/api/v2/core/[...path]/route.ts` → `apps/web/src/server/core-flow/http.ts`, Node 런타임·dynamic)
   - `GET /api/v2/core/buildings`, `GET /api/v2/core/buildings/{id}`, `POST /api/v2/core/buildings/{id}`(본문: `expectedVersion`, `displayName`, `serviceAddress`, `heatingType`, `managementMode`). Core HTTP는 GET·POST만 받으므로 저장도 POST다.
   - 기존 Core API처럼 세션 쿠키, `x-core-organization`, 쓰기에는 `x-b1-csrf`를 확인한다.
   - 응답 계약은 `packages/api-contracts`에 둔다(`CoreBuildingSummarySchema`, `CoreBuildingInfoSchema`, `CoreBuildingInfoSaveSchema`). 각 건물 응답에 `editable`(조직 관리자, 체험 세션 아님, 체험용 건물 아님)을 함께 준다.
   - 오류는 기존 Core 코드를 쓴다: 403 `FORBIDDEN`(권한 없음, 체험용 건물, 체험 세션의 저장), 404 `NOT_FOUND`, 409 `STATE_CONFLICT`(버전 충돌), 400 `INVALID_INPUT`. 화면은 저장 전에 받은 `editable`로 체험·체험용 건물을 미리 구분한다.
4. 공개 체험은 쓰기 금지(D4)
   - 서버는 세션의 사용자가 체험 진입 대상(`demoEntrySubjects`의 값)이면 체험 세션으로 본다.
   - `POST /api/v2/core/buildings/{id}`와 B3의 건물·호실 만들기(`POST .../properties`, `POST .../units`)는 체험 세션이면 403 `FORBIDDEN`이고, B3의 만들기 가능 머리글은 `false`다. B3 쪽은 HTTP 처리(`apps/web/src/server/b3/http.ts`)에서 막고, B3 도메인·저장 코드(FROZEN)는 바꾸지 않는다.
5. 시험
   - PostgreSQL(`tests/postgres/`): 세 함수의 권한(조직 관리자 통과, 건물 담당자·세입자·다른 조직 관리자 거절), 체험용 건물 거절, 버전 충돌, 입력 검사, '모름'이 사실을 지움, 저장 뒤 `core_flow.units`·업무함·정비 이력의 건물 이름, 업체 전달 원천에 주소가 들어감, 0025의 "행 없음" 동작이 그대로임
   - 도메인·응용: 저장한 난방 방식이 세입자 질문 세트를 고르고(`INDIVIDUAL` → 개별 난방 질문), `null`이면 지금처럼 `heatingUnknownV1`
   - 계약·발표: 넓힌 형식이 "사실 0개", "한 칸만 확인", "두 칸 확인" 건물을 모두 받고, 체험용 건물은 그대로 건물 여권
   - API: 권한, CSRF, 체험 세션 403(새 경로와 B3 만들기 둘 다), 오류 코드

### PR 2 (고위험, 화면): '더 보기 › 건물·호실 관리'

- 화면 PR이지만 FROZEN인 B1·B3의 `/workspace` 화면 주소를 바꾸므로 고위험으로 다룬다(DEV-01 "애매하면 고위험").

- `/core`의 '더 보기' 행 '건물·호실 관리'가 `/workspace` 대신 `/core` 안의 화면(`view: "buildings"`)을 연다. 아이콘은 그대로 `layout-grid`다.
- 화면(디자인 규칙 v1, [시안](https://claude.ai/artifact/LqVL8zRQWoBhn3xZwFxM3z) A)
  - 건물 목록: 제목 "건물 {n}곳", 행마다 건물 이름(없으면 `건물`과 보조 줄 "이름 없음"), 보조 줄 "호실 {n}개", 정보가 모자라면 상태 라벨 "정보 입력 필요"(대기 색). 주요 버튼 "건물 추가하기".
  - 건물 화면: 제목은 건물 이름. "건물 정보"(업체에 알려 줄 주소 · 난방 방식 · 관리 방식, 없으면 "입력 전") + "고치기". "호실 {n}개" 목록(호실 이름) + 주요 버튼 "호실 추가하기". 호실은 B3 호실 목록 API로 쪽 단위로 불러오고, 더 있으면 "더 보기" 글자 버튼.
  - 건물 정보 고치기: 건물 이름(필수, 도움말 "세입자와 업체에게 보이는 이름이에요."), 업체에 알려 줄 주소(선택, 도움말 "업체에 수리를 맡길 때만 보내요. 호수는 적지 않아요."), 난방 방식 타일(개별 난방 · 중앙 난방 · 모름), 관리 방식 타일(건물주 직접 · 관리사무소 · 모름), 아래 안내 "고른 값은 세입자 질문과 처리 경로 추천에 쓰여요. 추천은 늘 관리자가 확인해요." 주요 버튼 "저장하기"(휴대폰은 아래 고정).
  - 건물 추가하기: 제목 "어떤 건물인가요?", 건물 이름 한 칸(도움말 "추가한 뒤 건물 화면에서 주소와 난방·관리 방식을 넣어요."). 저장하면 B3로 건물을 만들고(`addressReference`에는 같은 이름을 넣는다), 이어서 건물 정보(이름)를 저장한 뒤 그 건물 화면으로 간다. 두 번째 저장이 실패하면 건물은 이미 있으므로 "건물은 추가했어요. 이름을 저장하지 못했어요. 건물 정보에서 다시 저장해 주세요."를 건물 화면에 보인다.
  - 호실 추가하기: 호실 이름 한 칸(B3 그대로, 80자).
  - 넓은 화면(1120px 이상): 목록과 건물 화면을 나란히(업무함과 같은 배치). 휴대폰: 하위 화면이라 탭바 없이 상단 바 뒤로 버튼과 하단 고정 버튼.
  - 상태: 불러오는 중, 빈 목록("아직 건물이 없어요. 건물을 추가해 주세요."), 오류(다시 시도하기), 저장 확인 중, 버전 충돌("다른 관리자가 먼저 고쳤어요. 새로 불러온 내용을 확인하고 다시 저장해 주세요." + 새로 불러오기), 체험 세션(고치기·추가 버튼 자리에 "체험에서는 바꿀 수 없어요."), 고칠 수 없는 건물(체험용 건물은 같은 문구).
  - 저장 성공은 토스트 "저장했어요"(8.9).
- `/workspace` 아래 모든 주소는 `/core`의 이 화면으로 보낸다(서버 쪽 이동). B1 모드가 아니면 지금처럼 404다.
- 시험: 화면 단위 시험(목록·건물·고치기·충돌·체험·오류 상태), 화면 자동 시험(`test:e2e:core`에 관리자 흐름 하나: 건물 추가 → 정보 저장 → 호실 추가 → 세입자 화면에 이름), 디자인 점검(390·1280px, 크롬·WebKit)

### 범위 밖

- 큰 조직용 '건물 → 호실 고르기'(업무함 필터, 정비 이력, 입주 연결의 고르는 칸): 다음 설계
- 모바일 앱 화면(앱 v2)
- 건물·호실 이름 바꾸기와 지우기, 호실 상세, 담당자 배정 화면
- 사용 승인 연도·주용도 같은 다른 건물 사실, 공공 데이터 조회
- 옛 v1 체험 화면(`/demo/*`)

## 위협·남용 사례

| 누가, 어떻게 | 막는 방법 | 시험 |
| --- | --- | --- |
| 다른 조직 관리자가 남의 건물 정보를 읽거나 고침 | 함수가 세션의 조직과 조직 관리자 자격을 확인하고, 표의 행 보안 정책도 조직을 묶는다. 다른 조직 건물은 `NOT_FOUND` | PostgreSQL 거절 시험 |
| 건물 담당자나 세입자가 건물 정보를 고침 | 조직 관리자만 허용 | 같음 |
| 공개 체험 방문자가 다른 방문자에게 보이는 이름·주소에 낙서 | 체험 세션의 쓰기는 서버에서 403. 체험용 건물은 누구도 못 고침 | API 시험(새 경로, B3 만들기) |
| 잘못 넣은 난방 방식으로 엉뚱한 질문·추천 | 추천은 늘 관리자 확인을 거친다(`humanReviewRequired: true`). '모름'을 고를 수 있고, 화면 안내가 쓰임새를 알린다 | 도메인 시험 |
| 업체용 주소가 엉뚱한 사람에게 보임 | 주소는 지금처럼 업체 전달 때만 업체에게 간다. 세입자 화면과 목록은 이름만 보인다. 로그에 주소를 남기지 않는다(DEV-09 A09) | 업체 원천 시험, 응답 모양 시험 |
| 두 관리자가 동시에 고쳐 한쪽이 사라짐 | 버전 확인, 409 | PostgreSQL 시험 |
| 긴 글·줄바꿈·제어 문자·스크립트 | 길이·한 줄 검사(서버·계약), 매개변수 SQL, React 기본 이스케이프 | 계약·API 시험 |
| 이 변경 뒤 관리자 응답이 503(C1 1단계에서 넘긴 위험) | 응답 형식을 먼저 넓히고, "사실 0개/한 칸/두 칸" 모두 시험 | 발표 시험 |

## 되돌리기

- PR 2(화면)는 병합 커밋을 되돌리면 된다. '더 보기' 행은 다시 `/workspace`를 연다.
- PR 1은 새 함수만 더하는 마이그레이션이다. 앱 코드를 되돌려도 함수는 남지만 부르는 곳이 없다.
- 주의: 데모가 아닌 건물에 사실을 저장한 뒤에는 응답 형식 넓히기(PR 1의 1번)를 되돌리면 안 된다. 되돌리면 그 건물의 요청에서 관리자 응답이 다시 503이다. PR 1 전체를 되돌려야 하면, 먼저 그 행의 `context`를 비우는 마이그레이션을 따로 낸다.

## 시험 순서

1. 실패부터: 넓힌 형식 시험(한 칸만 확인된 건물이 지금은 503) → 계약·발표 수정
2. 실패부터: 세 함수 시험(함수 없음 → 구조적 실패) → 마이그레이션. 변형 시험으로 권한·체험 건물·버전 검사를 하나씩 빼 보고 시험이 잡는지 본다.
3. API·체험 세션 시험 → 경로
4. 화면 단위 시험 → 화면 → 화면 자동 시험 → 디자인 점검
5. DEV-06·DEV-04: `test:shared`, `test:web`, `test:postgres`, `test:e2e:core`, `lint`, `typecheck`, `build:web`, `check:deps`, `verify_repository.py --history`
6. 새 문맥 독립 리뷰(PR마다), `ops/` 수락 기록
7. 병합 뒤 데모 배포는 운영자 확인을 받고 따로(DEV-04)

## 남은 위험

- 건물 추가는 B3 만들기와 이름 저장 두 번이라 한 번에 묶이지 않는다. 두 번째가 실패하면 이름 없는 건물이 남는다(화면이 알리고, 다시 저장할 수 있다).
- 건물 목록은 쪽 나눔 없이 조직의 건물을 모두 준다. 건물이 수천 개인 조직은 느릴 수 있다(호실은 쪽 단위).
- 이름 바꾸기·지우기가 없어서 잘못 만든 건물·호실은 남는다.
- 관리자가 넣은 사실은 공공 데이터로 확인하지 않는다(`OWNER_VERIFIED`는 "관리자가 확인함"이라는 뜻이다).
