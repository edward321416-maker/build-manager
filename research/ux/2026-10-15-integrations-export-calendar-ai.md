# 연동 기능 연구: 엑셀 내보내기, 일정 연결, Google 드라이브, AI 연결(MCP)

- 작성: 2026-10-15 (Asia/Seoul). 작성자: Claude Opus 5.5 (Claude Code, AI 작성). 사람 검토: `NOT_RUN`.
- 상태: 연구 노트. 구현 권한이 아니며, 제품 반영은 운영자 결정이 필요하다([RES-01](../RESEARCH_RULES.md#res-01-시작-전), [RES-09](../RESEARCH_RULES.md#res-09-반영공개)).
- 기준: `POLICY_REF` = `main` `1d88457`. `TARGET_REF` = `main` `1d88457`의 코드(읽기만 함). 따른 규칙: [연구 규칙](../RESEARCH_RULES.md) 1.0.0, [레퍼런스 규칙](../../references/REFERENCE_RULES.md) 1.1.0, [AI 작성·전달 사전 규칙](../../governance/ai_delivery_rules.md) 1.0.0. 위험 등급은 [개발 규칙](../../development/DEVELOPMENT_RULES.md) DEV-01을 인용만 했다.
- 앞선 연구: [역할별 기기 나누기 점검](2026-10-15-platform-roles-reference.md), [집 관리 범위·건물주 보고](2026-10-10-home-management-scope-owner-reporting.md)(건물주 월간 보고 O1 결정), [IA 사전 연구](2026-10-10-ia-feature-audit-reference.md)(관리자 습관 가설에 "엑셀·메모").
- 주장 `CLM-152`–`CLM-164`, 출처 `SRC-168`–`SRC-177`을 [출처 레지스트리](../sources/source_registry.csv)와 [주장 레지스트리](../sources/claim_registry.csv)에 등록했다. `SRC-153`(AppFolio 앱 설명)은 다시 인용했다.

## 요약

- [FACT] 운영자 요청(2026-10-15, 결정 전): "AI의 MCP처럼" Google 드라이브 연결, 엑셀 정리, 일정 관리 같은 기능을 연구해 추가하면 좋겠다(SRC-176, CLM-152).
- [FACT, 코드 읽기] 지금 우리 제품에는 엑셀·CSV 내보내기, 일정 파일, 외부 서비스 연결이 하나도 없다. 업체 방문 일정은 있다. 세입자가 고른 방문 시간이 확정된다(CLM-161).
- [FACT] 국내 홈버튼은 입금내역(세무 신고용 포함)과 임차인 목록을 엑셀로 내려받게 한다. Buildium은 보고서의 열을 골라 xls·csv·pdf로 내려받게 한다(CLM-153, CLM-154).
- [FACT] 일정 파일의 표준은 iCalendar(RFC 5545)다. Google 캘린더는 공개된 캘린더 주소를 추가할 수 있지만, 컴퓨터 웹브라우저에서만 된다(CLM-155, CLM-156).
- [FACT] Google 드라이브 연결은 앱이 만들거나 사용자가 앱으로 열거나 앱과 공유한 파일만 다루는 `drive.file` 권한이면 기본 검수만 받는다. 드라이브 전체를 보는 권한은 제한 권한이라, 그 데이터를 서버에 저장하거나 전송하면 보안 평가가 필요하다(CLM-157).
- [FACT] MCP는 AI 앱이 외부 데이터와 도구에 연결되는 공개 규약이다(최신 명세 2026-07-28). 사용자 동의·데이터 보호·도구 안전을 핵심 원칙으로 두지만, 명세 스스로 "MCP itself cannot enforce these security principles at the protocol level"이라고 적는다. 지키는 책임은 만드는 쪽에 있다(CLM-159).
- [FACT] 개인정보 보호 고시는 개인정보 다운로드 상황을 확인·점검하는 주기·방법·사후조치를 내부 관리계획으로 정하게 한다(CLM-160).
- [HYPOTHESIS] 권하는 순서: ① 엑셀 내보내기(업무함·정비 이력·월간 보고) → ② 확정된 방문 일정을 캘린더 파일로 → ③ 엑셀로 호실·세입자 한꺼번에 등록(건물 정보 2단계와 함께) → ④ Google 계정 연결(드라이브·캘린더)은 실제 로그인 뒤 → ⑤ AI 연결(MCP)은 마지막. 앞의 둘은 외부 계정 연결 없이 만들 수 있다(CLM-162).

## 1. 연구 질문과 도울 결정

- 질문 1: 비슷한 서비스는 엑셀 내보내기·가져오기, 일정 연결, 클라우드 저장소, 외부 연동(API·마켓), AI 연결을 어떻게 제공하는가?
- 질문 2: 각 기능을 우리 제품에 넣으려면 무엇이 필요하고, 어떤 위험(개인정보, 외부 계정, 검수)이 있는가?
- 질문 3: 무엇부터 하는 것이 좋은가?
- 도울 결정: 연동 기능의 범위와 순서(8절). "MCP처럼"이 무엇을 뜻하는지도 확인한다(8절 Q1).

## 2. 방법, 포함·제외 기준

- 방법: 공식 서비스 도움말·소개 페이지, 표준 문서(IETF RFC), 플랫폼 공식 문서(Google, MCP), 법령 원문(국가법령정보센터)을 2026-10-15에 직접 열어 읽었다. 우리 쪽은 `main` `1d88457`의 코드를 읽었다(`NOT_RUN`).
- 포함: 임대 관리 서비스의 내보내기·일정·연동 기능 설명, 연동을 만들 때 지켜야 하는 규칙.
- 제외: 검색 요약과 리뷰 모음(출처 아님, [REF-10](../../references/REFERENCE_RULES.md#ref-10-ai-생성물)), 로그인 뒤 화면, 유료 자료. Property Meld의 캘린더 연동 도움말과 ShowMojo의 캘린더 도움말은 접속이 막혀(403, 402) 읽지 못했으므로 쓰지 않았다(UNKNOWN). 가격 정보는 쓰지 않았다.

## 3. 운영자 요청

- "AI MCP처럼 구글 드라이브 연결한다거나 엑셀로 정리해 준다거나 일정 관리해 준다거나 이런 기능들도 연구 분석해서 추가해 주면 좋을 것 같다"(2026-10-15, SRC-176).
- "MCP처럼"은 두 가지로 읽힌다. ① 우리 앱이 다른 서비스(드라이브·엑셀·캘린더)와 이어지는 것. ② AI 비서(Claude 같은)가 우리 앱의 데이터와 기능을 쓰게 하는 것(우리 앱을 MCP 서버로 여는 것). 이 노트는 둘 다 보고, 어느 뜻인지는 운영자에게 묻는다(8절 Q1).

## 4. 지금 상태 (`main` `1d88457`, 읽기만 함, SRC-177, CLM-161)

| 기능 | 지금 | 위치·근거 |
| --- | --- | --- |
| 엑셀·CSV 내보내기 | 없음. 파일을 내려주는 곳은 사진 보기뿐이다. | `apps/web/src/server/core-flow/photos.ts` |
| 엑셀 가져오기(일괄 등록) | 없음. 건물·호실 등록(`/workspace`)과 입주 초대(`/core`)는 화면에서 하나씩 만든다. | `apps/web/src/app/workspace/organizations`, `apps/web/src/app/core/onboarding-panel.tsx` |
| 방문 일정 | 있음. 세입자가 가능한 시간을 최대 5개 내고, 업체가 시간을 제안하고, 세입자가 하나를 확정한다. | `packages/api-contracts/src/vendor-handoff.ts` 72–84행, 179–187행 |
| 일정 파일·캘린더 연결 | 없음 | 코드 검색 |
| 외부 계정 연결(Google 등) | 없음. Google 연동 의존성은 없다. 웹에는 Auth0 로그인 코드가 있지만(아이디·비밀번호 방식만, 계정 연결 엔드포인트는 꺼 둠) 실제 관리자 로그인은 검증 전이다(`NOT_VERIFIED`). 로그인 방식은 결정 D01 "Database-only Web identity path"로 정해져 있다. | `apps/web/package.json` 17행, `apps/web/src/server/b1/auth0.ts` 12–15행, [STATUS](../../STATUS.md) D01 행 |
| 건물주 월간 보고 | 결정만 됨(O1, 계정 없이 월 1회 요약). 화면 없음. | CLM-097 |
| AI 기능 | 없음. 제품 AI 안전 경계 문서가 있다. | [제품 AI 안전 경계](../../product/ai_safety_boundary.md) |

## 5. 레퍼런스와 규칙

모든 업체 행은 그 회사가 공개 문서에서 그렇게 설명한다는 [FACT]다. 실제 작동과 사용률은 확인하지 않았다.

### 5.1 엑셀·CSV 내보내기

| 출처 | 내용 | ID |
| --- | --- | --- |
| 홈버튼 도움말 "2-7 자료 다운로드" | "건물별 입금내역을 엑셀로 다운로드할 수 있습니다." 월별 입금 상세와 세무 신고용 현황 두 가지. 임차인 목록도 엑셀로 받는다(모든 건물의 모든 임차인). | SRC-168, CLM-153 |
| Buildium 블로그(2016-05-05) | 보고서를 미리 보고 열을 골라 정렬한 뒤 xls·csv·pdf로 내려받는다. 열 설정을 기억한다. 오래된 글이라 지금 메뉴와 다를 수 있다. | SRC-169, CLM-154 |

### 5.2 일정 연결

| 출처 | 내용 | ID |
| --- | --- | --- |
| IETF RFC 5545 (2009-09, 제안 표준) | "iCalendar data format for representing and exchanging calendaring and scheduling information". 일정 파일(.ics)의 표준이다. | SRC-170, CLM-155 |
| Google 캘린더 도움말 | 다른 캘린더를 주소(URL)로 추가할 수 있다. "컴퓨터 웹브라우저를 사용해야" 하고, Android·iPhone·iPad 앱에서는 구독할 수 없다. 주소로 추가하려면 그 캘린더가 공개돼 있어야 한다. | SRC-171, CLM-156 |

- 해석: 방문 하나를 표준 일정 파일(.ics)로 내려주면 사용자가 그 파일을 자기 캘린더 앱에 추가하는 방식이 된다. 기기·앱마다 여는 방식이 다를 수 있어 만들 때 확인해야 한다(UNKNOWN). 계속 갱신되는 구독 주소는 컴퓨터에서만 추가되고 주소가 곧 열쇠가 되므로 노출 위험이 있다. 양방향 연결은 각 캘린더 회사의 API와 계정 연결이 필요하다.

### 5.3 Google 드라이브 연결

| 출처 | 내용 | ID |
| --- | --- | --- |
| Google for Developers "Choose Google Drive API scopes"(2026-09-03 갱신) | 권장 권한 `drive.file`은 사용자가 앱으로 열거나 앱과 공유한 파일만 다룬다. 비민감 권한이라 "basic OAuth App Verification"만 받는다. 드라이브 전체를 보는 `drive`, `drive.readonly` 등은 제한 권한이다. "If you store restricted scope data on servers (or transmit), then you must go through a security assessment." | SRC-172, CLM-157 |

- 해석: 우리가 만든 엑셀 파일을 사용자의 드라이브에 "저장만" 하는 기능은 `drive.file`로 된다. 그래도 Google 로그인(계정 연결), 앱 검수, 연결 정보(토큰) 보관이 필요하다. 사용자가 내려받은 엑셀을 직접 드라이브에 올리는 것과 비교해 이득이 크지 않다.

### 5.4 외부 연동 마켓·API

| 출처 | 내용 | ID |
| --- | --- | --- |
| Buildium Marketplace | "an ever-expanding ecosystem of property management apps you can add to Buildium with just a few clicks", 쓰는 연동만 돈을 낸다. "Buildium's Open API allows you to sync your data from Buildium with other software." | SRC-173, CLM-158 |

### 5.5 AI 연결(MCP)

| 출처 | 내용 | ID |
| --- | --- | --- |
| MCP 명세 2026-07-28(확인 당시 최신) | "an open protocol that enables seamless integration between LLM applications and external data sources and tools". 역할은 Hosts(AI 앱), Clients(연결 부품), Servers(데이터·도구 제공). 서버는 Resources·Prompts·Tools를 준다. 핵심 원칙: 사용자 동의와 통제("Users must explicitly consent to and understand all data access and operations"), 데이터 보호(사용자 동의 없이 데이터를 서버에 노출하지 않음), 도구 안전(도구는 임의 코드 실행이므로 실행 전 동의). 단, "MCP itself cannot enforce these security principles at the protocol level". | SRC-174, CLM-159 |
| AppFolio Property Manager 앱 설명 | 관리자 앱에서 AI 에이전트 "Realm-X Performers"로 임대·수리·회계·소통 일을 한다고 설명한다. | SRC-153, CLM-164 |

### 5.6 개인정보 규칙

| 출처 | 내용 | ID |
| --- | --- | --- |
| 개인정보의 안전성 확보조치 기준 제8조(개인정보보호위원회고시 제2026-9호, 2026-07-01 시행) | 제2항: 개인정보처리자는 오·남용과 유출 등에 대응하기 위해 "접속기록 및 개인정보 다운로드 상황을 확인하고 점검하는" 주기·방법·사후조치 절차를 내부 관리계획으로 정하고 이행한다. 제1항: 접속기록은 1년 이상(일부는 2년 이상) 보관한다. | SRC-175, CLM-160 |

- 해석: 세입자 연락처 같은 개인정보가 담긴 엑셀을 내려받게 하면, 실서비스에서는 누가 언제 무엇을 내려받았는지 남기고 점검할 수 있어야 한다. 지금 데모는 합성 데이터만 쓰므로 바로 문제가 되지는 않지만, 설계 때 넣어야 한다. [개발 규칙](../../development/DEVELOPMENT_RULES.md) DEV-01은 실제 개인정보 처리를 고위험으로 둔다.

## 6. 후보 비교

아래 판단은 4·5절의 사실을 바탕으로 한 [HYPOTHESIS]다. 위험 등급은 DEV-01 표를 그대로 대 본 것이다.

| ID | 후보 | 쓰는 사람 | 좋은 점 | 필요한 것 | 위험 | 외부 계정 |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | 엑셀(xlsx 또는 csv) 내보내기: 업무함 목록, 호실 정비 이력, 건물주 월간 보고 | 관리자 | 이미 엑셀을 쓰는 습관과 맞는다(CLM-163). 건물주 보고(O1)에 쓴다. 다만 우리 제품에는 납부·비용 기록이 없어서 비용 기록이 생기기 전까지 보고서는 건수만 담는다(CLM-131). 홈버튼의 세무 자료 같은 쓰임은 아직 없다. | 내보낼 열 정하기, 개인정보 열 빼거나 가리기, 다운로드 기록 | 실데이터에서는 개인정보 처리(고위험). 다운로드 기록·점검(고시 제8조) | 없음 |
| C1 | 확정된 방문 일정을 캘린더 파일(.ics)로 받기 | 세입자, 업체, 관리자 | 표준 파일이라 여러 캘린더 앱에서 열 수 있을 것으로 본다. Android·iPhone에서 실제로 추가되는지는 확인 전이다([TO VERIFY], 만들기 전에 두 기기에서 시험). 이미 있는 방문 확정 기능에 붙인다. | 파일 만들기(표준 RFC 5545), 주소·출입 정보는 넣지 않거나 줄이기 | 파일에 들어간 주소·시간이 다른 곳에 남는다. 구독 주소 방식은 주소 노출 위험 | 없음 |
| E2 | 엑셀로 호실·세입자(초대) 한꺼번에 등록 | 관리자 | 건물 하나에 호실이 많을 때 시작이 빨라진다. 건물 정보 2단계(입력 칸)와 같이 하면 좋다. | 양식 파일, 줄마다 검사와 오류 안내, 미리 보기 | 잘못된 대량 입력. 세입자 연락처는 개인정보 | 없음 |
| D1 | Google 드라이브에 저장 | 관리자 | 내려받기·올리기 한 번을 줄인다. | Google 로그인 연결, `drive.file` 검수, 토큰 보관 | 인증·외부 서비스(고위험). 실제 관리자 로그인이 검증 전이고, Google 로그인을 더하면 D01 결정(Database-only Web identity path)을 다시 열어야 한다 | 있음 |
| C2 | Google·Outlook 캘린더 양방향 연결 | 관리자, 업체 | 일정 겹침을 줄인다. | 회사별 API와 계정 연결, 토큰 보관 | 인증·외부 서비스(고위험) | 있음 |
| A1 | 우리 앱을 MCP 서버로 열어 AI 비서가 요청·일정을 읽고 처리 | 관리자 | AI 비서에게 "이번 주 방문 일정 정리해 줘" 같은 일을 시킬 수 있다. | 실제 로그인과 권한, 도구마다 동의 화면, 기록 | 개인정보가 바깥 AI로 나간다. AI가 상태를 바꾸면 사람 확인 원칙과 부딪힌다(제품 AI 안전 경계). 고위험 | 있음 |
| A2 | 앱 안에서 AI가 월간 보고 초안을 쓰기 | 관리자 | 건물주 보고 준비 시간을 줄인다. | AI 고지·표시(DEV-11), 제품 AI 안전 경계 | AI가 사용자에게 보여 주는 문구(고위험) | 없음(우리 쪽 AI 사용) |

## 7. 권하는 순서

[HYPOTHESIS] CLM-162.

1. E1 엑셀 내보내기. 외부 계정 없이 만들 수 있고, 관리자 데스크탑 웹(역할별 기기 노트의 표 보기)과 건물주 보고 O1에 바로 이어진다. 개인정보 열은 처음에는 빼거나 가린다.
2. C1 방문 일정 파일. 이미 있는 방문 확정 흐름 끝에 "캘린더에 추가" 하나를 더한다.
3. E2 엑셀 일괄 등록. 건물 정보 2단계(입력 칸)와 묶어 설계한다.
4. D1·C2 Google 연결. 실제 로그인(앱 v2·Auth0)이 생긴 뒤, 운영자가 Google 개발자 계정·검수를 정할 때.
5. A1 AI 연결(MCP). 실제 로그인, 개인정보 처리방침, AI 고지가 갖춰진 뒤. 처음에는 읽기만 하는 도구부터.

## 8. 운영자 결정 (DECISION_REQUIRED)

| ID | 질문 | 권하는 안 | 다른 안 |
| --- | --- | --- | --- |
| Q1 | "MCP처럼"은 어느 뜻인가? | ① 우리 앱이 엑셀·캘린더·드라이브와 이어지는 것부터. ② AI 비서 연결은 마지막. | ②를 먼저 |
| Q2 | 무엇부터 할까? | E1 엑셀 내보내기 → C1 일정 파일 | 다른 순서 |
| Q3 | 엑셀에 개인정보(세입자 이름·연락처)를 넣을까? | 처음에는 빼고 호실·요청·상태·날짜만. 넣는 것은 실서비스 전 다운로드 기록과 함께 | 처음부터 넣기 |
| Q4 | Google 계정 연결(D1·C2)은 언제? | 실제 로그인 뒤 별도 스펙. 그 전에는 내려받기만. Google 로그인을 더할지는 D01(Database-only Web identity path)을 다시 여는 결정이라 그때 따로 정한다 | 지금 시작 |

- 권하는 안은 아직 결정이 아니다. 결정 전에는 스펙·구현에 넣지 않는다([AI 작성·전달 사전 규칙](../../governance/ai_delivery_rules.md) R02). E1을 고르면 화면 배치는 실제 크기 시안으로 먼저 보여 준다.

## 9. 반증과 한계

- 업체 설명은 판매용 문서다. 우리 고객이 실제로 엑셀을 얼마나 쓰는지는 인터뷰 근거가 없다(IA 사전 연구의 습관 가설뿐).
- Buildium 글은 2016년 글이라 지금 화면과 다를 수 있다.
- 캘린더 연동을 실제로 제공하는 임대 관리 서비스의 공식 문서는 읽지 못했다(Property Meld·ShowMojo 접속 차단). 일정 파일 판단은 표준과 Google 문서에만 기댄다.
- Google 검수에 걸리는 기간·비용은 확인하지 않았다(UNKNOWN).
- 고시 해석은 법률 자문이 아니다. 실서비스 전에는 개인정보 처리방침과 내부 관리계획을 따로 검토해야 한다.
- 반증 조건: 관리자 인터뷰에서 엑셀을 쓰지 않거나 보고서를 받지 않는다고 나오면 E1의 우선순위는 낮아진다.

## 10. 익명화·재사용 검토

- 개인정보, 사용자 리뷰, 로그인 뒤 화면, 캡처를 쓰지 않았다.
- 인용은 짧은 구절만 따옴표로 옮겼다([REF-05](../../references/REFERENCE_RULES.md#ref-05-인용)). 법령은 조문 취지를 요약하고 핵심 구절만 인용했다.
- 가격·순위 같은 판매 문구는 쓰지 않았다.

## 11. 참고 기록 (REF-03)

```text
참고: 홈버튼 도움말 — 2-7 자료 다운로드, https://docs.channel.io/homebutton/ko/categories/2-7-%EC%9E%90%EB%A3%8C-%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C-a5eff6d6, 확인 2026-10-15
가져온 것: 입금내역·임차인 목록을 엑셀로 내려받는 기능 범위
일부러 가져오지 않은 것: 화면, 메뉴 이름, 문구
라이선스: 해당 없음

참고: Buildium — Introducing dynamic reports (2016-05-05), https://www.buildium.com/blog/introducing-dynamic-reports/, 확인 2026-10-15
가져온 것: 열 고르기·미리 보기·여러 형식 내려받기 원리
일부러 가져오지 않은 것: 화면, 문구
라이선스: 해당 없음

참고: IETF RFC 5545 iCalendar, https://datatracker.ietf.org/doc/html/rfc5545, 확인 2026-10-15
가져온 것: 일정 파일 표준
일부러 가져오지 않은 것: 없음(구현 전)
라이선스: IETF Trust (구현 시 표준을 따름)

참고: Google 캘린더 도움말 — URL로 캘린더 추가, https://support.google.com/calendar/answer/37100, 확인 2026-10-15
가져온 것: 구독은 컴퓨터 웹브라우저에서만 되고 공개 캘린더여야 한다는 제약
일부러 가져오지 않은 것: 화면, 문구
라이선스: 해당 없음

참고: Google for Developers — Choose Google Drive API scopes, https://developers.google.com/workspace/drive/api/guides/api-specific-auth, 확인 2026-10-15
가져온 것: drive.file 권한과 제한 권한·보안 평가 조건
일부러 가져오지 않은 것: 코드
라이선스: 해당 없음(원리만 참고)

참고: Buildium Marketplace, https://www.buildium.com/marketplace/, 확인 2026-10-15
가져온 것: 연동 마켓·공개 API로 다른 소프트웨어와 잇는 구성
일부러 가져오지 않은 것: 화면, 문구, 가격
라이선스: 해당 없음

참고: Model Context Protocol Specification 2026-07-28(확인 당시 latest), https://modelcontextprotocol.io/specification/2026-07-28, 확인 2026-10-15
가져온 것: 역할 구분과 사용자 동의·데이터 보호·도구 안전 원칙
일부러 가져오지 않은 것: 코드(구현 전)
라이선스: 확인 전(구현 시 REF-06·REF-07로 확인)

참고: 개인정보의 안전성 확보조치 기준 제8조(개인정보보호위원회고시 제2026-9호), https://www.law.go.kr/LSW//admRulSideInfoP.do?admRulSeq=2100000281400&chrClsCd=010201&joNo=0008&joBrNo=00&dashNo=&docCls=jo&urlMode=admRulScJoRltInfoR, 확인 2026-10-15
가져온 것: 다운로드 상황 확인·점검 의무
일부러 가져오지 않은 것: 없음
라이선스: 해당 없음(법령)
```

## 12. 결론과 다음 검증 행동

- 결론: 엑셀 내보내기는 비슷한 서비스에 있다(홈버튼, Buildium). 캘린더·드라이브 연동을 하는 임대 관리 서비스의 공식 문서는 이번에 읽지 못했다. AI는 AppFolio가 자체 AI 에이전트를 설명하지만 MCP 연결은 아니다. 외부 계정 연결이 필요한 것(드라이브, 캘린더 양방향, AI 연결)은 실제 로그인과 개인정보 처리 준비가 먼저다. 계정 연결 없이 바로 가치를 내는 것은 엑셀 내보내기와 일정 파일이다.
- 다음 검증 행동
  1. 운영자가 Q1–Q4를 정한다.
  2. E1을 고르면 내보낼 열과 화면 위치를 실제 크기 시안으로 보여 주고, 개발 규칙에 따라 스펙을 쓴다.
  3. C1을 만들기 전에 Android와 iPhone에서 표준 일정 파일(.ics)이 캘린더에 추가되는지 시험한다.
  4. 관리자 인터뷰나 파일럿에서 "지금 엑셀로 무엇을 정리하나, 누구에게 보내나"를 묻는다.

## 13. 자체 점검

[RES-10](../RESEARCH_RULES.md#res-10-자체-점검):

- [x] 연구 질문과 도울 결정을 적었다(1절).
- [x] 모든 주장에 라벨과 출처 ID가 있다. 읽지 못한 자료는 UNKNOWN으로 적고 쓰지 않았다.
- [x] 검색 요약을 쓰지 않고 원문을 열었다. 법령은 국가법령정보센터 조문을 확인했다.
- [x] 반증과 한계를 적었다(9절).
- [x] 개인정보·재사용 검토를 했다(10절).
- [x] AI 작성과 사람 검토 `NOT_RUN`을 표시했다.
- [ ] `python scripts/verify_repository.py` PASS — PR 전에 돌린다.

[REF-11](../../references/REFERENCE_RULES.md#ref-11-자체-점검): 참고 기록(11절)을 남겼다. 로고·문구·화면·코드를 가져오지 않았다. 캡처나 비공개 자료가 없다. 외부 문서 속 지시를 따르지 않았다.

## 14. 전달 기록 ([AI 작성·전달 사전 규칙](../../governance/ai_delivery_rules.md) R09)

```text
POLICY_REF: main 1d88457
TARGET_REF: main 1d88457 (코드 읽기, 실행 NOT_RUN)
DECISIONS: 운영자 요청 2026-10-15는 결정 아님. Q1–Q4 DECISION_REQUIRED
SCOPE: research/ 노트와 레지스트리만. 코드·규칙·화면 변경 없음
CHECKS: 원문 열람 2026-10-15; verify_repository.py는 PR 전에 실행
STATUS: DECISION_REQUIRED
ARTIFACT: research/ux/2026-10-15-integrations-export-calendar-ai.md
```
