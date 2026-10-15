# Visit calendar file (.ics) for a confirmed vendor visit (integrations C1), acceptance

Snapshot: **2026-10-15 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN** once CI passes on the final head. It is not on the hosted demo; a redeploy is a separate operator decision (DEV-04). The phone check (opening the file on the operator's phone) waits for that redeploy or a development server on the same Wi-Fi.

This is the integrations C1 (calendar file), not the earlier "building information break C1" (`ops/building_context_fallback_c1_20261014_acceptance.md`).

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: the vendor file carries the real service address, and visit times, buildings and units leave the product as a file (DEV-01 real personal information; when unsure, high-risk). No API, database, permission or deployment change |
| Operator decisions | 2026-10-15, in session, on a real-size mockup page: all three roles ("셋 다 (추천)"; other options: tenant and vendor, tenant only); the real address in the vendor file only ("넣기 (추천)"; other option: building and unit only); one standard file, then a phone check ("A 파일 하나, 기기로 확인 (추천)"; other options: file plus a Google button, a subscription address); design "이대로 승인 (추천)"; after asking for automatic adding, "파일로 시작, 자동은 앱에서 (추천)" (other options: a subscription address now, Google account linking first) |
| Spec and plan | [Spec](../docs/superpowers/specs/2026-10-15-visit-calendar-c1-design.md), [plan](../docs/superpowers/plans/2026-10-15-visit-calendar-c1.md); a private visual page of the spec was shown to the operator |
| Research | [Integrations research](../research/ux/2026-10-15-integrations-export-calendar-ai.md) (PR #157, CLM-155, CLM-162, CLM-166) |
| Policy | `POLICY_REF` main `446ee50`, unchanged at the base `cb3c4f7`. Main `8702312` (merged in before the PR) changes only design rules for the landing page `/` (Toss reference, 9.1 scroll scenes, landing sizes), none of which touches the visit boxes |
| Base | main `cb3c4f7`; main `8702312` merged in after the checks (no overlap with the changed web files) |
| Independent review | Fresh-context review agent, read-only, on `origin/main...2680962`: **APPROVE WITH NITS**, no BLOCKER/HIGH, one MEDIUM (the browser test's privacy checks used a packet without an access instruction and never checked the tenant's and manager's place) and five LOW; all fixed test-first in `617b832` (below). Delta review of `617b832` by the same agent: **APPROVE**, all six findings fixed, no new bug, the three kept nits agreed |
| PR | Recorded in the PR body with its final head and that head's CI |

## Change

- `apps/web/src/lib/calendar-file.ts`: `icsUtc` (UTC `YYYYMMDDTHHMMSSZ`), `icsText` (TEXT escaping of `\`, `;`, `,` and every line break; the colon stays), `icsFold` (75 octets per line, CRLF plus one space, never inside a UTF-8 character or a surrogate pair), `calendarFile` (PRODID, VERSION, CALSCALE, METHOD, one VEVENT with UID, DTSTAMP, DTSTART, DTEND, SUMMARY, LOCATION only when present, DESCRIPTION; CRLF; no VALARM).
- `apps/web/src/lib/download-file.ts`: `downloadFile(fileName, text, type)` saves through a temporary link and releases the object URL after 60 s; E1's `downloadCsv` now delegates to it (its tests unchanged).
- `apps/web/src/lib/visit-calendar.ts`: the three roles' entries from named fields only (title, place, note; the vendor's place is the service address, the tenant's and manager's are building and unit), `방문일정_{Seoul date}.ics`, and `visitStillAhead` (the end time is still ahead).
- `apps/web/src/components/visit-calendar-button.tsx`, `.module.css`: the white secondary button `캘린더에 추가` (design rules 8.1), the 8.9 toast `캘린더 파일을 받았어요. 파일을 열어 캘린더에 추가해 주세요.`, and in place of a toast `캘린더 파일을 만들지 못했어요. 다시 받아 주세요.` (`role="alert"`) when the file cannot be made.
- `vendor-handoff-tenant.tsx` (with `core-screen.tsx` passing the request's issue type and its unit's place), `vendor-handoff-manager.tsx` and `vendor/job/vendor-job-screen.tsx`: the button inside each existing confirmed-visit box while the visit has not ended, disabled while the screen is busy.
- Tests: `calendar-file.test.ts`, `download-file.test.ts`, `visit-calendar.test.ts`, `visit-calendar-button.test.tsx`, `vendor-handoff-tenant-calendar.test.tsx`, `vendor-handoff-manager-calendar.test.tsx`, `vendor/job/vendor-job-calendar.test.tsx`, and one browser test in `tests/vendor-e2e/vendor-job.spec.ts` that saves the file as the vendor, the tenant and the manager and reads the downloaded bytes.
- Unchanged: API contracts, server code, migrations, permissions, the visit confirm and change flows, the mobile app, dependencies, the demo.

### Review fixes

| Review finding | Fix | Test that failed first |
| --- | --- | --- |
| MEDIUM: browser privacy checks proved little | `provision()` in `tests/vendor-e2e/harness.ts` takes an optional access instruction; the C1 browser test publishes one and checks no file holds it, the tenant's text, the vendor name or the work summary, and that the tenant's and manager's files name building and unit (which also covers the tenant's unit lookup on `/core`) | Browser test, run on the final code (below) |
| LOW: U+2028/U+2029 pass through | `icsText` turns them into spaces | `calendar-file.test.ts` |
| LOW: placement differed from the approved mockup | `캘린더에 추가` and `방문 일정 변경` share one wrapping row, 10 px apart; the change check stays below the row | One placement-and-busy test per screen |
| LOW: no failure box on `/vendor/job` | The button's own CSS boxes its alert (8.11) | Checked by eye (layout) |
| LOW: manager file stamped at render time | Uses the live clock at the click | `vendor-handoff-manager-calendar.test.tsx` |
| LOW: busy lock and four-octet folding untested | One busy test per screen (mutation-checked: dropping the manager's `disabled` fails it); one emoji folding test | As named |
| Nit: empty building name left a stray space or ` · ` | `visitPlace` leaves empty parts out; `/core` passes the tenant's place through it | `visit-calendar.test.ts` |

Kept nits: `METHOD:PUBLISH` stays as the spec has it (RFC 5545 makes it optional; calendar apps accept it without ORGANIZER); an old failure line could stay after a reschedule only if the same box stayed mounted, but a reschedule cancels the visit and removes the box; the `downloadCsv` delegation stays in this PR because the spec names it.

## Threats (spec table)

| ID | Threat | Control | Evidence |
| --- | --- | --- | --- |
| T1 | Access instruction leaks into a calendar account | No file carries the access instruction or the access policy text | Entry tests with a full packet (access instruction, vendor name, work summary, shared details, safety notice) and the vendor screen test with an access instruction check each is absent; the browser test's packet has no access instruction and checks the tenant's own text is absent from all three files |
| T2 | The address stays in a calendar account | Operator decision for the vendor only; tenant and manager files carry building and unit | Entry tests; the browser test checks the address is in the vendor file and not in the other two |
| T3 | Calendar injection through a value (`\nURL:...`, `;`, `,`) | Every TEXT value escaped; CR, LF and CRLF become the two characters `\n`; other control characters and the Unicode line and paragraph separators (U+2028, U+2029) become spaces | Unit tests on `icsText` (a value with `\r\nURL:` or U+2028 `URL:` stays text) and on the whole file (no bare line break outside CRLF line ends) |
| T4 | A visit outside one's permission | No new API; only the visit the screen already received | Out of scope by design |
| T5 | Stale entry after a change | The note says to save it again; the UID is the appointment id, so the same visit keeps it and a new visit gets a new one | Entry tests (UID); remaining risk below |
| T6 | File-name tricks | The name is fixed text plus the Seoul date | File-name tests |

## Verification

All local runs on 2026-10-15 KST with Node 24.21.0 (the pinned copy; the PC default 24.14.0 cannot run the browser setup) and npm 11.19.0, synthetic data only.

- Test-first per task: each task's tests ran against a stub that compiled but behaved wrongly and failed on assertions, then passed after the implementation. The review fixes started from six new failing tests (separator, empty building, manager click time, placement on three screens); the busy-lock test was mutation-checked.
- At `2680962` (before the review fixes, which touch only `apps/web`): `test:shared` 52 files, 669 tests; `test:postgres` 49 files, 652 tests; `check:deps` passed.
- At `617b832` (review fixes): `test:web` 101 files, 1103 tests passed; `lint` 0 errors (8 existing warnings, none in a changed file); `typecheck` exit 0; `test:e2e:vendor` 21/21 with the strengthened C1 test.
- The first `test:e2e:core` run at `2680962` stopped in 18 s before any test because the web server process failed to start (Windows code 0xC0000142). At `617b832`: `build:web` passed and `test:e2e:core` 65/65.
- Layout checked by eye from browser captures kept outside the repository (`~/.build-manager-rc1-private/visit-calendar-c1-shots/`): the vendor box at 390 px, the tenant box at 390 px and the manager group at 1280 px, each with the two buttons in one row, and the vendor and tenant change checks below the row. `scripts/design-audit.mjs` does not open a confirmed visit, so its result covers the surrounding screens only: Chromium and WebKit, fresh synthetic fixture, 231 screens, 0 findings at `617b832` (captures in `~/.build-manager-rc1-private/visit-calendar-c1-audit/`).
- `python scripts/verify_repository.py --history`: run on the records commit after merging main (recorded in the PR body).
- Phone check: NOT_RUN (needs the demo or a development server on the same Wi-Fi).

## Rollback

- A revert PR restores the old screens; no data, migration or API changes with this PR. On the demo (after a later redeploy) the VM rollback in `deploy/vm/README.md` applies; no migration lies between the images.

## Remaining risks

- Android Google Calendar may not add the file directly (Google's help documents ICS import on a computer only); after the phone check the operator decides on a separate Google button.
- Whether saving again replaces or duplicates the entry depends on the calendar app; after a change the old entry may stay.
- Times are written in UTC and shown in the device's time zone (Korean time on a Korean phone).
- The vendor's calendar account keeps the service address (operator decision).
- Automatic adding waits for app v2: the phone app adds confirmed visits through `expo-calendar` with the user's permission; the file button stays (spec "후속").
- Found while checking the captures, not changed here: in the tenant's change check (unchanged from main) `일정 변경하기` and `돌아가기` touch with no gap between them (design rules §4); a small follow-up.
