# Vendor Secure Handoff v1 — Task7 local checkpoint

POLICY_REF: `4f3d3dbdf57c7d537ad6b79674b05b29888c44e1`.
Entry TARGET_REF: `3953d75` (Task6 closure). Final Task7 source HEAD: `d80c9e4` (test-only follow-up on `10b66ec`).
Authority: accepted plan blob `51123e2583c8ecdb132711d86cacdf43027743b1` and PR75 execution directive 6013595548. Previous receipt: [Task6 checkpoint](vendor_secure_handoff_task6_checkpoint.md).

## Local Task7 result

Migration `0021_vendor_handoff_work.sql` adds the owner-owned, org-scoped, FORCE-RLS `work_event` table with append-only VISIT_STARTED, BLOCKER_RECORDED and BLOCKER_CLEARED evidence, exact EXECUTE grants to the Vendor runtime only, and the FOLLOW_UP blocker-provenance foreign key. Migrations 0001–0020, Design/D9/D9R1 and the accepted plan remain byte-identical (frozen audit 28/28).

- One VISIT_STARTED per Appointment: it requires the current SCHEDULED Appointment of the confirmed latest round and no current blocker, and marks the Appointment OCCURRED without any time change.
- A PREAUTHORIZED_ENTRY visit start rechecks the exact stored authorizing occupancy member after the source-ticket lock wait and is allowed only inside the explicitly authorized window; a replacement member cannot satisfy it.
- A blocker overlays the waiting state without changing the phase or any history; at most one current blocker exists; a clear references the exact current blocker and both events remain.
- Clearing a FOLLOW_UP_VISIT_REQUIRED blocker after an occurred visit atomically opens one FOLLOW_UP round whose provenance is that blocker; the occurred Appointment stays OCCURRED and a later visit gets a new Appointment.
- Clears and FOLLOW_UP provenance can reference only a BLOCKER_RECORDED event of the same assignment; the insert guard runs under the caller's organization binding.
- The Tenant projection keeps only the scheduling turn and never learns the blocker category or note.
- Vendor HTTP routes and the Vendor work UI use explicit confirmations, identical resend on unknown outcomes and stale-conflict refresh; the Manager view shows the current blocker and waiting state.

## Independent review

| Generation | Verdict | Outcome |
| --- | --- | --- |
| `6129c0b` implementation | BLOCKER 0 / HIGH 1 / MEDIUM 3 / LOW 4 | insert guard rebound the organization from the row; blocker-overlaid status copy; refused preauthorized start copy; silent follow-up commitment; Tenant blocker category, stale form intent, index and test gaps |
| `10b66ec` remediation | BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 2 | all eight fixed; weak cross-organization probe assertion; follow-up copy relies on a Task8 latest-visit rule |
| `d80c9e4` follow-up | BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0 | all closed; reviewer re-ran security PostgreSQL 23/23; latest-visit rule is a Task8 merge gate |

## Verified local evidence (generation `10b66ec`; `d80c9e4` re-ran the security suite 23/23 and test typecheck)

| Gate | Result |
| --- | --- |
| Vendor PostgreSQL (foundation, security, external HTTP, Manager preview/HTTP, scheduling, Tenant HTTP, work) + core-ticket-outcome | 157/157 PASS |
| Frozen PostgreSQL regressions | 42/42 PASS |
| Full Web | 741/741 PASS |
| `npm run verify` (shared 482/482, lint 0 errors / 4 unchanged warnings, typecheck, Next build, deps) | exit 0 |
| Staged public scan | PASS, 713 files / 331 links / 0 findings |
| Frozen authority audit | 28/28 PASS (Vendor migrations=3) |

RED generations and every intermediate failure are retained privately. Some remediation tests characterize behavior that already held and are labelled as such.

## Limits and next gate

A missed preauthorized window cannot be started or rescheduled; the Vendor is told to contact the Manager, and Manager revoke/reassign arrives in Task9. Completion reports and photos are Task8. AC evidence is local and partial; no 57/57 acceptance is claimed. No remote/Ready/merge/deploy/production/external Google write; sync_status=pending; tokens=unknown. Next: Task8.
