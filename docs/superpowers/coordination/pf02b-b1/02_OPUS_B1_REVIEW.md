# Opus — 자취사무소 B1 독립 계획·구현 검토 지시서

상태: **REVIEWER_RUNBOOK_READY / WAIT_FOR_VALID_HANDOFF**
실행자: 별도 Claude Code 세션의 실제 사용 가능 모델. 구현 세션의 사고 과정·전체 transcript를 가져오지 않는다.

## 시작 조건

[Astra 인계표](00_B1_ROLE_CONTRACT.md#9-인계-형식과-파일-소유자)에 해당하는 실제 `B1_HANDOFF.md`가 있어야 한다.
계획이 없는데 저장소를 돌아다니며 대기하지 않는다. 현재 사용자 지시는 역할 구체화·검토이며 이 문서가 제품 쓰기 권한을 만들지 않는다.

처음에는 [B1 전환 명세](inputs/PF02_B_PRODUCT_INTEGRATION_TRANSITION.md)와 [역할 계약](00_B1_ROLE_CONTRACT.md)을 읽는다.
다음 리뷰부터는 이전 검토 hash가 같으면 재사용한다. Astra의 기술적 근거는 읽되 결론을 검증 결과로 그대로 채택하지 않는다.

## 불변 권한

- Astra의 제품 worktree·정책·schema·lockfile·workflow·canonical ops 로그 수정 금지.
- commit/push/merge·Auth0/Kakao 대시보드·사용자 계정/브라우저 변경 금지.
- .env·Client Secret·provider token·사용자 이메일 원문 요청/복사 금지.
- 리뷰 전용 디렉터리에는 보고서와 합성 재현 probe를 쓸 수 있다.
- 재현은 승인된 별도 checkout/일회성 PostgreSQL 및 별도 포트에서만. 공유 test DB나 실제 운영자 계정을 사용하지 않는다.
- 재현 코드가 필요하면 unified diff/정확한 patch로 남기고 제품에 통합하지 않는다. Astra가 검토해 회귀시험을 소유한다.
- 허용된 tool 설정을 실제로 확인한다. 문구만으로 read-only enforcement가 된 것으로 보고하지 않는다.
- 도구 접근이 부족하면 그 사실을 보고하고, 새 권한을 얻기 위해 제한을 자동 해제하지 않는다.

## MODE=PLAN

1. scope/plan 파일과 hash, repo base 및 policy를 확인한다. 바뀐 계획으로 조용히 리뷰하지 않는다.
2. Astra 계획을 다시 쓰지 말고 B1-00~05 경계와 R01~R12의 입증 방법을 확인한다.
3. 최우선 검토: identity 원자성, 조직 선택 전 discovery 권한, session 철회·권한 조회 시점,
   직접 API/cache 우회, 시험 adapter가 production에 들어갈 가능성.
4. 계획이 가리키는 실제 interface와 필요한 코드만 확인한다. 상세 구현 계획에 테스트 경로·실패 결과가 비어 있는지 본다.
5. 계획 밖 신규 기능·리팩터링·카카오 실험을 인수조건으로 추가하지 않는다.
6. `B1_REVIEW_PLAN.md`에 발견사항과 판단을 작성한다.

완료: `PLAN_REVIEW_COMPLETE`와 verdict. 구현을 시작하거나 실행 승인을 대신하지 않는다.

## MODE=IMPLEMENTATION

제품 실행 승인을 거친 후보에 대한 인계가 있을 때만 수행한다.

1. PLAN_SHA256, BASE_SHA, HEAD_SHA와 변경 파일을 검증하고 별도 고정 checkout에서 시작한다.
   추적 소스 변경 유무와 누락된 파일·커밋을 확인한다. 실험 결과가 후보와 다른 코드면 따로 표시한다.
2. 자기 판단으로 source·호출 경로·SQL·테스트를 대조한다. green CI를 소스 검토 대신 쓰지 않는다.
3. R01/R03/R05/R06/R07 우선으로 필요한 독립 재현을 선택한다. 하나의 시험이 여러 항목을 증명하면 중복 실행하지 않는다.
   실제 Postgres 없이 mock만 사용했다면 `MOCK_PROBE`로, 실제 DB 재현이면 환경·명령·결과를 남긴다.
4. 실제 Auth0 재로그인을 사용자에게 다시 요구하지 않는다. Astra의 지정된 live smoke 자료를 검사하고
   `EXECUTOR_LIVE_EVIDENCE_INSPECTED`로 구분한다. 부족한 실제 인증 근거가 B1 필수조건이면 그 공백을 지적한다.
5. 필수 9개 CI가 정확한 후보에 연결됐는지와 새 B1 시험이 실행됐는지 확인한다.
   PR 이벤트가 synthetic merge ref를 시험하면 run head와 pull-request head 관계를 함께 기록한다.
   plan-only 단계의 CI 미실행과 implementation 단계의 필수 CI 누락을 혼동하지 않는다.
6. `B1_REVIEW_IMPL.md`와 필요한 비밀 없는 재현 파일만 작성한다.

완료: `IMPLEMENTATION_REVIEW_COMPLETE`와 verdict. NO_BLOCKING_FINDINGS여도 승인 없는 merge는 하지 않는다.

## 발견사항 형식

각 항목에 `finding_id`, `severity`, 실제 `reviewed_ref`, `file:line`, 위반 B1 요구,
입력/상태/호출 순서, 기대와 관찰, 증거분류, 최소 수정 방향, 확인하지 못한 점을 적는다.

증거분류: `STATIC_REVIEW`, `CI_LOG_INSPECTION`, `MOCK_PROBE`, `REPRODUCED_POSTGRES`,
`EXECUTOR_LIVE_EVIDENCE_INSPECTED`, `NOT_RUN`.
제품 코드의 특정 누출/손상 경로를 증명했으면 실제 재현 없이도 STATIC_REVIEW 결함으로 지적할 수 있다.
반대로 이름·취향·가능성만으로 HIGH를 만들지 않는다. 발견사항 할당량은 없다.

판정:
- `NO_BLOCKING_FINDINGS`: 필요한 리뷰 범위에서 차단 결함이 없고 검토에 필수인 접근/증거가 충족됨.
- `CHANGES_REQUIRED`: 근거 있는 결함 또는 계획·구현 인수조건 누락이 있음.
- `BLOCKED_REVIEW_ACCESS`: 필수 대상/환경/증거가 없어 판단 불가. 미검증을 성공으로 바꾸지 않음.

## 수정 후

Astra의 `B1_FINDING_RESOLUTION.md`, 새 파일 hash/HEAD, 이전 후보 대비 diff를 읽는다.
해결된 finding과 직접 영향만 재검토한다. 변하지 않은 모든 source·과거 PASS는 다시 읽지 않는다.
같은 문제의 두 차례 수정에도 불일치가 있으면 최소 재현·계약 차이를 조정자에게 전달한다. 자동 수용/자동 범위 확대는 금지한다.

## 최종 요약

`MODE`, `REVIEW_REF`, `VERDICT`, 차단 finding ID, 직접 수행한 시험, 직접 수행하지 않은 경계,
리뷰 파일 실제 경로만 요약한다. 정상 결과에 장문의 전체 로그를 붙이지 않는다.
사용자는 로그인/승인만 담당하며 기술적인 source·CI 검증과 원인 판정을 넘기지 않는다.

`PRODUCT_WRITES=0 / REMOTE_WRITES=0 / EXTERNAL_PROVIDER_WRITES=0 / EXTERNAL_SYNC=PENDING`
