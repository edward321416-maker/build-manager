# Vendor Secure Handoff v1 — Task8 local checkpoint

POLICY_REF: `4f3d3dbdf57c7d537ad6b79674b05b29888c44e1`.
Entry TARGET_REF: `75d29d0` (Task7 closure). Final Task8 source HEAD: `085c090`.
Authority: accepted plan blob `51123e2583c8ecdb132711d86cacdf43027743b1` and PR75 execution directive 6013595548. Previous receipt: [Task7 checkpoint](vendor_secure_handoff_task7_checkpoint.md).

## Local Task8 result

Migration `0022_vendor_handoff_completion.sql` adds owner-owned, org-scoped, FORCE-RLS `completion_report`, `completion_photo` and the `manager_disposition` resource shape (no Task8 disposition command), exact runtime EXECUTE grants, the report foreign key and the final FOLLOW_UP provenance invariant (exactly one source for FOLLOW_UP, none otherwise). Migrations 0001–0021, the Core photo sanitizer, Design/D9/D9R1 and the accepted plan remain unchanged (frozen audit 28/28).

- Vendor photo upload validates the live session read-only, then decodes and re-encodes through the unchanged Core sanitizer (EXIF/GPS/XMP removed, byte and pixel bounds), with the strict command in its own header and `X-Upload-Id` equal to the request identity. The replay fingerprint includes the sanitized-byte SHA-256 and every intent field; at most ten photos per initial upload context; only for the latest occurred visit and never while a round is OPEN.
- An initial work report needs the latest occurred visit, no current blocker, no OPEN round, the current packet acknowledgment and 1–5 same-context photos XOR one approved omission reason. It is append-only, attaches the selected photos, retires every other staged initial photo, and makes the assignment COMPLETION_REPORTED (derived, not a durable status) without ending the assignment or the ticket. Correction context and supersession stay rejected until Task9.
- COMPLETION_REPORTED refuses packet publication, scheduling, visit/blocker evidence, uploads, another report and every assignment end other than closeout.
- The Manager reads only ATTACHED photos selected by a report of that ticket's assignments; every other id is the same hidden NOT_FOUND. The Tenant has no report or completion-photo exposure.
- Vendor work-report UI and Manager review use the D9 preferred term "작업 보고"; the Manager revoke action is hidden while a report awaits its disposition.

## Independent review

| Generation | Verdict | Outcome |
| --- | --- | --- |
| `6b06601` implementation | BLOCKER 0 / HIGH 0 / MEDIUM 3 / LOW 6 | decode before session check; forbidden "업체 완료" wording; boolean packet acknowledgment; open-round uploads and stranded staging; per-visit staging, capacity copy, terms, test gaps, comment |
| `085c090` remediation | BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0 | all closed; reviewer re-ran typecheck, focused web 135/135, shared 9/9, completion+security PostgreSQL 47/47 |

## Verified local evidence (generation `085c090`)

| Gate | Result |
| --- | --- |
| Vendor PostgreSQL (foundation, security, external HTTP, Manager preview/HTTP, scheduling, Tenant HTTP, work, completion) + core-ticket-outcome | 182/182 PASS |
| Frozen PostgreSQL regressions | 42/42 PASS |
| Full Web | 763/763 PASS |
| `npm run verify` (shared 485/485, lint 0 errors / 4 unchanged warnings, typecheck, Next build, deps) | exit 0 |
| Staged public scan | PASS, 718 files / 332 links / 0 findings |
| Frozen authority audit | 28/28 PASS (Vendor migrations=4) |

RED generations and every intermediate failure (including load-induced 5 s timeouts and a boundary-test detection resolved by an exact sanitizer allowance) are retained privately.

## Limits and next gate

Correction requests, correction-context uploads/reports, MORE_WORK, closeout, revoke/reassign and direct-completion wiring are Task9; Task9 must replace `pending_report` for unresolved correction requests and refuse revoke/reassign during COMPLETION_REPORTED server-side. Replay determinism across service instances is Task11. AC evidence is local and partial; no 57/57 acceptance is claimed. No remote/Ready/merge/deploy/production/external Google write; sync_status=pending; tokens=unknown. Next: Task9.
