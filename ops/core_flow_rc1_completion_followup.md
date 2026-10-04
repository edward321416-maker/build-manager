# Completion confirmation and follow-up v1 execution evidence

Date: 2026-10-04. Status: **COMPLETION_CONFIRMATION_FOLLOWUP_V1_BLOCKED** at Web integration, not a new approval gate.

## Authority and preserved work

The operator dispatched `ASTRA_RC1_COMPLETION_CONFIRMATION_FOLLOWUP_V1_IMPLEMENT_NOW.md` and authorized bounded implementation, tests, commits, normal push and the existing [Draft PR70](https://github.com/edward321416-maker/build-manager/pull/70). The subsequent operator reply confirms that a concurrent UI writer remains active and directs continuation on nonoverlapping backend work. No Ready, merge, deployment, Auth0 expansion, Expo retry or Unit Maintenance Fact Timeline is authorized.

- POLICY_REF/main: `e9144fac807f39544932baac25b11f836658dbb3`.
- START_HEAD: `5032e9b3d080cfcfe4148819f5138e47679298e0`.
- Concurrent presentation commit observed: `d27247fae77cda37bd092cf4bb31ef1c6bd09663`, a direct child of START_HEAD. Its 24 UI/browser paths and presentation receipt are preserved; a commit alone is not a writer handoff.
- Backend checkpoint: the commit containing this receipt and its 15 named backend/contract/test paths. The exact backend SHA is recorded after commit in the local execution receipt; it is not the final integrated IMPLEMENTATION_HEAD. Isolated outcome/recovery UI drafts remain outside this checkpoint. No final exact-head CI exists yet, and the concurrent presentation commit does not contain this feature.
- Branch: `feat/core-flow-rc1`, existing workspace. No reset, rebase, stash, force push or bulk staging.

The initial five dirty runtime records were byte-identical at the backend verification checkpoint. Subsequent task-log additions are append-only and excluded from a candidate until separately reviewed. Existing rows in all 17 baseline tables, including ticket/photo/Q&A records, remain present with their original row fingerprints. Other concurrent synthetic runs added rows, so whole-table equality is not claimed. No existing development data was modified by this backend phase. Migrations 0001–0016 remain byte-identical.

## Implemented backend

Additive migration [0017](../packages/persistence-postgres/migrations/0017_core_ticket_outcome_followup.sql) stores immutable outcome assertions and one direct source-to-target relation. Source ticket rows, events, work metadata, notes, conversation and photos are never updated by an outcome command. Historical RESOLVED remains separate from a subsequent RECURRENCE_CLAIM. Managers have read-only projections; current tenant ownership, unit authority and manager assignment ceilings are rechecked.

The [application concern](../packages/application/src/core-ticket-outcome.ts), [adapter](../packages/persistence-postgres/src/core-flow.ts), [strict contracts](../packages/api-contracts/src/core-ticket-outcome.ts), [typed client](../packages/api-client/src/core-ticket-outcome.ts) and [HTTP handler](../apps/web/src/server/core-flow/http.ts) are connected. Existing normal intake domain logic builds a fresh target; source text, protocol answers, photos, conversation and notes are not copied.

`create_ticket_follow_up(..., NULL)` first authorizes, locks and rechecks without writes. The adapter holds that source lock inside the same existing transaction, constructs the fresh domain Ticket, then invokes the command with that Ticket. Target, normal CREATED event, assertion and relation commit together. There is no intermediate commit or automatic retry. Saved exact requests are checked before the one-target guard so a successful replay can return its original target. Changed payload/source returns409; new conflicting requests return409.

New public routes under `/api/v2/core`:

- GET `tickets/:id/outcome`.
- POST `tickets/:id/outcome/resolved`: first201, exact replay200.
- POST `tickets/:id/follow-up`: first201, exact replay200.
- GET `tickets/:id/outcome/requests/:key`: own saved receipt, no request body.
- GET `tickets/:id/follow-up`: authorized neutral source ID only.

Existing Origin, B1 CSRF/session, developer transport, strict query parsing and private/no-store behavior remain. Both new tables use FORCE RLS with an organization ceiling. The nine exact functions use the existing owner and `search_path=pg_catalog`; four private helpers have no runtime EXECUTE. Runtime roles have no direct table privileges.

Isolated outcome/recovery components exist and pass focused checks, but **are not wired into either active screen**. Metadata recovery stores only source ticket ID, request UUID and claim kind. It does not persist description or photos and does not automatically resend a mutation. No actual new Web flow or screenshot is claimed.

## Commands and results

Environment: Windows, isolated official Node24.21.0, npm11.19.0, local synthetic Docker PostgreSQL18.6. Tests use independently provisioned fixture databases; existing development server, shared build and concurrent UI/browser tests were not restarted or overwritten. Logs remain in the private task evidence directory; raw settings, identities and request content are not public artifacts.

| Command / scope | Exit and observed count |
| --- | --- |
| `npm run test:postgres -- tests/postgres/core-ticket-outcome.test.ts tests/postgres/core-ticket-communication.test.ts tests/postgres/core-flow.test.ts` | 0;43 tests/3 files |
| `npm run test:postgres` | 0;377 tests/35 files;467.57s |
| `npm run test:shared` (final backend/client tests) | 0;447 tests/40 files |
| Web outcome HTTP, existing B1 guard, isolated recovery and summary tests | 0;15 tests/4 files |
| `tsc -p tsconfig.packages.json --noEmit` | 0 |
| `npm run typecheck:tests` | 0 |
| `tsc -p apps/web/tsconfig.json --noEmit --incremental false` | 0; no shared incremental cache write |
| focused ESLint on six owned Web files | 0;0 errors/warnings |
| `npm run check:deps` | 0; installed dependency graph unchanged |
| `git diff --check` | 0; pre-existing mixed-log CRLF notices retained |

This is workspace evidence, not a final immutable candidate. Full Web/Mobile/build/verify/browser checks, actual owned-server restart, screenshots and exact-head9CI are **NOT_RUN_THIS_SLICE** pending integration. Earlier5032e9b results remain historical only.

Initial failures are retained: HTTP behavioral RED4 and PostgreSQL table RED1; additive catalog inventory mismatch in the first combined regression (41 pass/1 fail), corrected by extending exact lists without deleting old controls; PostgreSQL test-helper UUID type inference; client return-type RED5 corrected by explicit DTO generics; synthetic B1 fixture incorrectly used a3300-second transport lifetime, corrected to the existing exact3600-second contract; two new HTTP test typing errors and isolated component effect lint failure, corrected without changing frozen guards or weakening expectations. A private scan-setup helper attempted unavailable runtime environment access; the unintended read-only historical scan was cancelled and the isolated-index setup was corrected. Re-execution followed concrete fixes; no skip, timeout increase, warning suppression or success-only reporting.

## Acceptance evidence map

`DB` below means [the new PostgreSQL suite](../tests/postgres/core-ticket-outcome.test.ts). `HTTP` means [the new handler suite](../apps/web/src/server/core-flow/ticket-outcome.test.ts). These are self-checks, not an independent review or actual browser evidence.

| AC | Backend evidence and remaining runtime status |
| --- | --- |
| 01 | DB RESOLVED/manager read/source hash PASS; actual outcome card NOT_VERIFIED |
| 02 | DB same request returns one assertion/same result PASS |
| 03 | DB observed source-lock exact concurrent replay PASS |
| 04 | DB OPEN/IN_PROGRESS deny both mutations PASS |
| 05 | DB + HTTP admin/staff writes denied PASS |
| 06 | DB co-occupant, other tenant and replacement denial PASS |
| 07 | DB other-organization source nondisclosure PASS |
| 08 | DB staff assignment removal denies outcome and relation reads PASS |
| 09 | DB UNRESOLVED target/CREATED/assertion/relation and forced rollback PASS |
| 10 | DB RECURRENCE_CLAIM atomic path PASS; actual claim wording NOT_VERIFIED |
| 11 | DB rich source with old answer/photo/Q&A/note yields fresh target/default work PASS |
| 12 | DB new target photo belongs only to target PASS; actual upload UI NOT_VERIFIED |
| 13 | DB seven source-table fingerprint sets unchanged PASS |
| 14 | DB second direct follow-up denied/no second target PASS |
| 15 | DB same follow-up request returns same target PASS |
| 16 | DB same key changed text/issue/kind/source denied PASS |
| 17 | DB observed lock races, one target maximum and no orphan PASS |
| 18 | DB historical RESOLVED retained then recurrence/latest projection PASS |
| 19 | DB RESOLVED then UNRESOLVED denied PASS |
| 20 | DB follow-up then RESOLVED denied PASS |
| 21 | DB forged location/target/content denied, relation constraints and RLS PASS |
| 22 | DB subsequent transaction readback PASS; browser refresh NOT_VERIFIED |
| 23 | Owned-server restart NOT_RUN; later transaction read is not restart proof |
| 24 | DB actual occupancy turnover and lock-wait authority recheck PASS; actual Web NOT_VERIFIED |
| 25 | DB/strict contract neutral source context and current source/target authorization PASS; navigation UI NOT_VERIFIED |
| 26 | Full PostgreSQL Q&A/completion guard regression PASS; old browser suite NOT_RUN_THIS_SLICE |
| 27 | Full PostgreSQL work queue regression PASS; old browser suite NOT_RUN_THIS_SLICE |
| 28 | Full PostgreSQL photo regression PASS; old browser suite NOT_RUN_THIS_SLICE |
| 29 | Full PostgreSQL handling regression PASS; old browser suite NOT_RUN_THIS_SLICE |
| 30 | Shared/DB normal protocol and safety intake PASS; actual browser protocol NOT_VERIFIED |
| 31 | Actual390px NOT_RUN |
| 32 | DB saved replay, typed-client no retry and metadata-only helper PASS; actual response-loss UX NOT_VERIFIED |
| 33 | HTTP exact Origin/B1 CSRF, session expiry, strict inputs,201/200 and private projection PASS |
| 34 | Final public candidate/history scan NOT_VERIFIED until candidate fixation; bounded phase scan recorded separately |

Concurrency tests observe backend PIDs and actual PostgreSQL lock waits in controlled READ COMMITTED transactions. Cases cover same/different resolved keys, same/different follow-up keys, both resolved/follow-up orders, resolved-before-recurrence, a shared request across two sources, and revocation while waiting. Rollback tests fail final relation insertion and abort the outer port operation; no target or receipt survives either failure.

## Remaining integration boundary

The operator explicitly confirmed the UI writer is active. Preserve its committed and subsequent local work. After an actual handoff, reread both screens and integrate only bounded outcome/fresh-intake/recovery controls, including session/organization/logout cleanup. Then execute synthetic browser flows, source/target navigation, response-loss recovery, turnover, owned restart,390px and prior browser regressions. Freeze the final candidate, scan public code and reachable history, normally push/update Draft PR70 and verify all nine exact-head hosted jobs. A presentation commit alone does not authorize overwriting an active writer.

Existing3130 runtime remains its prior build; these new controls are not available there. No fresh launch claim is made. AC-D06 NOT_VERIFIED, historical B5 Mobile/AC18 PARTIAL, existing desktop verdict, actual-manager Auth0 constraint and Expo/native/device/APK NOT_RUN remain unchanged. Ready/merge/deploy: NOT_PERFORMED.

CHECKPOINT | Completion follow-up backend verified; UI handoff pending | evidence=0017 + PostgreSQL377/35 + shared447/40 + HTTP/helper15/4 | tokens=unknown
