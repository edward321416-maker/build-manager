# Canonical research provenance backfill plan v1.3

Status: **OPEN / PROGRAM QA PROVENANCE HOLD**

## Why this exists

The canonical evidence policy assigns source and claim provenance to `research/sources/`. The living Google research document has grown materially beyond the bootstrap registries: the latest audit counted **125 unique external hyperlinks** and **134 visible `[FACT]` markers**, while the repository registries stopped at SRC-007 / CLM-014 before this backfill.

This is a provenance-governance defect, not evidence that the research statements are false. Drive research artifacts preserve many source URLs, locators, paraphrases and limits, especially the S1 Evidence Coding workbook, but those are not a substitute for the repository's designated canonical registry.

## Rules

- Never bulk-mark a source verified merely because it appears in the long-form document.
- Re-open the original source before assigning `verified_source` / `verified_literature`.
- Preserve vendor marketing, official authority, research literature and community anecdotes as different source types.
- A source row does not automatically make every statement derived from it a FACT.
- Keep atomic claims in `claim_registry.csv`; do not create claims solely to inflate coverage.
- Do not fabricate publication dates, exact locators or case identities.
- The legacy 40-case corpus remains partially unrecoverable at case level; cumulative unique count stays NOT CERTIFIED unless provenance is recovered.
- Direct-user, WTP, prevalence, adoption and commercial evidence remain unverified unless their own evidence gates are satisfied.

## Backfill batches

| Batch | Scope | Priority | Completion rule |
| --- | --- | --- | --- |
| 0 | Core methodology sources used by Program Audit / S2-S6 | COMPLETE / MERGED | Original source reopened; SRC and CLM rows added |
| 1 | Official/legal/standards/primary-authority sources | CORE SET COMPLETE / FINAL RECONCILIATION OPEN | Current core authorities are registered; remaining active public/submission FACT coverage is decided by G-PROV-02/06/08 rather than by exhaustive source counting |
| 2 | Vendor/competitor primary documentation | CORE WORKFLOW SET COMPLETE IN PR #57 CANDIDATE | Register vendor-primary workflow/authority evidence with marketing and scope limits; publication still requires the PR publication gate |
| 3 | S1 public behavioral evidence | NEXT AFTER BATCH 2 PUBLICATION | Map active S1 public-case rows to stable source IDs; preserve same-thread/reviewer dependency, geography and self-selection limits |
| 4 | Legacy 40-case proxy corpus | RECOVERY ONLY | Import only provenance that can be independently matched; do not invent missing case registry |

## Batch 0 receipt

Added:
- SRC-008 — generative social simulation validation critical review
- SRC-009 — JASSS ABM validation overview
- SRC-010 — Cambridge synthetic-participant study
- SRC-011 — NN/g heuristic-evaluation theory
- SRC-012 — WebArena
- SRC-013 — BrowserGym
- CLM-015 through CLM-020 — methodology claims grounded in those sources
- CLM-021 — current 20–100-unit / 1–3-building band explicitly registered as an unverified working hypothesis
- CLM-001 submission use narrowed to historical bootstrap framing

Batch 0 reduces the highest-risk methodology provenance gap but **does not close the program-level provenance HIGH**. The hold remains until the current product thesis and externally consequential factual sections have canonical source coverage sufficient for submission/public factual reuse.

## Batch 1 progress — authoritative/legal/safety core

Status: **CORE AUTHORITATIVE SET COMPLETE / FINAL ACTIVE-CONCLUSION RECONCILIATION OPEN**

Independently reverified against current/official primary sources: SRC-014..023 / CLM-022..031 covering current Commercial Act 657/680, current PIPA 15/16/21/29/37, NIST IR 8259A, EPA WaterSense leak/flow monitoring, and NIST AI 600-1.

The living research document's stale Commercial Act historical-version links were replaced with current-law links. Its PIPA/GOV.UK source-link region was repaired after audit found cross-paragraph hyperlink-range drift; source labels now map to the intended current sources.

Batch 1 is not exhaustive for every official/standards source. NFPC/KGS/CPSC/DOE/LBNL/ISO/CSA and insurance-specific authorities remain later authoritative backfill items. The program-level provenance hold remains open.

## Batch 2 progress — competitor/vendor primary sources

Status: **CORE WORKFLOW COMPARATORS COMPLETE IN THIS CANDIDATE**

Registered SRC-024..029 and CLM-032..037 for Property Meld, AppFolio, Buildium and Latchel. The competitor index is updated from bootstrap TO VERIFY-only status to a partial-verification model that records documented workflow/authority capabilities while explicitly excluding vendor efficacy, adoption, pricing and superiority claims from independent evidence.

The current **Coordination Core workflow/authority-boundary comparator set** is covered in this candidate. This does not claim that all competitor, pricing, packaging or commercial facts in the living research document are canonicalized. Optional/legacy competitor leads remain TO VERIFY and are not used for feature-absence, superiority, pricing, adoption or demand claims.


## Frozen provenance closure gate — G-PROV-01..08

This gate was frozen before Batch 3 completion so HOLD release cannot be declared from registry growth or post-hoc judgment.

| Gate | Requirement | Current status after this candidate |
| --- | --- | --- |
| G-PROV-01 | Batch 0 methodology sources used for S2-S6 boundaries have stable SRC IDs and consequential atomic CLM rows with scope/limitations. Working ICP remains a HYPOTHESIS. | PASS |
| G-PROV-02 | Every active external FACT constraining current privacy/legal/safety/IoT/AI-governance conclusions and intended for public/submission reuse maps to a current primary/official SRC + CLM, or is explicitly downgraded/excluded. | OPEN — final active-conclusion reconciliation required |
| G-PROV-03 | Every competitor/vendor FACT used for current Coordination Core differentiation/boundary maps to vendor-primary SRC + CLM and preserves vendor-evidence limits. Legacy competitors may remain TO VERIFY only when not used for absence/superiority/pricing/adoption claims. | CANDIDATE PASS — becomes canonical only after this Batch 2 PR merges |
| G-PROV-04 | Every active S1 public-case row has a stable canonical source_id; every distinct active source URL has a canonical SRC. Unmatched rows are EXCLUDED_FROM_CANONICAL_EVIDENCE or TO_VERIFY. | NOT RUN — Batch 3 |
| G-PROV-05 | Batch 3 preserves same-thread/page and known same-speaker/reviewer dependencies; mapped-row/source counts are never relabeled independent participants/events; geography, self-selection, vendor-review and source-cluster limits remain visible. | NOT RUN — Batch 3 |
| G-PROV-06 | claim_registry contains atomic entries for externally consequential current-thesis facts carried into synthesis: external behavioral workflow boundary/counterconditions where supported, competitor non-uniqueness/boundaries, and current legal/safety/privacy constraints. Product DECISION/HYPOTHESIS and synthetic outputs are not padded into external FACT claims. | OPEN — final thesis-coverage audit after Batch 3 |
| G-PROV-07 | Legacy 40-case proxy corpus may remain historical hypothesis-generation context when unrecoverable rows are excluded from canonical factual evidence; cumulative unique count remains NOT CERTIFIED. | PASS — policy frozen |
| G-PROV-08 | Final mechanical reconciliation proves no active canonical S1 row lacks source_id; no CLM references a missing SRC; every FACT CLM has locator + verification; no public current-thesis FACT depends only on an unbackfilled long-form link; vendor/current-law/dependency limits are preserved. | NOT RUN — final closure audit |

**HOLD release rule:** CANONICAL_PROVENANCE moves from HOLD to PASS only when G-PROV-01 through G-PROV-08 are each PASS. Any OPEN / UNKNOWN / FAIL keeps the HOLD open. Batch completion or registry row count alone is insufficient.

**Sequence after this candidate:** merge/reconcile Batch 2 → execute Batch 3 S1 row-level mapping and dependency preservation → run G-PROV-02/06/08 final reconciliation → release or retain HOLD. This does not rerun S1-S6 and does not authorize recruitment, S6 execution, implementation, real tenant data, or production hosting.
