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
| 0 | Core methodology sources used by Program Audit / S2-S6 | COMPLETE IN THIS CANDIDATE | Original source reopened; SRC and CLM rows added |
| 1 | Official/legal/standards/primary-authority sources | NEXT | Reverify original pages and add stable SRC IDs + consequential claims |
| 2 | Vendor/competitor primary documentation | AFTER B1 | Register as vendor evidence; preserve entry-path/version contradictions and marketing limits |
| 3 | S1 public behavioral evidence | AFTER B2 | Map S1 public-case rows to stable source IDs; preserve same-thread/reviewer dependency, geography and self-selection limits |
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

Status: **PARTIAL COMPLETE IN THIS CANDIDATE**

Independently reverified against current/official primary sources: SRC-014..023 / CLM-022..031 covering current Commercial Act 657/680, current PIPA 15/16/21/29/37, NIST IR 8259A, EPA WaterSense leak/flow monitoring, and NIST AI 600-1.

The living research document's stale Commercial Act historical-version links were replaced with current-law links. Its PIPA/GOV.UK source-link region was repaired after audit found cross-paragraph hyperlink-range drift; source labels now map to the intended current sources.

Batch 1 is not exhaustive for every official/standards source. NFPC/KGS/CPSC/DOE/LBNL/ISO/CSA and insurance-specific authorities remain later authoritative backfill items. The program-level provenance hold remains open.

## Batch 2 progress — competitor/vendor primary sources

Status: **CORE WORKFLOW COMPARATORS COMPLETE IN THIS CANDIDATE**

Registered SRC-024..029 and CLM-032..037 for Property Meld, AppFolio, Buildium and Latchel. The competitor index is updated from bootstrap TO VERIFY-only status to a partial-verification model that records documented workflow/authority capabilities while explicitly excluding vendor efficacy, adoption, pricing and superiority claims from independent evidence.

The current product-thesis-critical comparator set is now canonicalized. Optional/legacy competitor leads remain TO VERIFY and are not required for the present Coordination Core thesis.
