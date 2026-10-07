# Vendor Secure Handoff v1 — Task5 local checkpoint

POLICY_REF: `4f3d3dbdf57c7d537ad6b79674b05b29888c44e1`.
Entry TARGET_REF: `0e4c2da` (Task4 closure). Final Task5 source HEAD: `bac8cda9c4e7e8471d40b25ea1ddc711310ea3e5`.
Authority: accepted plan blob `51123e2583c8ecdb132711d86cacdf43027743b1` and PR75 execution directive 6013595548. Previous receipt: [Task4 checkpoint](vendor_secure_handoff_task4_checkpoint.md).

## Local Task5 result

Migration `0020_vendor_handoff_scheduling.sql` adds eight owner-owned, org-scoped, FORCE-RLS tables (scheduling rounds, Tenant availability submissions/windows, explicit entry authorizations and their exact windows, Vendor slot proposals/slots, Appointments) with composite keys tying every row to its round, assignment and authorizing occupancy member, and exact runtime EXECUTE grants. Migrations 0001–0018, Design/D9/D9R1 and the accepted plan remain byte-identical (frozen audit 28/28).

- Vendor Accept moves OFFERED to ACTIVE and creates exactly one INITIAL/OPEN round in the same transaction; exact replay returns the same result and concurrent Accept cannot create a second round.
- Vendor Withdraw is valid only from ACTIVE: ENDED/WITHDRAWN, Vendor access denied, still-actionable OPEN rounds and SCHEDULED Appointments cancelled, OCCURRED history and the source ticket untouched.
- Tenant availability never creates consent. Unattended-entry consent is a separate current-Tenant action on exact windows of the Tenant's own current submission, stores the exact occupancy member, and is projected only while that member stays current.
- A preauthorized Vendor slot must lie fully inside an authorized window; resident-confirmation proposals carry 1–5 future non-overlapping slots and only the current proposal's slot can be confirmed by the Tenant.
- Appointment times and history rows are immutable; closed rounds are frozen. Tenant, Vendor and Manager RESCHEDULE require a future SCHEDULED Appointment, supersede it and open exactly one RESCHEDULE round. Pre-confirmation restarts stay inside the OPEN round. Task5 creates no FOLLOW_UP round.
- Location/access packet changes are rejected beneath a confirmed Appointment and restart an unconfirmed round otherwise.
- Every command uses the source-ticket-first prologue with post-wait authority recheck, and receipts reconcile exact replays before time/state guards. The Tenant adapter binds the selected organization inside the command transaction.
- `POST /api/v2/vendor/job/accept|withdraw` and the Vendor job screen's Accept/Withdraw are added; results that began before a same-tab assignment switch are ignored.

## Independent review

| Generation | Verdict | Outcome |
| --- | --- | --- |
| `52e6af5` implementation | BLOCKER 0 / HIGH 0 / MEDIUM 3 / LOW 9 | replay after start passes; consent projected without occupancy recheck; non-throwing lock-wait polls; plus constraint, trigger, timestamp, copy and test gaps |
| `bac8cda` remediation | BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0 | all closed; reviewer re-ran scheduling+security PostgreSQL 56/56 |

## Verified local evidence (generation `bac8cda`)

| Gate | Result |
| --- | --- |
| Vendor PostgreSQL (foundation, security, external HTTP, Manager preview/HTTP, scheduling) + core-ticket-outcome | 122/122 PASS |
| Frozen PostgreSQL regressions | 42/42 PASS |
| Full Web | 668/668 PASS |
| `npm run verify` (shared 482/482, lint 0 errors / 4 unchanged warnings, typecheck, Next build, deps) | exit 0 |
| Staged public scan | PASS, 701 files / 329 links / 0 findings |
| Frozen authority audit | 28/28 PASS |

RED generations (Web 10, contract 3, PostgreSQL 30 failures; remediation Web 3, PostgreSQL 6 failures) and every intermediate failure are retained privately.

## Limits and next gate

Tenant Core HTTP/UI, Vendor scheduling HTTP/UI and the Asia/Seoul formatter belong to Task6; visit start/occupancy recheck at VISIT_STARTED to Task7; FOLLOW_UP and report provenance to Task7/8; Manager revoke/reassign to Task9. A missed past SCHEDULED appointment is resolved by Task7/Task9 paths. AC evidence is local and partial; no 57/57 acceptance is claimed. D7-L01, D8-L01, D8-L02 retained. No remote/Ready/merge/deploy/production/external Google write; sync_status=pending; tokens=unknown. Next: Task6.
