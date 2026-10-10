# Claude entry point — build-manager

Before substantive project work, read [AGENTS.md](AGENTS.md), [AI delivery rules](governance/ai_delivery_rules.md), and [project policy](governance/project_policy.md). The delivery rulebook is canonical on `main`; record its commit as `POLICY_REF` and keep the selected implementation commit as a separate `TARGET_REF`. Before design, development, research or reference work, read the whole matching rulebook; the project hook blocks covered edits, web lookups and package additions until it was read in the session.

| Work | Rulebook |
| --- | --- |
| User-facing screens, styles, layout, images or copy (Web, Mobile, landing page) | [Design rules](design/DESIGN_RULES.md) |
| Code, configuration, tests, scripts, deployment, `docs/`, adding packages | [Development rules](development/DEVELOPMENT_RULES.md) |
| Research and evidence in `research/`, `submission/` or `product/` | [Research rules](research/RESEARCH_RULES.md) |
| Looking up or using external material: services, designs, code, libraries, documents, data, AI output | [Reference rules](references/REFERENCE_RULES.md) |

Perform the pre-delivery self-review without asking the user to request it again. Interview only for unresolved consequential decisions; do not re-ask approved choices. Preserve FROZEN scope and use delta regression after corrections.

A pinned worktree must not be merged, rebased, reset, or otherwise changed merely to read a newer rule. Read the policy revision without moving the implementation branch. Respect the current task's exact authorization, stop conditions, and host permissions.

This file is a reading entry point, not an installed runtime hook or proof of automatic compliance. Do not claim a rule was read without a read receipt, or a test ran without execution evidence.
