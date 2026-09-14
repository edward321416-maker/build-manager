# 모두의 창업 2기 — Building-Aware AI Repair Router
## Step 05. Product Spec v1

- 문서 상태: **RE-AUDITED v2 / READY FOR USER REVIEW**
- 기준일: **2026-09-14**
- 이전 기준본: `04_7_global_benchmark_product_v2_REAUDITED_v2.md`
- 다음 단계: 사용자 승인 후 `Step 06 — Codex Astra High Implementation Plan & Master Prompt`
- 제품 외부명(Working): **건물 맞춤형 AI 수리 라우터**
- 내부 아키텍처명: **Building-Aware Maintenance Intelligence Layer**
- Hero Message: **주소가 수리 프로토콜이 된다**
- 개발 목적: **모두의 창업 Contest MVP**
- 제품검증 범위: **2개 DEMO 건물 × 2개 하자 Protocol**
- 고객증거 상태: `MISSING`
- PMF 상태: `NOT_CLAIMED`

---

# Re-Audit v2 — 수정 요약

이번 2차 전수점검에서 구현 전에 수정이 필요한 항목을 확인했다.

## Critical 수정

1. `REQUEST_MORE_INFO`가 UI/API에는 있었지만 Ticket 상태·Decision 타입에 완전히 반영되지 않았음  
   → `NEEDS_MORE_INFO` 상태와 discriminated review action을 추가.

2. `MISSING_REQUIRED` 상태에서도 자동 Route 추천이 생성될 수 있었음  
   → **Evidence가 COMPLETE일 때만 정상 자동 Route 추천**.  
   `MISSING_REQUIRED`/`CONFLICTING`은 자동 추천을 보류하고 Human Review로 전환.

3. Safety Escalation과 정상 Route Recommendation의 경계가 불명확했음  
   → `SAFETY_ESCALATED`에서는 정상 Route Recommendation을 생성하지 않음.

4. 도로명주소→건축HUB Resolver에 지번 기반 필드가 부족했음  
   → `admCd`, `mtYn`, `lnbrMnnm`, `lnbrSlno` 등 parcel component를 adapter input에 보강.

5. SQLite를 향후 cloud/serverless 배포까지 그대로 사용할 수 있는 것처럼 읽힐 수 있었음  
   → **Repository Port + Local SQLite Adapter**로 수정.  
   Vercel 같은 serverless 환경에서는 로컬 SQLite 영속성을 전제로 하지 않음.

## High 수정

6. Public Contest Demo에 Production-grade 인증 없이 실제 파일업로드를 열어두는 위험  
   → Public FIXTURE demo는 synthetic evidence만 사용. 실제 파일업로드는 local/dev opt-in 또는 P1.

7. Demo에서 Landlord → Tenant → Landlord로 역할전환 경로가 빠져 있었음  
   → DEMO-only role-switch CTA를 명시.

8. `management_mode=NONE`과 `OWNER_DIRECT` 의미가 겹침  
   → `OWNER_DIRECT / MANAGEMENT_OFFICE / THIRD_PARTY_MANAGER / UNKNOWN`으로 정리.

9. 핵심 API에 조회 endpoint와 추가정보 재수집 flow가 부족  
   → GET endpoints와 `REQUEST_MORE_INFO → NEEDS_MORE_INFO → 재finalize` 상태전이를 명시.

10. `next build` 검증이 Engineering Acceptance에 없었음  
    → Production build pass를 필수 Gate에 추가.

---

# 0. Executive Specification

## 0.1 MVP가 증명해야 하는 단 하나의 것

> **같은 임차인 신고라도 검증된 Building Context가 다르면 필요한 질문·증거·추천 처리경로가 실제로 달라진다.**

MVP는:

- 종합 임대관리 앱이 아니다.
- 실제 업체 마켓플레이스가 아니다.
- 법률 책임 판정 서비스가 아니다.
- 완전 자율 AI Agent가 아니다.

MVP가 보여줄 것은:

```text
주소 / DEMO 건물 선택
      ↓
Building Passport
      ↓
임대인 최소 확인
      ↓
Tenant Issue
      ↓
Context-specific Protocol
      ↓
Evidence
      ↓
Repair Packet
      ↓
Explained Route
      ↓
Human Approval / Override
```

---

# 1. Product Principles

## P1. Context before AI

AI는 검증된 건물 Context보다 앞서 추론하지 않는다.

## P2. Rules before LLM

Safety와 핵심 Routing은 deterministic rule이 기준이다.

## P3. Evidence before recommendation

정상 자동 Route Recommendation은 **필수 질문·필수 증거가 COMPLETE일 때만** 생성한다.

- `COMPLETE` → 정상 Route 추천 가능
- `MISSING_REQUIRED` → 자동 Route 추천 보류, 추가정보 요청 또는 관리자 수동판단
- `CONFLICTING` → 자동 Route 추천 보류, 관리자 검토
- `SAFETY_ESCALATED` → 정상 Route 추천 생성 금지

## P4. Explain before action

추천 결과와 함께 어떤 Context/Rule이 영향을 줬는지 보여준다.

## P5. Human before execution

실제 처리경로 확정은 임대인이 한다.

## P6. Unknown is valid

모르는 값은 `UNKNOWN`으로 유지한다.

추정값으로 채우지 않는다.

## P7. Source is visible

공공데이터·임대인 확인·임차인 제출·시스템 정리를 구분한다.

## P8. Core works without LLM

LLM 장애나 미설정 상태에서도 핵심 vertical slice가 작동한다.

## P9. Demo is honest

Synthetic fixture는 `DEMO DATA`라고 명확히 표시한다.

## P10. No real PII in repository

실제 개인 주소·세입자 정보·실제 민원 원본을 GitHub에 넣지 않는다.

---

# 2. Product Scope

## 2.1 P0 Core — 반드시 구현

1. Address/Demo Building Select
2. Building Candidate / Resolver 상태
3. Building Passport
4. Owner Verification
5. Tenant Issue Input
6. Heating Protocol
7. Leak Protocol
8. Safety Hard Stop
9. Guided Question
10. Evidence Slot
11. Repair Packet
12. Explained Route
13. Human Approve / Override
14. Provenance
15. Minimal Audit Event
16. Fixture Mode
17. Live API Adapter Interface
18. Fallback / Unknown handling

---

## 2.2 P0 Optional — Core 안정 후만

- 오류코드 OCR
- 제품 라벨 OCR
- QR 렌더링
- Natural-language LLM parsing
- 간단한 상태 Timeline
- 실제 Juso/BuildingHUB live call

Optional이 없어도 Contest Hero Demo가 완성돼야 한다.

---

## 2.3 P1 — 이번 개발에서 제외

- Vendor Secure Link
- Vendor/Tenant Scheduling
- Photo Closeout
- Maintenance Memory 고도화
- Warranty Card
- Repeated Issue Alert
- Weather Context
- Preventive Maintenance
- Building Health Dashboard
- English Intake

---

## 2.4 P2+ — 명시적 Out of Scope

- 월세
- 관리비
- 계약
- 공실
- 전자서명
- 법률 AI
- 수리업체 Marketplace
- 자동견적
- 결제
- 보험
- IoT
- 3D Scan
- Native App
- Autonomous Vendor Dispatch
- Full PMS
- 세무

---

# 3. Roles

## LANDLORD

할 수 있음:

- 건물 선택/등록
- Building Context 확인
- Owner Context 확인
- Ticket 조회
- Repair Packet 조회
- 추천 Route 승인
- Route Override

하지 않음:

- 자동 법적 책임판정 요청
- 자동 업체결제

---

## TENANT

할 수 있음:

- 본인 DEMO Unit의 문제 신고
- Protocol 질문 응답
- Evidence 제출
- 접수 완료 확인

볼 수 없음:

- 임대인의 내부 Route 후보 전체
- 비용·내부 메모
- 다른 호실

---

## SYSTEM

할 수 있음:

- Context 조합
- Protocol 선택
- Safety Hard Stop
- Evidence 요구
- Repair Packet 생성
- Route 후보/근거 생성
- Audit Event 저장

하지 않음:

- 실제 업체 자동 배정
- 법률 책임 확정
- 비용 승인
- 고장 원인 확정

---

# 4. Information Architecture

```text
/
├─ /demo
│   ├─ DEMO Building A
│   └─ DEMO Building B
│
├─ /landlord
│   ├─ /buildings
│   ├─ /buildings/new
│   ├─ /buildings/[buildingId]
│   ├─ /tickets
│   └─ /tickets/[ticketId]
│
└─ /t/[tenantToken]
    ├─ issue
    ├─ questions
    ├─ evidence
    └─ submitted
```

MVP에서 Production-grade auth는 구현하지 않는다.

역할은:

- Demo Landlord session
- Opaque tenant token

으로 제한한다.

---

# 5. Screen Inventory — 10 Screens

# Screen 1 — Demo / Building Select

Route:

```text
/demo
```

목적:

- Hero Flow 시작
- Live address mode 또는 DEMO fixture 선택

요소:

- 제품 한 줄 설명
- `DEMO 건물 A`
- `DEMO 건물 B`
- `주소로 건물 찾기` 버튼/입력
- DEMO badge

Acceptance:

- 두 fixture를 한 클릭으로 선택 가능
- fixture는 반드시 DEMO 표시
- Live API가 없어도 다음 화면 진행 가능

---

# Screen 2 — Building Candidate / Passport

Route:

```text
/landlord/buildings/new
```

목적:

- 선택된 building의 공식/fixture 정보를 검토

표시:

- 건물명
- 주택/주용도
- 사용승인일
- 지상/지하층
- 가구/세대수
- 승강기
- source badge

Acceptance:

- `source_type`을 각 주요 field에 표시
- 여러 후보일 경우 자동 확정하지 않음
- unknown field는 빈칸이 아니라 `확인 필요`
- BuildingHUB 실패 fallback 제공

---

# Screen 3 — Owner Verification / Protocol Ready

Route:

```text
/landlord/buildings/[buildingId]/verify
```

질문:

1. 이 건물의 하자·수리 문의를 보통 누가 처리하나요?
2. 난방방식은 무엇인가요?
3. 임대인이 제공한 주요 옵션설비는 무엇인가요?

선택:

```text
management_mode:
- OWNER_DIRECT
- MANAGEMENT_OFFICE
- THIRD_PARTY_MANAGER
- UNKNOWN

heating_type:
- INDIVIDUAL
- CENTRAL_SHARED
- DISTRICT
- UNKNOWN
```

완료 화면:

> **이 건물의 유지관리 설정이 준비됐어요.**

Acceptance:

- 최대 3개 핵심 확인으로 완료
- `UNKNOWN` 허용
- 확인된 값은 `OWNER_VERIFIED`
- Context가 Protocol assignment에 반영됨
- DEMO mode에서는 `203호 세입자 신고 화면 열기` CTA 제공
- 실제 제품의 tenant invitation/auth를 의미하지 않음

---

# Screen 4 — Tenant Issue Input

Route:

```text
/t/[token]
```

표시:

> `DEMO 다가구 A · 203호`

입력:

- 자유문장
- Quick Category

Quick Category P0:

```text
HEATING
LEAK
OTHER
```

Acceptance:

- LLM이 없어도 category 선택으로 진행
- 자유문장 `"보일러가 안 돼요"`는 heuristic 또는 optional LLM로 HEATING 분류 가능
- 분류 실패 시 category 선택 요청
- tenant에게 building 내부 과도한 정보 노출 금지

---

# Screen 5 — Guided Questions

목적:

- Protocol question을 한 번에 한 개씩 표시

UI:

- progress hint
- previous answer summary
- single question
- binary / multiple choice / short text

Acceptance:

- Safety question은 일반 troubleshooting보다 먼저 표시 가능
- Protocol이 Building A/B에 따라 달라짐
- 한 번에 한 질문
- back/edit 가능
- LLM은 질문 의미를 변경하지 않음

---

# Screen 6 — Guided Evidence

목적:

- 필요한 evidence slot 표시

P0 Evidence Type:

```text
PHOTO_PLACEHOLDER
CONTROL_PANEL_PHOTO
LEAK_AREA_PHOTO
FIXTURE_PHOTO
```

UI:

- 무엇을 찍는지 설명
- 왜 필요한지 설명
- FIXTURE mode에서는 synthetic DEMO evidence 선택
- Local development에서는 opt-in으로 local preview 가능

Acceptance:

- Evidence requirement는 Protocol이 결정
- user가 required evidence를 건너뛰면 `MISSING_REQUIRED`
- Public Contest Demo에서는 arbitrary server-side file upload를 기본 비활성화
- 실제 PII 이미지 fixture 금지
- Evidence 저장 실패가 신고 자체를 막지 않음
- Production-grade upload/auth/storage는 P1 이후 별도 설계

---

# Screen 7 — Tenant Submission Complete

표시:

> **필요한 정보가 준비됐어요.**

또는 incomplete:

> **일부 정보가 부족하지만 접수할 수 있어요.**

Acceptance:

- tenant에게 내부 AI reasoning 전체를 노출하지 않음
- ticket id 생성
- 상태는 `READY_FOR_REVIEW`, `PARTIAL`, 또는 `SAFETY_ESCALATED`
- Safety Escalated ticket은 별도 안전 message
- DEMO mode에서만 `임대인 검토 화면으로 전환` CTA 제공
- 실제 제품에서는 tenant가 landlord console로 전환할 수 없음

---

# Screen 8 — Landlord Ticket Dashboard

Route:

```text
/landlord/tickets
```

카드:

- building/unit
- category
- submitted time
- evidence state
- safety state
- review state

P0 Status:

```text
READY_FOR_REVIEW
PARTIAL
SAFETY_ESCALATED
APPROVED
OVERRIDDEN
```

Acceptance:

- Safety Escalated 최상단
- color만으로 status 구분하지 않음
- Building A/B fixture ticket 모두 표시 가능

---

# Screen 9 — Repair Packet

Route:

```text
/landlord/tickets/[ticketId]
```

섹션:

1. User Report
2. Structured Symptoms
3. Building Context
4. Evidence
5. Safety
6. Suggested Route
7. Why
8. Provenance

Acceptance:

- fact와 generated summary 구분
- Route에 사용된 Context만 `Routing basis`로 별도 표시
- `routing_eligible=false` 값은 Why에 직접 인과 근거로 쓰지 않음
- 법적 책임 표현 금지
- Suggested Route는 확정처럼 표현하지 않음

---

# Screen 10 — Route Decision / Override

Action:

```text
APPROVE_RECOMMENDATION
OVERRIDE_ROUTE
REQUEST_MORE_INFO
```

Override 시:

- 새 Route 선택
- optional reason
- Audit Event 기록

Acceptance:

- human decision 없이 실제 action 확정 금지
- recommended vs selected 저장
- override history 표시
- `REQUEST_MORE_INFO` 선택 시 Ticket → `NEEDS_MORE_INFO`
- tenant가 추가 답변/evidence를 제출한 뒤 `/finalize` 재실행 가능
- P0에서는 실제 외부업체 호출 없음

---

# 6. Demo Fixtures

## 6.1 DEMO Building A

```yaml
id: demo-building-a
display_name: DEMO 해솔빌라
demo: true

official_context:
  primary_use:
    value: 다가구주택
    source_type: FIXTURE_OFFICIAL
    routing_eligible: false

  approval_year:
    value: "2011"
    source_type: FIXTURE_OFFICIAL
    routing_eligible: false

  ground_floors:
    value: 5
    source_type: FIXTURE_OFFICIAL
    routing_eligible: false

  household_count:
    value: 14
    source_type: FIXTURE_OFFICIAL
    routing_eligible: false

  elevator:
    value: false
    source_type: FIXTURE_OFFICIAL
    routing_eligible: false

owner_context:
  management_mode:
    value: OWNER_DIRECT
    source_type: OWNER_VERIFIED
    routing_eligible: true

  heating_type:
    value: INDIVIDUAL
    source_type: OWNER_VERIFIED
    routing_eligible: true

  owner_supplied_boiler:
    value: true
    source_type: OWNER_VERIFIED
    routing_eligible: true
```

---

## 6.2 DEMO Building B

```yaml
id: demo-building-b
display_name: DEMO 라온하우징
demo: true

official_context:
  primary_use:
    value: 공동주택
    source_type: FIXTURE_OFFICIAL
    routing_eligible: false

  approval_year:
    value: "2018"
    source_type: FIXTURE_OFFICIAL
    routing_eligible: false

  ground_floors:
    value: 12
    source_type: FIXTURE_OFFICIAL
    routing_eligible: false

owner_context:
  management_mode:
    value: MANAGEMENT_OFFICE
    source_type: OWNER_VERIFIED
    routing_eligible: true

  heating_type:
    value: CENTRAL_SHARED
    source_type: OWNER_VERIFIED
    routing_eligible: true
```

실제 주소를 포함하지 않는다.

---

# 7. Context Model

## 7.1 ContextValue

```ts
type ContextSourceType =
  | "JUSO"
  | "BUILDING_HUB"
  | "KAPT"
  | "OWNER_VERIFIED"
  | "TENANT_SUBMITTED"
  | "SYSTEM_DERIVED"
  | "FIXTURE_OFFICIAL";

type ContextValue<T> = {
  key: string;
  value: T | null;
  sourceType: ContextSourceType;
  sourceRef?: string | null;
  verified: boolean;
  routingEligible: boolean;
  fetchedAt?: string | null;
  updatedAt: string;
};
```

---

## 7.2 Building

```ts
type Building = {
  id: string;
  displayName: string;
  demo: boolean;
  normalizedAddress?: string | null;
  sourceNativeIds: {
    jusoBdMgtSn?: string | null;
    buildingHubId?: string | null;
    kaptCode?: string | null;
  };
  context: ContextValue<unknown>[];
};
```

---

## 7.3 Unit

```ts
type Unit = {
  id: string;
  buildingId: string;
  unitLabel: string;
  tenantToken: string;
  context: ContextValue<unknown>[];
};
```

P0에서는 실제 대량 unit import를 구현하지 않는다.

fixture unit:

```text
203호
```

등만 사용.

---

# 8. Ticket Model

```ts
type TicketStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "PARTIAL"
  | "NEEDS_MORE_INFO"
  | "SAFETY_ESCALATED"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "OVERRIDDEN";

type IssueType =
  | "HEATING"
  | "LEAK"
  | "OTHER";

type Ticket = {
  id: string;
  buildingId: string;
  unitId: string;
  issueType: IssueType;
  rawUserText: string;
  status: TicketStatus;
  protocolId: string | null;
  answers: Answer[];
  evidence: Evidence[];
  safetyFlags: SafetyFlag[];
  repairPacket?: RepairPacket | null;
  routeDecision?: RouteDecision | null;
  createdAt: string;
  updatedAt: string;
};
```

---

# 9. Evidence Model

```ts
type EvidenceType =
  | "CONTROL_PANEL_PHOTO"
  | "LEAK_AREA_PHOTO"
  | "FIXTURE_PHOTO"
  | "GENERAL_PHOTO";

type Evidence = {
  id: string;
  type: EvidenceType;
  storageRef?: string | null;
  fixtureRef?: string | null;
  source: "TENANT_UPLOAD" | "DEMO_FIXTURE";
  createdAt: string;
};
```

P0에서는 사진의 고장진단을 하지 않는다.

사진은:

> Protocol이 요구한 evidence가 제출됐는지

를 보여주는 데 사용한다.

---

## 9.1 Answer / Safety Types

```ts
type AnswerValue =
  | string
  | boolean
  | string[]
  | null;

type Answer = {
  questionId: string;
  value: AnswerValue;
  createdAt: string;
  updatedAt: string;
};

type SafetyFlag =
  | "GAS_SMELL"
  | "SMOKE_OR_FIRE"
  | "ELECTRICAL_WATER_RISK";

type SafetyCheck = {
  id: string;
  flag: SafetyFlag;
  questionId: string;
  hardStop: true;
};

type RouteRule = {
  id: string;
  when: RuleExpression;
  primary: RouteType;
  alternatives: RouteType[];
  rationaleTemplate: string;
};
```

---

# 10. Route Model

```ts
type RouteType =
  | "LANDLORD_REVIEW"
  | "MANAGEMENT_OFFICE"
  | "THIRD_PARTY_MANAGER"
  | "MANUFACTURER_AS"
  | "GENERAL_VENDOR";

type RouteRecommendation = {
  primary: RouteType;
  alternatives: RouteType[];
  rationale: RationaleItem[];
  humanReviewRequired: true;
};

type RationaleItem = {
  contextKey?: string;
  protocolRuleId: string;
  explanation: string;
  sourceType?: ContextSourceType;
};
```

---

# 11. Human Review Action / Route Decision

`REQUEST_MORE_INFO`는 Route 확정이 아니므로 RouteDecision과 분리한다.

```ts
type RouteDecision =
  | {
      action: "APPROVE_RECOMMENDATION";
      recommendedRoute: RouteType;
      selectedRoute: RouteType;
      actor: "LANDLORD";
      decidedAt: string;
    }
  | {
      action: "OVERRIDE_ROUTE";
      recommendedRoute: RouteType | null;
      selectedRoute: RouteType;
      reason?: string | null;
      actor: "LANDLORD";
      decidedAt: string;
    };

type MoreInfoRequest = {
  action: "REQUEST_MORE_INFO";
  reason: string;
  requestedQuestionIds?: string[];
  requestedEvidenceTypes?: EvidenceType[];
  actor: "LANDLORD";
  requestedAt: string;
};
```

State transition:

```text
READY_FOR_REVIEW / PARTIAL
  ├─ approve/override → APPROVED / OVERRIDDEN
  └─ request more info → NEEDS_MORE_INFO
                            ↓
                    tenant adds data
                            ↓
                        IN_PROGRESS
                            ↓
                         finalize
```

---

# 12. Audit Event

```ts
type AuditEvent = {
  id: string;
  entityType: "BUILDING" | "TICKET";
  entityId: string;
  actor: "SYSTEM" | "LANDLORD" | "TENANT";
  eventType:
    | "CONTEXT_UPDATED"
    | "TICKET_SUBMITTED"
    | "SAFETY_ESCALATED"
    | "ROUTE_RECOMMENDED"
    | "MORE_INFO_REQUESTED"
    | "REPAIR_PACKET_REGENERATED"
    | "ROUTE_APPROVED"
    | "ROUTE_OVERRIDDEN";
  metadata: Record<string, unknown>;
  createdAt: string;
};
```

---

# 13. Protocol Model

Protocol은 versioned JSON/TypeScript data file로 관리한다.

DB에서 자유편집하는 기능은 P0에서 만들지 않는다.

```ts
type QuestionType =
  | "YES_NO"
  | "SINGLE_SELECT"
  | "SHORT_TEXT";

type ProtocolQuestion = {
  id: string;
  prompt: string;
  type: QuestionType;
  choices?: { value: string; label: string }[];
  required: boolean;
  showWhen?: RuleExpression;
};

type EvidenceRequirement = {
  type: EvidenceType;
  required: boolean;
  showWhen?: RuleExpression;
  instruction: string;
  why: string;
};

type Protocol = {
  id: string;
  version: string;
  issueType: IssueType;
  match: RuleExpression;
  safetyChecks: SafetyCheck[];
  questions: ProtocolQuestion[];
  evidence: EvidenceRequirement[];
  routeRules: RouteRule[];
};
```

---

# 14. Rule Expression

P0에서는 복잡한 generic rules DSL을 만들지 않는다.

작은 typed condition tree만 지원.

```ts
type RuleExpression =
  | {
      op: "eq";
      field: string;
      value: string | boolean | number;
    }
  | {
      op: "and";
      rules: RuleExpression[];
    }
  | {
      op: "or";
      rules: RuleExpression[];
    };
```

대상 field는 whitelist.

임의 JavaScript 실행 금지.

---

# 15. Safety Precedence

Routing 전에 무조건 실행.

```text
Safety Check
↓
if HARD STOP
    status = SAFETY_ESCALATED
    normal protocol suspend
else
    continue protocol
```

P0 Hard Stop:

```text
GAS_SMELL
SMOKE_OR_FIRE
ELECTRICAL_WATER_RISK
```

---

# 16. GAS_SMELL Rule

Trigger:

- 사용자가 가스 냄새가 있다고 응답

행동:

- 일반 troubleshooting 중지
- 안전 카드 표시
- Ticket `SAFETY_ESCALATED`
- Landlord Dashboard 최상단

안전카드의 메시지는 한국가스안전공사 지침 기반으로 유지한다.

최소 의미:

- 가능한 경우 가스공급 차단
- 창문·출입문을 열어 환기
- 전기기구 사용 금지
- 도시가스/가스공급 관련 기관에 연락
- 위험 시 안전한 장소로 이동 및 긴급신고

앱이 누출위치를 추정하지 않는다.

출처:
- 한국가스안전공사
- https://www.kgs.or.kr/kgs/abad/view.do

---

# 17. SMOKE_OR_FIRE Rule

Trigger:

- 연기/불꽃/실제 화재 응답

행동:

- 일반 troubleshooting 중지
- 안전한 대피 우선
- 119 신고 안내
- Ticket `SAFETY_ESCALATED`

앱이:

- 화재원인
- 소화 가능 여부

를 판단하지 않는다.

출처:
- 소방청 소방안전교육 플랫폼
- https://119metaverse.nfa.go.kr/

---

# 18. ELECTRICAL_WATER_RISK Rule

Trigger:

- 물이 콘센트/멀티탭/노출전선 등에 닿았거나 근접했다고 응답

행동:

- 전기설비 자가조작 안내 금지
- 접근 최소화 안내
- 관리자/전문가 확인 우선
- 심각한 위험이면 긴급신고 안내

P0에서는 AI가:

> 안전하다고 판정

하지 않는다.

---

# 19. Heating Protocol — Shared Safety

Protocol:

```text
HEATING_V1
```

공통 첫 단계:

1. 가스 냄새?
2. 연기/불꽃?

둘 중 하나라도 yes:

> Safety Hard Stop.

---

# 20. Heating Branch A — Individual

Match:

```text
heating_type == INDIVIDUAL
```

질문:

1. 온수도 나오지 않나요?
2. 난방은 모든 방에서 작동하지 않나요?
3. 보일러/조절기 전원은 켜져 있나요?
4. 표시창에 오류코드가 있나요?

Evidence:

- `CONTROL_PANEL_PHOTO` — 권장/필수 여부 P0에서 required
- OCR optional

Route Rule:

```text
if
  heating_type == INDIVIDUAL
  AND management_mode in [NONE, OWNER_DIRECT]
then
  primary = LANDLORD_REVIEW
  alternatives = [MANUFACTURER_AS]
```

Repair Packet에는:

> `제조사 A/S 확인 후보`

라고 표현 가능.

실제 Manufacturer dispatch는 하지 않는다.

---

# 21. Heating Branch B — Shared/Central

Match:

```text
heating_type == CENTRAL_SHARED
```

질문:

1. 난방 문제는 이 호실에만 있는 것으로 알고 있나요?
2. 온수에도 문제가 있나요?
3. 세대 조절기 화면에 이상표시가 있나요?

Evidence:

- `FIXTURE_PHOTO` 또는 thermostat/controller photo slot

### 명시적 차이

개별보일러 모델 라벨을 우선 요구하지 않는다.

Route Rule:

```text
if
  heating_type == CENTRAL_SHARED
  AND management_mode == MANAGEMENT_OFFICE
then
  primary = MANAGEMENT_OFFICE
  alternatives = [LANDLORD_REVIEW]
```

---

# 22. Heating Unknown Branch

Match:

```text
heating_type == UNKNOWN
```

행동:

> 난방방식을 먼저 확인하는 질문.

Route:

> `LANDLORD_REVIEW`

자동 추정 금지.

---

# 23. Leak Protocol — Shared Safety

Protocol:

```text
LEAK_V1
```

첫 Safety:

1. 물이 콘센트·멀티탭·전기기구 주변까지 번졌나요?
2. 물이 통제하기 어려울 정도로 계속 흐르나요?

전기 위험 yes:

> `ELECTRICAL_WATER_RISK`.

대량 누수:

> 일반 self-troubleshooting보다 관리자 즉시 확인을 우선.

---

# 24. Leak Questions

1. 물이 어디에서 보이나요?

```text
CEILING_WALL
SINK_BATHROOM_FIXTURE
APPLIANCE
UNKNOWN
```

2. 현재도 계속 새고 있나요?
3. 특정 기기를 사용할 때만 발생하나요?
4. 처음 발견한 시점은 언제인가요?

---

# 25. Leak Evidence

## CEILING_WALL

- `LEAK_AREA_PHOTO`
- 주변 전체 위치가 보이는 사진

## SINK_BATHROOM_FIXTURE

- `LEAK_AREA_PHOTO`
- 가능한 경우 배관/연결부 사진

## APPLIANCE

- `LEAK_AREA_PHOTO`
- `FIXTURE_PHOTO`

---

# 26. Leak Routing

P0에서 누수 원인을 확정하지 않는다.

Rule Example:

```text
if
  management_mode == MANAGEMENT_OFFICE
  AND location == CEILING_WALL
then
  primary = MANAGEMENT_OFFICE
  alternatives = [LANDLORD_REVIEW]
```

다른 경우:

```text
primary = LANDLORD_REVIEW
```

### 금지

- 공용부 책임 확정
- 임대인 비용책임 확정
- 위층 과실 확정

Route는:

> **누구에게 먼저 상황을 보여줄지**

에 대한 운영 recommendation이다.

---

# 27. Evidence State

```ts
type EvidenceState =
  | "COMPLETE"
  | "MISSING_REQUIRED"
  | "CONFLICTING"
  | "SAFETY_ESCALATED";
```

`COMPLETE`는:

> 고장 원인이 확인됐다는 뜻이 아니다.

뜻:

> Protocol이 요구하는 최소 정보가 준비됐다는 뜻.

## 27.1 Recommendation Gate

```text
COMPLETE
→ 정상 RouteRecommendation 생성 가능

MISSING_REQUIRED
→ 정상 자동추천 보류
→ recommendation = null
→ status = PARTIAL

CONFLICTING
→ 정상 자동추천 보류
→ recommendation = null
→ human review

SAFETY_ESCALATED
→ 정상 자동추천 금지
→ recommendation = null
→ safety flow only
```

관리자는 자동추천이 없어도 수동 Route를 선택할 수 있지만:

- 그 선택은 `OVERRIDE_ROUTE`
- AuditEvent에 남김
- 시스템 추천인 것처럼 표시하지 않음

---

# 28. Repair Packet Schema

```ts
type RepairPacket = {
  ticketId: string;
  revision: number;
  issueType: IssueType;

  userReport: {
    rawText: string;
  };

  structuredSymptoms: Record<string, unknown>;

  contextSnapshot: {
    routingBasis: ContextValue<unknown>[];
    informational: ContextValue<unknown>[];
  };

  evidenceState: EvidenceState;
  evidence: Evidence[];

  safety: {
    flags: SafetyFlag[];
    escalated: boolean;
  };

  recommendation: RouteRecommendation | null;

  generatedSummary: {
    text: string;
    source: "TEMPLATE" | "LLM";
  };

  createdAt: string;
};
```

---

# 29. LLM Contract — Optional

P0 Core는 LLM 없이 동작.

LLM을 설정한 경우에만:

1. 자유문장 category parsing
2. 질문 자연어 표현
3. answer normalization
4. summary wording

사용.

LLM이 할 수 없는 것:

- Safety Rule 변경
- Protocol condition 변경
- Route Rule 변경
- legal liability
- final action

---

# 30. Optional LLM Structured Output

```ts
type LlmParseResult = {
  suggestedIssueType:
    | "HEATING"
    | "LEAK"
    | "OTHER";
  normalizedUserText: string;
  extractedEntities: Record<string, string>;
  uncertaintyFlags: string[];
};
```

P0에서 self-generated probability 사용 금지.

예:

```text
confidence: 0.87
```

같은 값을 Routing 근거로 사용하지 않는다.

---

# 31. Runtime Mode

```ts
type RuntimeMode =
  | "FIXTURE"
  | "LIVE";
```

## FIXTURE

- DEMO A/B
- public API 불필요
- automated test 기본

## LIVE

- Juso adapter
- BuildingHUB adapter
- optional K-apt enrichment

Live 실패 시:

> manual/fallback.

---

# 32. External Adapter Interfaces

```ts
interface AddressProvider {
  search(query: string): Promise<AddressCandidate[]>;
}

interface BuildingRegistryProvider {
  resolve(input: NormalizedAddress): Promise<BuildingCandidate[]>;
  getProfile(candidateId: string): Promise<ExternalBuildingProfile>;
}

interface KaptProvider {
  enrich(input: NormalizedAddress): Promise<KaptEnrichment | null>;
}
```

P0 Kapt adapter는 interface/stub만 있어도 된다.

---

# 33. Address Candidate

```ts
type AddressCandidate = {
  roadAddress: string;
  jibunAddress?: string | null;
  postalCode?: string | null;
  buildingName?: string | null;
  bdMgtSn?: string | null;

  components: {
    // 도로명주소 식별/좌표 계열
    admCd?: string | null;
    roadCode?: string | null;       // rnMgtSn
    undergroundFlag?: string | null; // udrtYn
    mainBuildingNo?: string | null; // buldMnnm
    subBuildingNo?: string | null;  // buldSlno

    // 지번/건축HUB resolve에 필요한 parcel 계열
    mountainFlag?: string | null;   // mtYn
    lotMainNo?: string | null;      // lnbrMnnm
    lotSubNo?: string | null;       // lnbrSlno
  };
};
```

External provider field mapping은 공식 활용가이드 기준으로 adapter 내부에서 수행한다.

도로명주소 API는 `admCd`, `mtYn`, `lnbrMnnm`, `lnbrSlno` 등 지번 조합에 필요한 값을 제공할 수 있으므로, BuildingHUB resolver는 road-number만이 아니라 **parcel component도 보존**한다. `admCd`를 BuildingHUB의 세부 request field로 어떻게 분해·매핑할지는 실제 구현 시 건축HUB 공식 활용가이드/Swagger를 기준으로 adapter 내부에서 확정한다.

도메인 모델이 provider response shape에 직접 의존하지 않게 한다.

---

# 34. Building Candidate Resolution

```ts
type BuildingCandidate = {
  providerId: string;
  displayName: string;
  roadAddress?: string | null;
  jibunAddress?: string | null;
  primaryUse?: string | null;
};
```

여러 candidate이면:

> 사용자 선택.

AI 자동선택 금지.

---

# 35. Internal API Contract

모든 endpoint는 Zod로 request/response boundary를 검증한다.

FIXTURE mode의 public demo에서는 실제 인증을 구현하지 않으며 synthetic data만 사용한다.

## GET `/api/address/search`

Query:

```text
?q=검색어
```

Response:

```json
{
  "items": []
}
```

Fixture mode에서는 demo result.

---

## POST `/api/buildings/resolve`

Input:

```json
{
  "addressCandidate": {}
}
```

Response:

```json
{
  "candidates": []
}
```

---

## POST `/api/buildings`

Input:

```json
{
  "candidateId": "..."
}
```

Result:

- Building 생성
- profile fetch
- ContextValues 생성

---

## PATCH `/api/buildings/:id/context`

Owner verified Context 업데이트.

---

## GET `/api/buildings/:id`

Building Passport + Context 조회.

---

## GET `/api/tickets`

Landlord Dashboard용 Ticket 목록.

P0에서는 fixture/demo landlord scope만 반환.

---

## GET `/api/tickets/:id`

Repair Packet / current state 조회.

---

## POST `/api/tickets`

Tenant 신고 생성.

---

## POST `/api/tickets/:id/answers`

Protocol answer 저장.

---

## POST `/api/tickets/:id/evidence`

Evidence 등록.

---

## POST `/api/tickets/:id/finalize`

- safety
- evidence completeness
- Repair Packet
- Route recommendation

생성.

---

## POST `/api/tickets/:id/decision`

Request body는 discriminated union:

- `APPROVE_RECOMMENDATION`
- `OVERRIDE_ROUTE`
- `REQUEST_MORE_INFO`

동작:

### APPROVE_RECOMMENDATION

- recommendation이 존재해야 함
- Ticket → `APPROVED`

### OVERRIDE_ROUTE

- recommendation 유무와 관계없이 human-selected Route 저장 가능
- Ticket → `OVERRIDDEN`
- reason 권장

### REQUEST_MORE_INFO

- Ticket → `NEEDS_MORE_INFO`
- `MoreInfoRequest` 저장
- normal RouteDecision은 생성하지 않음

추가 answer/evidence가 들어오면 Ticket → `IN_PROGRESS`, 이후 `/finalize`를 재실행하여 Repair Packet revision을 증가시킨다.

---

# 36. Persistence — Deployment-Safe Boundary

## 36.1 원칙

도메인 로직이 SQLite에 직접 의존하지 않도록 `Repository Port`를 둔다.

```ts
interface TicketRepository {
  get(id: string): Promise<Ticket | null>;
  list(): Promise<Ticket[]>;
  save(ticket: Ticket): Promise<void>;
}

interface BuildingRepository {
  get(id: string): Promise<Building | null>;
  save(building: Building): Promise<void>;
}
```

## 36.2 P0 Local Contest Demo

권장:

> **Node 24 `node:sqlite` + Drizzle ORM**

이유:

- 추가 DB 계정 불필요
- Node 24에서 사용할 수 있는 built-in SQLite driver
- 로컬 Contest Demo에 충분
- fixture/test 쉬움
- Drizzle은 `node:sqlite`를 공식 지원

## 36.3 Test

- In-memory repository
- 외부 DB 불필요

## 36.4 Cloud Deployment 주의

로컬 SQLite file은 serverless 환경의 영속 저장소로 가정하지 않는다.

예를 들어 Vercel은 serverless의 로컬 파일시스템이 ephemeral이므로 SQLite의 영속 write store로 사용할 수 없다고 안내한다.

따라서 향후 공유형 cloud deployment가 필요하면:

- persistent DB provider
- persistent volume이 있는 Node/Docker host
- 별도 remote database

중 하나를 별도로 결정한다.

### P0 원칙

> **Hosting choice 때문에 Product Core를 바꾸지 않도록 repository abstraction을 유지한다.**

P0의 production-grade multi-user persistence는 범위 밖이다.

---

# 37. Evidence Storage

P0:

- DEMO fixture images
- local development에서만 optional local preview/storage adapter
- public FIXTURE demo에서는 arbitrary binary upload 기본 비활성화

Interface:

```ts
interface EvidenceStorage {
  save(file: FileLike): Promise<StoredEvidence>;
  get(ref: string): Promise<StoredEvidence>;
}
```

Automated tests에서는 memory adapter.

Public GitHub:

> 실제 개인 사진 없음.

---

# 38. Recommended Technical Stack

## Runtime

- **Node.js 24 LTS**
- **Next.js 16.3 Active LTS**
- TypeScript strict
- Next.js App Router

2026-09-14 재확인 기준 공식 자료에서 Next.js 16.3.3이 Active LTS이며 Node 24가 LTS다. Vitest 5는 2026-09-03 공개됐고 Node >=22.12를 요구하므로 Node 24와 호환된다. Playwright의 현재 시스템 요구사항에도 Node 24.x가 포함된다.

## UI

- Tailwind CSS
- accessible headless/component primitives
- custom product components

특정 UI library에 제품구조를 종속시키지 않는다.

## Validation

- Zod

## Persistence

- Repository Port
- Local P0 adapter: Node `node:sqlite`
- Drizzle ORM
- Tests: in-memory adapter

## Unit / Integration Tests

- Vitest 5

## E2E

- Playwright

## Package Manager

- 기존 환경에 package manager가 있으면 유지
- 신규 repo면 `pnpm` 권장
- lockfile commit

### Version Rule

Codex는 작업 시작 시:

1. `package.json`
2. lockfile
3. Node version config

를 먼저 읽는다.

기존 프로젝트가 있으면 임의 upgrade 금지.

신규 프로젝트에서만 이 기준을 사용한다.

---

# 39. Repository Structure

```text
/
├─ app/
│  ├─ demo/
│  ├─ landlord/
│  ├─ t/[token]/
│  └─ api/
│
├─ components/
│  ├─ building/
│  ├─ ticket/
│  ├─ protocol/
│  └─ ui/
│
├─ domain/
│  ├─ building/
│  ├─ protocol/
│  ├─ safety/
│  ├─ routing/
│  └─ ticket/
│
├─ adapters/
│  ├─ address/
│  ├─ building-hub/
│  ├─ kapt/
│  ├─ llm/
│  └─ evidence/
│
├─ protocols/
│  ├─ heating.v1.ts
│  └─ leak.v1.ts
│
├─ fixtures/
│  ├─ buildings.ts
│  ├─ evidence/
│  └─ scenarios.ts
│
├─ db/
│  ├─ schema.ts
│  └─ migrations/
│
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
│
├─ docs/
│  └─ product/
│
└─ .env.example
```

---

# 40. Architecture Boundaries

## `domain/`

외부 API/Next UI를 모른다.

Pure logic:

- Safety
- Protocol selection
- Evidence completeness
- Routing

## `adapters/`

외부 서비스 책임.

## `app/`

HTTP / UI.

## `protocols/`

versioned rules.

### 핵심

Route recommendation unit test는:

> Next.js 실행 없이 가능해야 한다.

---

# 41. Security / Secret Rules

- Public Contest Demo는 `FIXTURE`가 기본
- Production-grade auth가 없는 상태에서 LIVE mode + real tenant data를 공개 배포하지 않음
- Public FIXTURE demo에서는 arbitrary file upload 비활성화
- address search query / exact residential address를 analytics·test log에 저장하지 않음
- API key client component에 노출 금지
- `.env` commit 금지
- `.env.example` 값 비움
- log에 secret 금지
- live provider는 server-only
- DEMO fixture는 secret 불필요

Git history secret scan은 구현 완료 전 수행.

---

# 42. Privacy Rules

P0 DEMO:

- real tenant PII 없음
- real private residential address fixture 없음
- synthetic building name
- synthetic unit
- synthetic repair issue

Live API manual test 시:

- 주소를 test log/fixture로 commit하지 않음
- screenshot public repo 저장 시 실제 주소 masking

---

# 43. UX Direction

## Landlord

- desktop-first
- 정보밀도 중간
- Context / Evidence / Route를 카드로 구분

## Tenant

- mobile-first
- 한 번에 하나의 질문
- 큰 선택영역
- 짧은 설명
- 기술용어 최소화

---

# 44. Visual Principles

- Chatbot-looking product 금지
- 과도한 AI glow/gradient 금지
- 실제 workflow product처럼 보이게
- `공공데이터`, `임대인 확인` 같은 source badge
- Recommendation에는 `AI/자동 추천` 표시
- status를 색만으로 표현하지 않음
- 문장과 icon/label 병행
- mobile touch target 충분히 확보

---

# 45. Accessibility Acceptance

- 모든 form input에 label
- keyboard navigation
- focus visible
- image evidence input에 accessible name
- semantic heading order
- button role 정확
- status color-only 금지
- error message text 제공
- tenant screen mobile zoom/scroll 정상

P0에서 WCAG 완전준수를 주장하지 않는다.

기본 접근성 risk를 낮춘다.

---

# 46. Automated Test Strategy

코드 구현은 TDD 원칙.

순서:

```text
Failing Test
→ Minimal Implementation
→ Refactor
```

Core domain부터 작성.

---

# 47. Unit Tests — Mandatory

## Safety

### U-SAFE-01

gas smell = true

Expected:

- Safety escalated
- Normal route 없음
- 일반 protocol 중단

### U-SAFE-02

smoke/fire = true

Expected:

- Safety escalated

### U-SAFE-03

water near electricity = true

Expected:

- Safety escalated

---

## Heating

### U-HEAT-01

Building A:
- INDIVIDUAL
- OWNER_DIRECT

Expected:

- individual questions
- control panel evidence
- route = LANDLORD_REVIEW
- MANUFACTURER_AS alternative

### U-HEAT-02

Building B:
- CENTRAL_SHARED
- MANAGEMENT_OFFICE

Expected:

- shared heating questions
- no boiler-model-first requirement
- route = MANAGEMENT_OFFICE

### U-HEAT-03

heating_type UNKNOWN

Expected:

- ask heating type
- no inferred heating route

---

## Leak

### U-LEAK-01

management office + ceiling leak

Expected:

- location evidence
- management office candidate
- no liability wording

### U-LEAK-02

owner direct + appliance leak

Expected:

- fixture + leak evidence
- landlord review

---

# 48. Routing Integrity Tests

### U-ROUTE-01

`approval_year` changes 2011 → 1990.

Expected:

> Route unchanged.

Reason:

`routing_eligible=false`.

### U-ROUTE-02

`heating_type` INDIVIDUAL → CENTRAL_SHARED.

Expected:

> Protocol / Route changes.

### U-ROUTE-03

Kapt match not found.

Expected:

> management_mode stays UNKNOWN.

not NONE.

---

## Evidence Gate

### U-EVID-01

required evidence missing.

Expected:

- evidenceState = `MISSING_REQUIRED`
- normal recommendation = null
- status = `PARTIAL`

### U-EVID-02

conflicting answers/evidence.

Expected:

- evidenceState = `CONFLICTING`
- normal recommendation = null
- human review required

### U-EVID-03

Safety escalated.

Expected:

- recommendation = null
- no normal route approval action

---

## Review State

### U-STATE-01

READY_FOR_REVIEW → REQUEST_MORE_INFO.

Expected:

- status = `NEEDS_MORE_INFO`
- no RouteDecision yet
- `MORE_INFO_REQUESTED` AuditEvent

### U-STATE-02

NEEDS_MORE_INFO + new answer/evidence.

Expected:

- status = `IN_PROGRESS`
- re-finalize allowed
- packet revision increments

---

# 49. LLM Independence Test

### U-LLM-01

LLM adapter disabled.

Expected:

Full Hero Demo works using:

- Quick Category
- deterministic protocol
- template summary

---

# 50. Integration Tests

### I-01

Fixture Building A create → verify → Tenant heating → finalize.

Expected:

Repair Packet generated.

### I-02

Fixture Building B same issue.

Expected:

different Protocol and Route.

### I-03

Safety hard stop.

Expected:

Packet contains safety escalation and no normal recommendation.

### I-04

Route override.

Expected:

AuditEvent contains recommended/selected route.

### I-05

Missing required evidence.

Expected:

- PARTIAL
- no automatic RouteRecommendation
- landlord can request more info

### I-06

Request more info → tenant supplies data → re-finalize.

Expected:

- NEEDS_MORE_INFO → IN_PROGRESS → READY_FOR_REVIEW
- Repair Packet revision increases
- recommendation only appears after completeness gate passes

---

# 51. API Failure Tests

### I-API-01

Address provider fails.

Expected:

- user sees fallback
- DEMO mode works
- no crash

### I-API-02

Building provider returns multiple.

Expected:

- candidate selection
- no automatic choice

### I-API-03

Building provider fails.

Expected:

- manual context path available

---

# 52. E2E — Playwright Mandatory

## E2E-01 Hero A

1. Demo
2. Select Building A
3. Verify Context
4. Tenant enters heating issue
5. Complete individual protocol
6. Submit
7. Landlord opens Repair Packet
8. sees LANDLORD_REVIEW / manufacturer alternative
9. approve

---

## E2E-02 Hero B

Same heating issue.

Expected:

- shared heating questions
- MANAGEMENT_OFFICE recommendation
- no individual boiler evidence-first flow

---

## E2E-03 Comparison

System proves:

```text
same issue text
+
different building context
=
different protocol/route
```

---

## E2E-04 Safety

Gas smell yes.

Expected:

- safety message
- normal flow suspended
- recommendation = null
- normal approve action hidden

---

# 53. Test Browsers

At minimum:

- Chromium desktop landlord
- Chromium mobile tenant

Before delivery:

- one WebKit tenant smoke test

Playwright supports Chromium/WebKit/Firefox and mobile emulation.

---

# 54. Logging

P0 internal structured log:

```text
request_id
ticket_id
protocol_id
protocol_version
safety_flags
route_recommended
route_selected
override
runtime_mode
```

PII/logging 금지:

- uploaded image binary
- user exact address in test logs
- API secrets

---

# 55. Observability for Contest Evidence

MVP가 만들어지면 측정 가능한 기술지표:

- Fixture scenario pass
- live address search success/failure
- profile fields populated
- owner correction count
- protocol selected
- evidence completeness
- human override count

### 주의

이것은 고객효과 KPI가 아니다.

> **technical execution evidence**

다.

---

# 56. Demo Script — 60~75 Seconds

## 0–8초

> “세입자가 ‘난방이 안 돼요’라고 말했을 때 모든 건물에 같은 질문을 하면 될까요?”

Building A/B 표시.

---

## 8–20초

Building A 선택.

Building Passport:

```text
다가구
개별난방
관리실 없음
```

---

## 20–35초

DEMO-only `203호 세입자 신고 화면 열기`로 역할을 전환.

Tenant:

> “난방이 안 돼요.”

질문:

- 온수?
- 보일러 화면?
- 가스 냄새?

---

## 35–48초

Repair Packet:

```text
개별난방
관리실 없음
→ 임대인 검토
→ 제조사 A/S 후보
```

`왜?` 근거 표시.

---

## 48–65초

같은 신고를 Building B에서 보여준다.

```text
공동난방
관리주체 있음
→ 질문 변화
→ 관리주체 후보
```

---

## 65–75초

마무리:

> **건물이 다르면, 같은 신고도 다르게 물어야 합니다.**
>
> **주소가 수리 프로토콜이 됩니다.**

---

# 57. Contest Screenshot Set

## Image 1

Hero comparison A vs B.

## Image 2

Building Passport.

## Image 3

Owner Verification.

## Image 4

Tenant Issue.

## Image 5

Guided Evidence.

## Image 6

Repair Packet.

## Image 7

Why/Provenance.

## Image 8

Human Override.

필요하면 8장까지만.

10장을 채우기 위해 억지 이미지 추가 금지.

---

# 58. Acceptance Criteria — Product

## AC-01

DEMO Building A/B가 synthetic임이 명확하다.

## AC-02

같은 HEATING issue가 A/B에서 다른 questions를 생성한다.

## AC-03

같은 HEATING issue가 A/B에서 다른 route recommendation을 생성한다.

## AC-04

`approval_year` 변경이 route를 바꾸지 않는다.

## AC-05

Safety hard stop이 normal protocol보다 우선한다.

## AC-06

LLM 없이 Hero Demo 전체 동작.

## AC-07

Repair Packet에 routing basis source가 보인다.

## AC-08

Landlord가 Route override 가능.

## AC-09

override가 AuditEvent로 남는다.

## AC-10

K-apt not found가 `관리실 없음`으로 변환되지 않는다.

## AC-11

Building API 실패에도 fallback path 존재.

## AC-12

real PII가 fixture/test에 없음.

## AC-13

`MISSING_REQUIRED`/`CONFLICTING` 상태에서는 자동 Route 추천이 생성되지 않음.

## AC-14

`REQUEST_MORE_INFO`가 `NEEDS_MORE_INFO` 상태로 전이되고 tenant data 추가 후 재finalize 가능.

## AC-15

Public FIXTURE demo에서는 실제 파일 upload와 real tenant data 저장이 기본 비활성화.

---

# 59. Acceptance Criteria — Engineering

## ENG-01

TypeScript strict compile passes.

## ENG-02

Lint passes.

## ENG-03

Unit tests pass.

## ENG-04

Integration tests pass.

## ENG-05

Playwright Hero scenarios pass.

## ENG-06

No secret committed.

## ENG-07

No real PII fixture.

## ENG-08

No direct provider response type leaks into domain.

## ENG-09

Domain routing logic has no Next.js dependency.

## ENG-10

Core routing works with LLM adapter disabled.

## ENG-11

`next build` passes in the pinned Node 24 environment.

## ENG-12

FIXTURE automated tests use no live network dependency.

## ENG-13

Repository unit tests pass with in-memory adapter.

## ENG-14

No serverless deployment path assumes local SQLite is durable.

---

# 60. Acceptance Criteria — UX

## UX-01

Tenant flow works at 390px mobile viewport.

## UX-02

Landlord flow works at 1280px desktop.

## UX-03

No horizontal scrolling in core flow.

## UX-04

Each guided step has one primary action.

## UX-05

Source/provenance labels are understandable.

## UX-06

AI recommendation is visually distinguishable from verified fact.

## UX-07

UNKNOWN state is visible, not silently inferred.

## UX-08

Safety screen clearly interrupts normal flow.

---

# 61. Error Copy

## Address failure

> 건물정보를 불러오지 못했어요. DEMO 건물을 선택하거나 필요한 정보만 직접 확인할 수 있어요.

## Multiple buildings

> 이 주소에서 여러 건물이 확인됐어요. 관리하려는 건물을 선택해주세요.

## Unknown heating

> 난방방식을 확인하지 못했어요. 알고 있는 방식을 선택하거나 ‘모름’을 선택해주세요.

## Missing evidence

> 일부 정보가 부족해요. 그래도 접수할 수 있고, 관리자가 추가 확인을 요청할 수 있어요.

## Safety

> 안전 확인이 먼저 필요한 상황입니다.

---

# 62. Runtime Safety Copy — Gas

공식 지침의 의미를 축약해 사용.

> **가스 냄새가 난다면 일반 점검을 중단합니다. 가능한 경우 가스 공급을 차단하고 창문과 출입문을 열어 환기하세요. 전기기구는 사용하지 말고 도시가스 관리기관 등 전문기관에 연락해 안전을 확인하세요. 위험하다고 느껴지면 안전한 곳으로 이동해 긴급 도움을 요청하세요.**

제품 출시 전 최종 문구는 공식 안전지침과 다시 대조한다.

---

# 63. Product Metrics — P0

고객효과가 아니라 제품 정상동작 지표.

- Scenario completion
- Protocol branch selected
- Safety rule activation
- Evidence state
- Repair Packet generated
- Route recommendation
- Route override
- API fallback usage

---

# 64. Non-Goals

이 Spec이 완료돼도 다음을 주장하지 않는다.

- 고객이 돈을 낸다.
- 수리시간이 줄었다.
- 분쟁이 줄었다.
- 사고가 줄었다.
- 국내 최초다.
- PMF가 있다.
- AI가 고장원인을 맞힌다.

---

# 65. Contest Story Alignment

## Problem

같은 문장이라도 실제 처리에 필요한 정보는 건물마다 다르다.

## Existing market

국내 서비스들은 민원 접수·상태·작업·임대관리까지 이미 제공한다.

## Our narrow hypothesis

> 접수 `이후`가 아니라 접수 `순간`의 품질을 Building Context로 바꾼다.

## Technical feasibility

- 주소 API
- 건축HUB
- owner verification
- deterministic protocol
- web MVP

## Execution

두 건물, 두 하자로 vertical slice.

---

# 66. Founder Fit Alignment

신청서에서는 다음 정도로만 연결한다.

> 건축학을 전공하며 건축물의 용도·구조·공간정보를 다뤘고, BIM 및 AI·데이터 프로젝트에서 서로 다른 정보를 구조화해 의사결정 workflow로 연결해왔다. 이 경험을 바탕으로 공공 건축정보를 유지관리 의사결정에 연결하는 MVP를 직접 설계·검증한다.

직접 임대관리 경험이 있다고 확대하지 않는다.

---

# 67. Tech Stack Rationale

## Next.js 16.3

- full-stack Web MVP
- App Router
- server-only external API adapters
- mobile/desktop responsive UI
- Contest demo + future deployment

2026-08 security release 기준 16.3.3이 Active LTS로 안내됐다.

## Node 24 LTS

2026-09 현재 LTS.

Node 26은 Current이므로 contest MVP에서는 Node 24를 권장한다.

## Vitest 5

2026-09 최신 major.

## Playwright

- Chromium/WebKit/Firefox
- mobile emulation
- E2E Hero test

---

# 68. Versioning Policy

신규 repo 기준:

- Node: 24 LTS
- Next: 16.3.x Active LTS
- package versions: install 시점 compatible stable
- lockfile 반드시 commit
- exact resolved versions lockfile로 고정

Codex는 보안 patch가 있는 package를 임의로 과거 취약 버전으로 pin하지 않는다.

---

# 69. Documentation Requirements

Repo에:

```text
docs/
├─ product/
│  ├─ 05_product_spec_v1.md
│  ├─ protocol_heating.md
│  ├─ protocol_leak.md
│  └─ demo_script.md
├─ architecture/
│  ├─ adapters.md
│  └─ safety_precedence.md
└─ decisions/
   └─ ADR-001-building-aware-scope.md
```

실제 경로는 repo가 생긴 뒤 프로젝트 convention에 맞춘다.

---

# 70. Decision Record

ADR:

> **Why not full PMS?**

결론:

국내 경쟁사가 이미 강하고 Contest hypothesis를 흐리므로 maintenance intake intelligence만 구현.

ADR:

> **Why LLM optional?**

Safety/routing deterministic integrity와 demo reliability.

ADR:

> **Why fixtures?**

External API failure로 contest demo와 tests가 깨지는 것을 방지.

---

# 71. Product Spec Self-Review

## Placeholder scan

- TBD/TODO 없음
- P1/P2는 out-of-scope로 명시

## Internal consistency

- P0 = 2 buildings × 2 protocols
- OCR/QR optional
- Vendor P1
- LLM optional
- Human approval required
- Evidence Gate before auto recommendation
- REQUEST_MORE_INFO state transition defined
- Safety escalation and normal routing separated
- Persistence runtime separated from deployment assumptions

재감사 후 일관됨.

## Scope check

단일 구현계획으로 관리 가능한 수준.

## Ambiguity check

다음은 구현 전에 Codex가 임의로 결정하면 안 됨:

- Live Juso/BuildingHUB exact field mapping
- actual API keys
- production hosting
- production auth
- production file storage

P0에서는 adapter/fallback로 처리.

---

# 72. Spec Approval Gate

이 문서는 **구현 전 최종 제품 설계 문서**다.

다음 단계로 넘어가기 전에 사용자가 승인해야 한다.

승인 후에만:

1. `writing-plans` 단계
2. 구현 태스크 분할
3. TDD 순서
4. Codex Astra High Master Prompt
5. 실제 개발

로 진행한다.

---

# Sources

## Official Public Data

1. 주소기반산업지원서비스  
   https://business.juso.go.kr/

2. 국토교통부 건축HUB 건축물대장정보  
   https://www.data.go.kr/data/15134735/openapi.do

3. 국토교통부 공동주택 기본정보  
   https://www.data.go.kr/data/15058453/openapi.do

4. 한국가스안전공사 누출시 응급조치  
   https://www.kgs.or.kr/kgs/abad/view.do

5. 소방청 소방안전교육 플랫폼  
   https://119metaverse.nfa.go.kr/

## Technical Platform

6. Next.js official blog/docs  
   https://nextjs.org/blog  
   https://nextjs.org/docs

7. Node.js releases  
   https://nodejs.org/

8. Vitest  
   https://vitest.dev/

9. Playwright  
   https://playwright.dev/

10. Drizzle ORM — SQLite / node:sqlite  
    https://orm.drizzle.team/docs/sqlite/get-started-sqlite  
    https://orm.drizzle.team/docs/get-started/node-sqlite-new

11. Vercel — SQLite / ephemeral filesystem limitation  
    https://vercel.com/kb/guide/is-sqlite-supported-in-vercel

12. 도로명주소 도움센터 — API 식별 조합 / 지번 필드  
    https://business.juso.go.kr/addrlink/qna/qnaDetail.do?bulletinRefSn=133153  
    https://m1.juso.go.kr/addrlink/qna/qnaDetail.do?bulletinRefSn=130109

---

# Document Control

- Step: `05`
- Version: `V1_REAUDITED_V2`
- Status: `RE_AUDITED_V2_READY_FOR_USER_REVIEW`
- Product: `BUILDING_AWARE_AI_REPAIR_ROUTER`
- Architecture: `BUILDING_AWARE_MAINTENANCE_INTELLIGENCE_LAYER`
- Hero: `ADDRESS_TO_PROTOCOL`
- MVP Buildings: `2_SYNTHETIC_FIXTURES`
- MVP Protocols: `HEATING_LEAK`
- Core LLM Dependency: `NO`
- Safety Precedence: `HARD_RULE_FIRST`
- Human Approval: `REQUIRED`
- OCR: `OPTIONAL`
- QR: `OPTIONAL`
- K-apt: `OPTIONAL_ADAPTER`
- Live API: `ADAPTER_WITH_FALLBACK`
- Persistence: `REPOSITORY_PORT_LOCAL_NODE_SQLITE_INMEMORY_TEST`
- Recommended Runtime: `NODE_24_LTS_NEXT_16_3`
- Test: `VITEST_5_PLAYWRIGHT`
- Evidence Recommendation Gate: `COMPLETE_ONLY`
- More Info State: `NEEDS_MORE_INFO_DEFINED`
- Public Demo Upload: `DISABLED_BY_DEFAULT`
- Public Demo Runtime: `FIXTURE_FIRST`
- Cloud SQLite Durability: `NOT_ASSUMED`
- Customer Evidence: `MISSING`
- PMF: `NOT_CLAIMED`
- Implementation: `BLOCKED_PENDING_USER_APPROVAL`
- Next: `06_CODEX_IMPLEMENTATION_PLAN_AND_MASTER_PROMPT`
- Last reviewed: `2026-09-14`
