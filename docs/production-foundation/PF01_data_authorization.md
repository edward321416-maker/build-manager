# PF01 — 데이터·관계·권한 설계 0.2

상태: **REVIEWED_FOR_APPROVAL — 설계 제안, 새 서비스 구현 아님**
날짜: 2026-09-18
조사 기준: `main@6d0eaab3356b901e5ec8627c3a49e8730dd75a79`
대체 대상: 이전 로컬 PF01_foundation_design.md 0.1의 상세 정책. 과거 문서/커밋은 보존.

## 1. 목표와 범위

첫 완결 흐름: 관리조직 활성화→건물/호실→입주기간 개설→입주자 초대→인증 후 수락→자기 호실 텍스트 신고→담당 관리자 조회/답변→입주 연결 종료→이전 세션·재전송을 통한 접근 차단.

PF01은 설계다. 구현은 PF02에서 이 계약을 작은 단위로 적용한다. 사진/공용공간 신고/대리접수/과거 입주 이력 제공/조직 간 데이터 이전/전체 임대차계약/업체 계정은 첫 수직 구현에 넣지 않는다. 해당 데이터가 존재하지 않는다고 가정해 모델을 망가뜨리지는 않되, 기능을 먼저 만들어 놓지도 않는다.

## 2. 승인 제안과 가정

- 한 Organization은 하나의 관리 데이터 격리 영역이다. 개인 임대인도 조직 하나를 가진다.
- User에는 전역 landlord/tenant 역할이 없다. 역할은 조직 멤버십 또는 입주 관계에서 얻는다.
- 주민은 조직 직원 멤버십에 넣지 않는다. OccupancyMember라는 별도 관계를 쓴다.
- ORG_ADMIN은 자신의 조직 관리권한, PROPERTY_STAFF는 배정 건물의 유지관리권한만 갖는다. 직원의 입주자 초대·퇴거·권한 변경은 최초 버전에서 금지한다.
- 첫 파일럿은 검토된 관리 상대만 활성화하는 비공개 초대형이다. 초대와 본인 인증은 법적 소유/실거주 인증이라고 표시하지 않는다.
- 한 호실의 ACTIVE Occupancy는 하나다. 공동거주자는 그 Occupancy의 여러 Member로 표현한다. 방/침대별 다중 점유가 필요한 상품은 이후 별도 자원 모델을 승인한다.
- 활성 입주관계가 있어도 주민은 **본인이 작성한 신고만** 읽고 답한다. 다른 공동거주자/새 입주자의 신고를 자동 공유하지 않는다.
- 유효 관계는 ACTIVE 상태뿐 아니라 `starts_at/joined_at <= 판단시각`이고 종료시각이 없거나 아직 지나지 않았다는 시간 조건까지 만족해야 한다. 시간은 UTC로 저장하고 UI에서 한국시간 등 사용자 시간대로 표시한다. 상태만 ACTIVE인 만료 관계는 권한을 주지 않는다.

이 기본값들은 제품 정책 제안이지 외부 표준의 강제 규칙이 아니다. 회원별 최소 권한과 요청마다 재검증한다는 원칙은 OWASP를 참고한다. [S05]

## 3. 데이터 모델

ID는 불투명한 식별자로 발급하지만 ID의 난독성이 권한을 대신하지 않는다. org-scoped row는 org_id를 갖고 다른 조직 부모 참조를 DB에서 거부한다. [S05]

| 엔터티 | 주요 필드/책임 | 제약과 상태 |
|---|---|---|
| User | id, status, created_at | ACTIVE/SUSPENDED/DELETION_PENDING; 영구 역할 없음 |
| ExternalIdentity | issuer, subject, user_id | (issuer, subject) 유일; 이메일만으로 계정 자동 병합 금지 |
| Organization | id, status, display_name | PENDING/ACTIVE/SUSPENDED/ARCHIVED; ACTIVE만 업무 허용 |
| OrganizationMembership | org_id, user_id, role, status, version | 유효한 user+org 쌍의 membership 하나; ORG_ADMIN/PROPERTY_STAFF |
| PropertyAssignment | org_id, membership_id, property_id, status | staff 업무 범위를 명시; 타 조직 FK 금지 |
| Property | org_id, id, address_reference, status | 주소는 식별 보조; 다른 조직 건물과 자동 통합 없음 |
| Unit | org_id, property_id, id, label, status | 조직 내 부모 FK; 같은 건물의 활성 label 중복 방지 |
| Occupancy | org_id, unit_id, id, starts_at, ends_at, status, version | ACTIVE/ENDED; 시작 전 예약 입주 기능은 유예, 한 Unit의 ACTIVE 하나 |
| OccupancyMember | org_id, occupancy_id, user_id, id, joined_at, ended_at, status | ACTIVE/ENDED; 구성원만 종료 가능; 그룹 종료 시 전원 유효권한 종료 |
| Invitation | org_id, occupancy_id, issuer_membership_id, recipient_binding, token_digest, status, expires_at, accepted_user_id | PENDING/ACCEPTED/REVOKED; 만료는 DB 시간 비교, 토큰 원문 저장 금지 |
| MaintenanceTicket | org_id, property_id, unit_id, occupancy_id, reporter_member_id, created_by_user_id, client_request_id, workflow_status, safety_status, version | 참조 관계가 서로 일치; 관계/조직/작성자를 이후 입주자에게 재연결하지 않음 |
| TicketMessage | org_id, ticket_id, actor_user_id, visibility, text, created_at | RESIDENT_VISIBLE/INTERNAL; 주민은 INTERNAL 작성 불가 |
| CommandReceipt | org_id, actor_user_id, operation, request_key, canonical_digest, resource_id, result_code | scope 내 요청키 유일; 원문 요청/응답을 무제한 복제하지 않음 |
| AuditEvent | org_id, actor_ref, action, resource_ref, outcome, occurred_at | 목적 제한; 원문 대화/토큰 없음; 내부 actor ID도 개인정보일 수 있음 |

Asset/CommonArea/Media/Outbox는 후속 모듈 책임이다. 이 단계에 형식만 있는 테이블을 모두 만들지 않는다. Ticket의 공간 모델은 이번 Unit 대상으로 고정하고 후속 확장은 versioned API로 추가한다.

Occupancy는 서명된 임대차계약(Lease)이 아니다. 보증금·월세·계약서·주민등록번호를 기본 필드로 모으지 않는다. Account 삭제, 구성원 연결 종료, 입주기간 종료, 건물 폐쇄는 서로 다른 사건이다.

## 4. 불변조건 I01~I12

- **I01 — 신원과 권한 분리:** 세션은 User를 찾는 수단이며, 현재 Organization/멤버십/담당/입주 관계가 접근을 결정한다.
- **I02 — 조직 격리:** 유효한 타 조직 ID를 알아도 목록/상세/변경/후속 파일·작업으로 접근하지 못한다. 복합 FK와 쓰기 정책이 교차조직 참조도 거부한다.
- **I03 — 담당 및 신고자 범위:** 직원은 배정 건물, 주민은 유효 입주 + 본인 작성 신고로 제한한다. 전역 role/view 값은 무시하거나 요청 스키마에서 거부한다.
- **I04 — 단일 유효 입주기간:** Unit마다 ACTIVE Occupancy 하나, 그 안의 여러 OccupancyMember는 각각의 상태를 갖는다. 관계의 역사적 FK를 덮어쓰지 않는다.
- **I05 — 일회성 초대:** 대상 결합·발급자 현재 권한·시간·대상 상태를 확인하고 초대 소비와 관계 생성을 같은 transaction으로 처리한다.
- **I06 — 철회 일관성:** 철회 commit 뒤의 신규 권한 판단은 이전 권한으로 성공하지 않는다. 쓰기와 철회가 경합하면 명시된 잠금·직렬화 결과를 따른다.
- **I07 — 재전송 안전:** 현재 권한 확인이 CommandReceipt replay보다 먼저다. 같은 키 다른 요청은 충돌, 같은 키 같은 요청은 중복 생성 없음.
- **I08 — 승인된 열람 범위만 응답:** 내부 메시지/개인자료는 UI에서만 숨기지 않고 주민 응답에서 제외한다. 새 입주자는 과거 입주 자료를 기본적으로 받지 않는다.
- **I09 — 영속성·동시성:** 부분 관계/거짓 성공 없음; stale version overwrite를 막고 transaction 실패는 원자적으로 rollback한다.
- **I10 — 환경·정보 최소화:** production에서 demo/v1/fixture/test auth fallback 차단, 입력 상한·로그 비밀 제거, DB 비특권 role 사용.
- **I11 — 복원 시 철회 보존:** 오래된 backup이 해지·삭제·권한 철회를 되살리는 상태로 공개되지 않는다.
- **I12 — 표면 간 같은 권한:** Web/Mobile/API가 같은 서버 계약을 사용하고, stale 화면·구버전 client·deep link가 서버 검사를 우회하지 않는다.

## 5. 권한 행렬

업무 데이터 접근 허용은 User ACTIVE, Organization ACTIVE, 해당 자원/관계 활성, 요청 인증 유효를 전제로 한다. 아래 이외는 기본 거부다. 본인 계정 관리와 개인정보 요청 접수는 조직 연결이 종료돼도 별도 본인 확인 경로로 가능하며, 조직 활성 조건 때문에 그 요청까지 막지 않는다.

| 동작 | ORG_ADMIN | PROPERTY_STAFF | 활성 입주자 | 연결 종료 사용자 | 플랫폼 지원 |
|---|---|---|---|---|---|
| 자기 조직 건물·호실·입주기간 생성 | 허용 | 거부 | 거부 | 거부 | 일반 업무 API 거부 |
| 직원/입주자 초대·권한/퇴거 변경 | 허용 | 거부 | 거부 | 거부 | 별도 승인된 운영 경로만 |
| 실제 자기 호실 신고 생성 | 관리자 대리신고는 후속 | 직원 대리는 후속 | 자기 ACTIVE 연결만 | 거부 | 거부 |
| 티켓 조회·resident-visible 답변 | 자기 조직 | 담당 건물 | 본인 신고만 | 거부 | 기본 거부 |
| 내부 메시지 읽기/작성 | 자기 조직 | 담당 건물 | 거부 | 거부 | 기본 거부 |
| 다른 조직 접근 | 거부 | 거부 | 거부 | 거부 | 기본 거부 |
| 본인 계정·개인정보 요청 접수 | 허용 | 허용 | 허용 | 허용 | 처리자 역할 별도 |

여러 합법적 관계를 가진 사람은 서버가 검증한 context 중 하나를 선택한다. 한 요청에서 관리자 context와 다른 조직의 입주 context를 섞지 않는다. '관계 종료 사용자' 행은 종료한 관계에 한하며 다른 활성 조직 관계는 유지된다.

last active ORG_ADMIN을 자발적 탈퇴/동시 권한 변경으로 제거하지 못한다. 보안 사고의 계정 정지는 이 규칙 때문에 막지 않으며, 그 결과 유효 관리자가 없으면 조직 업무를 잠그고 별도 복구 절차를 거친다. 조직을 정지하는 운영 조치와는 별도다. 최초 admin 활성화·ownership dispute 처리와 support break-glass의 실제 운영 권한은 구현/운영 계획에서 별도로 승인받는다. 조직 관리자라는 명칭은 건물 소유자 인증을 뜻하지 않는다.

## 6. 인증·계정 수명주기

검증된 인증 공급자의 표준 flow를 사용하되, 자원 권한을 공급자 JWT의 role 문자열에 위임하지 않는다. issuer/audience/signature/expiry 검증 후 User를 찾고 매 요청의 현재 조직·자원 관계를 조회한다. 연결 공급자 변경 때 email 일치로 자동 계정 병합하지 않는다.

Web는 보안 cookie 기반 세션과 CSRF 방어, Mobile은 표준 authorization-code/PKCE 및 안전한 토큰 보관을 기본으로 제안한다. public client의 PKCE와 refresh rotation 또는 sender constraint는 RFC 9700을 기준으로 선택한다. [S09]

redirect/deep link는 허용 origin/path와 로그인 당시 사용자 문맥에 결합한다. 다른 계정으로 초대링크를 열면 자동 연결하지 않고 안전한 오류/계정전환 안내를 제공한다. Production에서 테스트 헤더나 query의 userId로 사용자를 지정하는 경로는 없다. 테스트 identity adapter는 시험용 조립에만 사용한다.

관리자 MFA, 계정복구, 이메일·전화번호 변경의 재인증, 세션 철회는 실제 데이터 도입 전에 제공자와 함께 검증해야 한다. provider 연결이 없는데 인증 완료라고 보고하지 않는다.

## 7. 초대 명령의 상세 계약

### 7.1 생성

관리자가 활성 Occupancy와 검증할 수 있는 초대 수신 대상을 선택한다. 발급 범위는 resident 연결 하나다. staff/admin 초대는 별도 명령이며 resident invite의 role 파라미터로 승격시키지 않는다.

기본 제안 유효기간은 24시간이다. 이 수치는 보안 표준의 의무값이 아니라 제품 기본값이다. 충분한 엔트로피의 토큰을 사용하고 서버에는 검증용 digest와 수신대상 결합/상태만 저장한다. 일반 access log, analytics, crash report에 초대 비밀을 넣지 않는다. 브라우저의 token 교환 후 주소 정리와 허용된 deep link 복귀를 설계하고 인증된 POST로 수락을 완료한다. 초대 랜딩에 제3자 추적 코드를 넣지 않고 외부 referrer로 넘기지 않는다.

### 7.2 수락

인증 후 수신대상 결합, issuer 멤버십·조직 상태, Occupancy/Unit 상태, 만료·철회 여부를 transaction 안에서 다시 검사한다. 현재 시각은 잠금 대기 후 DB 시간으로 판단한다. transaction 시작 시각만 써서 대기 중 만료된 링크를 수락하지 않는다.

초대 row의 단일 소비와 OccupancyMember 생성은 원자적이다. 동일 초대 동시 수락은 하나의 관계만 만든다. 같은 사용자에게 이미 같은 active membership이 있으면 중복 생성하지 않는다. 다른 인증 사용자에게 양도되는 결과는 없어야 한다.

이미 수락한 동일 사용자의 재요청은 현재 관계가 여전히 활성일 때만 기존 관계 결과를 제공한다. 종료된 관계를 예전 링크/영수증으로 되살리지 않는다. 다른 사용자, 미수락 만료·철회 초대에는 같은 '사용할 수 없는 초대' 응답을 사용해 수신자/건물 정보를 노출하지 않는다.

### 7.3 발급자 퇴사와의 관계

수락보다 먼저 issuer 권한 철회가 commit됐으면 pending 초대는 실패한다. 수락이 유효하게 먼저 commit됐으면 이후 issuer 퇴사만으로 이미 형성된 입주관계를 자동 삭제하지 않는다. 입주관계의 종료·조직 정지는 별도 권한 사건이다. 이를 뒤섞으면 직원 교체마다 정상 입주자가 임의 퇴거되는 버그가 생긴다.

## 8. 철회·종료·경합

### 8.1 종료 결과

OccupancyMember 종료는 그 구성원만, Occupancy 종료는 그 기간의 구성원 전체의 현재 호실 접근을 끊는다. User 계정과 다른 관계는 남는다. 전체 계정 SUSPENDED는 모든 서비스 관계의 일반 접근을 막는다.

기존 티켓은 예전 occupancy/reporter 참조를 유지한다. 관리자는 필요한 조직 업무 범위와 승인된 보유정책 안에서 계속 처리할 수 있지만 새 입주자에게 자동 귀속·공유하지 않는다. 퇴거자가 본인 정보 제공을 요청하는 경로는 일반 호실 API와 분리해 본인 확인·제3자 자료 제외 후 처리한다.

### 8.2 쓰기와 철회가 동시에 오는 경우

초대 수락, 신고, 메시지 작성은 권한을 입증하는 관련 row를 잠그고 transaction 안에서 상태를 재확인한 뒤 commit한다. 철회 명령은 해당 관계에 상충하는 잠금을 사용한다. 정상 쓰기의 FOR SHARE와 철회의 FOR UPDATE 등이 상충한다는 PostgreSQL 규칙을 이용하는 방향이다. FOR KEY SHARE만으로 non-key 상태 변경이 막힌다고 가정하지 않는다. [S07]

잠금 순서는 User→Organization→Membership/Assignment→Property/Unit→Occupancy/Member→Invitation 또는 Ticket으로 통일하고, 같은 종류 여러 row는 ID 순서다. 초대에서는 수락자뿐 아니라 발급자의 계정 상태도 관련 User 집합에 포함한다. 실제 SQL과 migration 검토에서 읽는 모든 권한 row의 잠금 여부를 확인한다. last-admin 변경은 Organization 수준에서도 직렬화한다. 분산 캐시의 오래된 허용결과로 DB 재검사를 생략하지 않는다.

- 철회가 먼저 commit: 대기하던 쓰기는 상태를 재검사하고 거부, 새 데이터 없음.
- 쓰기가 먼저 commit: 쓰기는 당시 권한으로 유효, 철회는 이후 완료, 후속 쓰기 거부.
- deadlock/직렬화 실패: 내부 제한 재시도 또는 재시도 가능한 오류; 부분 성공 없음. 자동 재시도도 동일 idempotency 문맥과 권한 재검사를 유지.

조회는 단일 transaction/snapshot의 권한 확인 지점을 기준으로 한다. 철회 이전에 승인되어 이미 전달 중이던 응답이나 사용자 기기에 저장된 바이트까지 회수한다고 약속하지 않는다. 철회 commit 뒤 새로 시작한 일반 요청은 차단하고 클라이언트는 권한 오류 시 해당 context 캐시를 제거한다.

## 9. 실제 API 계약 제안

**아래 경로·operation은 제안 명칭이며 현재 저장소에 구현된 API라고 주장하지 않는다.** demo v1과 구분하는 authenticated `/api/v2`를 제안한다. 내부 도메인 규칙을 전부 복제하는 것은 아니다.

| operation | 입력 경계 | 정상 결과 | 실패/부정 경계 |
|---|---|---|---|
| listMyContexts | 인증된 User만 | 현재 활성 관리·입주 context | 다른 User ID 인자 거부 |
| createProperty / createUnit | 검증된 org context + 제한된 필드 | org 범위 자원 생성 | 다른 org 부모 FK 거부 |
| startOccupancy | unitId, 시작 시각 | active 기간 생성 | 다른 active 기간 또는 archived unit 충돌 |
| createResidentInvitation | occupancyId, recipient binding | 일회성 초대 | staff·inactive scope 거부 |
| acceptResidentInvitation | 인증 주체 + 토큰 | 연결 1개 또는 동일 사용자의 기존 연결 | 양도·만료·철회·반복활성화 거부 |
| createMaintenanceTicket | occupancyId, issueType, rawUserText, clientRequestId | 본인의 유효 Unit/Member에 생성 | 작성자/org/status/view 주입 거부 |
| list/getMaintenanceTickets | 검증된 context, pagination | 관리자 담당 또는 주민 본인 자료만 | 타 조직/타 주민 상세 비노출 |
| addTicketMessage | ticketId, text, 요청키, 허용 visibility | 권한에 맞는 메시지 | 주민 INTERNAL, 타 scope 거부 |
| acknowledgeTicket | ticketId, If-Match version | OPEN→ACKNOWLEDGED | 권한 없음 또는 stale version 거부 |
| endOccupancy / endOccupancyMember | 대상, If-Match version | 관계 종료 + 감사 | 신규 권한 확인·경합 정책 적용 |

공통 오류: 비인증 401, 보이지 않는 자원 404, 이미 접근 가능한 context의 권한 없는 행위 403, 검증 실패 400, 동일 키 다른 내용/중복 active occupancy 409, stale If-Match 412, body 상한 초과 413, 속도 제한 429, 저장소 장애 503. 오류 본문에는 원문 입력·토큰·stack·타 조직 자원정보를 넣지 않는다. 오류 상세 코드는 후속 공개 스키마에서 닫힌 vocabulary로 정한다.

### 9.1 입력과 남용 제한

현재 v1에는 원문 길이 상한이 없다. 이를 production에서도 무제한으로 유지하지 않는다. v2 초안: 신고/메시지는 1~2,000 Unicode code points, JSON body 64 KiB, page size 최대 50. 모두 제안된 제품 상수이며 Unicode/한글/emoji 경계 시험을 포함한다. [G06]

역할·조직·신고자·status 등 서버 소유 필드가 body에 들어오면 strict schema로 거부한다. 요청 본문은 로그에 복사하지 않는다. 위험 문구가 body 상한을 넘었다면 조용히 잘라 정상 접수했다고 표시하지 않고, 입력을 보존한 오류·수동 안전 안내 경로를 제공한다.

multi-instance rate limit의 저장소와 임계값은 PF02 plan에서 선택한다. 단일 프로세스 메모리 제한만으로 운영 전체를 보호했다고 주장하지 않는다. 외부 요금이 발생하는 초대·메일·AI는 자원별 한도와 비용 차단이 확정되기 전 공개하지 않는다.

### 9.2 재전송·동시 수정

조직/행위자/명령/요청키 단위로 CommandReceipt를 사용한다. 정상 요청의 canonical_digest를 비교하되 auth·scope 확인이 먼저다. 같은 내용의 성공 결과를 재전달할 때도 현재 권한을 통과해야 한다.

Ticket creation의 clientRequestId는 (org_id, created_by_user_id, client_request_id) 유일 제약으로 티켓 보유기간 중 중복 생성 방지에 사용한다. 결과 resource가 삭제되거나 scope가 철회되면 예전 응답 body를 복원하지 않는다. 요청키를 다른 명령·사용자·조직에 재사용해도 서로의 영수증을 보지 못한다.

메시지/초대 등 일반 replay 창은 24시간을 제안한다. 유효기간을 넘긴 명령은 앱이 성공 상태를 조회·조정한 후에만 명시적으로 재제출하게 하며, 자동 새 키로 중복 실행하지 않는다. 무한한 exactly-once를 약속하지 않는다. stale version 갱신은 412로 반환해 새 상태를 조회하게 한다.

## 10. PostgreSQL과 모듈 경계

Org-scoped 테이블은 org_id와 id에 유일 제약을 두고 부모 참조에도 org_id를 포함한다. Ticket의 unit/occupancy/member가 같은 관계 chain인지 DB 제약과 application 검증 양쪽에서 확인한다. 다른 조직 ID를 조합한 INSERT/UPDATE도 실패해야 한다.

API runtime role은 migration owner/superuser/BYPASSRLS가 아니다. RLS를 org 격리의 보조 방어로 적용하되 resident 본인 티켓/직원 담당 범위는 application에서 반드시 검사한다. RLS만으로 모든 세부 권한이 해결됐다고 주장하지 않는다. WITH CHECK 쓰기 정책과 정책 없는 기본 거부, tenant context 누락을 시험한다. [S06]

connection pool에는 session 전역 org 문맥을 남기지 않는다. 인증과 resource 확인 뒤 transaction-local context를 설정하고 같은 연결/transaction에서 질의한다. SET LOCAL은 transaction 종료에 한정되며 commit/rollback과 savepoint 경계도 검사한다. org를 설정하는 주체는 서버이며 request body가 아니다. [S08]

Identity lookup/초대 token lookup/조직 bootstrap은 아직 org scope를 알 수 없는 예외 경로다. 일반 업무 RLS를 임의로 끄지 않는다. 전용 최소권한 lookup/command, 균일 오류·속도제한·감사 계약을 별도로 구현계획에서 검증한다. managed auth provider의 service role을 앱이나 일반 query에 배포하지 않는다.

모듈은 다른 모듈 테이블을 임의 갱신하지 않는다. 단일 DB transaction 안에서 공개 use case들을 조합할 수 있고, 외부 메일/스토리지/AI 호출을 긴 DB lock 안에서 실행하지 않는다.

## 11. 데모 경계와 배포 전환

production 배포에서 **기존 비인증 v1의 모든 업무 경로**와 `/demo/reset`·fixture provider·test auth adapter를 차단한다. 화면에서 링크만 없애거나 reset 하나만 막는 것으로 충분하지 않다. demo와 production의 DB/credential/context는 분리한다.

APP_MODE 같은 명시적 배포 모드(이름은 제안)를 둔다. 모드/DB 설정이 빠지거나 잘못되면 시작/요청을 실패시킨다. `NODE_ENV=production`만으로 안전한 데이터 모드를 결정하지 않는다. production 연결 실패 시 demo SQLite로 fallback하지 않는다.

기존 v1 앱은 demo 전용이며 production DB에 접근하지 못한다. 실제 공개 릴리스부터는 API contract version/최소지원 버전/업데이트 정책을 같이 기록한다. 현재 데모에 '이미 배포된 실사용자 호환'이라는 존재하지 않는 사실을 만들지는 않는다.

PF02 변경 명세에는 v2 조립, legacy 차단, 실제 actor 전달, 신규 테스트, 의도적으로 대체되는 demo 가정을 좁혀서 적는다. 기존 domain 규칙과 과거 commit를 지우는 대규모 재작성은 하지 않는다.

## 12. 개인정보·복원·운영

필드별 목적, 접근자, 보유/삭제 계기, 위탁/외부전송 여부를 등록한다. 구체 기간과 법적 처리근거는 실제 수집 전에 확정할 결정이다. 미정이라고 무기한 저장하지 않는다. 이 문서는 법률 적합성 인증이 아니다.

유지관리 결과를 익명 이력으로 제공하는 기능은 초기에 열지 않는다. 이름만 지운 사진·메시지를 비개인자료라고 간주하지 않는다. 원문/사진을 포함한 주민 export는 별도 본인 확인·제3자 자료 제거·접근 감사 후 제공한다.

backup 복원 후에는 서비스와 worker 외부 발송을 차단한 채 최신 철회/삭제 상태를 조정한다. 복원 대상 DB와 함께 되돌아가지 않는 보호된 처리 기록을 사용하도록 복구 절차를 설계한다. 복원된 세션을 무조건 신뢰하지 않고 session invalidation/정책 epoch 등 재인증 장치를 적용한다. 최신 상태를 복구할 근거가 부족하면 real access를 열지 않는다. 동기화된 삭제·철회 증거를 어디에 어떤 기간 보관할지는 개인정보/복원 결정에서 승인한다.

후속 Outbox는 티켓 변경과 발송 대기 레코드를 같은 transaction에 기록하며, worker는 재시도·중복방지와 발송 직전 현재 권한 검사를 수행한다. 이미 전달된 외부 메시지를 회수할 수 있다고 약속하지 않는다. 초기 알림은 본문/주소/호실/신고자를 lock screen에 넣지 않고 일반 알림 후 인증된 화면으로 유도한다. [S10]

## 13. PF02 구현 분할과 판정

A: schema/constraints/runtime DB role/transaction 계약. B: 실제 인증·조직/담당 관계. C: 초대/입주/퇴거. D: 텍스트 신고·관리자 답변. E: 두 역할 Web/Mobile + 동시성/복원·부정 시나리오.

F40의 최종 연결 증거는 실제 Web 세션과 Mobile 개발 빌드가 동일 staging API의 같은 ticketId를 읽고 쓰는 것이다. RNTL에 mock DTO를 주는 시험만으로 이 항목을 대체하지 않는다. 하나의 runner일 필요는 없지만 자동/수동, emulator/실기기, 서버 영속성을 구분해 기록한다. 서명된 release 실기기 전체 QA는 별도의 PF06 gate다.

각 작업에 exact file scope, 실제 schema/command, 선행 상태, red/green 또는 기존 동작 검증 예외, 표준 회귀, public data 검사, publication ref를 고정한 별도 implementation plan이 필요하다. 현재 문서가 SQL/IAM 실행 권한은 아니다.

acceptance_cases.json의 F01~F44은 예정 시험이며 현재 전부 NOT_RUN이다. 같은 source code의 mock 호출 횟수만으로 DB 제약/격리/경합을 통과했다고 주장하지 않는다. provider 인증 통합과 실제 Web/Mobile session 경계는 각각 시험한다.

## 14. 잔여 결정

D01 실제 인증 공급자/flow와 비용·사용자 복구. D02a PostgreSQL major/driver 및 로컬 시험 방식. D02b 호스팅·리전·backup/복원. D03 실제 조직 활성화·관리권 확인 절차와 운영자. D04 필드별 개인정보 처리·보유·위탁/국외전송·삭제. D05 응대시간·알림 채널·요금/비용 상한. D06 runtime/action/runner exact pin과 테스트환경 수정 범위.

D06은 PF00 실행계획에서 해결한다. D02a는 PF02-A 전에, D01은 PF02-B 전에, D02b/D03/D04/D05는 실데이터 파일럿 전에 해결한다. 미결정은 보류 gate와 담당자가 있는 의사결정이며 이를 임의 값으로 채워 배포하지 않는다.
