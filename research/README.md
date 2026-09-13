# Research and evidence system

Purpose: test whether structured tenant intake solves a meaningful landlord/manager problem. No interviews or market findings were imported during repository bootstrap.

## Claim types

| Type | Required meaning and evidence |
| --- | --- |
| FACT | Verifiable observation with source_id, exact locator, scope/date, and a recorded verification. A source's assertion is not automatically independent truth. |
| HYPOTHESIS | Falsifiable proposition with a planned method and disconfirmation condition; not a result. |
| ASSUMPTION | Temporary planning input with an owner and a validation gate; never present it as measured. |
| DECISION | Operator/team choice with date and rationale; does not prove market demand. |
| TO VERIFY | Missing, stale, conflicting, or unread evidence; cannot support a factual submission claim. |

Use visible `[FACT]`, `[HYPOTHESIS]`, `[ASSUMPTION]`, `[DECISION]`, or `[TO VERIFY]` labels in narrative text. CSV `classification` carries the same values without brackets. `verification_status` is a separate field: a documented decision can be approved while a market claim remains unverified.

## Registries

[Sources](sources/source_registry.csv) track provenance, publication/access dates, exact locator, verification state, and reuse restrictions. [Claims](sources/claim_registry.csv) link atomic claims to sources and validation work. Use stable SRC-/CLM- IDs; separate compound claims. A source may exist without a verified claim. Corrections create a new dated note/revision and preserve previous provenance.

Promote a claim to FACT only after checking the original, its reference period, population, denominator, limitations, and exact supporting passage/table. Record reviewer and date. Distinguish official statistics, vendor marketing, direct observation, and participant testimony. Do not infer market size from a different population or invent metrics, prices, users, interview results, willingness to pay, or competitor features.

## Research note rule

Create a note only when actual research exists, named `YYYY-MM-DD-topic.md` in a relevant research subdirectory. Each note must contain: research question; claim IDs and types; method and inclusion/exclusion criteria; source IDs and exact locators; observations versus interpretation; counterevidence and limitations; anonymization/reuse review; conclusion; next verification action; author/reviewer/date. For interviews, report recruitment method, anonymous participant code, consent scope, and actual sample limitations without publishing recruiting/contact details. Do not create empty note files.

## Privacy and raw immutability

Raw interviews, recordings, contracts, photos, address/unit identifiers, and consent records stay in approved private storage outside this public repository. Keep an access-controlled original with checksum, capture time, provenance, and consent/retention basis. Never overwrite raw data; redaction, transcription, and analysis produce separate versioned derivatives. Immutability does not override valid deletion/retention obligations: authorized private deletion must be audited, not implemented as a silent overwrite.

Remove names, phones, email, precise addresses, building/unit numbers, faces, voices, license plates, screenshots of accounts, and EXIF/location metadata before considering publication. Replacing a name alone is insufficient. Keep participant-code mappings private. Prefer aggregate paraphrases; rare circumstances may reidentify a participant. Obtain consent for the specific use; interview participation is not public-release consent. Check redacted images visually and text for indirect identifiers. Do not publish a quote unless its use and anonymization were reviewed.

## Current evidence boundary

The operator supplied a local legacy problem note. Only headings/link inventory were inspected; its full content, claims, redistribution rights, and privacy status were not verified. It remains preserved and Git-ignored. Use the backlog to reverify original sources before importing any derived statement.

Interview preparation: [landlord guide](interviews/landlord_guide.md) and [tenant guide](interviews/tenant_guide.md). Competitor evidence belongs in the [competitor index](competitors/README.md).
