# 앱이 방문 일정을 휴대폰 캘린더에 넣는 방식 참고 연구 (C1 앱)

- 작성: 2026-10-16 (Asia/Seoul). 작성자: Claude Opus 5.5 (Claude Code, 연구 세션 2-56, 예전 2-85, AI 작성). 사람 검토: `NOT_RUN`.
- 상태: 연구 노트. 여기의 제안은 구현 권한이 아니다. 반영은 운영자가 정한다([RES-01](../RESEARCH_RULES.md#res-01-시작-전), [RES-09](../RESEARCH_RULES.md#res-09-반영공개)).
- 기준: `POLICY_REF` = `main` `446ee50`(이 세션에서 읽음. `32f8e15`까지 바뀐 규칙은 디자인 규칙의 소개 페이지 부분뿐). `TARGET_REF` = `main` `32f8e15`. 따른 규칙: [연구 규칙](../RESEARCH_RULES.md) 1.0.0, [레퍼런스 규칙](../../references/REFERENCE_RULES.md) 1.1.0.
- 앞선 연구: [연동 기능 연구](2026-10-15-integrations-export-calendar-ai.md)(.ics 파일, 구독 주소, Google 캘린더 API, CLM-155·CLM-162·CLM-166). 이번에는 겹치지 않게 앱 쪽(휴대폰 캘린더 동기화, iOS 권한, 앱 로그인, 백그라운드, 설치)만 봤다.
- 주장 `CLM-250`–`CLM-270`, 출처 `SRC-260`–`SRC-280`을 [출처 레지스트리](../sources/source_registry.csv)와 [주장 레지스트리](../sources/claim_registry.csv)에 등록했다. 번호는 다른 세션의 예약 범위(`SRC-230`–`SRC-259`, `CLM-220`–`CLM-249`) 다음에서 시작했고, 시작 전에 다른 세션에 알렸다.

## 요약

- [FACT] 애플은 이벤트를 넣기만 하는 앱에 가장 적은 권한을 권한다. iOS 17부터 시스템 일정 추가 화면(EventKitUI)은 앱과 다른 프로세스에서 돌아 캘린더 권한이 필요 없다. 사용자 손 없이 넣기만 하려면 쓰기 전용으로 충분하다. 전체 접근은 "기존 일정을 보여 주거나, 고치거나, 지우는 것"이 핵심 기능일 때만 청한다(CLM-250, CLM-251).
- [FACT] 쓰기 전용 앱은 자기가 만든 일정도 읽지 못한다. 그래서 바뀐 방문을 고치거나 취소된 방문을 지우려면 전체 접근이 필요하다(CLM-252). 운영자가 고른 "자동 추가(바뀌면 고치고 지움)"는 애플이 말하는 전체 접근 사례에 해당한다.
- [FACT] 애플 사람 인터페이스 지침: 권한은 그 기능을 실제로 쓸 때 묻고, 시스템 창 앞에 보여 주는 화면에는 버튼 하나("계속" 같은 이름)만 두며 "허용" 같은 말이나 취소 버튼을 두지 않는다(CLM-253). 시안의 "나중에" 버튼과 "캘린더에 자동으로 넣기"라는 버튼 이름은 이 지침과 맞지 않는다.
- [FACT] React Native 공식 문서는 쿠키 기반 로그인이 불안정하고, iOS에서 302 리다이렉트에 붙은 쿠키가 제대로 저장되지 않는다고 적는다(CLM-255). 우리 데모 입장은 303 리다이렉트와 함께 쿠키를 주고, 서버는 B1 요청에 토큰(Authorization)을 받지 않는다(CLM-256). Expo 안내서는 앱이 세션을 토큰으로 갖고 `expo-secure-store`에 두는 구조를 권한다(CLM-258).
- [HYPOTHESIS] 그래서 설계서의 "서버 변경 없이 웹 데모 입장 쿠키로 들어가기"는 아이폰에서 실패할 가능성이 높다(CLM-257). 앱용 입장(토큰)을 서버에 더하는 것이 표준에 맞다. 다만 이것은 서버 인증 변경이라 고위험이다.
- [FACT] 실제 서비스 사례:
  - 교대근무 앱 Planday·SocialSchedules는 앱 안의 켜기 스위치로 휴대폰 캘린더에 근무 일정을 넣는다(Planday는 구독 캘린더, SocialSchedules는 전체 접근을 청함). 두 곳 모두 캘린더 갱신이 즉시가 아니니 최신 일정은 앱에서 보라고 한다(CLM-263, CLM-264).
  - Google 캘린더는 Gmail의 예약 메일로 일정을 저절로 넣고, 나중 메일로 바뀌면 일정도 고치며, 기본으로 본인만 보이고, 끌 수 있다(CLM-265).
  - 오픈소스 앱 skriuw(MIT)는 앱 전용 캘린더를 기본 캘린더와 같은 계정에 만들고, 순수 동기화 함수와 얇은 어댑터로 나누며, 저장한 대응표와 일정 메모 안 표시로 앱이 만든 일정만 고치고 지운다(CLM-267).
- [FACT] 설치: 무료 Apple 계정은 기기 3대, App ID 10개, 7일 만료이고 기기당 앱 3개까지다. AltStore로 넣은 앱은 7일 뒤 열리지 않으며 백그라운드 새로 고침으로 연장한다(CLM-261). 백그라운드 작업은 최소 15분, 시점은 iOS가 정하고, 사용자가 앱을 완전히 끄면 멈춘다(CLM-259).

## 1. 연구 질문과 도울 결정

- 질문: 실제 앱과 플랫폼 지침은 "확정된 방문(예약)을 휴대폰 캘린더에 넣고 바뀌면 맞추는 앱"을 어떤 구성(화면·권한·로그인·동기화 구조·시점·설치)으로 만드는가? 그중 build-manager C1 앱에 무엇을 가져올 것인가?
- 도울 결정: C1 앱 설계(브랜치 `feat/app-visit-calendar`의 `docs/superpowers/specs/2026-10-16-app-visit-calendar-design.md`, 이 노트를 쓸 때 main에 없음)를 고칠지. 운영자 지시(2026-10-16): "이 앱의 구성 방식이나 구동방식 등등 모든 요소들을 래퍼런스들을 연구 분석해서 적용하는 방법으로 하자"(SRC-280).

## 2. 방법, 포함·제외 기준

- 2026-10-16에 웹 검색으로 후보를 찾고 원문 페이지를 직접 열어 읽었다. 화면이 스크립트로 그려지는 애플 문서는 같은 문서의 JSON판을 읽었다. 검색 결과 요약은 출처로 쓰지 않았다([REF-10](../../references/REFERENCE_RULES.md#ref-10-ai-생성물)).
- 포함: 플랫폼 1차 문서(애플 개발 문서·WWDC·사람 인터페이스 지침, React Native·Expo 공식 문서), 공개 도움말(교대근무 앱, Google 캘린더, Property Meld), 라이선스가 확인된 공개 소스 코드, 운영자의 다른 앱 기록, 우리 코드.
- 제외: 로그인 뒤 화면, 라이선스가 없는 코드(Habit-bloom은 읽기만 하고 쓰지 않음), 읽지 못한 페이지(HotSchedules 403, Rotageek 404, Property Meld 원문 403, OWASP MASVS 본문이 비어 있음), 검색 요약만 있는 사례(Sling, Zoho Shifts, Axial Shift 등).
- 국내 사례: 네이버 예약→네이버 캘린더, 카카오 예약→톡캘린더 자동 등록을 검색했으나 공개 근거를 찾지 못해 UNKNOWN으로 둔다. 원문을 열어 확인한 국내 출처가 없어 주장으로 등록하지 않았다.

## 3. 출처와 관찰

| 출처 | 무엇 | 관찰(원문 위치) | 주장 |
| --- | --- | --- | --- |
| SRC-260 | WWDC23 「Discover Calendar and EventKit」 | 4:56 "In iOS 17, this UI runs in a separate process, which means you don't need to request Calendar access."; 10:59 쓰기 전용은 "add events to the calendar without user interaction" 등에만; 14:23 "Only request full access if your app has a core feature that requires displaying, updating, or removing existing events."; 마무리 "request the minimum access needed, and only when it's needed" | CLM-250, CLM-251 |
| SRC-261 | 애플 문서 「Accessing the event store」 | "write-only access ... doesn't let it read any events ..., including events your app created"; 쓰기 전용의 캘린더 목록은 가상 캘린더 하나; "Don't request full access if your app's features only need write-only access."; iOS 17은 `NSCalendarsFullAccessUsageDescription`/`NSCalendarsWriteOnlyAccessUsageDescription`이 없으면 자동 거절 | CLM-251, CLM-252 |
| SRC-262 | 애플 사람 인터페이스 지침 「Privacy」 | "Request permission only when your app clearly needs access"; "Avoid requesting permission at launch"; 설명 문장은 짧고 완전한 능동문; 시스템 창 앞 화면은 "Include only one button", "Continue"/"Next", 취소·닫기 금지, "Allow" 같은 버튼 이름 금지 | CLM-253, CLM-254 |
| SRC-263 | 애플 「Compare memberships」 | 무료 계정 개인 팀: 기기 3대 7일 만료, App ID 10개 7일 만료, 기기당 앱 3개. App Store Connect(베타 테스트·배포)는 유료 프로그램 | CLM-261 |
| SRC-264 | React Native 0.87 문서 「Networking」 | "Cookie based authentication is currently unstable"; "on iOS, when redirected through a 302, if a Set-Cookie header is present, the cookie is not set properly"; `redirect:manual`, `credentials:omit` 안 됨 | CLM-255 |
| SRC-265 | Expo 「Authentication」 안내서 | 웹은 쿠키, 앱은 JWT가 흔함; 앱의 토큰은 `expo-secure-store`에 안전하게 저장; 비밀값은 서버에 | CLM-258 |
| SRC-266 | Expo Router 「Authentication」 | 세션 Context provider, `Stack.Protected`로 보호한 `(app)` 묶음과 그 밖의 `sign-in` 화면, `useStorageState`가 앱에서 `expo-secure-store`로 토큰을 보관 | CLM-258 |
| SRC-267 | Expo SDK 57 「SecureStore」 | iOS는 키체인(`kSecClassGenericPassword`), Expo Go 포함, 같은 번들 ID로 다시 설치하면 남음 | CLM-258 |
| SRC-268 | Expo SDK 57 「BackgroundTask」 | 기본 12시간, 최소 15분, "Tasks won't run exactly on schedule", 사용자가 앱을 끄면 멈춤, Expo Go 포함 | CLM-259 |
| SRC-269 | Expo SDK 57 「Calendar」 | Expo Go 미지원, 예전 `...Async` 함수는 지원 중단이며 실행 중 오류, 새 API(`requestCalendarPermissions`, `createCalendar`, `listEvents`, `calendar.createEvent`, `event.update`, `event.delete`, `addEventWithForm`), `getCalendars`·`listEvents`는 전체 접근 필요, iOS `addEventWithForm`은 최소 쓰기 전용 필요, `url` 칸은 iOS만 | CLM-260 |
| SRC-270 | Expo 「Internal distribution builds」 | iOS 내부 배포는 애드혹 프로비저닝("works with any normal paid Apple Developer account"), 기기 UDID 등록 필요 | CLM-262 |
| SRC-271, SRC-272 | AltStore Classic 「Getting Started」, 「App IDs」 | "Apps installed with AltStore expire after 7 days"; 백그라운드 새로 고침과 "Refresh All"; "register up to 10 App IDs at a time", "each App ID expires after one week" | CLM-261 |
| SRC-273 | Planday 도움말(2025-05-20) | 앱 프로필의 "Sync with your calendar" → Subscribe → Add, iOS 캘린더의 "Subscribed Calendars"에 표시, 갱신 주기 선택(자동·1시간·30분·15분), "for immediate updates, always check the Planday app" | CLM-263 |
| SRC-274 | SocialSchedules 도움말(2026-07-03) | More Menu › Calendar Sync 스위치, "Tap 'Allow Full Access'", 끄는 법은 설정의 구독 캘린더 "My shifts from SocialSchedules" 구독 해지, "SocialSchedules does not control the frequency of sync" | CLM-264 |
| SRC-275 | Google 캘린더 도움말 「Manage your events from Gmail」 | 예약 메일의 일정이 캘린더에 들어가고 "stay up-to-date", "By default, only you can find events from Gmail", "Show events from Gmail" 체크로 끄기 | CLM-265 |
| SRC-276 | Property Meld 도움말(검색 결과로만 확인, 원문 403) | Google·Outlook 캘린더 연동을 켜면 기사 일정이 그 캘린더에 자동으로 들어간다는 설명(검색 요약). 세입자에게는 일정 확정 메일과 24시간·1시간 전 알림 | CLM-266 |
| SRC-277 | 오픈소스 skriuw(MIT) `apple-calendar.ts`, `journal-calendar-sync.ts`(커밋 `b21a741`) | 앱 전용 캘린더 "Skriuw Journal"을 기본 캘린더의 source에 만듦, 어댑터(목록·만들기·고치기·지우기)와 순수 동기화 함수, 저장한 대응표 + 메모의 "Skriuw journal entry: {id}" 표시로 중복 방지, "Only event IDs previously created by Skriuw are updated or deleted" | CLM-267 |
| SRC-278 | 운영자의 헬트(다이어트 코치) 앱 기록과 workflow `ios-unsigned-ipa.yml`(비공개 저장소) | GitHub Actions macOS에서 서명 없는 IPA, Windows AltServer로 운영자 Apple ID 설치, 2026-10-12까지 7번째 빌드 | CLM-268 |
| SRC-279 | build-manager `32f8e15` 코드 읽기 | `apps/web/src/server/core-flow/http.ts` L42–48(B1에서 Origin 없는 POST 거절), L90(Bearer는 RC1 64자 코드만), `apps/web/src/server/b1/demo-entry.ts` L27–39(Origin 확인, 303 리다이렉트 + `__session` 쿠키 1시간), `apps/mobile/src/app/core.tsx`(RC1 개발 코드 입장만) | CLM-256 |
| SRC-280 | 운영자 지시와 결정(2026-10-16) | 이 노트 1절과 8절 | CLM-269 |

## 4. 해석

- **권한**: 애플의 기준으로 보면 "바뀌면 고치고 지우는 자동 추가"는 전체 접근이 필요한 기능이다(CLM-251, CLM-252). 다만 애플은 같은 자리에서 "필요할 때만, 가장 적게"를 거듭 말한다(CLM-250, CLM-253). 그래서 앱 시작 때가 아니라 사용자가 자동 추가를 켤 때 묻고, 거절하면 권한이 필요 없는 시스템 추가 화면으로 하나씩 넣게 하는 것이 지침에 맞는 조합이다.
- **켜고 끄기**: 읽은 세 서비스(Planday, SocialSchedules, Google)는 모두 이 기능을 사용자가 켜거나 끄는 설정으로 둔다(CLM-263, CLM-264, CLM-265). 시안에는 끄는 방법이 없다.
- **로그인**: 공식 문서 두 곳(CLM-255, CLM-258)과 우리 서버 구조(CLM-256)를 합치면, 쿠키·리다이렉트에 기대는 데모 입장은 앱에서 불안정할 가능성이 높다. 표준은 토큰을 키체인에 두고 요청마다 붙이는 방식이다.
- **동기화 구조**: skriuw의 구조(앱 전용 캘린더 + 순수 계획 함수 + 얇은 어댑터 + "앱이 만든 일정만")는 설계서의 구조와 같다(CLM-267). skriuw는 대응표가 지워져도 메모 안 표시로 다시 찾는다. 설계서는 iOS `url` 칸을 쓰는데, 아이폰만 대상이므로 쓸 수 있지만 캘린더 계정(예: iCloud)에 따라 `url`이 보존되는지는 기기에서 확인해야 한다.
- **시점**: 교대근무 앱들도 캘린더 갱신이 즉시가 아니라고 안내하고 최신 일정은 앱에서 보라고 한다(CLM-263, CLM-264). 앱을 열 때 맞추는 설계는 이 관행과 같은 한계를 가진다. 백그라운드 작업은 시점 보장이 없다(CLM-259).
- **다른 길(구독 캘린더)**: Planday·SocialSchedules는 서버가 주는 구독 캘린더를 앱이 추가하는 방식이라 앱을 열지 않아도 캘린더 앱이 스스로 갱신한다(CLM-263, CLM-264). 운영자는 2026-10-15에 구독 주소를 고르지 않았고(웹 C1 설계 "고르지 않은 길"), 서버·보안 작업이 크다.

## 5. C1 앱에 대한 제안 (운영자 결정 필요)

| # | 제안 | 근거 | 바뀌는 것 |
| --- | --- | --- | --- |
| P1 | 앱 입장은 토큰 방식: 데모 입장에 앱용 응답(리다이렉트 없이 토큰)을 더하고, 서버가 그 토큰을 `Authorization`으로 받는다. 앱은 토큰을 `expo-secure-store`(키체인)에 둔다 | CLM-255, CLM-256, CLM-258 | 서버 인증 변경(고위험). 다른 길: 서버 변경 없이 쿠키로 시도하고 아이폰에서 안 되면 그때 바꾸기 |
| P2 | 권한은 자동 추가를 켤 때 묻는다. 그 앞 화면은 버튼 하나("계속"), "나중에" 없음. 끄고 싶으면 그 화면에 들어가지 않으면 된다 | CLM-253 | 시안 2번 화면 |
| P3 | "캘린더 자동 추가" 켜기·끄기 설정. 끄면 앞으로의 앱 일정을 지울지 묻는다 | CLM-263, CLM-264, CLM-265 | 시안 3번 화면, 새 설정 줄 |
| P4 | 거절했거나 끈 상태에서는 일정마다 시스템 추가 화면(`addEventWithForm`)으로 넣는다. 애플은 권한 없이 된다고 하고 Expo 문서는 최소 쓰기 전용이 필요하다고 해서, 기기에서 확인한다 | CLM-250, CLM-260 | 설계서 그대로(확인 항목 추가) |
| P5 | 동기화는 skriuw 구조를 따른다: 앱 전용 캘린더 + 순수 계획 함수 + 어댑터 + 앱이 만든 일정만. 일정 찾기는 `url` 칸과 메모의 짧은 표시("방문 번호 …") 둘로 한다 | CLM-267 | 설계서에 메모 표시 추가 |
| P6 | 앱 구조는 Expo Router 권장 방식: 세션 provider와 보호된 경로 묶음 | CLM-258 | 설계서 코드 구조 |
| P7 | 맞추는 시점은 지금처럼 앱을 열 때·새로고침. 화면에 "마지막 확인 시각"을 보이고, 백그라운드 맞추기는 알림과 함께 나중에 | CLM-259, CLM-263, CLM-264 | 설계서 그대로 |
| P8 | 설치는 헬트 방식 그대로(무료 Apple ID, 7일 새로 고침, App ID 10개 한도) | CLM-261, CLM-268 | 설계서에 한도 적기 |

## 6. 반증과 한계

- 실제 서비스 사례는 교대근무 앱 2곳과 Google 1곳만 원문으로 읽었다. 수리·임대 관리 앱(Property Meld)은 원문을 열지 못해 검색 요약만 있다(CLM-266은 TO VERIFY). 국내 앱 사례는 찾지 못했다(UNKNOWN).
- skriuw는 개인 개발 오픈소스(별 8개)이고 예전 `...Async` API를 쓴다. 구조만 참고하고 코드는 가져오지 않는다.
- CLM-257은 문서를 근거로 한 추론이다. 실제 아이폰에서 쿠키 입장이 될 수도 있다. 반증 조건: 아이폰 앱이 `POST /api/v2/session/demo` 뒤 `GET /api/v2/core/access`에서 200을 받는다.
- 애플 문서는 시점에 따라 바뀔 수 있다. 확인일은 2026-10-16이다.

## 7. 익명화·재사용 검토

- 개인정보 없음. 인용은 짧게 했고 출처를 밝혔다(REF-05). 캡처는 하지 않았다.
- 헬트 앱 기록(SRC-278)은 운영자 소유 비공개 저장소다. 저장소 이름·번들 ID·Expo 계정 이름은 이 노트에 옮기지 않았다.
- skriuw는 MIT다. 코드를 옮기지 않으므로 SPDX 표시는 필요 없다.

## 8. 운영자 지시 (2026-10-16)

- [DECISION] 운영자는 C1 앱 설계(아이폰, 헬트 방식 설치, 자동 추가, 관리자 전부)를 승인한 뒤, 구현 전에 앱의 구성·구동 방식 전부를 참고 자료로 연구해 적용하라고 지시했다(CLM-269).
- [DECISION] 운영자는 이 노트의 결과를 그림 페이지(바뀐 2·3번 화면과 로그인 비교)로 본 뒤 앱 로그인은 "A. 앱용 토큰 입장 (추천)"(다른 선택지: "B. 웹 입장(쿠키) 먼저 시도"), 나머지 제안 P2–P8은 "그림 페이지대로 반영 (추천)"(다른 선택지: "고칠 점 있음")을 골랐다(CLM-270). 설계서는 이 결정대로 따로 고친다.

## 9. 참고 기록 (REF-03)

```text
참고: WWDC23 "Discover Calendar and EventKit" — https://developer.apple.com/videos/play/wwdc2023/10052/, 확인 2026-10-16
가져온 것: 권한 단계(EventKitUI → 쓰기 전용 → 전체 접근)와 "필요할 때, 가장 적게" 원칙
일부러 가져오지 않은 것: Siri 일정 제안, 가상 회의 기능
라이선스: 해당 없음(문서)
```

```text
참고: Apple "Accessing the event store" — https://developer.apple.com/documentation/eventkit/accessing-the-event-store, 확인 2026-10-16
가져온 것: 쓰기 전용은 자기 일정도 못 읽음, iOS 17 설명 키
일부러 가져오지 않은 것: macOS·미리 알림
라이선스: 해당 없음
```

```text
참고: Apple Human Interface Guidelines "Privacy" — https://developer.apple.com/design/human-interface-guidelines/privacy, 확인 2026-10-16
가져온 것: 기능을 쓸 때 묻기, 시스템 창 앞 화면은 버튼 하나, 설명 문장 쓰는 법
일부러 가져오지 않은 것: 추적·위치 버튼 지침
라이선스: 해당 없음
```

```text
참고: React Native 0.87 "Networking" — https://reactnative.dev/docs/network, 확인 2026-10-16
가져온 것: 쿠키 기반 로그인 불안정, iOS 리다이렉트 쿠키 문제
일부러 가져오지 않은 것: 없음
라이선스: 해당 없음
```

```text
참고: Expo "Authentication", Expo Router "Authentication", SDK 57 SecureStore·BackgroundTask·Calendar, "Internal distribution builds" — https://docs.expo.dev/, 확인 2026-10-16
가져온 것: 앱 세션은 토큰을 secure-store에, 세션 provider와 보호된 경로, 백그라운드 작업의 한계, 캘린더 새 API와 권한 조건, 내부 배포의 계정 조건
일부러 가져오지 않은 것: OAuth·AuthSession(데모 입장에는 쓰지 않음)
라이선스: 해당 없음
```

```text
참고: AltStore Classic FAQ "Getting Started", "App IDs" — https://faq.altstore.io/, 확인 2026-10-16; Apple "Compare memberships" — https://developer.apple.com/support/compare-memberships/, 확인 2026-10-16
가져온 것: 무료 계정의 7일 만료와 App ID·기기 한도, 새로 고침 방법
일부러 가져오지 않은 것: AltStore PAL(유럽 전용)
라이선스: 해당 없음
```

```text
참고: Planday 도움말, SocialSchedules 도움말, Google 캘린더 도움말 "Manage your events from Gmail" — 3절 표의 URL, 확인 2026-10-16
가져온 것: 켜기·끄기 설정, 앱이 최신 일정의 기준이라는 안내, 자동으로 넣고 바뀌면 고치는 동작, 기본 비공개
일부러 가져오지 않은 것: 화면 배치·문구·아이콘(운영자가 고른 참고 사이트가 아님, REF-04)
라이선스: 해당 없음
```

```text
참고: skriuw — https://github.com/remcostoeten/skriuw (v1-final/apps/mobile/src/calendar, 커밋 b21a741), 확인 2026-10-16
가져온 것: 앱 전용 캘린더 + 순수 동기화 함수 + 어댑터 구조, 앱이 만든 일정만 고치는 원칙, 메모 안 표시로 다시 찾기
일부러 가져오지 않은 것: 코드 자체, 예전 ...Async API, AsyncStorage 대응표
라이선스: MIT(코드를 옮기지 않음)
```

## 10. 결론과 다음 검증 행동

- 설계서의 동기화 구조(앱 전용 캘린더, 순수 계획 함수, 앱이 만든 일정만)는 참고 사례와 같다. 바꿔야 할 곳은 셋이다: 앱 입장 방식(P1), 권한 묻는 화면(P2), 켜기·끄기(P3).
- 다음 행동
  1. 운영자가 P1–P8을 정했다(2026-10-16, 8절): P1은 A(앱용 토큰 입장), P2–P8은 제안대로.
  2. 정한 대로 설계서와 시안 페이지를 고치고 다시 승인받는다.
  3. 기기 확인 항목에 넣는다: 입장 방식(CLM-257), `addEventWithForm`의 권한 조건(CLM-260), `url` 칸 보존.
  4. Property Meld 원문(CLM-266)과 국내 사례(UNKNOWN)는 다시 찾을 때 확인한다.

## 11. 자체 점검

- [x] 연구 질문과 도울 결정을 적었다(1절).
- [x] 모든 주장에 라벨과 출처 ID가 있다. 원문을 못 연 것은 TO VERIFY, 못 찾은 것은 UNKNOWN으로 적었다.
- [x] 2차 자료(검색 요약)는 출처로 쓰지 않았고, Property Meld는 2차라고 표시했다.
- [x] 반증과 한계를 적었다(6절).
- [x] 개인정보·재사용 검토를 마쳤다(7절). 캡처 없음.
- [x] AI 작성과 사람 검토 `NOT_RUN`을 표시했다.
- [x] `python scripts/verify_repository.py`는 커밋 전에 실행한다(PR에 결과).

## 12. 전달 기록 ([AI 작성·전달 사전 규칙](../../governance/ai_delivery_rules.md) R09)

```text
POLICY_REF: main 446ee50 (32f8e15까지 연구·레퍼런스 규칙 변경 없음)
TARGET_REF: edward321416-maker/build-manager docs/app-calendar-research (main 32f8e15에서 시작)
DECISIONS: 운영자 2026-10-16 지시와 결정(8절, CLM-269·CLM-270)
SCOPE: 허용 — 이 노트, 출처·주장 레지스트리 행, 연구 색인 / 금지 — 제품 코드·설계서 변경(운영자 결정 뒤 따로)
CHECKS: verify_repository.py(커밋 전)
STATUS: READY_TO_SEND
ARTIFACT: research/ux/2026-10-16-app-calendar-sync-references.md
```
