# 올린 사진을 필수 증빙으로 지정 (P1b) 구현 계획

- 스펙: [P1b 설계](../specs/2026-10-11-intake-photo-evidence-p1b-design.md). 운영자 승인 2026-10-11.
- 실행: 이 세션에서 순서대로 한다. 작업마다 실패하는 테스트, 구현, 통과, 커밋 순서다(DEV-04).

## 전역 제약

- 판정 규칙(`packages/domain/src/evidence/evaluate-evidence.ts`의 `evaluateEvidence`)과 안전 판정은 바꾸지 않는다.
  - 리뷰 반영: 같은 파일에 요구 목록을 읽는 `activeEvidenceRequirements`만 더한다. 유스케이스와 presenter가 이 함수를 같이 쓴다.
- `storageRef`는 서버가 확인한 사진 ID로만 만든다: `core-photo:<photoId>`.
- 마이그레이션은 값을 넓히기만 한다. `core_flow.store_ticket`은 같은 서명, 같은 소유자(`bm_core_flow_owner`)로 다시 정의하고 `SECURITY DEFINER`와 `search_path=pg_catalog`를 그대로 둔다(`tests/postgres/core-flow.test.ts`가 함수 목록과 설정을 고정함).
- 화면 문구는 디자인 규칙 v1(해요체, 동사 버튼, 화면당 주요 버튼 하나)을 따른다.

## PR 1: 서버 (브랜치 `fix/intake-photo-evidence-p1b`)

### T1 유스케이스

- 만들 파일
  - `packages/application/src/use-cases/submit-ticket-photo-evidence.ts`
  - 같은 이름의 `.test.ts`
  - `packages/application/src/index.ts`에 export를 더한다.
- 인터페이스: `submitTicketPhotoEvidence(deps, { ticketId, evidenceType, photoId }): Promise<{ ticket: Ticket; changed: boolean }>`
- 테스트(먼저 실패 확인)
  - 켜진 요구 항목이면 `TENANT_UPLOAD` 증빙이 `core-photo:<id>`로 기록되고, 상태가 다시 계산된다.
  - 같은 유형을 다른 사진으로 고르면 바뀌고, 같은 요청은 `changed: false`다.
  - 켜지지 않은 유형(`FIXTURE_PHOTO`, 위치가 기기가 아닐 때)은 `STATE_CONFLICT`다.
  - 관리자 결정(APPROVED·OVERRIDDEN)이 기록된 접수는 `assertIntakeAllowed`로 거부된다. 답변처럼, 제출 뒤 결정 전에는 다시 고를 수 있고 상태는 `IN_PROGRESS`로 돌아간다.
  - 필수 답변과 지정한 사진이 다 있으면 판정이 `COMPLETE`다(도메인 회귀).
  - 리뷰 반영으로 더한 테스트
    - 안전 신호가 있으면 사진을 골라도 `SAFETY_ESCALATED`다.
    - 제출 뒤 다시 고르면 `IN_PROGRESS`다.
    - 난방은 `CONTROL_PANEL_PHOTO`로 제출하면 `READY_FOR_REVIEW`이고, 누수용 유형은 거부한다.
    - UUID가 아닌 사진 ID는 `NOT_FOUND`다.
    - 같은 질문에 두 번 답했으면 첫 답변으로 요구를 판단한다.
    - 도메인: `TENANT_UPLOAD` 판정(`COMPLETE`·`CONFLICTING`)과 `activeEvidenceRequirements`가 판정과 맞는지.

### T2 Core 동작 `EVIDENCE`

- 고칠 파일: `packages/application/src/core-flow.ts`
- 동작
  - `CoreAction`에 `{ type: "EVIDENCE"; ticketId; evidenceType; photoId }`를 더하고, 세입자 동작으로 둔다.
  - 사진이 `scope.photos(ticketId)`에 없으면 `NOT_FOUND`다.
  - 바뀐 것이 없으면 기록 없이 현재 상태를 돌려준다.
  - 바뀌었으면 `scope.store(ticket, "EVIDENCE", "")`로 기록한다.
- 테스트: T3의 PostgreSQL 통합 테스트로 확인한다. 기존 Core 동작도 같은 방식으로 테스트한다.

### T3 마이그레이션과 PostgreSQL 테스트

- 만들 파일
  - `packages/persistence-postgres/migrations/0024_core_flow_photo_evidence.sql`
  - `tests/postgres/core-flow-photo-evidence.test.ts`
- 테스트(먼저 실패 확인)
  - 누수 접수 → 필수 답변 → 사진 올림 → `EVIDENCE` → 제출하면 `READY_FOR_REVIEW`이고, 추천 경로가 있다.
  - 사진을 고르지 않고 제출하면 지금처럼 `PARTIAL`이다.
  - 이벤트 기록
    - `EVIDENCE` 이벤트가 하나 남는다.
    - 같은 요청을 되풀이하면 이벤트가 늘지 않는다.
    - 다시 고르면 바뀌고 이벤트가 하나 더 남는다.
  - 거부되는 경우
    - 다른 접수의 사진은 `NOT_FOUND`다.
    - 관리자의 `EVIDENCE` 동작은 `FORBIDDEN`이다.
    - 켜지지 않은 유형은 `STATE_CONFLICT`다.
    - 완료된 처리는 `STATE_CONFLICT`다.
  - 관리자 세션으로 `store_ticket(..., 'EVIDENCE', ...)`를 직접 부르면 `FORBIDDEN`이다.
- `scripts/hosted-demo-provision.mjs` 주석의 "0001-0023"을 "0001-0024"로 고친다.

### T4 계약, HTTP, 응답, 클라이언트

- `packages/api-contracts`
  - `CorePhotoEvidenceRequestSchema`(`evidenceType`: 공개 유형 이름, `photoId`: uuid)를 더한다.
  - 제출된 증빙 DTO에 선택 필드 `photoId`를 더한다.
- `apps/web/src/server/core-flow/http.ts`
  - `POST tickets/{id}/evidence`를 더한다. 본문 검증이 실패하면 DB를 부르지 않는다.
  - 공개 유형 이름을 도메인 유형으로 바꾼다.
- `apps/web/src/server/http/presenters.ts`
  - `TENANT_UPLOAD` + `core-photo:` 증빙이면 `photoId`를 채운다.
  - 리뷰 반영: 요구 목록(`evidenceRequirements`)을 `activeEvidenceRequirements`로 만든다. 예전에는 마지막 답변을 읽어서, 같은 질문에 두 번 답하면 서버가 거부할 유형을 보여 줄 수 있었다.
- `packages/api-client/src/core-flow.ts`: `submitPhotoEvidence(id, body)`를 더한다.
- 테스트(먼저 실패 확인): 계약 스키마, HTTP 경계(잘못된 본문은 400이고 DB 호출이 없음), presenter의 `photoId`, 클라이언트 요청 경로와 응답 해석.

### T5 검사, PR, 리뷰, 수락

- 실행할 검사
  - `npm run test:shared`, `test:web`, `lint`, `typecheck`, `build:web`, `check:deps`
  - `npm run test:postgres`(마이그레이션이 있어서 필수)
  - `python scripts/verify_repository.py --history`
- PR 본문 첫 줄은 `Risk tier: 고위험`이다.
- CI를 통과한 뒤 새 문맥에서 독립 리뷰를 받는다.
- `ops/` 수락 기록을 남기고 병합한다.

## PR 2: 화면 (PR 1 병합 뒤)

### U1 세입자 증빙 단계

- 고칠 파일
  - `apps/web/src/components/tenant/ticket-intake.tsx`(`coreFlow` 분기)
  - `apps/web/src/app/core/core-screen.tsx`(Core 클라이언트 전달)
  - `apps/web/src/components/core-photos.tsx`(도움말 문구, 사진 선택 타일)
- 동작
  - 남은 요구 항목마다 한 화면씩 보여 준다.
    - 제목: 요구 항목 이름. 안내: 프로토콜 문구 그대로.
    - 사진: 선택 타일(4:3, 라디오).
    - 주요 버튼 "이 사진으로 정하기", 보조 버튼 "사진 추가하기"(3장 제한).
  - 다 고르면 "수리 요청 제출"로 넘어간다.
- 테스트
  - 컴포넌트 테스트(타일 선택, 버튼 상태, 문구)
  - `core-e2e` 흐름: 누수 → 사진 지정 → 제출 → 관리자 추천 경로

### U2 관리자 표시

- 서버·계약 변경(리뷰 반영): 관리자 상세 응답(`LandlordTicketDetailDtoSchema`, `presentLandlordTicket`)에는 아직 제출된 증빙이 없다.
  - 제출된 증빙(유형 이름, `photoId`)을 관리자 상세 계약과 응답에 더한다.
  - 계약 테스트와 presenter 테스트를 먼저 실패시키고 시작한다.
- `PhotoGallery`에서 증빙으로 고른 사진 아래에 유형 이름을 보여 준다.
- 이력에서 `EVIDENCE`를 "증빙 사진 지정"으로 보여 준다. 지금은 대체 이름 "접수 정보 변경"으로 보인다.

### U3 검사, PR, 리뷰, 수락

- 디자인 규칙 15절 체크리스트, `scripts/design-audit.mjs` 0건, 390·1280px 캡처(비공개 보관)
- `test:e2e:core`, 고위험 흐름(독립 리뷰, `ops/` 수락)
- 데모 배포는 두 PR을 모두 병합한 뒤, 실행 직전에 운영자에게 확인한다.
  - 배포 메모: 응답 스키마가 `.strict()`라, 배포 전 번들을 연 탭은 `photoId`가 든 응답을 읽지 못한다. 배포 뒤 열린 탭을 새로고침한다.
