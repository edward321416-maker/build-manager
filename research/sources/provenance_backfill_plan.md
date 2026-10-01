# Canonical research provenance backfill plan v1.3

Status: **PASS / PROGRAM QA PROVENANCE HOLD RELEASED FOR CURRENT-THESIS FACTUAL REUSE BOUNDARY**

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
| 1 | Official/legal/standards/primary-authority sources | CORE SET COMPLETE / CLOSURE RECONCILED | Current core authorities used by the active thesis are registered; unregistered historical facts remain excluded from canonical public/submission reuse |
| 2 | Vendor/competitor primary documentation | COMPLETE / MERGED PR #57 | Vendor-primary workflow/authority evidence is canonical with marketing and scope limits preserved |
| 3 | S1 public behavioral evidence | COMPLETE / MERGED PR #60 | 76/76 active rows mapped to 52 public URLs; dependencies preserved; only directly reverified sources promoted beyond TO_VERIFY |
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

Status: **CORE AUTHORITATIVE SET COMPLETE / CLOSURE RECONCILED**

Independently reverified against current/official primary sources: SRC-014..023 / CLM-022..031 covering current Commercial Act 657/680, current PIPA 15/16/21/29/37, NIST IR 8259A, EPA WaterSense leak/flow monitoring, and NIST AI 600-1.

The living research document's stale Commercial Act historical-version links were replaced with current-law links. Its PIPA/GOV.UK source-link region was repaired after audit found cross-paragraph hyperlink-range drift; source labels now map to the intended current sources.

Batch 1 is not exhaustive for every official/standards source. NFPC/KGS/CPSC/DOE/LBNL/ISO/CSA and insurance-specific authorities remain later authoritative backfill items. The program-level provenance hold remains open.

## Batch 2 progress — competitor/vendor primary sources

Status: **COMPLETE / CANONICAL PR #57**

Registered SRC-024..029 and CLM-032..037 for Property Meld, AppFolio, Buildium and Latchel. The competitor index is updated from bootstrap TO VERIFY-only status to a partial-verification model that records documented workflow/authority capabilities while explicitly excluding vendor efficacy, adoption, pricing and superiority claims from independent evidence.

The current **Coordination Core workflow/authority-boundary comparator set** is covered in this candidate. This does not claim that all competitor, pricing, packaging or commercial facts in the living research document are canonicalized. Optional/legacy competitor leads remain TO VERIFY and are not used for feature-absence, superiority, pricing, adoption or demand claims.


## Frozen provenance closure gate — G-PROV-01..08

This gate was frozen before Batch 3 completion so HOLD release cannot be declared from registry growth or post-hoc judgment.

| Gate | Requirement | Current status after this candidate |
| --- | --- | --- |
| G-PROV-01 | Batch 0 methodology sources used for S2-S6 boundaries have stable SRC IDs and consequential atomic CLM rows with scope/limitations. Working ICP remains a HYPOTHESIS. | PASS |
| G-PROV-02 | Every active external FACT constraining current privacy/legal/safety/IoT/AI-governance conclusions and intended for public/submission reuse maps to a current primary/official SRC + CLM, or is explicitly downgraded/excluded. | PASS — current registered constraints are CLM-022..031; unregistered historical NFPC/KGS/CPSC/DOE/LBNL/ISO/CSA/insurance-specific facts remain historical/internal and are excluded from canonical public/submission FACT reuse unless separately backfilled |
| G-PROV-03 | Every competitor/vendor FACT used for current Coordination Core differentiation/boundary maps to vendor-primary SRC + CLM and preserves vendor-evidence limits. Legacy competitors may remain TO VERIFY only when not used for absence/superiority/pricing/adoption claims. | PASS — Batch 2 merged as PR #57 / main 09b5689b104c27c831cae5ff593a4fb916d8c0d3 with fresh push CI 9/9 SUCCESS |
| G-PROV-04 | Every active S1 public-case row has a stable canonical source_id; every distinct active source URL has a canonical SRC. Unmatched rows are EXCLUDED_FROM_CANONICAL_EVIDENCE or TO_VERIFY. | PASS — PR #60 merged; 76/76 rows mapped and 52/52 distinct public URLs registered; unreverified rows remain TO_VERIFY_MAPPED_NOT_CANONICAL |
| G-PROV-05 | Batch 3 preserves same-thread/page and known same-speaker/reviewer dependencies; mapped-row/source counts are never relabeled independent participants/events; geography, self-selection, vendor-review and source-cluster limits remain visible. | PASS — 10 shared-URL clusters and all 3 declared same-speaker/reviewer dependencies are preserved; row counts remain non-independent evidence units |
| G-PROV-06 | claim_registry contains atomic entries for externally consequential current-thesis facts carried into synthesis: external behavioral workflow boundary/counterconditions where supported, competitor non-uniqueness/boundaries, and current legal/safety/privacy constraints. Product DECISION/HYPOTHESIS and synthetic outputs are not padded into external FACT claims. | PASS — current factual support is bounded in CLM-022..036 and CLM-038..048; CLM-037 remains a DECISION and product/WTP/market-boundary hypotheses remain non-FACT |
| G-PROV-07 | Legacy 40-case proxy corpus may remain historical hypothesis-generation context when unrecoverable rows are excluded from canonical factual evidence; cumulative unique count remains NOT CERTIFIED. | PASS — policy frozen |
| G-PROV-08 | Final mechanical reconciliation proves no active canonical S1 row lacks source_id; no CLM references a missing SRC; every FACT CLM has locator + verification; no public current-thesis FACT depends only on an unbackfilled long-form link; vendor/current-law/dependency limits are preserved. | PASS — final fixed-candidate reconciliation: S1 map 76/76; SRC 90 / CLM 48; duplicate SRC/CLM IDs 0; missing CLM→SRC refs 0; FACT locator/verification gaps 0; FACT claims backed only by TO_VERIFY-mapped sources 0 |

**HOLD release rule:** CANONICAL_PROVENANCE moves from HOLD to PASS only when G-PROV-01 through G-PROV-08 are each PASS. Any OPEN / UNKNOWN / FAIL keeps the HOLD open. Batch completion or registry row count alone is insufficient.

**Closure disposition:** G-PROV-01 through G-PROV-08 are PASS under the bounded current-thesis reuse policy below. CANONICAL_PROVENANCE therefore moves from HOLD to PASS when this closure candidate is published. This does not rerun S1-S6 and does not authorize recruitment, S6 execution, implementation, real tenant data, production hosting, or any claim of market validation.


## Batch 3 progress — S1 row-level traceability

Status: **COMPLETE / CANONICAL PR #60**

Google Drive readback of the live `S1_Public_Cases` registry produced 76 coded rows and 52 distinct source URLs. Batch 3 adds stable SRC-030..081 URL mappings plus SRC-082 for the internal S1 registry, and adds `s1_row_source_map.csv` so each S1 row has a stable source_id, URL cluster and known speaker/reviewer dependency.

Six source URLs were independently reopened during this audit and are marked `ACTIVE_E0_VERIFIED_SECONDARY`. All other mapped rows are explicitly `TO_VERIFY_MAPPED_NOT_CANONICAL`; mapping a URL does not make its observation a verified canonical FACT.

Dependency preservation is explicit: 10 source URLs contain multiple coded rows; known same-speaker/reviewer splits S1-001/002, S1-025/026 and S1-056/057 have stable dependency IDs. Shared source/page/thread rows remain non-independent even when speakers differ.

CLM-038..041 add bounded current-thesis coverage for directly reverified workflow-failure examples, low-frequency/unit-count counterevidence, mature-system/switching counterevidence and the S1 corpus dependency structure. These claims do not establish prevalence, WTP, adoption rate or product efficacy.

G-PROV-04 and G-PROV-05 are candidate PASS in this stacked branch. G-PROV-06 is candidate PASS but still participates in the final G-PROV-08 active-thesis reconciliation. G-PROV-02 and G-PROV-08 remain OPEN / NOT RUN, so the program-level provenance HOLD cannot be released from Batch 3 alone.

### Batch 3 delta audit — 2026-10-01

Status: **PASS AFTER CORRECTION / CANDIDATE PUBLICATION**

Mechanical comparison against the live Google `S1_Public_Cases!A1:N77` confirms 76/76 case IDs map exactly on geography, source_type, direction and source_url; 52 distinct public URLs map to SRC-030..081; SRC-082 represents the internal registry. Ten multi-row URL clusters and all three declared speaker/reviewer dependency pairs are preserved.

Fresh recheck reconfirmed the active evidence boundaries for SRC-033, SRC-037, SRC-041, SRC-051 and SRC-081 on 2026-10-01. SRC-032 retains its prior 2026-09-29 verification receipt because the page was not newly retrievable in this audit; it is not silently re-dated.

Two mixed fact/inference claims were corrected: CLM-039 now records only the observed 9/16-unit low-burden counterexamples, while behavior-based ICP interpretation remains a next action; CLM-040 now records only the observed 47-unit mature-PMS workflow and 72-unit switching-reluctance counterexamples, while integration-first/DEFER remains a research action rather than a FACT.

No mapped-but-unreverified row is promoted: all such rows remain `TO_VERIFY_MAPPED_NOT_CANONICAL`. S1 remains E0+ secondary evidence with geography/source/self-selection dependence and cannot establish prevalence, WTP, adoption rate, product effect or Korean market incidence.

## Final canonical factual-reuse boundary

The provenance HOLD release is deliberately **bounded**. It is not a statement that every `[FACT]` in the long-form Google research document is canonical.

### Canonical current-thesis factual reuse

- **Competitor workflow / authority boundaries:** CLM-032..036. Reuse only with their vendor-primary scope and without efficacy/adoption/superiority inference.
- **Bounded S1 examples / counterexamples:** CLM-038..040. Reuse only as examples or counterconditions, never as prevalence, incidence, effect size, adoption rate or Korean-market estimates.
- **Current price / pricing-method anchors:** CLM-042..048. Reuse only with the registered scope caveats. Competitor prices are anchors, not WTP proof or a hard ceiling.
- **Internal corpus structure:** CLM-041 is a verified internal mapping fact, not market evidence.

### Verified but internal-only constraints

CLM-015..020 (methodology) and CLM-022..031 (current law/privacy/IoT/AI-governance constraints) remain verified and traceable but retain their `submission_use` restrictions unless a later task explicitly clears a bounded public use.

### Explicitly excluded from canonical factual reuse

- S1 rows whose `canonical_evidence_status` is `TO_VERIFY_MAPPED_NOT_CANONICAL`.
- Legacy 40-case case-level claims that cannot be independently recovered; cumulative unique count remains **NOT CERTIFIED**.
- Unregistered historical long-form source facts, including NFPC/KGS/CPSC/DOE/LBNL/ISO/CSA/insurance-specific material, unless separately backfilled and claimed.
- The long-form v1.6 Landly numeric Assist/Pro rates recorded on 2026-09-29: the current 2026-10-01 Landly pricing page no longer publishes those numeric amounts. Canonical CLM-042 supersedes that current-price interpretation.
- The Building Solution pricing/ROI statements and any other v1.6 external fact not represented by a current SRC + CLM.
- KRW 79,000/month and the KRW 49,000–129,000 corridor: these remain future **HYPOTHESIS / TEST CANDIDATE** inputs, not launch price, WTP evidence or FACT.
- Any direct-user prevalence, adoption, switching, satisfaction, time-saving, operational outcome or paid-demand claim. Those evidence gates remain NOT RUN.

### Pricing provenance addendum

SRC-083..090 / CLM-042..048 are added as bounded current pricing/method provenance. The preserved older unmerged pricing branch is not merged wholesale; the current closure reuses only source/claim content that was freshly reconciled to 2026-10-01 evidence. In particular, Landly is corrected from the older numeric Assist/Pro representation to its current Free / per-task Assist / monthly Pro packaging with consultation-based pricing.

## Final closure audit

Canonical receipt: [2026-10-01 canonical provenance closure audit](../2026-10-01-canonical-provenance-closure-audit.md).

Mechanical closure at the fixed candidate proves:
- 90 unique SRC rows and 48 unique CLM rows;
- no duplicate SRC or CLM IDs;
- no CLM references a missing SRC;
- every FACT CLM has a nonblank locator and verification status;
- no FACT CLM relies on a `mapped_from_s1_workbook_TO_VERIFY` source;
- all 76 active S1 rows have a stable source_id and all mapped source URLs match their canonical SRC;
- 10 shared-URL clusters and 3 declared same-speaker/reviewer dependency pairs remain explicit;
- pricing/vendor/current-law source-type and reuse limitations remain visible.

**Program disposition:** CANONICAL_PROVENANCE = PASS for the bounded current-thesis factual-reuse boundary. Market confidence is unchanged: WTP, adoption, Korean prevalence, actual time savings, E3/E4 outcomes and real-user evidence remain unvalidated.

