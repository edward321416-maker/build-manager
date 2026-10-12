# P1b screens: tenant names a stored photo as the required evidence, acceptance

Snapshot: **2026-10-12 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN**. This is PR 2 of 2 (screens). With PR 1 (#116), a tenant can complete a `/core` intake to `READY_FOR_REVIEW` with a recommended route. Nothing is deployed. The hosted demo gets both PRs, and migration 0024, at a deploy the operator confirms right before it runs.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: the tenant flow of the required-evidence judgment and a public API contract change (DEV-01) |
| Operator decisions | 2026-10-11: the spec with D1–D5 ("승인 (추천)"); D6 "글자 버튼으로 남기기 (추천)", which keeps "사진 없이 제출하기" as a text button on the evidence step |
| Spec and plan | `docs/superpowers/specs/2026-10-11-intake-photo-evidence-p1b-design.md` and `docs/superpowers/plans/2026-10-11-intake-photo-evidence-p1b.md`, PR 2 (U0–U3) |
| Base | main `a3cb9fe` (PR 1 merged) |
| Reviewed candidate | `1fd9864` |
| Independent review | Fresh context on `3ee7412`: REQUEST CHANGES with HIGH 1, MEDIUM 2, LOW 5 and Nit 3, all fixed in `782687e`. The main issue was that naming a photo on a sent request reopened it and read as a manager's more-info request. A delta re-review on `782687e` gave APPROVE with one LOW (a one-round-trip window after "사진 없이 제출하기") and two Nits. They were fixed in `1fd9864` and confirmed (APPROVE). |
| PR | #117. The PR records its final head and that head's CI. |

## Change

- **Contract and presenter**
  - Each requirement may carry the protocol's `instruction`; the presenter fills it.
  - The landlord detail carries `submittedEvidence` with `photoId`, from the same presenter helper as the tenant status. It is optional in the schema so older fixtures stay valid; the server always sends it.
- **Evidence step** (`PhotoEvidenceStep`, before the request is first sent)
  - One step per outstanding requirement: the per-type prompt (one name list for both roles), the instruction, and the stored photos as radio tiles.
  - The primary button "이 사진으로 정하기" is disabled until a photo is picked and says why.
  - "사진 추가하기" uploads in place and picks the new photo.
    - A connection or unknown failure offers "다시 올리기". The retry reuses the upload id after checking whether the photo was stored.
    - Size, format and limit failures say so in 해요체, and a 409 reloads the photo list. It stops at three photos.
  - "사진 없이 제출하기" (D6) submits as `PARTIAL`.
  - A new step takes focus on its heading when the control that led there is gone.
  - Naming a photo re-reads the summary, so the photo list and the history show it before sending. Photos added in the step reload only the photo list.
- **Sent requests** (D5, from the independent review)
  - A request already sent without its photos stays as sent. Its collapsed follow-up only says "필요한 사진 없이 보냈어요. 관리자가 확인한 뒤 다시 물어볼 수 있어요."
  - `evidenceStage()` decides from the intake's own ticket (a repair packet exists once the request is sent) and the screen's events. So the step never reopens after "사진 없이 제출하기".
  - A sent request reopened another way (for example through the API) keeps the intake's own "수리 요청 제출" instead of a dead end.
- `TicketIntake` takes the step as a render prop, so the shared tenant component holds no Core client code.
- **Labels and copy**: named photos show their evidence name for both roles, the history reads `EVIDENCE` as "증빙 사진 지정", and the photo help, to-do and draft messages mention the photo step.
- **Design audit**: `scripts/design-audit.mjs` checks the evidence step at every width as `tenant-evidence`.

## Threats

| Threat | Control | Evidence |
| --- | --- | --- |
| A forged storage reference or another ticket's photo | The screen sends only the photo UUID of a stored photo of this ticket; the server builds and checks the reference (PR 1). | PR 1 tests; this PR's client path |
| A sent request reopened by naming a photo, which would read as a manager's more-info request and withdraw the request | No photo step on a sent request, decided at once from the intake's own ticket. A request reopened another way can be submitted again. | `evidenceStage` unit tests; e2e for a sent request and for a reopened two-photo request |
| A photo stored twice after a lost response | A retry reuses the upload id and checks the stored photos first. | Component test |
| A tenant picks any photo because none fits | "사진 없이 제출하기" (D6) | e2e |
| A hazard hidden behind the photo step | The safety stage still comes first (`intakeStage` unchanged). | Existing tests |

## Verification

- RED, then GREEN:
  - First round: contracts 2, presenter 2 and the step's 11 component tests failed before their code.
  - Review rounds: the step's new tests (5, then 1), the accessibility test the first e2e prompted, and the `evidenceStage` tests failed before their fixes.
- Mutations: five mutants of the step are each caught by their targeted test. They remove the busy lock from the primary and from the radios, remove the focus move, force focus, and offer a retry for every failure.
- e2e `photo-evidence.spec.ts` (4) and `usability.spec.ts` (5): 9/9 on the final code.
  - Coverage includes 390px with 200% root text, the photo name and history before sending, a sent request staying as sent, and a reopened two-photo request.
  - In the first round, a 30 s timeout right after a Next build passed on rerun (DEV-06).
- Design audit: 121 screens, 0 findings, including `tenant-evidence`. Earlier runs found the text button's border (removed); the 200% caption wrap was found in the e2e screenshot and fixed.
- Local checks:
  - typecheck passed; lint had 0 errors and one more `no-img-element` warning.
  - test:web 891/891.
  - test:shared 651/654 at `3ee7412`; three 5 s graph timeouts under host load passed on rerun (30/30).
  - PostgreSQL Core files 19/19; build passed; `verify_repository.py --history` passed.
- CI: every check passed on `3ee7412`, `782687e` and `1fd9864`, including `postgres-integration` and `web-e2e`. `web-e2e` runs the full Core e2e suite: 39 tests at `3ee7412`, including the new photo-evidence spec. The PR records the final head's CI.

## Rollback

- Revert the PR. There is no migration here, and the contract changes are additive optional fields. Without it, `/core` submits without photos as before (`PARTIAL`).

## Not verified

- The full e2e and `test:postgres` suites ran only in CI.
- The mobile app has no evidence step yet.
- The hosted demo deploy (both PRs, migration 0024, first use of `redeploy.sh` and `--write-check`) waits for the operator's confirmation. Tabs opened before it need a reload.
- Known and left for follow-up:
  - Adding photos after sending needs an operator decision on what that state means.
  - The conversation's send button and the step's primary can both be filled blue when the tenant does both at once.
  - D4 (a manager asks for a specific photo) and the presenter's last-answer next question are open.
