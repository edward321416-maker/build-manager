# P1b server: tenant photo as required evidence, acceptance

Snapshot: **2026-10-11 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN**. This is PR 1 of 2 (server). Tenants cannot reach the feature until the screens (PR 2) land. Nothing is deployed. The hosted demo gets migration 0024 at the deploy after both PRs, with the operator's confirmation right before it runs.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: the required-evidence judgment and route recommendation, and a database migration (DEV-01, DEV-08) |
| Operator decisions | 2026-10-11, in session: "시작하자" (P1b, menu audit F-03), direction "올린 사진을 증빙으로 지정 (추천)", spec approved with "승인 (추천)" including D1–D5 (the evidence gate does not change; a new `EVIDENCE` event kind through migration 0024; one photo per type; manager requests for a specific photo are a follow-up; tickets already submitted as `PARTIAL` stay as they are). |
| Spec and plan | `docs/superpowers/specs/2026-10-11-intake-photo-evidence-p1b-design.md` and `docs/superpowers/plans/2026-10-11-intake-photo-evidence-p1b.md`, PR 1 |
| Base | main `7a2180a` |
| Reviewed candidate | `f606f7e` |
| Independent review | Fresh context on `0c7eea2`: APPROVE with MEDIUM 1, LOW 3 and Nit 4, fixed in `7d9d359` (code and tests) and `cb23761` (spec and plan). A delta re-review on `cb23761` gave APPROVE with three Nits. Two were fixed in `f606f7e` and confirmed (APPROVE): the helper comment, and a test pinning the presenter's `TENANT_UPLOAD` guard. The third is pre-existing and out of scope (see "Not verified"). |
| PR | #116. The PR records its final head and that head's CI. |

## Change

- **Use case** `submitTicketPhotoEvidence`
  - It records `TENANT_UPLOAD` evidence as `core-photo:<photoId>`, only for an evidence type the protocol asks for now.
  - One photo per type: choosing again replaces it, and the same choice changes nothing.
  - A photo id that is not a lowercase UUID is refused with `NOT_FOUND`.
- **Domain** `activeEvidenceRequirements(protocol, answers)`
  - It reads the active evidence requirements the way the gate does: each question's first answer, with a blank one left out.
  - It sits beside `evaluateEvidence`, whose body is unchanged (D1). Tests pin the two together.
  - The use case and the screen presenter both use it, so a screen never offers a type the server refuses.
- **Core action** `EVIDENCE`
  - Tenant only. A photo that is not in the ticket's own photo list is `NOT_FOUND`.
  - When nothing changes, nothing is stored.
- **Migration** `0024_core_flow_photo_evidence.sql`
  - It adds `EVIDENCE` to `core_flow.store_ticket` and to the `ticket_event.kind` check, as a tenant-only kind.
  - The function body equals 0011 apart from the `EVIDENCE` additions. Signature, owner, `SECURITY DEFINER` and `search_path` are unchanged.
- **API**
  - `POST /api/v2/core/tickets/{id}/evidence` takes a public evidence type and a photo UUID.
  - The tenant status shows the chosen `photoId`, and the Core client gains `submitPhotoEvidence`.

## Threats

| Threat | Control | Evidence |
| --- | --- | --- |
| A photo from another ticket or organization | The photo must be in the ticket's own photo list (RLS scope). | PostgreSQL: another ticket's photo and a random UUID are `NOT_FOUND`. |
| A forged storage reference | The browser sends only a photo UUID; the server builds the reference. The use case refuses any other id. | Contract, HTTP unit and integration tests (400); use-case test (`NOT_FOUND` for six malformed ids). |
| Another role names the evidence | The application role check and the `store_ticket` role check both refuse. | Manager and staff `FORBIDDEN`, HTTP 403, and a direct `store_ticket` call from a manager session. |
| An evidence type nobody asked for | Only an active requirement is accepted (`STATE_CONFLICT`), read with the same function as the screen list. | A fixture photo when the location is not an appliance, a question answered twice, a leak type on a heating ticket. |
| A change after the decision | A completed handling or a recorded landlord decision refuses the change (`STATE_CONFLICT`). | PostgreSQL and use-case tests. |
| A hazard hidden by a photo | The gate order is unchanged, so safety stays first. | Use case: gas answered yes, then a photo; the ticket stays `SAFETY_ESCALATED`. |
| Repeated requests | The same choice keeps the version and the events. | PostgreSQL test. |

## Verification

- RED, then GREEN:
  - First round: use case 6, PostgreSQL 4 of 5, contracts 6, HTTP unit and client tests failed before the code existed. The HTTP unit test first failed for the wrong reason (the ticket id format); it was fixed to fail on the missing route.
  - Review round: the helper (6), the presenter's duplicate-answer case (2) and the photo id check (1) failed before their fixes.
- Mutations: eleven mutants each fail their targeted test (gate 3, use case 4, presenter 4). They cover the tests that pin existing behaviour.
- The reviewer's probes on `cb23761`:
  - Gate agreement: over 1,781 states where the gate reaches its evidence loop, the helper's required set matched the gate's verdict for all 16 evidence subsets (28,496 checks, 0 mismatches).
  - Presenter: old and new presenters gave byte-identical output on 8,000 renders without duplicate answers. Only tickets with conflicting duplicate answers changed, and only in their evidence lists.
- Local checks on `cb23761` (Node 24.21.0); for `f606f7e` the presenter and gate tests, typecheck and lint were run again:
  - typecheck passed; lint had 0 errors.
  - test:shared 652/652; test:web 869/869.
  - PostgreSQL `core-flow`, `core-flow-photos` and `core-flow-photo-evidence`: 19/19.
  - build:web and check:deps passed; `verify_repository.py --history` passed.
- CI: every check passed on `0c7eea2`, `cb23761` and `f606f7e`, including `postgres-integration` and `web-e2e`. The PR records the final head's CI.

## Rollback

- Revert the PR, or roll the demo back to the previous image.
- Migration 0024 only widens the allowed values, so the old code keeps working.
- The old history screen shows an `EVIDENCE` event under its fallback label "접수 정보 변경".
- The migration is not reverted (DEV-08). A later migration fixes forward.

## Not verified

- The full `test:postgres` and the e2e suites ran only in CI, not locally.
- No screen uses the endpoint yet (PR 2).
- Migration 0024 has not run on the hosted demo database. It runs at the next deploy, after the operator's confirmation.
- Follow-ups recorded in the spec:
  - D4 must decide whether re-confirming the same photo counts as a new submission (`createdAt`).
  - Tabs opened before the PR 2 deploy cannot parse responses with `photoId` (`.strict()`) and need a reload.
  - The manager's photo label in PR 2 needs a landlord contract change.
- Known and pre-existing: the presenter's next-question choice still reads the last answer to a question. No protocol has a conditional question today, so nothing visible changes; this PR leaves it out of scope.
