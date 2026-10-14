# Changelog

## 2026-09-13 — Repository foundation

- Established the build-manager charter, governance, public-data boundaries, and contribution workflow.
- Began a phase-based evidence and delivery log. Subsequent phases are recorded here when their files are created.

## 2026-09-13 — Research system

- Added source/claim registries, neutral landlord and tenant interview guides, privacy and immutable-raw rules, and an explicitly unverified competitor lead index.

## 2026-09-13 — GitHub collaboration

- Added issue/PR templates and advisory public-repository checks.
- Created 19 initial issues, 5 milestones, and 11 project labels; preserved 10 existing labels.
- Kept squash and merge commits enabled. Collaborator invitation remains pending; no review-requirement rule was created.

## 2026-09-13 — Product state

- Documented the problem, B2B2C strategy, bounded MVP, proposed workflow, and Safety Gate.
- Marked baseline workflows, market outcomes, implementation feasibility, and safety validation as unverified rather than observed results.

## 2026-09-13 — Submission workspace

- Added a substantive provisional application draft, official-requirement verification table, evidence and claim gates, and an original-image plan.
- Separated drafts from the final release directory; official compliance and submission remain blocked pending verification and artifact approval.

## 2026-09-13 — AI operating prompts

- Added English ChatGPT/Codex instructions for bounded autonomous tooling, selective context, patch-only code payloads, and durable checkpoints.
- Codified Sheets append and Drive schema caching with pending fallback and receipt verification. Runtime enforcement, external sync, and token savings remain untested.

## 2026-10-10 — Hosted demo design

- Deployed the login-free synthetic demo to the operator's VM with design rules v1 applied to the home, `/core` and `/vendor/job` screens, including the spacing fixes from the operator's iPhone reports.
- Added `scripts/design-audit.mjs` (Chromium and WebKit, empty states) and the operator feedback log in the design rules.

## 2026-10-10 — Security update

- Redeployed the hosted demo with Next.js 16.3.8 and sharp 0.35.5 (PR #97), fixing the published Next.js and sharp advisories that Dependabot reported. Demo data and settings were kept.
- Closed the unused Next.js image optimizer route `/_next/image` (PR #106). The hosted demo was redeployed from main, which also brought the tenant intake completion from PR #100. The rollback procedure was rehearsed first and is now in `deploy/vm/README.md`.

## 2026-10-11 — Vendor screen fixes

- Redeployed the hosted demo from main `53428c7` with the Vendor job screen fixes from PR #111 (uploaded work photos go into the report by default, a disabled report button lists what is still missing, and a Tenant's available time can be copied into a proposal) and the lockfile-only tooling update from PR #110. The archive of the previous image was kept on the VM for rollback.

## 2026-10-12 — Photos as required evidence

- Redeployed the hosted demo from main `39e372a` with P1b (PR #116 and #117): after the questions a tenant names one of the ticket's own photos as each required evidence, or sends without one, so a complete request reaches review with a recommended route, and the manager sees which photo was named. Migration 0024 was applied when the new image started. This was the first deploy with `deploy/vm/redeploy.sh`; the archive of the previous image was kept on the VM for rollback.

## 2026-10-12 — Manager next step and /core design cleanup

- Redeployed the hosted demo from main `309b0b7` with the manager's next step from PR #121 (a 다음 할 일 zone in each request, queue rows that name the open intake step, and a Vendor section that explains what it needs first) and the remaining `/core` design items from PR #122 (4:3 photo thumbnails without a box, the caption style for times and counts, the 248px left menu from 1024px, and maintenance history as list rows). No migration was added. The archive of the previous image was kept on the VM for rollback.

## 2026-10-13 — Plain names, Korean dates and larger tap targets

- Redeployed the hosted demo from main `f5ff1ce` with the one name table for states, routes and policies from PR #123 (raw values and the old landlord term are gone), dates and times in the design rules section 14 format with folded repeat saves in the history from PR #125, Seoul time everywhere with the exact time next to `10분 전` from PR #127, and 50px tap targets for the `/core` controls the design audit found from PR #126 (the phone top menu links stay 40px tall by operator decision). No migration was added. The archive of the previous image was kept on the VM for rollback.

## 2026-10-13 — Fuller first page, 해요체 and the join status check

- Redeployed the hosted demo from main `48d2516` (image `8474bbb5b02c`, replacing `945841c9a81b`). It brings the first-visitor page rebuilt on the layout of the reference site the operator picked (PR #137, after PR #135 allowed copying a picked site's layout), the photo-choice tile text centred and the design audit's `center` check (PR #128), 해요체 across `/core` and the Vendor job screen (PR #131), and a `/core/join` status check that no longer reads every saved request without an inspected invite (PR #134). The menu parts from PR #136 are included but not wired to any screen yet. No migration was added. The previous image's archive stays on the VM for rollback.

## 2026-10-13 — Bottom tabs and a left menu on /core

- Redeployed the hosted demo from main `81c6d39` (image `97a803fc87dd`, replacing `8474bbb5b02c`). On phones `/core` now has a bottom tab bar: tenants 우리 집 · 내 요청 · 알림 · 내 정보, managers 업무함 · 알림 · 더 보기 (호실 정비 이력, 입주 연결, 건물·호실 관리, 내 정보; the middle two only for an organisation admin). From 768px every role has a 248px left menu with the same items, 더 보기's rows listed directly (PR #136 and #139). Organisation choice and logout moved into 내 정보. The design rules' status list and feedback table moved to `design/DESIGN_STATUS.md` (PR #140, no screen change). No migration was added. The previous image's archive stays on the VM for rollback.

## 2026-10-14 — 홈 · 요청 · 알림 · MY and the real Pretendard face

- Redeployed the hosted demo from main `48aa7cf` (image `4718a64c05ab`, replacing `97a803fc87dd`). Tenant tabs are now 홈 · 요청 · 알림 · MY and the account entry reads MY for every role; 홈 lists up to three in-progress requests with a link to 알림 when something needs doing, 요청 shows 진행 중 and 끝난 요청 groups, and a single organisation's name is shown as plain text (PR #143). Pages now load the Pretendard face from the font CDN under its real name, `Pretendard Variable`; before, phones and other computers without Pretendard installed fell back to the system font (PR #145). No migration was added. The previous image and its archive stay on the VM for rollback; older ones were removed.

## 2026-10-14 — Units without building information, and every unit past 200

- Redeployed the hosted demo from main `1289a67` (image `722c8899950d`, replacing `4718a64c05ab`), which applied migrations 0025 and 0026 at start-up. A building registered on `/workspace` without Core building information now lists its units under the name `건물` with no building facts, and the manager's request responses carry such a building as unverified instead of failing (PR #147). The Core unit list now holds every unit a session can read, ordered by building name, unit label and unit id, instead of the first 200 in id order, which had left out every newly registered unit once an organisation passed 200; building access is checked once per building (PR #148). Every demo building has building information and the demo has 3 active units, so its screens did not change. The previous image and its archive stay on the VM for rollback.

## 2026-10-14 — Reasons on the 알림 to-do list

- Redeployed the hosted demo from main `b4d696f` (image `78829071966a`, replacing `722c8899950d`). 알림 now also lists per-request reasons: `방문 시간 확정 필요` and `결과 확인 필요` for tenants, `업체 확인 필요` and `기한 지남` for managers, and `연결 요청 확인 필요` for organisation admins; while the first read of those reasons runs, the list says `처리할 일을 더 확인하고 있어요.` (PR #150). The release also carries the docs-only deploy record PR #149. No migration was added. The previous image and its archive stay on the VM for rollback.
