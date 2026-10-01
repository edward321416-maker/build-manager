# Canonical research provenance backfill plan v1.3

Status: **CLOSED / CANONICAL_PROVENANCE PASS**

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
| 1 | Official/legal/standards/primary-authority sources | CORE SET COMPLETE / RECONCILED | Current core authorities are registered; unbackfilled historical FACTs remain excluded from public/submission factual reuse unless later promoted through SRC + CLM |
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

Status: **CORE AUTHORITATIVE SET COMPLETE / FINAL RECONCILIATION PASS**

Independently reverified against current/official primary sources: SRC-014..023 / CLM-022..031 covering current Commercial Act 657/680, current PIPA 15/16/21/29/37, NIST IR 8259A, EPA WaterSense leak/flow monitoring, and NIST AI 600-1.

The living research document's stale Commercial Act historical-version links were replaced with current-law links. Its PIPA/GOV.UK source-link region was repaired after audit found cross-paragraph hyperlink-range drift; source labels now map to the intended current sources.

Batch 1 is not exhaustive for every official/standards source. NFPC/KGS/CPSC/DOE/LBNL/ISO/CSA and insurance-specific authorities remain later authoritative backfill items. The program-level provenance hold remains open.

## Batch 2 progress — competitor/vendor primary sources

Status: **CORE WORKFLOW COMPARATORS COMPLETE / MERGED PR #57**

Registered SRC-024..029 and CLM-032..037 for Property Meld, AppFolio, Buildium and Latchel. The competitor index is updated from bootstrap TO VERIFY-only status to a partial-verification model that records documented workflow/authority capabilities while explicitly excluding vendor efficacy, adoption, pricing and superiority claims from independent evidence.

The current **Coordination Core workflow/authority-boundary comparator set** is canonicalized through PR #57. This does not claim that all competitor, pricing, packaging or commercial facts in the living research document are canonicalized. Optional/legacy competitor leads remain TO VERIFY and are not used for feature-absence, superiority, pricing, adoption or demand claims.


## Frozen provenance closure gate — G-PROV-01..08

This gate was frozen before Batch 3 completion so HOLD release cannot be declared from registry growth or post-hoc judgment.

| Gate | Requirement | Current status after this candidate |
| --- | --- | --- |
| G-PROV-01 | Batch 0 methodology sources used for S2-S6 boundaries have stable SRC IDs and consequential atomic CLM rows with scope/limitations. Working ICP remains a HYPOTHESIS. | PASS |
| G-PROV-02 | Every active external FACT constraining current privacy/legal/safety/IoT/AI-governance conclusions and intended for public/submission reuse maps to a current primary/official SRC + CLM, or is explicitly downgraded/excluded. | PASS — CLM-022..031 map the current governance facts to primary/official SRCs and explicitly restrict them to internal legal/privacy/engineering/sensor/AI-governance use; unbackfilled historical FACTs are excluded from public/submission factual reuse |
| G-PROV-03 | Every competitor/vendor FACT used for current Coordination Core differentiation/boundary maps to vendor-primary SRC + CLM and preserves vendor-evidence limits. Legacy competitors may remain TO VERIFY only when not used for absence/superiority/pricing/adoption claims. | PASS — Batch 2 merged as PR #57 / main 09b5689b104c27c831cae5ff593a4fb916d8c0d3 |
| G-PROV-04 | Every active S1 public-case row has a stable canonical source_id; every distinct active source URL has a canonical SRC. Unmatched rows are EXCLUDED_FROM_CANONICAL_EVIDENCE or TO_VERIFY. | PASS — Batch 3 merged as PR #60 / main 75cc994a984a899bc1dae4bdcbbfa855562f528c; 76/76 rows mapped and 52/52 distinct URLs registered; unreverified rows remain TO_VERIFY |
| G-PROV-05 | Batch 3 preserves same-thread/page and known same-speaker/reviewer dependencies; mapped-row/source counts are never relabeled independent participants/events; geography, self-selection, vendor-review and source-cluster limits remain visible. | PASS — 10 shared-URL clusters and 3 known same-speaker/reviewer dependencies mechanically preserved; S1 remains E0+ secondary evidence |
| G-PROV-06 | claim_registry contains atomic entries for externally consequential current-thesis facts carried into synthesis: external behavioral workflow boundary/counterconditions where supported, competitor non-uniqueness/boundaries, and current legal/safety/privacy constraints. Product DECISION/HYPOTHESIS and synthetic outputs are not padded into external FACT claims. | PASS — CLM-032..040 cover bounded competitor and directly reverified workflow/countercondition facts; CLM-041 records corpus structure; current core thesis itself remains HYPOTHESIS/DECISION rather than synthetic FACT |
| G-PROV-07 | Legacy 40-case proxy corpus may remain historical hypothesis-generation context when unrecoverable rows are excluded from canonical factual evidence; cumulative unique count remains NOT CERTIFIED. | PASS — policy frozen |
| G-PROV-08 | Final mechanical reconciliation proves no active canonical S1 row lacks source_id; no CLM references a missing SRC; every FACT CLM has locator + verification; no public current-thesis FACT depends only on an unbackfilled long-form link; vendor/current-law/dependency limits are preserved. | PASS — SRC 82 / CLM 41 / S1 76-row audit: missing S1 source IDs 0, missing CLM→SRC refs 0, FACT locator/verification gaps 0; current long-form core-thesis summary contains 0 FACT markers (2 HYPOTHESIS, 3 DECISION); only claim-registry-bounded verified FACTs are cleared for factual reuse |

**HOLD release rule:** CANONICAL_PROVENANCE moves from HOLD to PASS only when G-PROV-01 through G-PROV-08 are each PASS. Any OPEN / UNKNOWN / FAIL keeps the HOLD open. Batch completion or registry row count alone is insufficient.

**Closure disposition:** G-PROV-01..08 are canonical PASS after PR #65 merged as main `e1645d34c995ace66f2b0360e9ca68290e8c2f03`. `CANONICAL_PROVENANCE = PASS` and the Program Audit v1.3 provenance HOLD is released. This release means the canonical reuse boundary is mechanically consistent; it does **not** validate WTP, prevalence, adoption, product efficacy, Korean incidence, direct-user evidence, S6, implementation, real tenant data or production hosting.


## Batch 3 progress — S1 row-level traceability

Status: **COMPLETE / MERGED PR #60**

Google Drive readback of the live `S1_Public_Cases` registry produced 76 coded rows and 52 distinct source URLs. Batch 3 adds stable SRC-030..081 URL mappings plus SRC-082 for the internal S1 registry, and adds `s1_row_source_map.csv` so each S1 row has a stable source_id, URL cluster and known speaker/reviewer dependency.

Six source URLs were independently reopened during this audit and are marked `ACTIVE_E0_VERIFIED_SECONDARY`. All other mapped rows are explicitly `TO_VERIFY_MAPPED_NOT_CANONICAL`; mapping a URL does not make its observation a verified canonical FACT.

Dependency preservation is explicit: 10 source URLs contain multiple coded rows; known same-speaker/reviewer splits S1-001/002, S1-025/026 and S1-056/057 have stable dependency IDs. Shared source/page/thread rows remain non-independent even when speakers differ.

CLM-038..041 add bounded current-thesis coverage for directly reverified workflow-failure examples, low-frequency/unit-count counterevidence, mature-system/switching counterevidence and the S1 corpus dependency structure. These claims do not establish prevalence, WTP, adoption rate or product efficacy.

G-PROV-04 and G-PROV-05 became canonical PASS with PR #60 publication. G-PROV-06 is confirmed PASS by the final active-thesis audit below. Batch 3 alone did not release the HOLD; the final G-PROV-02/06/08 reconciliation does.

### Batch 3 delta audit — 2026-10-01

Status: **PASS AFTER CORRECTION / CANDIDATE PUBLICATION**

Mechanical comparison against the live Google `S1_Public_Cases!A1:N77` confirms 76/76 case IDs map exactly on geography, source_type, direction and source_url; 52 distinct public URLs map to SRC-030..081; SRC-082 represents the internal registry. Ten multi-row URL clusters and all three declared speaker/reviewer dependency pairs are preserved.

Fresh recheck reconfirmed the active evidence boundaries for SRC-033, SRC-037, SRC-041, SRC-051 and SRC-081 on 2026-10-01. SRC-032 retains its prior 2026-09-29 verification receipt because the page was not newly retrievable in this audit; it is not silently re-dated.

Two mixed fact/inference claims were corrected: CLM-039 now records only the observed 9/16-unit low-burden counterexamples, while behavior-based ICP interpretation remains a next action; CLM-040 now records only the observed 47-unit mature-PMS workflow and 72-unit switching-reluctance counterexamples, while integration-first/DEFER remains a research action rather than a FACT.

No mapped-but-unreverified row is promoted: all such rows remain `TO_VERIFY_MAPPED_NOT_CANONICAL`. S1 remains E0+ secondary evidence with geography/source/self-selection dependence and cannot establish prevalence, WTP, adoption rate, product effect or Korean market incidence.


## Final G-PROV closure audit — 2026-10-01

Status: **PASS / HOLD RELEASED**

### Mechanical reconciliation

- Live main audited: `75cc994a984a899bc1dae4bdcbbfa855562f528c`.
- Batch 2: PR #57 merged; workflow/authority comparator provenance canonical.
- Batch 3: PR #60 merged as `75cc994a984a899bc1dae4bdcbbfa855562f528c`; candidate CI Repository `36805220913` and App `36805221027` both SUCCESS.
- `source_registry.csv`: 82 source rows.
- `claim_registry.csv`: 41 claim rows.
- `s1_row_source_map.csv`: 76 S1 rows, all with canonical `source_id`; 52 distinct source IDs/URLs.
- Missing CLM → SRC references: 0.
- FACT claims missing locator or verification status: 0.
- S1 rows missing a registered canonical source: 0.
- Shared-URL clusters: 10. Known same-speaker/reviewer dependency IDs: 3.
- Directly reverified S1 rows remain bounded E0+ secondary evidence; mapped-but-unreverified rows remain `TO_VERIFY_MAPPED_NOT_CANONICAL`.

### Active-thesis / public-reuse boundary

The living Google research document is a cumulative history, not the canonical factual registry. Its current top-level `현재 핵심 결론` section contains **0 [FACT] markers, 2 [HYPOTHESIS] markers and 3 [DECISION] markers**. Therefore the current core product thesis does not depend on an unbackfilled long-form FACT.

For factual public/submission reuse:
1. a statement must map to an atomic FACT in `claim_registry.csv`;
2. every referenced source must exist in `source_registry.csv`;
3. locator, verification status and `submission_use` scope must permit the intended wording; and
4. vendor, anecdotal, methodology and official-authority limitations remain attached.

Historical long-form FACTs that were not promoted through this process remain research history / TO VERIFY and are **not** silently cleared for factual public or submission reuse. This explicit exclusion satisfies the closure gate without fabricating exhaustive provenance for every historical link.

CLM-022..031 remain explicitly internal-only governance facts. CLM-032..036 may be reused only as bounded documented vendor capability/guidance/authority facts. CLM-038..040 may be reused only as bounded secondary examples/counterexamples, never as prevalence or incidence. CLM-041 is an internal corpus-structure fact. WTP, adoption, switching rate, time savings, product efficacy, Korean prevalence and commercial demand remain unvalidated.

### Final disposition

`G-PROV-01..08 = PASS`.

Published by PR #65 as main `e1645d34c995ace66f2b0360e9ca68290e8c2f03` after candidate Repository `36808793715` + App `36808793702` SUCCESS and fresh push-main Repository `36809293204` + App `36809293060` SUCCESS (required 9/9).

Canonical result:
- `CANONICAL_PROVENANCE = PASS`;
- Program Audit v1.3 provenance HOLD is released;
- no S1-S6 evidence class is upgraded;
- no Wave 1 recruitment is opened;
- S6 remains governed by its separate runnable-target entry gate;
- no implementation, real-data, hosting or commercial-validation authorization is created.


### Publication receipt

PR #65 fixed candidate HEAD `76a696797eac4a6607007b27afc33a6508728996` passed required candidate CI: Repository `36808793715` SUCCESS and App `36808793702` SUCCESS, required 9/9. It was merged with expected-head protection as main `e1645d34c995ace66f2b0360e9ca68290e8c2f03`.

Fresh actual-main push CI also passed: Repository `36809293204` SUCCESS and App `36809293060` SUCCESS, required 9/9 including mobile-health, Windows/Linux Mobile, Web E2E, PostgreSQL integration, apps, repository-safety and foundation-gate.

The provenance HOLD is therefore released canonically. Future external factual reuse remains constrained by `claim_registry.csv` classification, source mapping, locator, verification and `submission_use`; no evidence-maturity or product-authorization gate changed.
