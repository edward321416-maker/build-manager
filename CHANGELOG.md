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
