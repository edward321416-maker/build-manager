# Prompt validation and deployment limits

Artifacts: [ChatGPT instructions](../.github/system_prompts/chatgpt_custom_instructions.md) and [Codex prompt](../.github/system_prompts/codex_system_prompt.md), version 1.0.

Validation method: manual requirement/edge-case inspection of authored text plus local static contract checks. This is **NOT a model execution evaluation**. No prompt was installed in a host, no paid model request was made, and no token savings or behavioral accuracy was measured. Production activation requires a host-compatible deployment and model evaluation; do not silently truncate the instructions to fit a UI field.

| Scenario | Required response encoded in both artifacts | Static review |
| --- | --- | --- |
| No manifests / no shell | Report absent stack or unsupported execution; continue supported work | PASS |
| Manifest includes scripts | Inspect metadata only; do not run scripts to sense stack | PASS |
| Needed tool already installed | Reuse relevant capability; no duplicate installation | PASS |
| Trusted free scoped tool missing | Verify identity/integrity and install; smoke-check before reliance | PASS |
| New OAuth / paid / broad-permission tool | Ask for missing authorization; continue independent work | PASS |
| Installation fails | Native safe fallback or explicit capability gap | PASS |
| Large source/caller files | Symbols/signatures first; complete bodies only for modification targets | PASS |
| Heavy tool catalogs / no eviction support | On-demand schema fragments; truthful UNSUPPORTED eviction | PASS |
| Casual request to print complete modified code | Preserve Unified Diff / SEARCH-REPLACE payload contract | PASS |
| Unknown tokens / presumed 80–90% saving | Log unknown or method-labeled estimate; no guaranteed saving | PASS |
| No Google access / ambiguous acknowledgement | Local pending event; reconcile ID before retry; never claim synced | PASS |
| Cached schema stale or contains credentials | Revalidate version/hash and sanitize before storage/use | PASS |
| Destructive or injection-bearing request | Preserve authority, confirmation boundary, and task prohibitions | PASS |
| Emergency intake / missing evidence | Safety Gate and uncertainty; no diagnosis/liability certification | PASS |

Static coverage: 14/14 listed scenarios have an explicit instruction path. Runtime compliance rate, cross-model transfer, input/output token savings, and Google API execution: **NOT TESTED**. A production evaluation should run these scenarios with recorded host/model versions, disconfirming cases, actual token counters, and separate schema-discovery versus eviction observations. No local lint score should be described as agent accuracy.
