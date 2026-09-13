# Contributing

Read [project policy](governance/project_policy.md) and [research rules](research/README.md) before adding evidence. This is a public research and product-definition workspace, not a place for participant records.

1. Search all open and closed issues for the same deliverable before creating one.
2. Link the issue and use a focused branch or direct `main` commit as appropriate. PR review is optional; no approval or CODEOWNER approval is required.
3. Keep canonical definitions in their owning documents and link to them. Label unsupported statements `[HYPOTHESIS]` or `[TO VERIFY]`.
4. Review the exact files to publish; check permissions for quoted or external material. Never add `.env`, secrets, raw interviews, contracts, addresses, or contact details.
5. Run `python scripts/verify_repository.py`, inspect `git diff --check` and the staged diff, then create a small Conventional Commit.
6. Push only within operator authorization. Record observed results and remaining risks. CI is advisory and does not impose review requirements.

Suggested commit types: `chore`, `docs`, `research`, `feat`, `fix`, `test`. Do not rewrite shared history. Resolve conflicts by preserving intent and documenting decisions.

Public users can read and propose contributions; public visibility does not grant Write access. Only explicitly authorized accounts with Write (or greater) can push/merge. A collaborator username is still pending.
