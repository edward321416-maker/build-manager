# AI draft rules moved into the application package (PR 2a of the AI draft slice), acceptance

Snapshot: **2026-10-16 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN** once CI passes on the final head. This PR is refactor-only (DEV-02). No behaviour changes: not in the model evaluation, the product, the API, the database or the demo.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk. It moves the AI prompt and the banned-phrase checks (DEV-01; when unsure, high-risk), but does not change them |
| Operator decision | 2026-10-16, in session: "권장안으로 ㄱㄱ", given after the recommendation to plan PR 2 next. The split of PR 2 into 2a, 2b and 2c follows DEV-02 (one purpose per PR; refactoring separate from behaviour change) |
| Spec and plan | [Spec](../docs/superpowers/specs/2026-10-15-ai-draft-ollama-design.md) §5.1–5.3 and §12; [plan](../docs/superpowers/plans/2026-10-16-ai-draft-rules.md) |
| Evaluated setup | [PR 1 acceptance](ai_draft_eval_20261015_acceptance.md): gemma4:12b, prompt v2 `PROMPT_ID` `e1ec30f5f238` |
| Policy | `POLICY_REF` main `5972770`; rules unchanged since `7969f4c` |
| Base | main `5972770` |
| Independent review | See the PR body |

## Change

`packages/application/src/ai-draft/rules.ts` is new and holds the evaluated rules:
- the prompt;
- the user-message template, with its data-block neutralising and one-line unit label;
- the structured-output schema;
- the request body and options;
- the field check, including the not-a-repair limits;
- the banned-phrase checks per audience;
- the loopback check.

The prompt and the regular expressions were copied character for character. The file has no imports and uses only erasable TypeScript, so `scripts/ai-draft-eval.mjs` loads it with plain Node 24.

`packages/application/src/index.ts` re-exports it as `AI_DRAFT_*`, `buildAiDraftMessages`, `aiDraftRequestBody`, `checkAiDraft`, `aiDraftBannedPhrases`, `aiDraftOutwardBannedPhrases` and `assertAiDraftLoopback`.

`scripts/ai-draft-eval.mjs` imports these and re-exports them under its old names. It keeps only `PROMPT_ID`, the scoring code and the command-line runner.

`tests/architecture/ai-draft-eval.test.ts` keeps its 47 tests unchanged and adds 4:
- the script's exports and the application package's exports are the same objects (`toBe` on the schema and on the check);
- the request body keys stay in the evaluated order;
- the frozen exports are read-only in their types: a write fails `npm run typecheck:tests`;
- the rules file has no imports and no non-erasable syntax.

The final review asked for one change to `rules.ts` that is type-only: the frozen exports are typed as deeply read-only, and `aiDraftRequestBody` declares its return type `AiDraftRequestBody`. Nothing changes at run time. The re-score after this change is still identical.

Unchanged: the case files, `scripts/ai-draft-eval.d.mts`, product code paths, dependencies and the lock file.

## Evidence that nothing changed

| Check | Result |
| --- | --- |
| Prompt and regex lines, plan text against `scripts/ai-draft-eval.mjs` at `5972770` | Identical (checked by script before dispatch; the implementer compared again line by line) |
| `PROMPT_ID`, user-message template and request-body pins in the existing tests | Pass unchanged (`e1ec30f5f238`) |
| Offline re-score of every saved model run with the moved code (runs 2, 3 and 4, main and held-out sets) | Output identical, byte for byte, to the pre-move output |

## Verification

See the PR body for the commands, their results and the final head's CI.

## Remaining risks

- Local Node is 24.14.0 and CI uses 24.21.0. CI's command-line tests confirm that the `.ts` file loads under the pinned version.
- The behaviour changes deferred from PR 1 belong to PR 2b and 2c, as the plan says:
  - wider banned phrases;
  - more safety cases;
  - `num_ctx`;
  - the connector, the drafts table and the server function.
