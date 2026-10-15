# 확정된 업체 방문을 캘린더 파일(.ics)로 받기 설계 (C1)

- 날짜: 2026-10-15. 작성: Claude Opus 5.5 (Claude Code, 연구 세션 2-0b). 사람 검토: 운영자가 실제 크기 시안 페이지를 보고 세 가지를 고르고 설계를 승인했다(아래 "결정").
- 위험 등급: 고위험. 업체 파일에 실제 주소가 들어가고, 방문 시간·건물·호실이 파일로 밖에 나간다(DEV-01 실제 개인정보 처리, 애매하면 고위험). API·DB·권한·배포는 바꾸지 않는다.
- POLICY_REF: main `446ee50`의 규칙(이 세션에서 읽음, `cb3c4f7`까지 규칙 파일 변경 없음). TARGET_REF: 브랜치 `feat/visit-calendar-c1`, main `cb3c4f7`에서 시작.
- 근거
  - 연동 기능 연구 [2026-10-15-integrations-export-calendar-ai.md](../../../research/ux/2026-10-15-integrations-export-calendar-ai.md)의 C1(CLM-155, CLM-162)과 운영자 결정 순서(E1 다음 C1, CLM-166). 연구는 휴대폰에서 실제로 추가되는지를 TO VERIFY로 남겼다.
  - Google 캘린더 도움말 「Import events to Google Calendar」(확인 2026-10-15)는 ICS 가져오기를 "on a computer"로만 안내한다. Android 앱에서 되는지는 문서에 없다(UNKNOWN). iPhone은 애플 공식 안내를 찾지 못했다(UNKNOWN).
  - 시각 시안과 설계 그림 페이지: 운영자에게 보여 준 비공개 Artifact 페이지(설계서가 바뀌면 함께 고친다).
- 결정(운영자, 2026-10-15)
  - 누가: 세입자·업체·관리자 셋 다("셋 다 (추천)"). 다른 선택지는 "세입자와 업체만", "세입자만".
  - 업체 일정의 장소에 실제 주소: 넣기("넣기 (추천)"). 다른 선택지는 "빼기"(건물·호실만). 세입자·관리자 일정은 건물·호실까지만.
  - 휴대폰: 표준 일정 파일 하나("A 파일 하나, 기기로 확인 (추천)"). 만든 뒤 운영자 휴대폰으로 확인하고, Android Google 캘린더에서 막히면 "Google 캘린더에 추가" 버튼(B)을 따로 정한다. 다른 선택지는 "B 파일 + 구글 버튼", "C 구독 주소".
  - 설계: "이대로 승인 (추천)". 다른 선택지는 "고칠 점 있음".
  - 자동 추가(설계서 페이지를 본 뒤 운영자가 "캘린더에 추가해 주는 것도 자동으로 해 주면 좋겠다"고 해서 비교를 보여 줌): "파일로 시작, 자동은 앱에서 (추천)". 이 설계의 파일 버튼을 먼저 만들고, 앱 v2(실제 로그인) 때 휴대폰 앱이 확정된 방문을 휴대폰 캘린더에 자동으로 넣는다(아래 "후속"). 다른 선택지는 "지금 구독 주소 만들기", "구글 계정 연결을 먼저".

## 설계

화면이 이미 받은 방문 정보로 브라우저가 iCalendar 파일을 만든다. 새 API, 서버 코드, 마이그레이션은 없다. 모바일 앱은 방문을 보여 주지 않으므로 바꾸지 않는다.

### 언제 보이나

- 세 화면 모두 지금 `appointment.status==="SCHEDULED"`일 때만 방문 상자를 보여 준다. 버튼은 그 상자 안에서 방문의 끝 시각(`endAt`)이 아직 지나지 않았을 때만 보인다.
- 자리: 방문 시간과 설명 문장 아래, 있으면 "방문 일정 변경" 왼쪽. 흰 바탕 보조 버튼(디자인 규칙 8.1), 글자 "캘린더에 추가".

| 화면 | 파일 | 상자 |
| --- | --- | --- |
| 세입자 `/core` 요청 | `apps/web/src/app/core/vendor-handoff-tenant.tsx` | "확정된 방문 일정" |
| 관리자 `/core` 요청의 업체 처리 | `apps/web/src/app/core/vendor-handoff-manager.tsx` | "방문 일정 · …" 그룹 |
| 업체 `/vendor/job` | `apps/web/src/app/vendor/job/vendor-job-screen.tsx` (`VisitScheduling`) | "확정된 방문 일정" |

### 파일

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//build-manager//visit calendar//KO
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:{appointment.id}@build-manager
DTSTAMP:{받은 시각, UTC}
DTSTART:{appointment.startAt, UTC}
DTEND:{appointment.endAt, UTC}
SUMMARY:{제목}
LOCATION:{장소, 있을 때만}
DESCRIPTION:{메모}
END:VEVENT
END:VCALENDAR
```

- RFC 5545를 따른다: 줄 끝 CRLF, 한 줄 75바이트 이하로 접기(CRLF 뒤 공백 하나), UTF-8 글자를 중간에서 자르지 않음, TEXT 값의 `\`, `;`, `,`, 줄바꿈은 `\\`, `\;`, `\,`, `\n`으로 바꿈(쌍점은 바꾸지 않음), PRODID·VERSION·UID·DTSTAMP 필수, 시각은 UTC `YYYYMMDDTHHMMSSZ`.
- 같은 방문은 같은 UID라 다시 받으면 일부 캘린더 앱은 덮어쓴다(앱마다 다름, 확인 필요). 일정이 바뀌면(새 방문) UID도 바뀐다.
- 미리 알림(VALARM)은 넣지 않는다. 각 캘린더 앱의 기본 알림 설정을 따른다.
- 파일 이름: `방문일정_{방문 시작의 한국 날짜}.ics`(예: `방문일정_2026-10-17.ics`). 사용자 입력은 이름에 들어가지 않는다.
- 형식 `text/calendar;charset=utf-8`, BOM 없음.

### 내용

| | 세입자 | 업체 | 관리자 |
| --- | --- | --- | --- |
| 제목(SUMMARY) | `수리 방문 · 누수` | `방문 · 누수 · {건물} {호실}` | `업체 방문 · 누수 · {건물} {호실}` |
| 장소(LOCATION) | `{건물} {호실}` | `{serviceAddress}`(실제 주소) | `{건물} {호실}` |
| 메모(DESCRIPTION) | `업체가 방문해요. 일정이 바뀌면 build-manager에서 다시 받아 주세요.` | `작업 번호 {jobReference}. 출입 방법은 작업 화면에서 확인해 주세요. 일정이 바뀌면 다시 받아 주세요.` | `요청 번호 {ticketId} · {세입자 확정 또는 세입자가 동의한 시간 안에서 업체가 선택}. 일정이 바뀌면 다시 받아 주세요.` |
| 어디서 오나 | `/core` 화면의 호실 목록(`units`)과 요청의 `unitId`·`issueType`을 `VendorHandoffTenant`에 넘김 | `job.currentPacket`(`buildingName`, `unitLabel`, `serviceAddress`, `jobReference`, `issueType`) | `handoff.currentPacket`과 `ticket.ticketId` |

- 문제 이름은 난방·누수, 확정 방식 문장은 관리자 화면이 쓰는 문장과 같다. 호실(`unitLabel`)이 없으면 건물만 쓴다. 세입자 화면에서 호실을 찾지 못하면 장소를 넣지 않는다.
- 어느 파일에도 넣지 않는 것: 출입 방법(`accessInstruction`, 현관 비밀번호 등), 출입 방식 설명, 세입자 이름·연락처, 세입자가 쓴 설명 글, 공유 상세(`sharedDetails`), 안전 안내, 사진, 내부 메모, 업체 이름.

### 화면

- 누르면 파일을 만들어 내려받고 알림(토스트, 디자인 규칙 8.9, E1의 `Toast`)으로 "캘린더 파일을 받았어요. 파일을 열어 캘린더에 추가해 주세요."를 보인다.
- 파일을 못 만들면 토스트 대신 상자 안에 "캘린더 파일을 만들지 못했어요. 다시 받아 주세요."(`role="alert"`)를 남긴다.
- 화면이 바쁠 때(다른 저장 중, `disabled`/`submitting`/`locked`)는 누를 수 없다. 방문 일정 변경 확인 중에도 그대로 보인다.

### 코드 구조

| 파일 | 할 일 |
| --- | --- |
| `apps/web/src/lib/calendar-file.ts` (새) | iCalendar 글자 만들기: TEXT 이스케이프, 75바이트 접기, UTC 시각, 필수 속성. 화면을 모르는 순수 함수 |
| `apps/web/src/lib/download-file.ts` (새) | `downloadFile(이름, 글자, 형식)`. E1의 `downloadCsv`가 이것을 쓰게 바꾼다(동작 같음, 기존 시험 그대로 통과) |
| `apps/web/src/lib/visit-calendar.ts` (새) | 세 역할의 일정 내용(제목·장소·메모)과 파일 이름. 업체 화면(`app/vendor`)도 쓰므로 `lib`에 둔다 |
| `apps/web/src/components/visit-calendar-button.tsx` (새) | 버튼, 토스트, 실패 안내. 세 화면이 같이 씀 |
| 세 화면 파일과 `core-screen.tsx` | 버튼 연결, 세입자 화면에 호실·문제 넘기기 |

- 새 의존성은 없다. iCalendar 라이브러리를 넣지 않는다.

### 바꾸지 않는 것

API 계약, 서버 코드, 마이그레이션, 권한, 방문 확정·변경 흐름, 모바일 앱, 데모 배포.

## 위협·남용 사례

| 사례 | 어떻게 | 막는 방법 |
| --- | --- | --- |
| 출입 방법 유출 | 업체 작업 정보의 출입 방법(현관 비밀번호 등)이 캘린더 계정에 남음 | 출입 방법·출입 설명은 어느 파일에도 넣지 않는다. 작업 정보에 출입 방법이 있어도 파일에 없는지 시험으로 고정 |
| 주소가 캘린더 계정에 남음 | 업체 파일의 실제 주소가 업체의 구글·애플 계정에 올라감 | 운영자가 알고 정함(업체는 찾아가야 함). 세입자·관리자 파일에는 주소를 넣지 않음(시험) |
| 일정 파일 주입 | 건물·호실·작업 번호 값에 줄바꿈이나 `;`·`,`를 넣어 새 속성(예: `URL:`, 알림)을 끼워 넣음 | 모든 TEXT 값 이스케이프, 줄바꿈은 `\n` 글자로. 줄바꿈이 든 값이 한 줄의 값으로만 남는지 시험 |
| 권한 밖 방문 | 볼 수 없는 방문을 파일로 받음 | 새 API 없음. 화면이 이미 권한 검사를 거쳐 받은 방문만 씀 |
| 낡은 일정 | 일정이 바뀌어도 받은 파일·캘린더 일정은 그대로 | 메모에 "다시 받아 주세요". 같은 방문은 같은 UID. 예전 일정은 사용자가 지워야 할 수 있음(남은 위험) |
| 파일 이름 조작 | 이름에 사용자 입력을 넣어 경로·글자 장난 | 이름은 고정 글자와 날짜만 |

## 시험

실패하는 시험부터 쓰고, 목표 동작이 실제로 실패하는 것을 본 뒤 구현한다(DEV-04).

- 단위(`calendar-file.test.ts`): 필수 속성과 순서, CRLF, 이스케이프(`\`, `;`, `,`, 줄바꿈), 쌍점은 그대로, 75바이트 접기(한글 포함, 접은 줄마다 75바이트 이하, UTF-8 글자를 자르지 않음, 펼치면 원래 값), UTC 시각, VALARM 없음, 장소가 없으면 LOCATION 줄 없음.
- 단위(`visit-calendar.test.ts`): 세 역할의 제목·장소·메모, 출입 방법이 있는 작업 정보에서도 파일에 없음, 세입자·관리자 파일에 주소 없음, 호실이 없을 때, 파일 이름의 한국 날짜(브라우저가 다른 시간대여도).
- 컴포넌트: 세 화면에서 버튼은 확정되고 끝나지 않은 방문에만, 바쁠 때 누를 수 없음, 누르면 `text/calendar` 파일과 토스트, 실패하면 안내 상자. 기존 화면 시험은 그대로 통과.
- 화면 흐름: 업체 처리 흐름을 다루는 기존 브라우저 시험(`test:e2e:vendor` 또는 해당 core 시험)에 방문 확정 뒤 세 역할에서 파일을 받아 바이트(`BEGIN:VCALENDAR`, UID, 시각, 역할별 장소, 출입 방법 없음)를 읽는 단계를 더한다. 어느 묶음에 넣을지는 구현 계획에서 기존 시험을 읽고 정한다.
- 디자인 점검: `scripts/design-audit.mjs`(크롬·WebKit) 발견 0건. 390px·1280px 캡처는 저장소 밖에 두고 눈으로 확인.
- DEV-06: `test:shared`, `test:web`, `lint`, `typecheck`, `build:web`, `check:deps`, `test:postgres`, 해당 브라우저 시험, `verify_repository.py --history`. 브라우저 시험과 디자인 점검은 Node 24.21.0으로.
- 실제 기기: 운영자 휴대폰으로 파일을 열어 캘린더에 들어가는지 본다(iPhone 또는 Android, 구글 캘린더·삼성 캘린더 등). 데모에 올린 뒤나 같은 와이파이의 개발 서버로 확인한다. 확인 전에는 `NOT_RUN`으로 적는다.

## 롤백

- 화면 코드만 바뀌므로 PR을 되돌리는 커밋 하나로 끝난다. 데이터·마이그레이션 롤백은 없다. 데모에 올린 뒤에는 [VM 배포 절차의 Rollback](../../../deploy/vm/README.md#rollback)을 따른다.

## 남은 위험

- Android Google 캘린더 앱이 파일을 바로 추가하지 못할 수 있다(Google 도움말은 컴퓨터만 안내). 기기 확인 뒤 B(구글 버튼)를 따로 정한다.
- 다시 받았을 때 덮어쓸지 새로 생길지는 캘린더 앱마다 다르다. 일정이 바뀌면 예전 일정이 남을 수 있다.
- 시각은 UTC로 넣으므로 기기 시간대로 보인다. 한국 기기에서는 한국 시간이다.
- 업체 주소가 업체의 캘린더 계정에 남는다(운영자 결정).

## 후속: 자동 추가 (이 설계 범위 밖)

웹 브라우저는 사용자 손 없이 캘린더에 쓸 수 없다. 운영자 결정(2026-10-15)대로 자동 추가는 앱 v2에서 한다.

- 휴대폰 앱이 확정된 방문을 휴대폰 캘린더에 직접 만든다. 처음 한 번 캘린더 사용 허락을 받고, 일정이 바뀌면 앱이 같이 고친다. Expo SDK 57의 `expo-calendar`가 기기 캘린더에 일정을 만들 수 있고(iOS·Android 기기 전용, 사용자 허락 필요, 개발 빌드 필요), 확인 2026-10-15.
- 필요한 것: 앱이 방문을 보여 주는 기능, 실제 로그인(앱 v2), 새 의존성 평가(REF-06), 권한 문구, 별도 스펙.
- 이 설계의 파일 버튼은 앱 권한을 거절한 사람과 컴퓨터 사용자를 위해 그때도 남긴다.
- 고르지 않은 길: 구독 주소(구글은 컴퓨터에서만 추가, 다시 읽는 시점 공식 안내 없음, 주소가 곧 열쇠, 서버·DB 작업), 구글 계정 연결(실제 로그인 뒤로 정한 결정 CLM-166을 다시 열어야 하고, Google Calendar API를 쓰는 공개 앱은 검수가 필요함).

## 참고 기록 (REF-03)

```text
참고: RFC 5545 "Internet Calendaring and Scheduling Core Object Specification (iCalendar)" — https://www.rfc-editor.org/rfc/rfc5545, 확인 2026-10-15
가져온 것: 필수 속성(PRODID, VERSION, UID, DTSTAMP), CRLF와 75바이트 접기, TEXT 이스케이프, UTC 시각 형식
일부러 가져오지 않은 것: VALARM(미리 알림), 반복 일정, 참석자(ATTENDEE)
라이선스: 해당 없음
```

```text
참고: Expo SDK 57 "Calendar (expo-calendar)" — https://docs.expo.dev/versions/latest/sdk/calendar/, 확인 2026-10-15
가져온 것: 앱이 기기 캘린더에 일정을 만들 수 있고 사용자 허락이 필요하다는 사실(후속 자동 추가의 근거)
일부러 가져오지 않은 것: 이번 PR에서는 쓰지 않음(의존성 추가 없음)
라이선스: 해당 없음(문서)
```

```text
참고: Google Calendar API "Choose Google Calendar API scopes" — https://developers.google.com/workspace/calendar/api/auth, 확인 2026-10-15
가져온 것: 앱이 만든 별도 캘린더를 관리하는 권한(calendar.app.created)이 있고, 사용자 데이터에 접근하는 공개 앱은 검수가 필요하다는 사실
일부러 가져오지 않은 것: 구글 계정 연결 자체(운영자가 고르지 않음)
라이선스: 해당 없음
```

```text
참고: Google 캘린더 도움말 "Import events to Google Calendar" — https://support.google.com/calendar/answer/37118, 확인 2026-10-15
가져온 것: ICS 가져오기를 컴퓨터에서만 안내한다는 사실(휴대폰 확인이 필요한 이유)
일부러 가져오지 않은 것: 없음
라이선스: 해당 없음
```

## 전달 기록 (R09)

```text
POLICY_REF: main 446ee50 (cb3c4f7까지 규칙 파일 변경 없음)
TARGET_REF: edward321416-maker/build-manager feat/visit-calendar-c1 (main cb3c4f7에서 시작)
DECISIONS: 위 "결정" 절(운영자 2026-10-15)
SCOPE: 허용 — 위 코드 구조 표의 웹 파일과 시험, 기록 파일 / 금지 — API·서버·DB·권한·모바일·의존성 추가
CHECKS: 문서 검토만(구현 전). 시험은 구현 계획에서 정한다
STATUS: READY_TO_SEND(운영자가 설계서 페이지를 보고 자동 추가 방향까지 정함)
ARTIFACT: docs/superpowers/specs/2026-10-15-visit-calendar-c1-design.md
```
