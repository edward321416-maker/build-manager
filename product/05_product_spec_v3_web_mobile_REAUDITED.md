# 모두의 창업 2기 — Building-Aware AI Repair Router
## Step 05 v3 — Web + Mobile Monorepo Product Spec

- 문서 상태: **RE-AUDITED v3 / APPROVED ARCHITECTURE**
- 기준일: **2026-09-14**
- 이전 기준본: `05_product_spec_v1_REAUDITED_v2.md`
- 이전 기준본 상태: **SUPERSEDED — 구현 기준으로 사용 금지**
- 제품 외부명(Working): **건물 맞춤형 AI 수리 라우터**
- 내부 아키텍처명: **Building-Aware Maintenance Intelligence**
- Hero Message: **주소가 수리 프로토콜이 된다**
- P0 플랫폼: **Web + iOS/Android App**
- P0 역할: **Web Landlord + Web Tenant + App Landlord + App Tenant**
- PMF: `NOT_CLAIMED`
- Customer Evidence: `MISSING`
- WTP: `UNVALIDATED`

---

# 0. Executive Decision

P0가 증명할 핵심은 웹과 앱을 둘 다 만들었다는 사실이 아니다.

> **같은 세입자 신고라도 검증된 Building Context가 다르면 필요한 질문·증거·추천 처리경로가 달라진다.**

웹과 앱은 이 핵심가설을 동일한 서버 규칙으로 제공하는 delivery surface다.

차별성:

```text
Address
→ Verified Building Context
→ Maintenance Protocol
→ Guided Evidence
→ Explained Route
→ Human Decision
```

실행 채널:

```text
Landlord Web
Tenant Web
Landlord App
Tenant App
```

공모전에서 `Address → Context → Protocol`을 차별성으로, Web/App은 실행가능성과 접근성으로 설명한다.

---

# 1. Final Monorepo Architecture

```text
build-manager/
├─ apps/
│  ├─ web/                       # Next.js UI + authoritative HTTP API
│  └─ mobile/                    # Expo Router iOS/Android
│
├─ packages/
│  ├─ domain/                    # Pure business rules
│  ├─ application/               # Use cases + ports
│  ├─ api-contracts/             # Zod API DTOs
│  ├─ api-client/                # Typed HTTP client
│  └─ fixtures/                  # Synthetic server/test fixtures
│
├─ product/
├─ research/
├─ submission/
├─ ops/
└─ governance/
```

Root package manager: **npm workspaces**.

```json
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"]
}
```

P0에서는 Turborepo, Nx, pnpm workspace를 추가하지 않는다.

---

# 2. Authority Boundary

## 2.1 Core source는 공유하지만 Core decision은 서버만 실행

다음 authoritative decision을 Web/Mobile client가 직접 계산하면 안 된다.

- Safety Hard Stop
- Protocol branch selection
- Evidence completeness
- Route recommendation
- Repair Packet authoritative state
- Ticket state transition

실행 구조:

```text
Landlord Web ─┐
Tenant Web ───┤
              ├── packages/api-client
Landlord App ─┤
Tenant App ───┘
                     │
                     ▼
          apps/web /api/v1/*
                     │
                     ▼
          packages/application
                     │
                     ▼
              packages/domain
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
     Safety       Protocol       Routing
       │             │             │
       └─────────────┼─────────────┘
                     ▼
                Repair Packet
```

클라이언트는 API contract를 소비하고 UI만 표현한다.

---

# 3. Shared Package Boundaries

## 3.1 `packages/domain`

Pure TypeScript only.

금지 imports:

- React
- React Native
- Next.js
- Expo
- Drizzle 및 모든 ORM
- `node:sqlite` / server persistence driver
- fetch/HTTP
- process.env

Owns:

- Building Context types
- Ticket state
- Safety rules
- Heating / Leak Protocol
- Evidence completeness
- Routing
- Repair Packet
- Human review state transitions

## 3.2 `packages/application`

Framework-independent use cases and ports.

Use cases:

```text
createDemoBuilding
verifyBuildingContext
createTicket
submitTicketAnswer
submitTicketEvidence
finalizeTicket
approveRecommendation
overrideRoute
requestMoreInfo
listTickets
getTicket
resetDemo
listBuildings
getBuilding
searchAddress
```

### Read/discovery use cases

`GET /api/v1/demo/buildings`, `GET /api/v1/buildings/:id`, `GET /api/v1/address/search`
는 각각 Application use case를 거친다.

```text
listBuildings   → BuildingRepository.list()
getBuilding     → BuildingRepository.findById()  (없으면 null)
searchAddress   → AddressProvider.lookup()
```

Route Handler가 repository/provider를 직접 호출하지 않는다. 승인된 방향은
`HTTP → Application → Port`이며 `HTTP → Repository/Provider`가 아니다.

이 세 use case는 orchestration만 한다. business rule, DB 접근, network,
fixture import를 추가하지 않는다.

`getBuilding`은 `getTicket`과 같은 not-found 규약을 따라 없으면 `null`을 반환하고,
404 매핑은 HTTP layer가 담당한다.

Ports:

```text
BuildingRepository
TicketRepository
AddressProvider
BuildingRegistryProvider
KaptProvider
Clock
IdGenerator
DemoStateResetter
```

### `resetDemo`

Demo reset은 HTTP가 repository나 fixture를 직접 건드리는 경로가 아니다.

```text
HTTP
→ Application resetDemo()
→ DemoStateResetter port
→ server adapter
```

Semantics:

```text
현재 demo ticket 전부 삭제
owner/user가 변경한 demo building 상태 폐기
canonical synthetic demo building 재시드
재시드된 demo building 목록 반환
```

이것은 **production destructive endpoint가 아니다**. Synthetic demo state에만 작용한다. 실제 사용자 데이터, 실제 건물, 실제 티켓을 지우는 기능이 아니며 그렇게 표현해서도 안 된다.

Reset은 idempotent해야 하고 부분 상태를 남기지 않는다. Reset 이후에는 owner-verified mutation도 baseline으로 돌아간다.

Container 생성 자체는 reset이 아니다. Baseline seed는 store가 비어 있을 때만 허용하고, destructive reseed는 명시적 reset 경로에서만 일어난다.

## 3.3 `packages/api-contracts`

The directory name is intentionally `api-contracts`. The repository reserves an exact path segment named `contracts` for sensitive/legal contract material through `.gitignore` and `scripts/verify_repository.py`; application API schemas must not weaken that privacy boundary.

Public HTTP boundary only.

Owns:

### `CreateTicketRequest`

```text
buildingId
issueType
rawUserText
```

`rawUserText`는 세입자가 직접 쓴 신고 원문이며 **required**다. 이것이 없으면
report-text 기반 Safety 처리가 HTTP 경로에서 아예 도달 불가능해진다.

`rawUserText`는 **untrusted tenant input**이다.

```text
기존 deterministic Safety Gate가 report text를 평가할 수 있다
Safety 판단은 Domain에서만 수행한다
HTTP/client는 Safety 로직을 재구현하지 않는다
```

Client와 Route Handler는 `rawUserText`를 **로그로 남기지 않는다**. 공개 error
body에 넣지 않고, HTML로 렌더링하지 않으며, LLM에 보내지 않는다. 응답으로 다시
돌려주지도 않는다.

별도의 max length는 두지 않는다. 현재 canonical 문서가 정의한 길이 상한이 없기
때문이다.

`unitId`는 public contract에 포함하지 않는다. P0는 demo building마다 synthetic
unit context 하나를 가정하고, 서버가 그 unit identity를 파생한다. Unit 관리나
인증으로 확장하지 않는다.

- Zod request schemas
- Zod response schemas
- DTO types
- public enums/status
- API error envelope

내부 Domain entity를 그대로 API response로 노출하지 않는다.

Role-specific DTO를 분리한다.

```text
LandlordTicketDetailDto
TenantTicketStatusDto
TenantQuestionDto
BuildingPassportDto
```

## 3.4 `packages/api-client`

Imports only `@build-manager/api-contracts`.

Owns:

```text
listDemoBuildings()
getBuilding()
verifyBuildingContext()
createTicket()
submitAnswer()
submitEvidence()
finalizeTicket()
listTickets({ view })
getLandlordTicket()
getTenantTicketStatus()
approveRoute()
overrideRoute()
requestMoreInfo()
resetDemo()
```

## 3.5 `packages/fixtures`

Synthetic data only.

금지:

- 실제 개인 주소
- 실제 세입자 정보
- 실제 민원 원문
- 실제 사진/영상

---

# 4. Client Import Policy

| Package | Web UI | Mobile UI | Next API/Server |
|---|---:|---:|---:|
| `domain` | ❌ | ❌ | ✅ |
| `application` | ❌ | ❌ | ✅ |
| `api-contracts` | ✅ | ✅ | ✅ |
| `api-client` | ✅ | ✅ | 선택 |
| `fixtures` | ❌ | ❌ | ✅ |

Architecture test로 이 경계를 강제한다.

---

# 5. Platform Versions

## Runtime

- Node.js: **24 LTS**
- 2026-09-14 확인 기준 Node 24.21.0 LTS가 제공됨.

Official:
- https://nodejs.org/en/blog/release

## Web

- Next.js: **16.3.4**
- React: **19.2.3**
- App Router
- TypeScript strict
- Zod
- Playwright
- Vitest

2026-09-14 확인 기준 npm `next` latest는 16.3.4.

Official/reference:
- https://www.npmjs.com/package/next
- https://nextjs.org/docs

## Mobile

- Expo SDK: **57 stable**
- Expo patch: `57.0.17` 이상 SDK 57 compatible patch 권장
- React Native: **0.86.x**
- React: **19.2.3**
- Expo Router
- `jest-expo`
- `@testing-library/react-native`

Expo SDK 57 공식 mapping:

```text
React Native 0.86
React 19.2.3
Minimum Node 22.13.x
```

Official:
- https://expo.dev/changelog/sdk-57
- https://docs.expo.dev/versions/latest/
- https://docs.expo.dev/develop/unit-testing/
- https://docs.expo.dev/router/reference/testing/

---

# 6. Dependency Deduplication

Expo는 monorepo에서 중복 React/React Native/native module을 주의하라고 안내한다.

Root npm workspace에서 React를 단일 버전으로 맞춘다.

권장:

```json
{
  "overrides": {
    "react": "19.2.3",
    "react-dom": "19.2.3"
  }
}
```

React Native는 Expo SDK 57이 지원하는 버전에서 임의 override하지 않는다.

Release gate:

```bash
npm ls react
npm ls react-dom
npm ls react-native
npm ls expo
```

Official:
- https://docs.expo.dev/guides/monorepos/

---

# 7. Shared Package Transpilation

P0 shared package는 source TypeScript를 사용한다.

각 package마다 별도 `dist/` build pipeline을 만들지 않는다.

Next는 `transpilePackages`로 workspace package를 처리한다.

Expo SDK 52+ Metro는 공식 monorepo 설정에서 workspace를 자동 감지한다.

Official:
- https://nextjs.org/docs/architecture/nextjs-compiler
- https://docs.expo.dev/guides/monorepos/

---

# 8. Backend

P0 backend는 별도 `apps/api`를 만들지 않는다.

Next Route Handlers 사용:

```text
apps/web/src/app/api/v1/
```

Endpoint family:

```text
GET  /api/v1/demo/buildings
POST /api/v1/demo/reset
GET  /api/v1/address/search
GET  /api/v1/buildings/:id
PATCH /api/v1/buildings/:id/context
GET  /api/v1/tickets
POST /api/v1/tickets
GET  /api/v1/tickets/:id
POST /api/v1/tickets/:id/answers
POST /api/v1/tickets/:id/evidence
POST /api/v1/tickets/:id/finalize
POST /api/v1/tickets/:id/decision
```

## 8.1 P0 Ticket Role Projection

Ticket read endpoint는 `view` query parameter로 role projection을 고른다.

```text
GET /api/v1/tickets?view=landlord
GET /api/v1/tickets?view=tenant

GET /api/v1/tickets/:id?view=landlord
GET /api/v1/tickets/:id?view=tenant
```

`view`의 의미를 과장하지 않는다.

```text
view = P0/demo response projection selector
view != authentication
view != authorization
```

`view`는 어떤 신원도 증명하지 않는다. P0는 synthetic data만 사용하므로 demo projection으로 충분하다.

Tenant projection은 landlord-only field를 전송하지 않는다. 숨기는 것이 아니라 응답에 넣지 않는다. 자세한 목록은 24절을 따른다.

Production authentication이 생기면 authenticated role이 projection을 결정해야 하며, client가 보낸 `view`가 결정해서는 안 된다.

장기적으로 별도 API 서버가 필요하면 `domain/application/api-contracts`를 그대로 이동할 수 있다.

---

# 9. Mobile API Configuration

Mobile은 non-secret base URL만 사용한다.

```text
EXPO_PUBLIC_API_URL
```

절대 넣지 않음:

- Juso service key
- OpenAI/API secret
- DB credential
- auth secret

개발 예시:

```text
Android emulator: http://10.0.2.2:3000
iOS simulator:     http://127.0.0.1:3000
Physical device:   http://<developer-LAN-IP>:3000
```

실제 개발 URL은 환경에서 설정한다.

---

# 10. Persistence

Mobile은 SQLite를 직접 읽지 않는다.

```text
Mobile/Web UI
→ HTTP API
→ Application
→ Repository Port
→ Server Persistence Adapter
```

P0 local server:

- Repository interfaces: `packages/application`
- Local adapter: `apps/web/src/server/persistence/`
- **P0 local persistence = 직접 Node `node:sqlite` server adapter**
- **P0에 ORM 없음** (Drizzle 포함 어떤 ORM도 P0에 사용하지 않는다)
- Tests: in-memory repository

**Production persistence는 아직 선택되지 않았다.** 로컬 SQLite를 serverless cloud
durable DB로 간주하지 않는다. Repository port가 Application 경계를 유지하므로
향후 adapter 교체는 port 구현만 바꾸면 된다.

Production DB/hosting migration은 P1.

## 11.1 Local runtime stability

현재 로컬 런타임 기준:

```text
Node v24.14.0
node:sqlite Stability 1.1 / Active development
ExperimentalWarning observed
```

`node:sqlite`는 Node v24.15.0에서 Release Candidate가 된다. 현재 v24.14 어댑터를
Release Candidate라고 부르지 않는다. Production-stable이라고도 부르지 않는다.
Task 11만을 위해 Node를 올리지 않는다.

`DatabaseSync`는 동기 API다. 이는 로컬 contest/demo P0에서만 허용되며, 이로부터
production 동시성/처리량 특성을 주장하지 않는다.

이 store는 **synthetic demo 전용**이다. 실제 세입자 기록, 실제 주소, production
data를 담지 않는다.

## 11.2 Version terminology

두 가지 버전을 분리한다.

```text
SQLite database schema:
  SQLITE_DATABASE_SCHEMA_VERSION = 1
  PRAGMA user_version 에 저장

Persisted aggregate JSON:
  PERSISTED_AGGREGATE_VERSION = 1
  각 row 의 aggregate_version 컬럼에 저장
```

이전에 제안되었던 row 컬럼명 `schema_version`은 `aggregate_version`으로 대체한다.
DB schema 버전과 row aggregate 버전은 서로 다른 축이므로 같은 이름을 쓰지 않는다.

## 11.3 Task 12 runtime constraint

이 로컬 SQLite server container를 import하는 Next Route Handler는 반드시 다음을
명시해야 한다.

```ts
export const runtime = "nodejs";
```

이 adapter에 Edge runtime을 사용하지 않는다.

---

# 11. P0 Roles

사용자 승인:

> **P0 Web = 임대인 + 세입자**
>
> **P0 App = 임대인 + 세입자**

이는 Capability parity이며 pixel/screen parity가 아니다.

---

# 12. Capability Matrix

| Capability | Web Landlord | Web Tenant | App Landlord | App Tenant |
|---|---:|---:|---:|---:|
| DEMO role entry | ✅ | ✅ | ✅ | ✅ |
| Demo building select | ✅ | — | ✅ | — |
| Building Passport | ✅ | 최소 | ✅ | 최소 |
| Owner context verify | ✅ | — | ✅ | — |
| Issue create | — | ✅ | — | ✅ |
| Guided questions | — | ✅ | — | ✅ |
| Synthetic evidence | — | ✅ | — | ✅ |
| Safety interruption | 상태 | ✅ | 상태 | ✅ |
| Ticket list | ✅ | own status | ✅ | own status |
| Repair Packet | ✅ | simplified | ✅ | simplified |
| Route approve | ✅ | — | ✅ | — |
| Route override | ✅ | — | ✅ | — |
| Request more info | ✅ | respond | ✅ | respond |
| DEMO role switch | ✅ | ✅ | ✅ | ✅ |

---

# 13. Platform UX

## Web Landlord

Desktop-first.

```text
Building
→ Ticket Dashboard
→ Repair Packet
→ Routing Basis
→ Approve / Override / More Info
```

## App Landlord

Quick-action first.

```text
Ticket List
→ Compact Repair Packet
→ Why
→ Approve / Override / More Info
```

Desktop dashboard UI를 앱에 복제하지 않는다.

## Web Tenant

Mobile-responsive no-install fallback.

```text
URL
→ Issue
→ One question at a time
→ Synthetic evidence
→ Submitted/status
```

## App Tenant

Native navigation.

```text
DEMO role
→ Issue
→ One question at a time
→ Synthetic evidence
→ Submitted/status
```

실제 Camera는 P0 제외.

---

# 14. Hero Demo

## Primary

**Tenant App → Landlord Web**

```text
App Tenant
“난방이 안 돼요”
↓
Building-aware questions
↓
Evidence
↓
Repair Packet
↓
Web Landlord
↓
Why
↓
Approve
```

## Secondary

**Tenant Web → Landlord App**

```text
No-install Web report
↓
App Landlord Ticket
↓
Repair Packet
↓
Decision
```

공모전에서는 모든 화면을 대칭적으로 시연하지 않는다.

---

# 15. Demo Building A

```yaml
id: demo-building-a
display_name: DEMO 해솔빌라
demo: true
primary_use: 다가구주택
approval_year: "2011"
management_mode: OWNER_DIRECT
heating_type: INDIVIDUAL
owner_supplied_boiler: true
```

Routing eligible:

- management_mode
- heating_type
- owner_supplied_boiler

Informational only:

- approval_year
- floors
- structure
- parking

---

# 16. Demo Building B

```yaml
id: demo-building-b
display_name: DEMO 라온하우징
demo: true
primary_use: 공동주택
approval_year: "2018"
management_mode: MANAGEMENT_OFFICE
heating_type: CENTRAL_SHARED
```

No real address.

---

# 17. Protocol Scope

P0 only:

```text
HEATING_V1
LEAK_V1
```

No third protocol until P0 acceptance gates pass.

---

# 18. Decision Precedence

```text
1. SAFETY HARD STOP
2. VERIFIED ROUTING-ELIGIBLE CONTEXT
3. DETERMINISTIC PROTOCOL
4. OPTIONAL LANGUAGE NORMALIZATION
5. HUMAN DECISION
```

P0 Safety flags:

```text
GAS_SMELL
SMOKE_OR_FIRE
ELECTRICAL_WATER_RISK
```

Safety escalation:

```text
recommendation = null
normal approve = unavailable
ordinary troubleshooting = suspended
```

---

# 19. Evidence Recommendation Gate

```text
COMPLETE
→ normal automatic RouteRecommendation allowed

MISSING_REQUIRED
→ recommendation = null

CONFLICTING
→ recommendation = null

SAFETY_ESCALATED
→ recommendation = null
```

사람이 manual route를 선택할 수는 있지만 시스템 추천으로 표시하지 않는다.

---

# 20. More-info State Machine

```text
READY_FOR_REVIEW / PARTIAL
→ REQUEST_MORE_INFO
→ NEEDS_MORE_INFO
→ tenant adds data
→ IN_PROGRESS
→ finalize
→ READY_FOR_REVIEW
```

Repair Packet regeneration 시 revision +1.

---

# 21. LLM Policy

P0 Core는 LLM 없이 작동해야 한다.

Optional language layer가 향후 할 수 있는 것:

- free-text category parsing
- deterministic question wording
- answer normalization
- summary wording

할 수 없는 것:

- Safety override
- Protocol condition 변경
- Evidence Gate 변경
- Routing Rule 변경
- 법적 책임 판정
- Human Decision 대체

P0 acceptance를 위해 LLM SDK를 설치할 필요 없음.

---

# 22. Evidence / Media

Public P0는 synthetic evidence만 사용.

예:

```text
DEMO 보일러 표시창 이미지
DEMO 누수 위치 이미지
```

실제 Camera/Gallery는 P0.5/P1.

이유:

- 권한
- 저장소
- PII/EXIF
- consent
- 핵심가설과 무관

---

# 23. Push / Auth

Push notifications: **P1**.

Production authentication: **P1**.

P0에는 명확한:

```text
DEMO MODE
[임대인으로 보기]
[세입자로 보기]
```

만 제공한다.

실제 권한체계가 구현됐다고 주장하지 않는다.

---

# 24. Tenant/Landlord Data Separation

Tenant response는 다음을 노출하지 않는다.

- landlord internal notes
- internal-only route alternatives
- 비용
- 다른 호실
- hidden contact data

Contracts:

```text
LandlordTicketDetailDto
TenantTicketStatusDto
```

를 분리한다.

## 24.1 Role-explicit client reads

Client read API는 role을 암묵적 기본값으로 두지 않는다.

```text
listTickets({ view: "landlord" })  -> LandlordTicketDetailDto[]
listTickets({ view: "tenant" })    -> TenantTicketStatusDto[]

getLandlordTicket(id)       -> LandlordTicketDetailDto
getTenantTicketStatus(id)   -> TenantTicketStatusDto
```

Literal `view`에 따라 return type이 좁아져야 한다. 두 role의 union을 호출자가 직접 좁히도록 미루지 않는다.

별도 list-item DTO는 기존 데이터가 실제로 요구하지 않는 한 추가하지 않는다.

## 24.2 `DecisionRequest`: transport vs domain

`DecisionRequest`는 **HTTP review-action request union**이다. Domain `RouteDecision`과 같은 것이 아니다.

Transport discriminant와 Domain action 이름은 서로 다르며, 둘 다 이미 commit된 이름이므로 rename하지 않는다.

```text
transport DecisionRequest.type = "APPROVE"
→ application approveRecommendation()
→ Domain RouteDecision.action = "APPROVE_RECOMMENDATION"

transport DecisionRequest.type = "OVERRIDE"
→ application overrideRoute()
→ Domain RouteDecision.action = "OVERRIDE_ROUTE"

transport DecisionRequest.type = "REQUEST_MORE_INFO"
→ application requestMoreInfo()
→ Domain RouteDecision 생성하지 않음
→ ticket.routeDecision 은 null 로 유지
```

## 24.4 Actionable tenant follow-up

`REQUEST_MORE_INFO`는 무엇을 해야 하는지 지정한다.

```text
requestedQuestionIds?   : 다시 답할 protocol 질문
requestedEvidenceTypes? : 다시 제출할 synthetic evidence
```

둘 중 최소 하나는 필수다. 아무것도 요구하지 않는 요청은 tenant가 행동할 수 없다.
Evidence는 질문 ID로 접히지 않고 자체 vocabulary를 유지한다.

`REQUEST_MORE_INFO`는 여전히 RouteDecision을 만들지 않는다.

Landlord 상세에는 `followUpOptions`가 포함되어, 선택된 protocol에서 물어볼 수 있는
질문/증빙을 서버가 제공한다.

Tenant 상세에는 **현재 처리해야 할 요청**만 `moreInfoRequest`로 노출한다. 이력이
아니며 landlord 내부 필드를 포함하지 않는다.

미처리 판정은 `requestedAt` 기준이다.

```text
요청 시점 이후에 answer 가 없으면      -> 해당 질문은 미처리
요청 시점 이후에 evidence 가 없으면    -> 해당 증빙은 미처리
```

answer/evidence 이력은 지우지 않는다. 모두 처리되면 `reason`은 그대로 보이고
요청 목록만 비어 있다. refinalize 시 `moreInfoRequest`는 `null`이 된다.

Synthetic evidence 요구사항은 서버가 제공하는 `demoFixtureId`를 포함한다. Browser는
fixture ID를 만들어내지 않으며, 이는 파일 경로가 아니라 DEMO 식별자다.

## 24.3 Route vocabulary is a closed public contract

P0 route vocabulary는 **닫힌 public contract**다.

```text
LANDLORD_REVIEW
MANAGEMENT_OFFICE
THIRD_PARTY_MANAGER
MANUFACTURER_AS
GENERAL_VENDOR
```

`routeCode`는 임의 문자열이 아니다. `OverrideDecisionRequest.routeCode`와
`RouteOptionDto.routeCode` 모두 이 닫힌 vocabulary를 사용한다. 공개 contract는
Domain을 import하지 않으며, 두 vocabulary가 어긋나지 않는다는 것은 server-side
parity test가 보장한다.

자동 추천이 `null`일 때에도 임대인은 **유효한 manual route를 기록할 수 있다.**
이는 이미 Domain이 지원하는 동작이다.

Manual route는 **system recommendation이 아니다.** UI는 수동 선택지를 시스템이
추천한 것처럼 표시하지 않는다.

`SAFETY_ESCALATED`에서는 일반 override UI를 제공하지 않는다. 이는 Web
operational safeguard이며 Domain state machine을 바꾸지 않는다.

세 request가 `/api/v1/tickets/:id/decision` transport family를 공유하는 것과, 그 중 둘만 route decision을 만든다는 것은 서로 다른 층위의 사실이다.

`REQUEST_MORE_INFO`는 review-state 변경이지 route decision이 아니다. 이미 공개된 contract 이름을 미관상 이유로 rename하지 않는다.

---

# 25. API Error Contract

모든 request/response boundary는 Zod 검증.

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};
```

Raw stack/exception을 client에 노출하지 않는다.

---

# 26. Architecture Import Guard

Automated test는 `apps/mobile/**`에서 다음 import를 금지한다.

```text
@build-manager/domain
@build-manager/application
@build-manager/fixtures
```

Browser-facing Web components/hooks에서도 server-only package import를 금지한다.

Allowed server areas:

```text
apps/web/src/server/**
apps/web/src/app/api/**
```

---

# 27. Testing Strategy

## Shared

Vitest:

- Safety
- Heating Protocol
- Leak Protocol
- Evidence Gate
- Routing
- Repair Packet
- Ticket State
- Application Use Cases
- Contract parsing
- Architecture guard

## Web

Playwright:

- Building A Heating
- Building B Heating
- Safety escalation
- More-info/refinalize
- Route override
- Web Tenant flow
- Web Landlord flow

## Mobile

Official Expo testing stack:

- jest-expo
- React Native Testing Library
- Expo Router testing utilities

Required:

- DEMO role entry
- Landlord Building Passport
- App Tenant question flow
- App Tenant Safety interruption
- App Landlord Repair Packet
- approve/override/more-info action
- forbidden-import check

---

# 28. Mobile P0 Build/Health Gate

Mandatory P0:

```text
Mobile Jest/RNTL
Expo Doctor
Android export/bundle smoke
 iOS export/bundle smoke
```

P0에서 EAS account 연결은 요구하지 않는다.

EAS + Maestro E2E는 P1.

Expo 공식문서는 EAS Workflow Maestro job을 현재 alpha로 안내한다.

Official:
- https://docs.expo.dev/eas/workflows/examples/e2e-tests/

---

# 29. Root Verification Scripts

Semantic scripts:

```text
test
test:shared
test:web
test:mobile
lint
typecheck
build:web
check:deps
test:e2e:web
verify
```

`verify`는 외부 유료계정 없이 deterministic local gates만 사용한다.

`|| true`로 실패를 숨기지 않는다.

---

# 30. Dependency Gate

```bash
npm ls react
npm ls react-dom
npm ls react-native
npm ls expo
```

Expected:

- React consistently 19.2.3
- Expo SDK 57
- RN in Expo-supported 0.86.x
- incompatible duplicate native-module tree 없음

---

# 31. P0 Non-goals

```text
OCR
QR
Camera/Gallery
Push
Vendor scheduling
Marketplace
Payment
Rent/accounting
Contract
Tax
Legal AI
Insurance
Weather
Preventive maintenance
Warranty
IoT
3D scan
Production auth
Production deployment migration
Cloud DB migration
Autonomous vendor dispatch
```

---

# 32. Core Acceptance

## CORE-01

Same HEATING text + Building A/B => different server Protocol branch.

## CORE-02

Complete evidence => A/B different route recommendation.

## CORE-03

Changing approval year does not change routing.

## CORE-04

Safety escalation => recommendation null.

## CORE-05

Missing/conflicting evidence => recommendation null.

## CORE-06

More-info => packet revision increments after refinalize.

---

# 33. Web Acceptance

- Web landlord selects demo buildings.
- Building Passport and owner verification work.
- Web tenant completes HEATING and LEAK.
- Web landlord reviews packet/provenance.
- Approve/override/more-info work.
- Playwright Hero A/B passes.

---

# 34. App Acceptance

- App clearly marks DEMO mode and role choices.
- App landlord selects building and sees Building Passport.
- App tenant completes HEATING/LEAK through API contract.
- App landlord sees Repair Packet/Why/provenance.
- App landlord submits approve/override/more-info via shared API client.
- Mobile source has no direct domain/application/fixtures import.
- Expo health/export gates pass.

---

# 35. Cross-platform Contract Parity

같은 `LandlordTicketDetailDto`가:

- Web Landlord
- App Landlord

에서 같은 의미를 표현해야 한다.

같은 `TenantQuestionDto`가:

- Web Tenant
- App Tenant

에서 같은 질문/선택지를 표현해야 한다.

Parity는 pixel identical가 아니다.

---

# 36. Contest Claim Rules

구현 검증 후 허용:

> 웹과 앱에서 임대인과 세입자가 동일한 유지관리 workflow를 사용할 수 있도록 공통 API와 규칙엔진으로 구현했다.

검증 없이 금지:

- 고객이 사용했다
- 수리시간 단축
- 분쟁감소
- 비용절감
- PMF
- WTP
- 국내 최초
- App Store/Play Store 출시

---

# 37. Final Architecture Audit

| Check | Decision |
|---|---|
| Next.js Web | GO |
| Expo App | GO |
| Both roles on both | GO |
| npm workspaces | GO |
| shared UI library | NO |
| shared pure domain | GO |
| client authoritative routing | NO |
| Next API authoritative | GO P0 |
| separate API service | NOT P0 |
| React version alignment | REQUIRED |
| Next 16.3.4 | GO |
| Expo SDK 57 | GO |
| Node 24 LTS | GO |
| Real camera | P1 |
| Push | P1 |
| Production Auth | P1 |
| Web Playwright | REQUIRED |
| Mobile Jest/RNTL | REQUIRED |
| EAS/Maestro | P1 |
| Local server SQLite | GO P0 |
| Cloud SQLite assumption | PROHIBITED |

---

# 38. Supersession Rule

이 v3는 Web-only v2 architecture를 폐기한다.

다음 구조로 구현하는 이전 계획은 사용 금지:

```text
web/
```

현재 구조:

```text
apps/web/
apps/mobile/
packages/*
```

---

# Document Control

- Step: `05`
- Version: `V3_WEB_MOBILE_MONOREPO`
- Status: `APPROVED_ARCHITECTURE`
- Supersedes: `05_product_spec_v1_REAUDITED_v2.md`
- Monorepo: `NPM_WORKSPACES`
- Web: `NEXT_16_3_4`
- Mobile: `EXPO_SDK_57_RN_0_86`
- React: `19_2_3_ALIGNED`
- Node: `24_LTS`
- Roles: `LANDLORD_TENANT_ON_WEB_AND_APP`
- Backend: `NEXT_ROUTE_HANDLERS_P0`
- Authoritative Decisions: `SERVER_ONLY`
- Shared Packages: `DOMAIN_APPLICATION_API_CONTRACTS_API_CLIENT_FIXTURES`
- Shared UI: `NO`
- Mobile Direct Domain Import: `PROHIBITED`
- Public Demo Data: `SYNTHETIC_ONLY`
- Camera: `P1`
- Push: `P1`
- Production Auth: `P1`
- Customer Evidence: `MISSING`
- PMF: `NOT_CLAIMED`
- Next: `06_V3_CAPABILITY_FIRST_IMPLEMENTATION_PLAN`
