# Excel (CSV) export for the 업무함 and 호실 정비 이력 (E1), acceptance

Snapshot: **2026-10-15 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN** once CI passes on the final head. It is not on the hosted demo; a redeploy is a separate operator decision (DEV-04).

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: the first feature that takes manager data out of the product as a file (DEV-01 real personal information; when unsure, high-risk). No API, database, permission or deployment change |
| Operator decisions | 2026-10-15, in session: research options approved ("두 연구의 권하는 안 승인", CLM-166); button A beside the list title (other option: B, "8건 엑셀로 받기" in the count row); dates `2026-10-14 18:00` (other option: the screen's `10월 14일 (화) 오후 6:00`); columns as mocked, headers named like the screen; CSV for the 업무함 and one unit's 호실 정비 이력; design "이대로 승인 (추천)" (other options: add the download log now, hold); after the landlord ledger research the spec page drew "괜찮은데" with a request to match landlords' Excel, then "대장 방식으로 바꾸기 (추천)", "비고 칸 두기 (추천)" and "먼저 만들고 나중에 맞추기 (추천)" (CLM-213) |
| Spec and plan | [Spec](../docs/superpowers/specs/2026-10-15-excel-export-e1-design.md), [plan](../docs/superpowers/plans/2026-10-15-excel-export-e1.md); a private visual page of the spec was shown to the operator |
| Research | [Integrations research](../research/ux/2026-10-15-integrations-export-calendar-ai.md) (PR #157), [landlord Excel ledgers](../research/ux/2026-10-15-landlord-excel-ledgers.md) (PR #161, CLM-200..CLM-213) |
| Policy | `POLICY_REF` main `446ee50`; the rulebooks are unchanged at the base `4a5c42b` |
| Base | main `4a5c42b` (branch started at `e46fc43`, main merged in at `dbd52bd`) |
| Independent review | Fresh-context review agent, read-only, on `origin/main...5dd2838`: **APPROVE WITH NITS**, no BLOCKER/HIGH/MEDIUM, three LOW. All three LOW and five nits fixed in `e808e00` (below) |
| PR | Recorded in the PR body with its final head and that head's CI |

## Change

- `apps/web/src/lib/csv-file.ts`: `csvCell` quotes every cell, doubles inner quotes and puts `'` before a cell that starts with `=`, `+`, `-`, `@`, tab, CR, LF or full-width `＝＋－＠` (OWASP CSV Injection); `csvText` adds the BOM (built from a char code) and CRLF (RFC 4180); `csvFileName` turns path, reserved, control and format characters into `_` and drops spaces; `downloadCsv` saves through a temporary link and releases the object URL after 60 s.
- `apps/web/src/app/core/export-rows.ts`: the two headers in ledger order (date first, request number toward the end, empty `비고` last), rows from named fields only, names from the screens' tables, Seoul time through `instantToSeoulLocal`, the Seoul download date.
- `apps/web/src/app/core/maintenance-labels.ts`: the maintenance label tables moved out of the timeline component so the export imports them without a cycle (no behaviour change).
- `apps/web/src/components/toast.tsx`, `toast.module.css`: design rules 8.9 toast portalled to `<body>` (the queue card's `container-type` would trap a fixed box), an always-present polite live region in place, 3 s, layer 40, slide without opacity, off under reduced motion, `keep-all`; it sits 10 px above the tab bar only while the `/core` shell shows the tab bar (`--toast-bottom` in `nav/core-nav.module.css`), otherwise 20 px from the bottom.
- `manager-work.tsx`: `엑셀로 받기` in the title row, saving exactly the filtered rows in screen order; disabled while loading, after a load error (even though earlier rows are still held), with 0 rows, or while busy; a failed save shows `파일을 만들지 못했어요. 다시 받아 주세요.` in place and clears an earlier toast.
- `manager-maintenance-timeline.tsx`: the same for one unit's history beside `이력 다시 불러오기`; the heading wraps from 768 px; choosing the unit already shown no longer leaves the list loading (found by the browser test, below).
- Tests: `csv-file.test.ts`, `export-rows.test.ts`, `toast.test.tsx`, `manager-work-export.test.tsx`, `manager-maintenance-export.test.tsx`, two view tests in `manager-maintenance-timeline.test.tsx`, and one browser download test each in `tests/core-e2e/manager-work.spec.ts` and `maintenance-fact.spec.ts`.
- Unchanged: API contracts, server code, migrations, permissions, the mobile app, dependencies, the demo.

## Threats (spec table)

| ID | Threat | Control | Evidence |
| --- | --- | --- | --- |
| T1 | Formula injection through a label (`=HYPERLINK(...)`, `-2+3`) | Leading `'` for 11 start characters, every cell quoted, inner quotes doubled | Unit tests per character and the quote-and-comma trick; both browser tests save `=합성 수식 …` labels through the real API and read `'=…` back from the downloaded bytes |
| T2 | Data the manager cannot see reaches the file | No new API; rows come from the list the server already filtered (`ORG_ADMIN`/`PROPERTY_STAFF`, `can_unit`) and from named fields only | Row tests with extra tenant fields; the queue browser test checks the tenant's own text is absent |
| T3 | Personal data left on a shared PC | Tenant names, contacts, text, photos, notes, conversation and vendor data are never written | Column tests; spec "넣지 않는 것" |
| T4 | No record of who downloaded what | Synthetic demo only; a server-side download log comes before any tenant data or real service (PIPC Notice 2026-9 Art. 8(2), CLM-160) | Out of scope by operator decision |
| T5 | File-name tricks (`../`, `:`, bidi overrides) | Unsafe, control and format characters become `_` | File-name tests |
| T6 | Stale data | The file is what the screen shows; the toast states the count; the button is off after a failed reload | Queue tests (mutation-checked) |

## Verification

All local runs on 2026-10-15 KST with Node 24.21.0 (the pinned copy; the PC default 24.14.0 cannot run the browser setup) and npm 11.19.0, synthetic data only.

- Test-first per task: each task's tests ran against a stub that compiled but behaved wrongly and failed on assertions (Task 1: 6/6, Task 2: 6/6, Task 3: 4/4, Tasks 4 and 5: the button was missing), then passed after the implementation. The failed-reload test was mutation-checked (removing the `error` check makes it fail), and the same-unit test failed before its one-line guard.
- `test:web`: 94 files, 1076 tests passed at `9b504cd`. `lint`: 0 errors (8 existing warnings, none in a changed file). `typecheck`: exit 0.
- `test:e2e:core`: 65/65 at `9b504cd`. Two earlier full runs each failed one new test: the toast was checked after reading the file (the toast lasts 3 s; test timing fixed in `5dd2838`), and choosing the unit already shown left the timeline loading (product fix `9b504cd`).
- `test:postgres`: 49 files, 652 tests passed; `build:web`, `check:deps` passed (the build again inside the final browser run); package files unchanged after `npm ci`.
- `test:shared`: 52 files, 669 tests passed at `9b504cd`.
- Design audit (`scripts/design-audit.mjs`, Chromium and WebKit, fresh synthetic fixture): 231 screens, 0 findings at `9b504cd`, including the manager queue and `manager-maintenance` screens at 320–1440 px and their empty states. Captures stay outside the repository (`~/.build-manager-rc1-private/excel-export-e1-audit/`); the 1280 px queue and 390 px history captures were checked by eye.
- `python scripts/verify_repository.py --history`: PASS on the records commit (recorded in the PR body).
- Excel itself: NOT_RUN (no Excel on this PC). The browser tests read the real downloaded bytes (BOM, header, a formula cell, the empty 비고).

## Rollback

- A revert PR restores the old screens; no data, migration or API changes with this PR. On the demo (after a later redeploy) the VM rollback in `deploy/vm/README.md` applies; no migration lies between the images.

## Remaining risks

- Excel may show some unit names (for example `3-4`) as dates; the screen stays the reference.
- Cells starting with a blocked character show the `'` in Excel; such values are rare.
- OWASP notes no single treatment fits every spreadsheet program; tested against the file bytes, not Excel itself.
- The same toast text shown twice is not announced twice to screen readers (review nit, kept).
- The 난방/누수 names now exist in a third place (review nit, kept; values match).
- The landlords' real header rows (3–5) are still to be collected (CLM-211).
