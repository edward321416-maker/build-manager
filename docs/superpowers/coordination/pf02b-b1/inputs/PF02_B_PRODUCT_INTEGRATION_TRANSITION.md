# 자취사무소 — D01 검증 재배치와 PF02-B 본체 통합 전환

작성일: 2026-09-21
문서 상태: ORDER_CHANGE_APPROVED / FIRST_SLICE_SPEC_READY
제품 구현 상태: NOT_STARTED_BY_THIS_DELIVERY
실행자: 기존 Codex 세션. 실행 모델·도구는 실제 사용 가능한 것을 유지한다.

## 1. 사용자 결정과 이번 문서의 효력

사용자는 별도 인증 실험을 모두 마친 다음에야 제품 개발을 시작하는 순서를 바꾸고,
자취사무소 본체의 실제 인증·조직 권한 연결을 중심으로 진행하도록 요청했다.

- Auth0 공급자 선택, Modular Monolith, 기존 PostgreSQL·명시적 SQL·ports 구조를 유지한다.
- D01 G01–G08 전체 PASS를 PF02-B의 모든 개발에 대한 공통 선행조건으로 두지 않는다.
- 미검증 사례는 삭제하거나 PASS로 바꾸지 않고, 그 기능을 구현·노출하는 단계의 인수조건으로 옮긴다.
- 독립 검증 앱의 추가 실험은 현재 checkpoint에서 보류한다. 제품 통합에 필요한 결함이 확인될 때만 해당 사례를 다시 연다.
- 본 문서는 진행 순서와 첫 구현 범위의 명세다. 아직 작성되지 않은 구현계획의 승인, 제품 구현 완료, 유료 구매 또는 실사용 공개를 뜻하지 않는다.

## 2. 기준과 증거 구분

Repository: `edward321416-maker/build-manager`

```text
POLICY_REF = TARGET_REF = 87341f143b04dd96a5b7e66dedf8df47b5f5ae73
```

작성자가 이번에 원격 main을 읽어 위 40자리 SHA를 확인했다. 정책은 아래 blob이
이미 읽은 본문과 동일함을 확인하고 재사용했다.

| 경로 | blob |
|---|---|
| AGENTS.md | 8f7ae8bad87b1db2c620d027dc0984b07ac84718 |
| governance/ai_delivery_rules.md | e542b0a0cda47667efbc3dcf2c788efb0a964e81 |
| governance/project_policy.md | e68ceea7a04eb07ad316b96b26c0eac9e2778b6e |

직접 확인한 제품 계약: `docs/production-foundation/PF01_data_authorization.md`의
권한 행렬·인증 수명주기, `phase_dependencies.json`, root `package.json`.

로컬 D01 결과는 사용자가 전달한 실행자 보고이며 작성자가 PC에서 재실행한 결과가 아니다.
최신 보고는 G03의 정리된 범위 통과, G04 Database primary 재인증 통과, 실제 계정 연결 미실행이다.
G03의 공식 취소 UI 미적용·철회 전후 ID 미검증이라는 제한도 그대로 보존한다.

실행자는 새 작업 시작 시 원격·작업 트리를 읽기 전용으로 확인한다. 기준이 바뀌었다면
diff로 원인을 확인하고, 자동 reset/rebase/merge로 기준을 맞추지 않는다.

## 3. 즉시 정리할 진행 상태

1. `D01_PROVIDER = AUTH0_SELECTED_FOR_PRODUCT_INTEGRATION`으로 결정과 검증을 분리한다.
2. `D01_LIVE_VALIDATION = PARTIAL`을 유지한다. D01 전체 VERIFIED/FROZEN을 만들지 않는다.
3. G04는 `DEFERRED_FROM_FIRST_SLICE`로 재배치한다. 기존 partial 증거를 삭제하지 않는다.
4. 이미 연결됐는지는 최신 로컬 증거만 확인한다. 연결 미실행이면 그대로 두고,
   예상과 달리 연결돼 있어도 자동 unlink·계정 삭제·동의 철회로 되돌리지 않는다.
5. 보류 중인 linking 시도는 로컬에서 실행 불가능한 만료 상태로 두고 민감 token을 로그로 보존하지 않는다.
6. 필요한 종료 처리는 이번 시험이 소유한 서버·브라우저만 대상으로 한다. 다른 터미널·서비스는 보존한다.

이 전환을 위한 이메일 비교·Kakao 재인증·계정 연결 확인창은 더 요청하지 않는다.

## 4. 첫 제품 목표 — PF02-B의 B1 작업 단위

`B1/B2`는 이 문서의 작업 분할 이름이며 기존 canonical phase ID를 대체하지 않는다.

**완료 화면:** 별도 D01 검증 페이지가 아니라 `apps/web`에서 다음 흐름이 실제로 이어진다.

> 이메일/비밀번호 로그인 → 내부 User 식별 → 내 관리조직 목록 → 선택한 조직의 건물 목록
> → 권한 없는 조직 접근 거부 → 로그아웃 또는 권한 철회 후 접근 차단

### B1 범위

- 기존 Auth0 Database 연결을 첫 본체 로그인 경로로 사용한다. 검증용 테넌트·본인 시험 계정만 쓴다.
- 검증된 issuer/subject를 `ExternalIdentity`를 통해 내부 User에 매핑한다.
- 이메일, 클라이언트가 보낸 userId/role, 공급자 role 문자열로 계정·조직 권한을 만들지 않는다.
- 최초 로그인으로 내부 User가 생기더라도 조직 관리자 권한은 생기지 않는다.
- 동일 identity의 재로그인·동시 첫 로그인에도 User와 identity 매핑이 중복되지 않는다.
- 현재 User/Organization/Membership 상태를 서버에서 확인하고 허용된 조직·건물만 반환한다.
- 소속이 없으면 접근 가능한 조직이 없는 화면을 보여 준다. 모든 가입자를 관리자 처리하지 않는다.
- 첫 구현은 읽기 흐름을 끝까지 연결한다. 조직 생성·관리자 초대·권한 변경 화면은 B2다.
- B1의 긍정 경로는 유효한 ORG_ADMIN의 자기 조직 조회로 한정한다.
  PROPERTY_STAFF의 건물별 허용은 B2의 PropertyAssignment 검사와 함께 제공하며,
  그 전에는 조직 전체 조회를 허용하지 않는다. 입주자를 직원 멤버십에 넣지 않는다.
- 로그아웃과 서버 측 세션/계정 철회 후의 신규 보호 요청 거부를 B1에서 검증한다.
- 테스트용 관리자·조직·건물 관계는 합성 fixture로 준비할 수 있지만,
  운영 코드에 사용자 이메일·특정 subject 허용 목록이나 자동 seed 경로를 넣지 않는다.
- 실제 Auth0 시험 identity를 연결하는 로컬 DB에도 내부 식별자를 개인정보로 취급한다.
  운영자 본인 시험 계정과 합성 업무 데이터만 쓰고, 실제 주소·임대인·세입자 자료를 추가하지 않는다.

### B1에서 지킬 인증 경계

- Auth0 SDK로 검증된 서버 측 세션을 사용한다. 단순 JWT decode는 검증으로 취급하지 않는다.
- 안전한 cookie, CSRF/state/nonce·redirect 제한과 SDK의 공식 흐름을 유지한다.
- UI를 숨기거나 Proxy/Middleware 하나만 검사하는 방식으로 업무 API를 보호하지 않는다.
- 페이지·Route Handler·Server Action의 실제 데이터 접근 경계에서도 현재 권한을 확인한다.
- 업무 데이터와 사용자별 응답이 공유 cache를 통해 다른 사용자에게 전달되지 않게 한다.
- 세션이 있어도 User 또는 조직/멤버십이 비활성이면 업무 접근을 거부한다.
- 보호된 업무 요청의 org_id는 검증된 actor의 현재 관계를 확인한 다음 DB context로 설정한다.
- 같은 이메일의 Database/Kakao identity는 자동 연결하지 않는다. 첫 slice에는 연결 UI·endpoint를 노출하지 않는다.

### 첫 구현에서 설계해야 할 DB 접근 경계

PF02-A의 일반 runtime 권한은 신원 bootstrap·조직 검색의 완성된 계약이 아니다.
ExternalIdentity 조회/생성, 현재 actor의 조직 목록 조회, 세션 철회 저장의 경로를 좁게 설계해야 한다.

- 필요한 신규 migration·제한된 권한만 제안하고 기존 migration을 소급 수정하지 않는다.
- 일반 runtime을 owner/superuser/BYPASSRLS로 바꾸거나 RLS를 끄지 않는다.
- 로그인 전후 신원 조회 때문에 전체 조직 테이블의 무제한 열람 권한을 주지 않는다.
- 제한 함수/별도 port 등 어떤 방법을 선택했는지와 그 호출 권한을 구현계획에 명시한다.
- 세션·identity·membership 변경에 따른 철회 시점과 동시 요청의 처리 기준을 함께 명시한다.

## 5. 이후 개발 순서

| 순서 | 사용자가 얻는 기능 | 해당 단계에서 검증할 핵심 |
|---|---|---|
| B1 | 실제 로그인, 내 조직·건물 조회 | identity 중복 방지, 세션, 현재 관계 기반 허용/거부 |
| B2 | 관리조직·건물·호실 관리와 직원 담당 범위 | 조직 활성 상태, 담당 건물 제한, last-admin 보호, 변경·철회 경합 |
| PF02-C/D | 입주자 초대·참여, 본인 신고·관리자 응답 | 초대의 일회성/수신 대상 결합, 퇴거 후 차단, 신고자/내부메시지 범위 |
| Mobile 연결 | 같은 서버 계약을 Web와 앱에서 사용 | PKCE·안전한 토큰 저장·딥링크·기기별 로그아웃 및 철회 |
| 실제 데이터 파일럿 전 | 제한된 실제 사용자에게 서비스 제공 | 관리자 추가 인증, 복구, 메일, 개인정보, 관리권 확인, 백업·배포·장애 대응 |

Mobile과 실제 데이터 파일럿을 시작하기 전에 필요한 별도 계정·유료 기능·외부 권한은
이번 순서 전환으로 자동 승인되지 않는다. 전체 PF02 및 출시 완료도 아직 아니다.

## 6. D01 미검증 항목을 어디로 옮기는가

| 기존 gate | 처리 |
|---|---|
| G01 플랜·권한 | 사용할 기능별로 구현 전 실제 지원 여부 확인. 결제/권한 필요 시 그 기능만 보류 |
| G02 Web·Mobile | 기존 Web PoC 증거 재사용. 본체 Web는 B1에서, Mobile은 실제 앱 연결 단계에서 새로 검증 |
| G03 Kakao | 현재 증거·한계 보존. 본체에서 Kakao를 켤 때 callback·내부 User 매핑만 추가 검증 |
| G04 계정 연결 | 첫 제품 slice에서 기능을 제공하지 않는다. 명시적 연결 기능을 도입할 때 재개하며 미실행은 PASS로 바꾸지 않는다 |
| G05 관리자 MFA | 구현 시 설계·검증. 실제 관리 기능을 실사용자/실자료에 노출하기 전 필수 통과 |
| G06 복구·철회 | 기본 세션/권한 철회는 B1부터 필수. 공급자 복구 통지·다중 기기·Mobile은 해당 구현과 함께 검증하고 실자료 전에 완료 |
| G07 Apple/iOS·삭제 | iOS 로그인 배포 전 정책·실기기 검증. 계정 삭제는 관련 개인정보/관계 수명주기와 함께 파일럿 전 준비 |
| G08 운영 조건 | 개발 중에도 최소 수집·비밀 보호는 유지. 운영 메일·위탁/보유/삭제·지원복구·이전은 파일럿 전 검증 |

검증 시점을 옮기는 것이지 보안 조건을 없애는 것이 아니다.
권한 없는 접근 허용, 계정 혼동, 비밀 노출 같은 결함은 어느 단계에서도 다음 단계로 넘기지 않는다.

## 7. B1의 필수 인수조건

| 시험 | 기대 결과 |
|---|---|
| 실제 본체 로그인 전/후 | 보호 API 401 → 적법한 요청 200; 실제 Auth0 실행 증거는 테스트 adapter와 분리 |
| 같은 identity 재로그인·동시 최초 로그인 | 동일 내부 User, 단일 issuer/subject 매핑 |
| 잘못된 issuer/audience/만료·재사용 callback | 인증 실패; User·권한 부여 없음 |
| 가입했지만 조직 관계 없음 | 빈 조직 목록; 조직 업무 접근 불가 |
| 합성 조직 A 사용자로 A 조회 | 허용된 목록·상세만 반환 |
| 같은 사용자로 B의 알려진 자원 요청 | 일반화한 거부/미존재 응답; B 데이터 미노출 |
| role/userId/orgId 조작·직접 API 호출 | 권한 추가 없음; 서버 검사 유지 |
| User·Organization·Membership 정지/종료 commit 뒤 요청 | 기존 화면·cookie여도 거부; cache로 허용되지 않음 |
| logout 뒤 기존 세션 재사용 | 서버의 정의된 철회 범위에서 거부; 브라우저 cookie 삭제만으로 PASS 금지 |
| 관계 변경 전후 DB context 재사용 | 교차조직 누수 없음; 기존 PF02-A 회귀 유지 |
| 설정 누락 또는 Auth0/DB 사용 불가 | production 경로 실패/기동 거부; demo/SQLite/test identity fallback 금지 |

현재 `acceptance_cases.json`의 각 F-case는 원문 전체를 실제로 수행했을 때만 승격한다.
이 새 체크리스트의 부분 통과를 기존 canonical case 전체 PASS로 대체하지 않는다.

## 8. 다음 Codex 작업과 수정 범위

**다음 작업은 별도 로그인 실험이 아니라 B1을 본체에서 구현하기 위한 코드 기준 계획 확정이다.**

1. 최신 로컬 D01 checkpoint와 외부 계정 연결 상태를 필요한 부분만 확인하고 PoC를 보류한다.
2. 본 문서를 B1 범위명세로 삼고 `apps/web`, `packages/application`,
   `packages/api-contracts`, `packages/persistence-postgres`의 관련 경로·signature·설정만 조회한다.
3. 신원 mapping, 세션/철회, 조직 조회, RLS bootstrap 경계를 포함한 **하나의 B1 구현계획**을 만든다.
   실제 파일·함수·migration·시험 위치·외부 설정 delta를 고정하며 새로운 전용 PoC 앱을 만들지 않는다.
4. 공식 SDK 문서·설치 후보의 실제 API를 확인한다. D01에 사용됐다고 보고된 SDK 버전을
   제품의 설치·호환성 검증 결과로 소급 인정하지 않는다. exact 버전은 구현계획에 고정한다.
5. 기존 승인과 다른 보안/비용/데이터 결정을 발견하면 한 번에 묶어 보고한다.
   파일명·변수명·일반 구현 순서를 사용자에게 다시 묻지 않는다.
6. 본체 인증은 신규 subsystem이므로 작성된 구현계획 검토 전 제품 코딩을 시작하지 않는다.
   검토 후의 실행 목표는 B1의 실제 Web 흐름·DB 결과·회귀시험을 포함한 하나의 구현 후보다.

이번 전달문이 허용하는 즉시 작업: 읽기 전용 코드 확인, 기존 PoC 안전 정지, 비공개 로컬 B1 계획·로그 작성.
제품 코드 변경·dependency 설치·GitHub push/PR/merge는 **해당 구현계획의 실행 범위에서** 확정한다.
기존 PoC의 외부 계정/연결 생성 승인을 제품 배포·관리 권한 확대 승인으로 해석하지 않는다.

## 9. 검증·토큰·사용자 조작 원칙

- 전체 정책/spec/과거 transcript 재출력 금지. 읽은 본문과 blob이 같으면 재사용한다.
- 로컬 소스는 rg/AST/signature → 필요한 함수 본문 순서. 코드 전달은 unified diff 또는 정확한 SEARCH/REPLACE.
- D01 기존 PASS는 재사용하되 본체에 새로 연결한 경로의 시험은 별도로 수행한다.
- 자동 회귀에서 매번 사람에게 로그인시키지 않는다. 시험 adapter는 test-only 조립에만 두고 production 우회 경로를 검사한다.
- 실제 Auth0 로그인은 본체 흐름이 준비된 뒤 필요한 묶음에서만 사용자에게 요청한다.
- 이미 알려진 email·설정값을 다시 채팅에 요구하지 않는다. 기존 비공개 설정을 안전하게 참조하고 원문 .env/로그를 repo에 복사하지 않는다.
- 진짜 권한·동의·계정 소유 확인을 mock으로 대체해 실연동 PASS로 부르지 않는다.
- 기존 9개 프로젝트 검사 gate를 약화하지 않는다. B1에 필요한 신규 시험이 발견·실행되는지 구현계획에서 연결한다.
- 경로 변경 없는 문서 정리를 위한 별도 승인/merge/freeze PR 연쇄를 계획하지 않는다.
  구현 검토·main 검증과 현재 상태 갱신을 정해진 인수 흐름으로 묶고, 새로 열린 PR 자체를 또 freeze해야 하는 순환을 만들지 않는다.
- 한 작업이 끝날 때 보고: 실제 본체에서 새로 되는 동작 / 실행한 시험 / 미검증·차단 조건 / 다음 결과물.
- 로컬 미커밋 증거 보존. Google 동기화는 실제 쓰기/재조회 없으면 PENDING. 토큰 수치 미측정 시 unknown.

## 10. 출처와 현재 한계

프로젝트 근거는 위 TARGET_REF의 PF01 권한 행렬·인증 계약, phase_dependencies,
root manifest 및 이 대화의 사용자가 전달한 D01 실행 보고다. 후자는 독립 PC 검증이 아니다.
본 문서의 단계 재배치는 이번 사용자 요청에 따른 새 결정이며, 과거 문서가 원래부터
D01 전체 gate를 면제했다고 주장하지 않는다.

외부 1차 자료 — 2026-09-21 조회:
- Auth0 Next.js v4 통합: https://auth0.com/docs/quickstart/webapp/nextjs
- 계정 연결/identity 분리: https://auth0.com/docs/manage-users/user-accounts/user-account-linking
- 서버 권한 검증: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

최종 실행 보고는 D01 전체 PASS나 출시 완료가 아니라, 각각 실제 수행한 단계 상태로 작성한다.