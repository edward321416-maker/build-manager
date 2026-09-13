# MVP Scope

Status: four modules are **[DECISION]**; acceptance criteria below are proposed requirements, not implemented or tested behavior. Stack, model, deployment, cost, and media feasibility remain **[TO VERIFY]**.

| Module | Required outcome | Proposed acceptance evidence |
| --- | --- | --- |
| AI Guided Issue Intake | Convert conversation and optional permissioned photos/video into a tenant-confirmed structured report | Synthetic incomplete, ambiguous, conflicting, and media-failure cases; never fabricate missing facts |
| AI Triage | Classify the report, express uncertainty, prioritize safety, and suggest a next action | Human-labeled cases for every Safety Gate signal, ordinary cases, and abstentions; no invented accuracy threshold or result |
| Landlord / Manager Dashboard | Let an authorized manager inspect, assign, update, and close tasks | Demonstrate receipt, assignment, waiting state, resolution, reopen, and tenant-visible status with synthetic data |
| Property / Unit Maintenance History | Preserve dated issue and handling events associated with a unit | Show a chronology with actor/source provenance, corrections as new events, and access isolation |

## Proposed task record

Use opaque property/unit and issue identifiers; tenant-confirmed description; observed symptoms; reported onset and affected area; permissioned evidence references; missing information; category; urgency; uncertainty/reason; next action; human assignee; status; timestamped handling events; resolution outcome. Do not store identities or raw media in the public repository. Optional media and missing answers must not block an urgent escalation.

## Exclusions

No definitive liability allocation, universal fault diagnosis, electrical/gas/structural certification, dangerous DIY, autonomous contractor dispatch/payment, or production integrations are included. Price, market size, customer counts, and effectiveness are unverified. No promise of continuous emergency monitoring is made.

## Release criteria to define before implementation

The MVP-definition issue must settle supported issue categories, required versus optional fields, actor permissions, status transitions, evaluation methods/thresholds, access isolation, human handoff responsibility, retention, and failure/offline behavior. [AI Safety Boundary](ai_safety_boundary.md) applies across all four modules. A prototype uses synthetic data until a separately authorized privacy/safety-ready pilot.
