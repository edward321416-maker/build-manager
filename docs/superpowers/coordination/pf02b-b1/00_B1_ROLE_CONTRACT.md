# 자취사무소 B1 — Astra 구현 / Opus 독립 검토 운영 계약

작성일: 2026-09-21 · revision: 1.1
상태: **ROLE_SPLIT_REVIEWED / PLAN_STAGE_READY / PRODUCT_IMPLEMENTATION_NOT_AUTHORIZED_BY_THIS_DOCUMENT**
대체: 역할 운영안 1.0의 분담·인계 절차. 제품 범위는 바꾸지 않는다.

## 1. 한 가지 목표와 근거

**별도 인증 PoC가 아니라 본체에서 로그인 → 내부 User → 내 조직·건물 조회 → 타 조직 거부 → 로그아웃·권한 철회 뒤 차단을 완성한다.**

제품 범위의 기준은 [B1 전환 명세](inputs/PF02_B_PRODUCT_INTEGRATION_TRANSITION.md)다.
[이전 역할안](inputs/original_role_split.md)의 단일 작성자·독립 검토 원칙을 작업 단위로 구체화했다.
다른 문서의 현재 단계가 충돌하면 새 제품 범위를 임의로 정하지 말고 해당 조항만 보고한다.

- Repository: `edward321416-maker/build-manager`
- 이번 조회 POLICY_REF / CONTEXT_BASE: `87341f143b04dd96a5b7e66dedf8df47b5f5ae73`
- 원격 main과 정책 3개 blob 일치 확인. 정책 본문은 동일 blob의 기존 열람 내용을 재사용했다.
- 사용자 PC의 최신 계획·worktree·Auth0 상태는 이번 작성자가 직접 확인하지 않았다.
- 이 파일은 실제 CLI를 실행하거나 권한을 강제하는 설정 파일이 아니다.
- Astra·Opus는 역할 호칭이다. 실제 모델/CLI 식별자는 실행자가 기록하며, 이름만으로 기능·비용·품질을 보장하지 않는다.

## 2. 누가 무엇을 소유하는가

| 책임 | Astra / Codex | Opus / Claude Code | 조정 채팅·사용자 |
|---|---|---|---|
| B1 구현계획 | 단일 작성·수정 책임 | 완성된 계획의 모순·보안 경계 검토 | 중요한 미결정과 계획 실행 승인 판단 |
| 제품 소스·SQL·테스트 | 승인된 계획 범위에서 유일한 작성자 | 읽기 전용 검토 | 리뷰 충돌·범위 조정만 |
| 새 회귀시험 | 구현과 함께 작성·유지 | 별도 임시 환경에서 공격/실패 사례 재현 가능 | 반복적인 기술 판단 요구 안 함 |
| Auth0·브라우저·본인 시험계정 | 승인된 실연동 작업의 단일 담당 | 변경·로그인·비밀 접근 금지 | 본인 로그인·약관·명시적 외부 승인만 |
| CI·의존성·공개 scanner | 실행·원인 분석·필요한 최소 수정 | 정확한 대상·결과·누락 검토 | 최종 인수조건 유지 |
| 리뷰 결과 | 발견사항에 근거로 답하고 최소 수정 | 발견사항·재현 증거·판정 작성 | 해결되지 않는 계약 차이 중재 |
| commit/push/PR/merge | 해당 단계 승인 후에만 담당 | 금지 | 실행 승인과 exact-head 인수 판단 |
| 실행 로그 | 자신의 큐 및 승인 후 canonical append | 별도 로컬 리뷰 로그만 | 동기화 상태 확인 |

**프론트엔드/백엔드를 서로 나누지 않는다.** B1은 인증부터 데이터 접근까지 연결된 한 흐름이다.
Opus는 두 번째 설계자나 동시 코드 편집자가 아니라, 그 흐름을 독립적으로 반박·검증하는 담당자다.

## 3. 지금 시작할 일과 아직 시작하지 않을 일

지금 가능한 작업은 Astra의 **코드 기준 B1 계획 완성**과, 그 산출물에 대한 Opus의 **계획 검토**다.
새로운 계획이 이미 로컬에 있으면 그 문서를 이어서 사용한다. 같은 목적의 계획을 또 만들지 않는다.

제품 코드·의존성·외부 설정·GitHub 게시·병합은 아직 이 역할 문서로 승인하지 않는다.
Opus가 `NO_BLOCKING_FINDINGS`를 반환해도 그것만으로 구현 승인이나 merge 승인이 생기지 않는다.
필요한 중요 결정을 계획에 모으고, 계획 실행 범위를 한 번에 확정한 뒤 작업 단위마다 재승인을 묻지 않는다.

D01 추가 실험·G04 linking은 첫 slice에서 보류한다. 계정 비교·카카오 취소·동의 철회 시험으로 돌아가지 않는다.
PoC를 정리할 때는 소유가 확인된 시험 프로세스만 정상 종료한다. 외부 계정 unlink·삭제는 하지 않는다.

## 4. B1 작업 단위별 분담

아래 순서는 계획·구현의 책임 묶음이지 별도 승인 PR이나 독립 phase를 추가하는 것이 아니다.
각 단위는 Astra가 계획에 실제 파일·함수·SQL·시험 경로를 확정한다. 아래 위치는 확인된 패키지 수준의 후보이며 아직 생성된 파일이라고 주장하지 않는다.

| 단위 | Astra가 만들 결과 | Opus의 핵심 검토 질문 | 계획에서 정할 위치 |
|---|---|---|---|
| B1-00 연결 계약 | 인증 → 내부 actor → 세션 → 조직 발견 → 조직별 조회 흐름, 오류·철회 시점, exact SDK·설정 delta | 조직을 모르는 로그인 직후에 광범위한 DB 권한이 생기는가? | 기존 `apps/web`, `packages/application`, `packages/api-contracts`, `packages/persistence-postgres`의 실제 인터페이스 |
| B1-01 identity 매핑 | 검증된 issuer/subject로 ExternalIdentity·User를 원자적으로 찾거나 생성 | 동시 최초 로그인으로 중복 User/고아 row가 생기는가? 정지 계정이 다시 생성·활성화되는가? | application port/use case + PostgreSQL 신규 migration/adapter + DB 시험 |
| B1-02 세션·철회 | 서버에서 확인 가능한 세션 유효성, 로그아웃·계정 철회 후 신규 요청 거절 | cookie만 삭제하고 기존 cookie/token 재사용은 허용하는가? 판단 시점이 명확한가? | Web 서버 인증 조립 + application 정책 + persistence·회귀시험 |
| B1-03 내 조직·건물 조회 | 현재 ACTIVE User·Organization·ORG_ADMIN Membership 조건으로 목록·상세 조회 | 임의 orgId를 DB context에 먼저 넣는가? 조직 선택 전 discovery가 타인 소속을 노출하는가? | 좁은 discovery port/DB capability + 조직별 query + 응답 계약 |
| B1-04 본체 UI/API 연결 | `apps/web`에서 실제 로그인·빈 소속 화면·조직 선택·건물 조회·거부/장애 표시 | UI를 거치지 않는 직접 API/실제 Server Action에도 같은 정책이 적용되는가? 공유 cache가 섞이는가? | 기존 Web 화면·서버 진입점·계약·Web/E2E 시험 |
| B1-05 실행 증거·게시 후보 | 자동 회귀, 실제 Auth0 본체 smoke, 보안 검사, 정확한 후보 SHA·CI 영수증 | mock 성공을 실제 인증 성공으로 부풀리는가? 시험이 0개/skip인데 초록인가? | 현재 test scripts/workflows와 필요한 최소 delta, 동일 구현 PR의 상태 문서 |

**첫 긍정 경로는 ORG_ADMIN의 자기 조직 읽기**다. 신규 로그인은 관리자 권한을 자동 생성하지 않는다.
조직 생성·초대·권한 변경 UI, PROPERTY_STAFF의 건물 배정, 입주자 업무, 모바일 로그인, 계정 연결은 후속 범위다.
기존 runtime을 owner/superuser/BYPASSRLS로 바꾸지 않는다. RLS를 끄거나 기존 migration을 소급 수정하지 않는다.
PF02-A의 검증된 함수는 필요한 최소 연결 외 재설계하지 않는다. 새로운 근거 있는 결함만 좁게 재개한다.

## 5. Opus가 확인할 인수 경계 — 기존 B1 요구의 시험화

| ID | 실제 확인할 상황 | 기대 결과 |
|---|---|---|
| R01 | 같은 issuer/subject의 동시 첫 로그인·재로그인 | 하나의 내부 User·identity 매핑, 원자적 실패, 기존 정지 상태 보존 |
| R02 | 인증 성공했지만 조직 멤버십 없음 | 빈 조직 목록; 자동 관리자 생성·다른 조직 탐색 없음 |
| R03 | A 사용자로 알려진 B 조직·건물 ID 직접 요청 | 일관된 거부/미존재 응답, B 업무 데이터 없음 |
| R04 | UI 우회 및 userId/role/orgId 변조 | 클라이언트·provider role·이메일로 권한 추가 불가 |
| R05 | User·Organization·Membership 종료 commit 뒤 신규 요청 | 이전 화면·세션·cache로 계속 읽지 못함; 동시 진행 중 요청과 구분 |
| R06 | 로그아웃 후 기존 cookie/세션을 재사용 | 정의된 서버 철회 범위에서 거부; 단순 cookie 삭제를 근거로 삼지 않음 |
| R07 | 조직 발견·부트스트랩·pool 재사용 | 비특권·제한된 조회 경로, 임의 actor/org 선택이나 context 누수 없음 |
| R08 | 잘못된 인증·만료·callback 재사용 | 검증 실패·권한 부여 없음; callback으로 재로그인/철회를 우회하지 못함 |
| R09 | 서로 다른 사용자의 페이지/API cache | 사용자별 데이터가 교차 노출되지 않음 |
| R10 | Auth0/DB/설정 사용 불가 | 오류를 명시하고 실패 처리; demo/SQLite/test identity로 조용히 fallback하지 않음 |
| R11 | PROPERTY_STAFF 또는 입주자 관계로 B1 관리자 읽기 시도 | B2에 맡긴 범위를 미리 허용하지 않음 |
| R12 | 실제 본체 Auth0 smoke와 test-only adapter | 실제 인증 증거와 합성 회귀를 분리; production에 test-only 우회 미노출 |

계획 리뷰는 R01–R12에 시험과 책임 위치가 지정됐는지 본다. 구현 리뷰는 시험 코드와 실제 실행 증거를 대조한다.
Opus가 R01/R03/R05/R06/R07을 우선 독립 재현하되, 같은 불변조건을 한 시험이 입증하면 중복 실행하지 않는다.
각 항목을 별도 gate/문서/PR로 만들지 않는다. 실제 외부 인증은 Astra의 지정된 smoke 세션 한 묶음으로 확인한다.
공식 공급자 로그인 취소 등 D01의 미검증 경계를 이 표의 합성 시험으로 PASS 승격하지 않는다.

## 6. 실행 순서 — 정규 검토는 두 시점

1. **PLAN_DRAFT — Astra:** 기존 계획을 찾아 B1-00~05, 파일 책임, R01~12, 필요한 승인 delta를 한 계획으로 완성한다.
2. **PLAN_REVIEW — Opus:** 전달받은 파일 해시와 명세를 고정해 검토한다. 제품 코드는 수정하지 않는다.
3. **PLAN_READY — Astra:** 유효한 발견사항을 반영하고 해결표를 작성한다. Opus는 변경 구간만 재검토한다.
4. **EXECUTION_AUTHORIZED — 사용자/조정:** exact 계획 해시와 구현·외부 설정·게시 범위에 대해 필요한 승인을 한 번 정리한다.
5. **IMPLEMENTING — Astra:** TDD·회귀·단계별 commit을 진행한다. 작업 단위 완료 때마다 Opus를 자동 호출하지 않는다.
6. **CANDIDATE_READY — Astra:** 시험 결과와 변경 목록을 정리해 BASE_SHA·HEAD_SHA가 고정된 후보를 제출한다.
7. **IMPLEMENTATION_REVIEW — Opus:** 별도 checkout에서 소스·시험을 대조하고 필요한 경계만 재현한다.
8. **DELTA_FIX / REVIEW_COMPLETE — Astra/Opus:** 유효한 결함은 Astra가 수정, Opus는 해당 영향만 재검토한다.
9. **PUBLICATION — 승인된 Astra:** 독립 인수·필수 CI·게시 승인이 충족될 때만 PR/merge를 진행한다. 실제 merge SHA의 새 main CI를 확인한다.

계획 리뷰 또는 구현 리뷰에서 현재 필수 조건의 미검증/접근 부재가 있으면 `BLOCKED_REVIEW_ACCESS` 또는 `CHANGES_REQUIRED`다.
`NO_BLOCKING_FINDINGS`는 검토 범위의 판정이지 모든 보안 검증 PASS나 출시 승인이 아니다.
단지 예정된 후속 기능이라는 이유의 미검증은 B1을 막지 않지만, B1 필수 보안 검증 미완료는 숨기지 않는다.

## 7. 동시에 할 수 있는 것 / 할 수 없는 것

- Astra 구현 중 Opus는 **이미 검토된 명세로부터** R01~R12의 기대 결과를 독립적으로 정리할 수 있다. 선택 작업이며 무조건 실행시키지 않는다.
- 구현 후보가 없는데 Opus가 계속 저장소·대화를 탐색하며 기다리지 않는다.
- 구현 후보 리뷰 중 대상 HEAD를 이동시키지 않는다. 새 commit은 리뷰 결과 뒤에 제출하고 이전 리뷰를 새 HEAD에 재사용하지 않는다.
- 두 실행자가 같은 working tree, branch, runtime DB, 브라우저, Auth0 설정, node_modules/cache를 동시에 변경하지 않는다.
- 별도 worktree는 파일 checkout 분리다. Git metadata·호스트 권한·Docker socket·외부 계정의 보안 격리를 보장하지 않는다.
- 자동 협업 daemon, hook, 신규 MCP, background watcher는 이 계약으로 추가하지 않는다.

## 8. Opus 접근과 재현 환경

기본 허용은 고정된 소스·합성 시험·비밀 제거된 증거의 읽기와 별도 리뷰 디렉터리 쓰기다.
독립 재현이 필요하면 **리뷰 전용 checkout/임시 파일·별도 폐기용 DB·별도 포트**를 사용한다.
production 소스·migration·lockfile·workflow의 수정, 실행자 worktree 기록, commit/push/merge는 금지한다.

시험용 입력·프로브는 리뷰 전용 파일에 작성할 수 있다. 추적 소스의 bytes와 비교 전후 상태를 확인하며,
이를 제품 변경이나 인수된 회귀시험으로 취급하지 않는다. 유효한 회귀는 Astra가 검토 후 제품 시험에 통합한다.
리뷰용 DB는 승인된 합성 상태만 가진다. 실제 provider 비밀·시험 이메일·운영자 세션은 전달하지 않는다.
새 CLI/SDK 설치나 외부 권한이 필요하면 먼저 기존 승인에 포함되는지 확인한다. 자동 권한 확대는 금지한다.
실제 enforcement를 확인하지 못하면 `ACCESS_ENFORCEMENT=NOT_VERIFIED`라고 기록한다.
읽기 전용 설정 때문에 재현 실행이 불가해도 권한을 풀지 말고 STATIC_REVIEW/NOT_RUN을 분리해 보고한다.

## 9. 인계 형식과 파일 소유자

로컬 역할 디렉터리는 Astra가 **실제 존재를 확인한 repo 밖 폴더** 한 곳을 선택해 절대경로를 기록한다.
Windows/WSL 경로가 다르면 검증된 대응 경로만 제공한다. 사용자에게 긴 로그를 복사하도록 요구하지 않는다.
CLI 간 자동 전달은 현재 구성되지 않았다. 같은 PC에서 접근 가능하면 파일 경로만 전달하고,
접근할 수 없으면 비밀 없는 명세·계획·인계표만 첨부한다. 새 서비스 가입/연결로 우회하지 않는다.

| 산출물 | 단일 작성자 | 내용 |
|---|---|---|
| B1_IMPLEMENTATION_PLAN.md | Astra | 하나의 구현계획. 기존 파일이 있으면 그 경로 유지 |
| B1_HANDOFF.md | Astra | 단계·실제 경로·명세/계획 hash·Git base/head·변경 목록·시험 영수증 위치 |
| B1_REVIEW_PLAN.md | Opus | 계획 발견사항·판정·미검증 범위 |
| B1_REVIEW_IMPL.md | Opus | 구현 발견사항·직접 재현·CI 관찰·판정 |
| B1_FINDING_RESOLUTION.md | Astra | finding별 수용/근거 반박·수정 ref·해결시험 |
| 실행 로그 | 각자 별도 큐 | Opus가 Astra의 ops 파일을 동시에 append하지 않음 |

인계표 필수 필드:
`MODE`, `POLICY_REF`, `SCOPE_PATH`, `SCOPE_SHA256`, `PLAN_PATH`, `PLAN_SHA256`, `BASE_SHA`,
`HEAD_SHA`(계획 단계에는 NOT_APPLICABLE), `CHANGED_PATHS`, `CHECK_RECEIPTS`, `UNVERIFIED`,
`APPROVAL_STATUS`, `EXECUTOR_ENVIRONMENT`.
실제 파일/commit만 적으며 제목·요약으로 bytes를 대체하지 않는다. 새 검토자는 명세와 계획을 처음 한 번 읽어야 한다.

## 10. 결함과 재검토의 종료 규칙

발견사항은 `finding_id / severity / reviewed_ref / file:line / 위반 요구 / 재현 상태 / 기대·관찰 / 최소 수정 / 불확실성`으로 쓴다.
문제 개수 목표를 주지 않는다. 실제 문제가 없으면 그대로 반환한다.

- BLOCKER/HIGH: 현재 요구의 실패, 권한 우회, 데이터 누출·손상, 필수 시험 실패/누락 등 근거가 있는 차단 문제.
- MEDIUM/LOW: 비차단 개선·가독성·향후 확장. 기존 backlog로 넘기며 새 기능을 만들지 않는다.
- 코드로 증명되는 결함은 재현이 없더라도 STATIC_REVIEW로 차단 제기할 수 있으나 실제 실행했다고 주장하지 않는다.
- 같은 결함의 두 차례 수정에서도 합의가 안 되면 최소 재현·계약 차이만 조정한다. 두 번을 넘겼다고 자동 승인하지 않는다.
- 범위 밖 기존 결함은 이번 변경과의 인과·현재 gate 영향을 분리한다. 영향을 확인하지 않고 전체 프로젝트를 재감사하지 않는다.

## 11. 시험·CI·최종 게시

현재 root manifest에서 `test:shared`, `test:postgres`, `test:web`, `test:mobile`, `test:e2e:web`,
`lint`, `typecheck`(내부 typecheck:tests 포함), `build:web`, `check:deps`를 확인했다.
B1 실행계획은 후보에 필요한 전체 회귀·scanner·live smoke 및 정확한 명령을 책임 있게 연결한다.
명령이 존재한다는 확인은 이번에 시험을 실행했다는 뜻이 아니다. scanner 3+14와 기존 시험 개수는 역사적 기준이며 숫자만 맞추지 않는다.

현재 project acceptance check 9개를 낮추지 않는다:
`verify`, `repository-safety`, `apps`, `mobile-cold-linux`, `install-mobile-windows`, `web-e2e`,
`mobile-health`, `postgres-integration`, `foundation-gate`.
신규 B1 시험이 실제 job에서 발견·실행되는지 확인한다. 0개·skip·cancelled를 성공으로 세지 않는다.
Opus는 실제 run의 SHA·event·attempt·job result와 필요한 marker를 확인한다. CI 성공만으로 실연동을 대체하지 않는다.

Astra의 후보 → Opus 인수검토 → exact-head 게시 승인 → fresh main 검증 순서를 유지한다.
기존 사용자 승인 없는 merge·force push·rebase·history rewrite·branch 삭제는 없다.
상태·인수 근거는 가능하면 동일 구현 PR에 준비하되 **미래 main CI를 완료 사실로 선기록하지 않는다**.
병합 후 SHA/run은 PR comment·최종 영수증·로컬 append-only 큐에 기록하고, 다음 실질 작업의 승인된 로그 반영에 합친다.
종료 기록을 남기려고 또 종료 PR을 만들고 다시 종료하는 연쇄는 만들지 않는다. 기존 정책이 추가 기록을 실제로 요구하면 그 요구와 범위를 먼저 확인한다.

## 12. 토큰·출력 규칙

- 역할별 최초 필수 명세·정책은 읽는다. 이후 hash가 같으면 재사용하고 바뀐 부분만 읽는다.
- 전체 D01 transcript·과거 CI·다른 프로젝트 자료를 두 세션에 복사하지 않는다.
- source는 rg/AST/signature와 diff 우선. 필요한 보안 함수·직접 호출 경로는 충분히 읽는다.
- 전체 로그는 private 파일로 보존하고 필요한 marker/실패 구간만 출력한다. 정확한 근거를 희생하는 강제 줄수 제한은 없다.
- 인계 요약은 약 30행을 목표로 하고 자세한 발견사항은 파일에 둔다. 이는 편집 목표이지 도구의 token 상한이 아니다.
- CI polling을 5~20초 간격으로 반복하지 않는다. 실행기가 지원하는 저출력 대기/알림 또는 충분한 간격의 상태 확인을 사용한다.
- Opus 재현은 핵심 불변조건과 발견사항에 집중한다. 모든 회귀·실제 사람 로그인을 이중 실행하지 않는다.
- 기본은 역할별 단일 세션이며 세부 agent를 자동 증식시키지 않는다. 독립 작업이 생길 때만 비용을 설명하고 검토한다.
- token 실제 계측이 없으면 unknown이다. 절감률·시간 단축률을 만들어내지 않는다.

## 13. 다음 행동

지금은 [Astra 시작 지시서](01_ASTRA_B1_PLAN.md)를 기존 Codex 세션에 전달한다.
완성된 계획과 인계표가 준비된 뒤 [Opus 검토 지시서](02_OPUS_B1_REVIEW.md)를 별도 Claude Code 세션에 전달한다.
Opus는 계획이 오기 전에 작업을 시작하지 않는다. 실제 제품 실행은 계획 검토와 실행 승인 뒤다.
[감사 보고](03_ROLE_SPLIT_AUDIT.md)는 이번 역할 계약의 정적 검토이며 제품 코드 보안 감사 결과가 아니다.

## 14. 외부 근거·검증 한계

기존 첨부의 범위·제약과 별개로 다음 공식 문서를 2026-09-21에 확인했다.
- Claude Code Writer/Reviewer: https://code.claude.com/docs/en/best-practices
- OpenAI worktree 안내: https://developers.openai.com/codex/app/worktrees/

공식 자료는 역할·checkout 분리의 참고 근거다. 위 R01~R12, 단계·파일 소유권·판정 규칙은 이 프로젝트를 위한 구체화다.
Astra와 Opus의 성능 우열, 실제 CLI 간 자동 인계, 권한 강제, 제품 시험 성공 또는 token 절감을 이번 문서로 입증하지 않는다.
외부 Google 기록·스키마 캐시는 PENDING이며 연결/권한 설정을 변경하지 않았다.
