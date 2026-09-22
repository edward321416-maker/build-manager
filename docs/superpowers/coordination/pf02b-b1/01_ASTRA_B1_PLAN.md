# Astra — 자취사무소 B1 계획 작성 지시서

상태: **READY_FOR_PLAN_STAGE / IMPLEMENTATION_NOT_STARTED_BY_THIS_INSTRUCTION**
실행자: 기존 Codex 세션의 실제 사용 가능 모델. 새 모델/CLI 설치나 설정 변경 지시가 아니다.

## 목표

[B1 역할 계약](00_B1_ROLE_CONTRACT.md)과 [기존 전환 명세](inputs/PF02_B_PRODUCT_INTEGRATION_TRANSITION.md)를 사용해
**본체 로그인 → User → 내 조직·건물 조회 → 타 조직 거부 → 로그아웃·철회 차단**의 구현계획 하나를 완성한다.
새 인증 PoC를 만들거나 G04 account linking을 재개하지 않는다.

## 이번에 허용한 작업

- 관련 source와 manifest의 읽기 전용 확인, 이미 있는 B1 계획의 이어쓰기.
- 사용자가 소유한 작업을 보존하면서 이 D01 시험이 소유한 프로세스만 정상 종료.
- repo 밖의 비공개 계획·인계표·해결표·실행 로그 작성.
- 명세와 현재 코드 사이의 필요한 차이를 계획으로 정리.

제품 파일·dependency 설치·Auth0 설정·GitHub 쓰기·branch 변경·계정 연결은 이 시작 지시의 범위가 아니다.
운영 계약의 구현·게시 역할은 추후 승인 후에만 적용된다.

## 순서

1. 현재 repo identity와 main, 로컬 변경·worktree를 읽기 전용으로 확인한다.
   컨텍스트 기준은 `87341f143b04dd96a5b7e66dedf8df47b5f5ae73`다.
   다르면 이동 원인과 B1 영향만 확인한다. 무관한 main 이동 때문에 재설계하지도, 중요한 차이를 숨기지도 않는다.
   자동 reset/rebase/merge로 맞추지 않는다. 정책 변경·범위 충돌이 있으면 해당 사항만 보고한다.
2. AGENTS·governance의 실제 policy ref를 남긴다. 이미 읽고 hash가 같은 본문은 재출력하지 않는다.
3. 기존 B1 계획의 실제 경로를 찾는다. 있으면 유지하고, 없으면 검증한 repo 밖 폴더에 `B1_IMPLEMENTATION_PLAN.md`를 만든다.
   입력 파일의 제목만으로 Windows/WSL 경로를 추정하지 않는다.
4. 본체 관련 경로·signature부터 확인한다: `apps/web`, `packages/application`, `packages/api-contracts`, `packages/persistence-postgres`.
   기존 root/app package.json 및 발견되는 requirements/compose 파일은 metadata만 파싱한다. 스크립트를 실행해 스택을 추정하지 않는다.
5. 역할 계약 B1-00~05 각각에 실제 파일/함수/API/SQL/시험 위치, 입력·출력·거부/장애 결과를 고정한다.
   신규 파일은 planned, 존재하는 파일은 existing으로 구분한다. file:line은 실제 조회한 값만 사용한다.
6. R01~R12가 어느 시험에서 입증되는지 한 계획 안에 매핑한다. fake와 실제 Auth0, DB와 UI, PR CI와 main CI를 분리한다.
7. 아래 중요 결정을 한 번에 적는다. 일반 구현 세부는 스스로 결정하고 근거만 남긴다.
8. 자체 정적 점검 후 최종 계획 bytes를 해시하고 `B1_HANDOFF.md`를 작성한다.
9. Opus 계획 리뷰 인계 가능 상태로 종료한다. 이때 제품 코드를 쓰기 시작하지 않는다.

## 계획에서 빠뜨리지 않을 계약

- issuer/subject 검증 및 원자적 User/ExternalIdentity 매핑. 같은 이메일 자동 병합 금지.
- 일반 runtime의 넓은 권한 확대 없이 identity bootstrap·조직 discovery를 수행하는 정확한 경로.
- 신규 로그인 자동 ORG_ADMIN 생성 금지. 조직 없음·User 정지·다른 조직·staff 범위 거부.
- session/권한 철회가 효력을 갖는 시점과 신규 요청·이미 진행 중 요청의 구분.
- 로그아웃 후 cookie 재전송과 identity/계정 정지 시 재인증으로 우회하지 못하는 조건.
- 본체의 데이터 접근 진입점·공유 cache에 같은 권한 경계 적용.
- 실제 Auth0 시험 identity를 포함한 local DB/영수증의 최소 보관·비공개 취급.
- test-only bootstrap/identity adapter와 production 코드 조립의 분리.
- 기존 PostgreSQL migration 불변, 새 migration·권한의 최소 delta.
- 기존 9개 CI gate 유지와 B1 시험의 실제 발견·실행; 정확한 설치 버전과 플랫폼 lock 보존 방안.

## 실행 승인 때 한 번에 결정할 것

실제 SDK exact 버전, 수정 경로 allowlist, 신규 DB capability/DDL, 세션 철회 계약,
본체 callback 추가 등 외부 설정 delta, synthetic/live 테스트 범위, Git commit/push/PR·병합 권한을 계획에 구분한다.
이미 승인된 Auth0 선택·본체 진행 순서를 다시 선택하도록 요구하지 않는다.
새 권한·비용·개인정보·아키텍처 경계만 별도 결정 대상으로 올린다.

## Opus에게 넘길 인계표

`MODE=PLAN`, `POLICY_REF`, `SCOPE_PATH/SHA256`, `PLAN_PATH/SHA256`, `BASE_SHA`,
`HEAD_SHA=NOT_APPLICABLE`, `CHANGED_PATHS=계획문서만`, `CHECK_RECEIPTS`, `UNVERIFIED`,
`APPROVAL_STATUS=PLAN_REVIEW_ONLY`, 실제 OS/CLI·경로 대응을 기록한다.
토큰·이메일·.env·브라우저·provider 권한은 넘기지 않는다. 계획과 source의 재현 가능한 근거만 전달한다.

## 완료 보고

계획 파일의 실제 경로·SHA-256, B1-00~05 포함 여부, R01~R12 매핑 여부,
중요 미결정, Opus에게 줄 인계표 위치만 요약한다. 준비 안 된 항목을 PASS로 적지 않는다.

`PLAN_READY_FOR_OPUS / PRODUCT_IMPLEMENTATION_NOT_STARTED / G04_DEFERRED / EXTERNAL_SYNC_PENDING`

계획은 코드 실행이 아니다. 이 결과를 받으면 Opus가 계획 리뷰를 하고, 필요한 실행 승인을 정리한 후 Astra가 구현한다.
