# Project operating policy

Authority: the operator's 2026-09-13 implementation instruction and supplied agent preferences. The separately referenced full attachment was not available during bootstrap; no claim of reading it is made. Reconcile it when provided, preserving current work.

## Document ownership

| Concern | Canonical location |
| --- | --- |
| Purpose and customer segment | [Project Charter](../PROJECT_CHARTER.md) |
| Current readiness and blockers | [Status](../STATUS.md) |
| Product behavior | `product/` |
| Evidence classification and raw handling | [Research rules](../research/README.md) |
| Claims and source provenance | `research/sources/` |
| Submission draft / final gate | `submission/2026-modu-startup-2/` |
| AI execution / external sync | `ops/` |

Avoid duplicate canonical documents. Link to an owner instead of copying evolving definitions. Drafts may restate approved product definitions but must not invent evidence.

## Collaboration decision

Repository name: `build-manager`; visibility: Public; default branch: `main`. Enable squash and merge commits; rebase is optional. Required approving reviews: 0; mandatory CODEOWNER review: off; PR before merge: off. Prefer no branch restrictions during bootstrap. Do not remove unrelated existing protections without reviewing their impact. A Write collaborator may merge without additional review approval; the general public does not receive Write access. Invitation remains PENDING until a username is supplied.

## Public release gate

Publish only original project docs/code or material whose redistribution rights were checked. Keep raw recordings, transcripts, contracts, contact details, personal/unit addresses, media metadata, secrets, and API credentials outside Git. A `.gitignore` rule is not proof of safety: inspect the candidate Git tree and staged content. Use anonymous aggregate summaries, not reversible pseudonyms plus identifying details. Public commits are difficult to retract; do not publish first and clean later.

No repository deletion, force push, history rewriting, raw-data overwrite, credential extraction, IAM changes, or paid service registration is authorized. Preserve existing user files. Destructive commands require explicit confirmation and cannot be used to bypass this task's prohibitions.

## Evidence and completion

Separate FACT, HYPOTHESIS, ASSUMPTION, DECISION, and TO VERIFY. Verify links and factual sources; do not infer execution from configuration. Report NOT TESTED, OPEN RISK, or PENDING where warranted. Submission finalization requires the documented final gate and human confirmation of the intended submission artifact.
