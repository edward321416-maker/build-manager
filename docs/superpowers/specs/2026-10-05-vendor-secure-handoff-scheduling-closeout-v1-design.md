# Vendor Secure Handoff, Scheduling & Closeout v1 — Design Specification

**Status:** DRAFT_FOR_USER_REVIEW  
**Project:** 모두의 창업 2기 / build-manager  
**Repository:** edward321416-maker/build-manager  
**POLICY_REF at authoring:** 954ef347efef9db29465aefa2e72003b176ee150  
**TARGET_REF at authoring:** 954ef347efef9db29465aefa2e72003b176ee150  
**Design class:** Architectural — new external vendor capability, scheduling, work-execution and closeout subsystem  
**Implementation authority:** NOT_GRANTED_BY_THIS_SPEC  
**Production / real-data authority:** NOT_GRANTED

---

## 1. Purpose

The current development product can already:

- accept a tenant maintenance request;
- collect structured answers and ticket photos;
- apply protocol and safety rules;
- create a manager review packet and route decision;
- let a manager track work in a private work queue;
- support ticket-scoped public tenant/manager Q&A;
- record manager handling as OPEN, IN_PROGRESS and COMPLETED;
- collect a tenant outcome after manager completion;
- create atomic UNRESOLVED / RECURRENCE_CLAIM follow-up tickets;
- let a manager explicitly create a minimal, reviewed Unit Maintenance Fact from a completed ticket.

What is missing is the operational bridge between an approved external repair route and manager completion.

Vendor Secure Handoff, Scheduling & Closeout v1 introduces that bridge:

> An authorized manager can hand one approved ticket to one external vendor through a ticket-scoped secure link, let the vendor coordinate a visit with the current tenant, collect bounded work and completion evidence, and close the assignment without creating a vendor account or exposing the underlying tenant/manager record.

The target user value is to remove the manager from being a repeated scheduling relay while preserving manager review, tenant access control, privacy and the existing ticket/outcome/maintenance-memory semantics.

---

## 2. Design intent

The subsystem must make this path possible:

~~~text
Manager route approval
→ VendorAssignment PREPARING
→ reviewed Work Packet publish
→ secure link issue / OFFERED
→ vendor one-time redeem
→ vendor ACCEPT
→ SchedulingRound
→ Appointment
→ visit / blocker / follow-up as needed
→ VendorCompletionReport
→ manager review
→ ticket COMPLETED + assignment ENDED/CLOSED
→ existing tenant outcome
→ optional existing Maintenance Fact recording
~~~

The design must not turn a vendor report into proof of repair, a tenant outcome, a durable maintenance fact, or an autonomous dispatch decision.

---

## 3. Existing frozen boundaries preserved

This design extends the accepted development product. It does not reopen the accepted semantics of:

1. RC1 tenant intake, protocol, safety, route decision and manager handling;
2. Manager Work Queue priority, assignee label, due date and private notes;
3. ticket-scoped public Q&A and its completion guard;
4. tenant RESOLVED / UNRESOLVED / RECURRENCE_CLAIM outcome semantics;
5. atomic fresh follow-up ticket creation;
6. Unit Maintenance Fact Timeline v1:
   - manager-only;
   - explicit fact creation from a completed ticket;
   - append-only corrections;
   - no automatic extraction;
   - no tenant maintenance-history endpoint;
   - no copying of ticket conversation, photos or manager-private metadata into the fact ledger.

A VendorCompletionReport is not a Unit Maintenance Fact.

A completed vendor-managed ticket does not automatically create a Unit Maintenance Fact.

---

## 4. Selected product approach

### 4.1 Vendor participation

Selected:

**Ticket-scoped Vendor Secure Link, no vendor account.**

A vendor receives a capability limited to one VendorAssignment on one ticket.

The vendor does not receive:

- an Auth0 account;
- organization membership;
- a staff role;
- a vendor organization/profile;
- cross-ticket navigation;
- a searchable vendor portal;
- a marketplace identity.

### 4.2 Vendor identity in v1

A VendorAssignment stores only a short manager-entered vendorLabel for display, for example:

- 한빛설비
- 보일러119
- 김기사 배관

vendorLabel is metadata only.

It is never an authorization source.

Phone number, email, vendor employee roster and vendor account records are not part of v1.

### 4.3 Link delivery

The product creates a secure link.

The manager manually delivers that link through an existing external channel such as phone, SMS, Kakao or another channel.

The product does not send SMS, Kakao, email or push notifications in v1.

---

## 5. Core resource model

Conceptually:

~~~text
Ticket
└── VendorAssignment 1:N
    ├── VendorCapability[]
    ├── VendorSession[]
    ├── VendorWorkPacketRevision[]
    ├── SchedulingRound[]
    │   ├── TenantAvailabilitySubmission[]
    │   ├── VendorSchedulingProposal[]
    │   └── Appointment[]
    ├── VendorWorkEvent[]
    ├── VendorCompletionReport[]
    └── durable closeout / correction-request evidence
~~~

A ticket may have multiple historical assignments.

A ticket may have at most one non-ended VendorAssignment.

Historical records are preserved.

---

## 6. VendorAssignment lifecycle

### 6.1 Status

VendorAssignment.status is one of:

- PREPARING
- OFFERED
- ACTIVE
- ENDED

### 6.2 End reason

VendorAssignment.endReason is null unless status is ENDED.

When ENDED it is exactly one of:

- DECLINED
- WITHDRAWN
- REVOKED
- SUPERSEDED
- CLOSED

### 6.3 Meanings

**PREPARING**
- manager has created the assignment;
- no vendor authority exists yet;
- no link may be redeemed;
- the packet can be prepared.

**OFFERED**
- a current Work Packet revision exists;
- a valid capability link may be issued;
- the vendor has not yet accepted.

**ACTIVE**
- the vendor explicitly accepted;
- scheduling/work actions are permitted subject to current state.

**ENDED**
- no vendor action is permitted;
- capability and sessions are revoked;
- historical packet, scheduling, visit and completion records remain.

### 6.4 One current assignment invariant

For each ticket:

> At most one VendorAssignment may have status PREPARING, OFFERED or ACTIVE.

A new vendor cannot be prepared while an older assignment is still non-ended.

Reassignment is an explicit transition that ends the older assignment first within the same transaction.

---

## 7. Preconditions for creating a VendorAssignment

A manager may create a PREPARING VendorAssignment only when all are true:

1. the caller is currently authorized as ORG_ADMIN or currently scoped PROPERTY_STAFF for the ticket property;
2. the ticket is currently visible under the same manager authorization rules;
3. the ticket is not COMPLETED;
4. the ticket has a human route decision;
5. the selected route is exactly GENERAL_VENDOR or MANUFACTURER_AS;
6. the current ticket safety state is not SAFETY_ESCALATED;
7. no non-ended VendorAssignment exists for the ticket.

Creating PREPARING does not itself change ticket.workStatus.

These preconditions are rechecked after any relevant wait/lock before the write commits.

---

## 8. Safety precedence

Ordinary vendor dispatch must not bypass an accepted safety hard stop.

If the ticket is SAFETY_ESCALATED:

- VendorAssignment creation is forbidden;
- Work Packet publish is forbidden;
- secure link issuance is forbidden.

A future emergency/safety-specialist handoff is a separate product decision and is not implicitly authorized by this design.

---

## 9. Vendor capability authentication boundary

### 9.1 Separate identity boundary

Vendor capability authentication is separate from B1/Auth0 identity.

~~~text
B1/Auth0 identity
≠
Vendor capability session
~~~

Vendor requests do not become TENANT, ORG_ADMIN or PROPERTY_STAFF sessions.

### 9.2 Authority derivation

A vendor request is authorized only by server-side resolution:

~~~text
opaque vendor session
→ session digest lookup
→ VendorAssignment
→ current assignment status
→ source ticket / org / unit
→ requested assignment-owned resource
~~~

Client-supplied orgId, propertyId, unitId or ticketId never create vendor authority.

### 9.3 Database privilege boundary

Vendor HTTP handlers must use a vendor-specific database capability boundary with no direct table DML.

The runtime boundary receives only the EXECUTE capability required for vendor-session and assignment-scoped functions.

It must not gain the authenticated manager/tenant API surface merely because both flows run in the same application.

This is an internal development privilege boundary, not vendor IAM provisioning.

Production database credentials remain outside this design authority.

---

## 10. Secure link issuance and redemption

### 10.1 Link issuance prerequisites

A secure link may be issued only when:

- assignment status is PREPARING or a still-current OFFERED/ACTIVE assignment needs access reissue;
- current manager authorization is valid;
- a current PUBLISHED Work Packet revision exists;
- the source ticket still satisfies the external route and safety constraints;
- the assignment is not ENDED.

For the first issue:

~~~text
PREPARING
→ link issue
→ OFFERED
~~~

If the source ticket is OPEN at first OFFERED transition, the same manager operation changes it to IN_PROGRESS using the existing manager handling meaning.

If it is already IN_PROGRESS, no extra work-status transition occurs.

Vendor details are not copied into public ticket events.

### 10.2 Raw token

The raw capability token:

- is cryptographically random and high entropy;
- is assignment-scoped;
- has a default expiry of 72 hours;
- is never stored in plaintext in the database;
- is never written to application logs, Git, public receipts or screenshots;
- is represented in durable storage only by a digest and issuance metadata;
- is invalidated after successful redemption;
- is invalidated immediately on reissue, assignment end or manager revocation.

### 10.3 URL handling

The deliverable link uses a URL fragment rather than a query parameter or path credential:

~~~text
/vendor/job#<raw-token>
~~~

The browser posts the token once to the redeem endpoint.

After successful redemption the application clears the raw fragment from browser-visible navigation state.

Sensitive vendor pages and APIs use at minimum:

- Cache-Control: no-store;
- Referrer-Policy: no-referrer;
- X-Content-Type-Options: nosniff;
- frame embedding protection.

The vendor capability surface must not load third-party analytics or other third-party scripts that could observe the raw fragment or vendor-session context.

### 10.4 Vendor session

Successful redemption creates an opaque vendor session.

The raw token is not reused for normal API calls.

The vendor session:

- is assignment-scoped;
- is stored server-side by digest, not plaintext;
- has an absolute maximum lifetime of 7 days;
- is revocable;
- is invalidated when the assignment ends;
- is invalidated when a replacement vendor session is redeemed;
- is rechecked on every vendor read and mutation.

v1 permits at most one active vendor browser session per assignment.

If access is lost or expires while the assignment remains current, a manager may issue a new one-time link.

### 10.5 CSRF

Vendor mutations use the vendor session plus a server-issued CSRF value.

Possession of an assignment ID alone is never sufficient.

---

## 11. Work Packet principle

The vendor must not receive a reduced copy of the full Ticket DTO or LandlordRepairPacket.

Instead the manager publishes an explicit minimum-data projection:

**VendorWorkPacketRevision**

Only PUBLISHED revisions persist in v1.

Server-side draft persistence is not required.

The flow is:

~~~text
Manager edits locally
→ preview of exact vendor-visible information
→ publish mutation
→ immutable VendorWorkPacketRevision
~~~

---

## 12. Work Packet contents

A published Work Packet contains only:

### Assignment metadata
- assignmentId
- jobReference
- vendorLabel
- packetRevision
- publishedAt

### Location snapshot
- buildingName
- serviceAddress
- unitLabel

### Issue
- issueType
- workSummary
- sharedDetails[]
- safetyNotice[]

### Evidence
- explicitly allowed completion-source/input photo references for vendor viewing

### Access
- accessPolicy
- accessInstruction

Scheduling mode is not pre-declared by the manager. The effective scheduling mode is derived later from accessPolicy plus the tenant’s current availability/consent.

The vendor sees only the current published revision by default.

Older revisions are manager-audit history.

---

## 13. Work Packet server-derived fields

The following are server-derived snapshots and are never accepted from a manager or vendor mutation payload:

- organization identity;
- ticket identity;
- unit identity;
- building identity;
- buildingName;
- serviceAddress;
- unitLabel;
- issueType.

serviceAddress is derived from the canonical server-side building/property source.

Tenant raw text is never used as an address fallback.

If a serviceable canonical address is unavailable, packet publication fails with a safe ADDRESS_REQUIRED-style domain error rather than guessing.

---

## 14. workSummary

workSummary is:

- required;
- manager-reviewed;
- plain text;
- 1 to 1000 characters after validation;
- not interpreted as HTML;
- prohibited from containing unsupported control/format characters.

A system-generated starting suggestion may exist in a later implementation, but publication always requires manager review.

v1 does not publish an autonomous AI summary directly to a vendor.

---

## 15. sharedDetails provenance

Do not call tenant statements objective facts.

Each shared detail has:

- key;
- display label;
- display value;
- sourceType.

sourceType is one of:

- TENANT_REPORTED
- BUILDING_VERIFIED
- MANAGER_REVIEWED

Generation is two-stage:

1. server-side issue-specific vendor-shareable allowlist;
2. manager explicit selection before packet publish.

Raw free-text answers are not automatically vendor-shareable candidates.

The complete protocol answer object is never sent to the vendor.

---

## 16. Vendor-visible input photos

Input photos from the source ticket are private by default.

The manager explicitly selects allowedPhotoIds during packet publication.

For every selected photo the server verifies that it:

- belongs to the same organization;
- belongs to the source ticket;
- is currently readable by that manager;
- satisfies the accepted ticket-photo constraints.

Vendor photo reads recheck:

~~~text
vendor session
→ current non-ended assignment
→ requested packet/photo authorization
→ exact photo is allowed
~~~

A guessed photo UUID returns the hidden-resource response and cannot be used as authorization.

---

## 17. Data explicitly excluded from vendor projection

Vendor contracts must not contain:

- tenantId;
- tenant name;
- tenant phone/email;
- tenant rawUserText;
- full protocol Q&A;
- all ticket photos;
- public Q&A message history;
- manager private notes;
- manager priority;
- manager assigneeLabel;
- manager dueAt;
- full maintenance-fact history;
- unrelated tickets;
- unrelated units;
- route alternatives;
- cost estimates;
- invoices;
- hidden contacts;
- Auth0 identity;
- organization membership details;
- staff directory information.

---

## 18. Access policy

The Work Packet stores what the manager permits, not a tenant consent that has not happened yet.

v1 supports exactly two accessPolicy values:

- TENANT_PRESENT_REQUIRED
- TENANT_PREAUTHORIZATION_ALLOWED

MANAGER_COORDINATED is intentionally excluded from v1 because it would require a separate provenance model for manager-recorded tenant consent.

### 18.1 TENANT_PRESENT_REQUIRED

The tenant must explicitly confirm the final appointment.

Tenant preauthorization is not accepted for this assignment.

### 18.2 TENANT_PREAUTHORIZATION_ALLOWED

The tenant may still use normal resident-confirmation scheduling, or may explicitly authorize unattended access within one or more submitted availability windows.

The manager cannot create that tenant authorization.

The vendor cannot create that tenant authorization.

The eventual Appointment records the exact availability submission/window that supplied preauthorization when that path is used.

---

## 19. Access instructions

accessInstruction is optional, plain text and bounded.

It may contain operational guidance such as:

> 방문 전 초인종을 눌러 주세요.

v1 does not create structured fields for:

- reusable door-lock codes;
- communal entrance passwords;
- tenant phone numbers;
- tenant email.

The manager UI warns not to enter personal contact information or reusable access secrets.

The product does not claim perfect secret detection from free text.

---

## 20. Effective scheduling modes

The manager does not choose the realized scheduling mode directly.

The effective scheduling mode is a server-derived projection and is exactly one of:

- RESIDENT_CONFIRMATION_REQUIRED
- PREAUTHORIZED_ENTRY_WINDOW

Rules:

- TENANT_PRESENT_REQUIRED always derives RESIDENT_CONFIRMATION_REQUIRED.
- TENANT_PREAUTHORIZATION_ALLOWED derives PREAUTHORIZED_ENTRY_WINDOW only when the current tenant explicitly preauthorizes the relevant submitted windows.
- TENANT_PREAUTHORIZATION_ALLOWED otherwise derives RESIDENT_CONFIRMATION_REQUIRED.

A packet revision that changes accessPolicy is consequential to existing scheduling and follows the invalidation rules below.

---

## 21. VendorAssignment accept / decline

Redeeming a secure link does not accept the assignment.

The vendor first sees the current Work Packet and then chooses:

- Accept work
- Decline work

### 21.1 Accept

Allowed only when:

- assignment status is OFFERED;
- vendor session belongs to that assignment;
- assignment is still the current non-ended assignment;
- expectedAssignmentVersion is current;
- expectedPacketRevisionId is current;
- source ticket is not COMPLETED;
- no revocation/supersession occurred.

Success:

~~~text
OFFERED → ACTIVE
~~~

The first SchedulingRound can then be opened according to schedulingMode.

### 21.2 Decline

Allowed only before acceptance.

Success:

~~~text
OFFERED → ENDED
endReason = DECLINED
~~~

Decline reason is exactly one of:

- NO_CAPACITY
- OUT_OF_SERVICE_AREA
- SKILL_MISMATCH
- CANNOT_MEET_TIMING
- OTHER

An optional short vendor note may be retained as assignment-private operational evidence.

The decline does not cancel or complete the source ticket.

---

## 22. Vendor withdrawal after acceptance

A vendor who accepted but later cannot continue does not become DECLINED.

Success:

~~~text
ACTIVE → ENDED
endReason = WITHDRAWN
~~~

The source ticket remains unfinished.

The manager may then choose direct handling or a new VendorAssignment.

---

## 23. SchedulingRound aggregate

Scheduling negotiation is anchored by one resource:

**SchedulingRound**

Fields include conceptually:

- id
- assignmentId
- openedPacketRevisionId
- purpose
- status
- version
- createdAt

openedPacketRevisionId records the packet revision current when the round opened. It is provenance, not a promise that the packet can never receive a non-scheduling revision while the round remains open.

Each vendor proposal and each confirmed Appointment records the current packetRevisionId used for that action. Vendor mutations also supply expectedPacketRevisionId and conflict if the assignment has since published another current packet.

purpose is one of:

- INITIAL
- RESCHEDULE
- FOLLOW_UP

status is one of:

- OPEN
- CONFIRMED
- SUPERSEDED
- CANCELLED

There may be at most one OPEN SchedulingRound per assignment.

Scheduling mutations use:

- clientRequestId;
- expectedAssignmentVersion;
- expectedRoundVersion;
- expectedPacketRevisionId.

---

## 24. Tenant availability

A TenantAvailabilitySubmission is assignment- and round-scoped.

It is not part of the immutable Work Packet.

Each submission is historical and immutable once accepted.

A submission contains one to five future windows.

Each window:

- has startAt before endAt;
- uses an offset-aware timestamp;
- does not overlap another window in the same submission.

When current accessPolicy is TENANT_PREAUTHORIZATION_ALLOWED, the submission may additionally record explicit access authorization for those windows.

When current accessPolicy is TENANT_PRESENT_REQUIRED, a preauthorization flag is rejected.

The tenant must be the currently authorized tenant for the source ticket/unit at the time of submission.

---

## 25. Resident-confirmation scheduling

For RESIDENT_CONFIRMATION_REQUIRED:

~~~text
ACTIVE assignment
→ OPEN SchedulingRound
→ tenant availability
→ vendor proposal
→ tenant confirms one slot
→ Appointment
→ round CONFIRMED
~~~

VendorSchedulingProposal contains one to five future candidate slots.

The tenant selects one offered slot.

If the tenant needs another time before an Appointment has been confirmed, the current proposal is superseded and a new availability/proposal cycle stays inside the same OPEN SchedulingRound.

A replacement SchedulingRound is created only after a confirmed Appointment needs RESCHEDULE, or after an occurred visit requires FOLLOW_UP.

Manager routine approval is not required.

---

## 26. Preauthorized-entry scheduling

For PREAUTHORIZED_ENTRY_WINDOW:

~~~text
Work Packet accessPolicy = TENANT_PREAUTHORIZATION_ALLOWED
→ current tenant explicitly preauthorizes submitted window
→ effective mode = PREAUTHORIZED_ENTRY_WINDOW
→ vendor selects a slot fully inside that window
→ server validates containment
→ Appointment
→ round CONFIRMED
~~~

No second tenant confirmation is required.

The Appointment stores:

- source availabilitySubmissionId;
- selectedWindowId;
- authorizationMode = PREAUTHORIZED_ENTRY.

Before VISIT_STARTED, the server rechecks that the tenant whose authorization is being relied on still has a current valid occupancy relationship to the same unit.

If that authorization is no longer current, visit start is denied and manager review is required.

---

## 27. Appointment model

Appointment time is immutable after creation.

Appointment conceptually contains:

- id
- assignmentId
- schedulingRoundId
- packetRevisionId
- proposalId or null
- startAt
- endAt
- confirmationMode
- disposition
- createdAt

confirmationMode:

- TENANT_CONFIRMED
- PREAUTHORIZED_ENTRY

disposition:

- SCHEDULED
- OCCURRED
- SUPERSEDED
- CANCELLED

VISIT_STARTED changes the applicable appointment from SCHEDULED to OCCURRED.

Changing start/end time creates a new Appointment rather than updating the old one.

---

## 28. RESCHEDULE versus FOLLOW_UP

These are different.

### RESCHEDULE

A confirmed visit has not occurred and its time must change.

~~~text
old future Appointment → SUPERSEDED
new SchedulingRound purpose RESCHEDULE
→ new Appointment
~~~

### FOLLOW_UP

A prior visit actually occurred and another visit is required.

~~~text
Appointment #1 remains OCCURRED
new SchedulingRound purpose FOLLOW_UP
→ Appointment #2
~~~

An occurred appointment is never relabeled SUPERSEDED merely because another visit is needed.

---

## 29. Scheduling contract changes

Before an Appointment is confirmed:

- workSummary/sharedDetails/sharedPhotos may change through a new packet revision;
- accessMode/schedulingMode/service location changes supersede incompatible OPEN proposals/rounds.

After an Appointment is confirmed:

- non-scheduling packet information may be revised;
- serviceAddress, unitLabel, accessMode or schedulingMode cannot silently change underneath that appointment.

A consequential access/location change requires cancellation/rescheduling before the new contract becomes operative.

Every Appointment remains linked to the packet revision and authorization basis under which it was confirmed.

---

## 30. Tenant and vendor notifications

v1 guarantees current state in the Web UI.

It does not guarantee external notification delivery.

No SMS, Kakao, email or push service is introduced.

In PREAUTHORIZED_ENTRY_WINDOW, “tenant notified” in this design means the latest confirmed appointment is visible in the authenticated tenant ticket experience; it does not mean an external message was sent.

---

## 31. Current operational projection

The manager UI may derive a current phase such as:

- OFFERED
- SCHEDULING
- SCHEDULED
- IN_PROGRESS
- COMPLETION_REPORTED
- ENDED

This phase is a projection, not a replacement for the underlying assignment/scheduling/work resources.

waitingOn is also a projection.

Recommended values:

- NONE
- TENANT
- VENDOR
- MANAGER
- PARTS

---

## 32. Work execution evidence

Work execution is append-only.

Vendor work evidence uses VendorWorkEvent with these event kinds:

- VISIT_STARTED
- BLOCKER_RECORDED
- BLOCKER_CLEARED

There is at most one VISIT_STARTED event per Appointment.

VISIT_STARTED requires:

- ACTIVE assignment;
- a current vendor session;
- a current valid Appointment;
- the appointment is not CANCELLED or SUPERSEDED;
- current packet review contract satisfied;
- no active blocker that prevents start;
- preauthorized-entry occupancy recheck when applicable.

---

## 33. Blockers

BLOCKER_RECORDED does not replace the current lifecycle state.

A job can be:

~~~text
phase = IN_PROGRESS
blocked = true
waitingOn = PARTS
~~~

blockerCode is exactly one of:

- PARTS_REQUIRED
- ACCESS_BLOCKED
- SCOPE_REVIEW_REQUIRED
- FOLLOW_UP_VISIT_REQUIRED
- OTHER

At most one active blocker exists per assignment.

BLOCKER_CLEARED:

- references the exact blocker event it clears;
- is append-only;
- clears the current-blocker projection;
- does not delete the original blocker event.

A follow-up SchedulingRound may be created when another visit is required.

A FOLLOW_UP round opened from a current blocker or completion-report disposition records the source evidence that caused the follow-up. Any blocker cleared as part of opening that round is cleared atomically and remains in history.

---

## 34. VendorCompletionReport

A VendorCompletionReport means only:

> The currently assigned vendor reports that its assigned work is complete.

It does not mean:

- the source ticket is COMPLETED;
- the issue is RESOLVED;
- the tenant confirmed success;
- a Maintenance Fact exists.

Submission requires:

- assignment ACTIVE;
- a valid latest required visit with VISIT_STARTED;
- no active blocker;
- no OPEN SchedulingRound;
- current packet version acknowledged;
- either no unresolved completion-report correction request, or this submission is the correction revision that exactly responds to the current request and supersedes the report named by that request.

---

## 35. Completion report fields

Conceptually:

- id
- assignmentId
- appointmentId
- packetRevisionId
- revision
- supersedesReportId or null
- workSummary
- componentOrPartNote or null
- completionPhotoIds[]
- photoOmissionReason or null
- submittedAt

### workSummary

- required;
- 1 to 1000 characters;
- plain text;
- no HTML interpretation;
- bounded control/format-character validation.

### componentOrPartNote

Optional short text.

It is not an inventory, warranty record or cost line item.

### Completion photos

A report contains either:

- one to five valid completion photos; or
- a photoOmissionReason.

photoOmissionReason is exactly one of:

- NOT_APPLICABLE
- SAFETY_OR_PRIVACY
- TECHNICAL_FAILURE

Silent zero-photo completion is not accepted.

---

## 36. Completion photo security

Vendor completion images are a new external input surface.

v1 accepts only JPEG and PNG.

Each image uses at least the accepted Core photo limits for:

- byte size;
- decoded dimensions;
- total pixel count.

The implementation must decode and re-encode or otherwise prove that EXIF/GPS and equivalent embedded metadata are stripped before durable serving/storage.

Raw vendor file metadata is not exposed to tenant or manager UI.

Completion photos are assignment-scoped.

Tenant users do not receive the raw vendor completion-photo API in v1.

---

## 37. Completion-report review states

After a current VendorCompletionReport is submitted:

~~~text
phase = COMPLETION_REPORTED
waitingOn = MANAGER
~~~

Vendor mutation becomes read-mostly until the manager chooses one of:

1. Close out handling;
2. Request report correction;
3. Require follow-up work.

During COMPLETION_REPORTED:

- new packet publication is forbidden;
- new scheduling proposals are forbidden;
- new visit starts are forbidden;
- a second unrelated completion report is forbidden;
- reassignment/revocation that would bypass manager disposition is forbidden;
- the one allowed vendor mutation is a correction-report submission that exactly satisfies the current durable correction request.

The manager must first choose closeout, report correction, or follow-up work. After a follow-up disposition is committed, normal follow-up scheduling/reassignment rules apply again.

---

## 38. Completion-report correction

A manager may request correction of report content/evidence without scheduling a new visit.

The correction request:

- is durable and audited;
- references the current report;
- contains a required plain-text manager reason of 1 to 500 characters;
- has at most one unresolved request for the assignment;
- does not mutate the report.

The vendor submits a new VendorCompletionReport revision:

~~~text
Report #2
supersedesReportId = Report #1
~~~

Report #1 remains unchanged.

The correction flow does not itself reopen scheduling.

Only the latest un-superseded report can be used for manager closeout.

---

## 39. Follow-up after completion report

If manager review determines that more physical work is needed:

- the current report remains historical;
- assignment remains ACTIVE;
- a new SchedulingRound with purpose FOLLOW_UP is created;
- the round records the source completion report that led to follow-up;
- vendor work can resume only through the new current scheduling/visit flow.

This is not “correcting” the completion report.

It is more work.

---

## 40. Manager closeout

Vendor-managed closeout is a distinct manager operation.

It preserves the existing meaning of manager HANDLING COMPLETED:

> a human manager records that handling is complete; it is not proof of physical repair.

Closeout requires:

- current ORG_ADMIN / PROPERTY_STAFF authorization;
- ticket workStatus = IN_PROGRESS;
- current VendorAssignment = ACTIVE;
- current unsuperseded VendorCompletionReport exists;
- no active blocker;
- no OPEN SchedulingRound;
- no unresolved completion-report correction request;
- current report belongs to current assignment;
- existing ticket public-Q&A completion guard passes against expectedCommunicationVersion.

The manager supplies the existing bounded handling-completion message.

Vendor workSummary is never silently copied into the manager’s completion message.

---

## 41. Atomic closeout invariant

Vendor closeout must commit atomically.

Conceptually, under one transaction:

~~~text
recheck manager authorization
lock source ticket
lock current VendorAssignment
recheck current assignment/session-sensitive state
lock/verify current VendorCompletionReport
verify no blocker
verify no OPEN SchedulingRound
verify no pending report correction
run existing communication completion guard
record existing HANDLING COMPLETED semantics
set ticket IN_PROGRESS → COMPLETED
set assignment ACTIVE → ENDED / CLOSED
revoke vendor capability/session
commit
~~~

The system must not expose a committed intermediate state such as:

~~~text
ticket = COMPLETED
assignment = ACTIVE
~~~

All concurrent manager/vendor commands use a consistent lock order centered on the source ticket/current assignment.

Authorization is rechecked after waits.

---

## 42. Existing manager-only completion remains valid

This slice extends RC1; it does not replace direct manager handling.

If a ticket has no non-ended VendorAssignment:

- existing manager HANDLING IN_PROGRESS / COMPLETED behavior remains valid;
- historical ENDED assignments do not force a vendor closeout path.

If a ticket has a non-ended VendorAssignment:

- direct manager COMPLETED must not bypass the vendor assignment closeout invariant;
- manager must first end/revoke/supersede the current assignment or use the vendor closeout operation.

This is a required regression boundary.

---

## 43. Reassignment

Reassignment is one atomic manager command.

It:

1. ends the old non-ended assignment as ENDED / SUPERSEDED;
2. revokes all old vendor capability/session access;
3. supersedes any OPEN SchedulingRound;
4. supersedes future unoccurred Appointments;
5. preserves OCCURRED Appointments;
6. preserves Work Events;
7. preserves Completion Reports;
8. creates the new VendorAssignment as PREPARING.

The source ticket is not duplicated.

No moment may commit with two non-ended assignments.

---

## 44. Manager revoke

A manager may end a current assignment as ENDED / REVOKED.

Revocation:

- invalidates vendor token/session immediately;
- cancels/supersedes future assignment-owned scheduling according to current state;
- preserves all historical evidence;
- does not complete the ticket.

The manager may then continue direct handling or create a new assignment.

---

## 45. Ticket outcome after closeout

Only after ticket workStatus becomes COMPLETED does the accepted tenant outcome flow apply.

The existing result remains exactly one of:

- RESOLVED;
- UNRESOLVED;
- RECURRENCE_CLAIM.

VendorCompletionReport does not write a tenant outcome.

Manager closeout does not write a tenant outcome.

UNRESOLVED / RECURRENCE_CLAIM continue to create a fresh linked ticket under the accepted atomic follow-up semantics.

The old VendorAssignment remains ENDED / CLOSED.

A new follow-up ticket gets a new VendorAssignment only if a manager later chooses another approved external route.

---

## 46. Maintenance Fact Timeline integration

A completed source ticket remains eligible for the existing explicit manager-reviewed Maintenance Fact flow.

No automatic fact is created from:

- VendorCompletionReport;
- vendor workSummary;
- completion photos;
- componentOrPartNote;
- manager closeout;
- tenant outcome.

The Unit Maintenance Fact Timeline continues to contain only its accepted minimal structured fields and dynamic outcome/follow-up projection.

---

## 47. Manager UI

The manager uses the existing ticket workspace.

No global vendor marketplace or vendor directory is introduced.

The vendor handoff section supports:

- Create assignment;
- vendorLabel;
- prepare and preview exact Work Packet;
- select input photos;
- choose accessPolicy (tenant presence required or tenant preauthorization allowed);
- publish packet;
- issue/reissue/revoke secure link;
- observe assignment/scheduling/current waiting state;
- inspect vendor completion report and completion photos;
- request report correction;
- require follow-up work;
- close out;
- revoke/reassign.

Normal scheduling does not require manager approval at every step.

---

## 48. Tenant UI

Scheduling appears inside the existing tenant ticket experience.

The tenant can:

- submit current availability;
- explicitly preauthorize access within selected windows when offered;
- confirm one vendor-proposed slot when required;
- request rescheduling;
- view the current confirmed appointment;
- see simple current progress text.

The tenant does not see:

- vendorLabel;
- vendor completion raw photos;
- manager private notes;
- cost/invoice;
- vendor internal note;
- other assignments.

After manager completion, the existing tenant outcome UI remains the source of RESOLVED / UNRESOLVED / RECURRENCE_CLAIM.

---

## 49. Vendor UI

Vendor UI is a standalone no-account Web surface optimized for mobile.

It shows only:

- current Work Packet;
- current assignment acceptance action;
- current valid tenant availability/scheduling state;
- current Appointment;
- current work/blocker state;
- completion report form;
- vendor’s own current submitted report/result.

It provides no organization navigation, ticket list, unit list, staff list or historical unrelated job list.

390 px width is an acceptance target.

---

## 50. Candidate HTTP surface

Exact handler file layout is implementation-plan work, but the product contract uses separate namespaces.

### Existing authenticated manager namespace

Candidate manager routes:

- POST /api/v2/core/manager/tickets/:ticketId/vendor-assignment
- GET /api/v2/core/manager/tickets/:ticketId/vendor-assignment
- POST /api/v2/core/manager/vendor-assignments/:assignmentId/packet-revisions
- POST /api/v2/core/manager/vendor-assignments/:assignmentId/link
- POST /api/v2/core/manager/vendor-assignments/:assignmentId/revoke
- POST /api/v2/core/manager/vendor-assignments/:assignmentId/reassign
- POST /api/v2/core/manager/vendor-assignments/:assignmentId/completion-correction
- POST /api/v2/core/manager/vendor-assignments/:assignmentId/follow-up
- POST /api/v2/core/manager/vendor-assignments/:assignmentId/reschedule
- POST /api/v2/core/manager/vendor-assignments/:assignmentId/closeout

### Existing authenticated tenant namespace

Candidate tenant routes:

- GET /api/v2/core/tickets/:ticketId/vendor-scheduling
- POST /api/v2/core/tickets/:ticketId/vendor-scheduling/availability
- POST /api/v2/core/tickets/:ticketId/vendor-scheduling/confirm
- POST /api/v2/core/tickets/:ticketId/vendor-scheduling/reschedule

### Vendor capability namespace

Candidate vendor routes:

- POST /api/v2/vendor/session/redeem
- POST /api/v2/vendor/session/logout
- GET /api/v2/vendor/job
- POST /api/v2/vendor/job/accept
- POST /api/v2/vendor/job/decline
- POST /api/v2/vendor/job/withdraw
- POST /api/v2/vendor/scheduling/proposals
- POST /api/v2/vendor/scheduling/reschedule
- POST /api/v2/vendor/appointments/:appointmentId/visit-start
- POST /api/v2/vendor/blockers
- POST /api/v2/vendor/blockers/:blockerId/clear
- POST /api/v2/vendor/completion-reports
- GET /api/v2/vendor/photos/:photoId

Route naming may be mechanically normalized in the implementation plan to existing HTTP conventions, but the authorization and data contracts in this spec may not be weakened.

---

## 51. Mutation concurrency contract

Every consequential vendor mutation includes:

- clientRequestId;
- expectedAssignmentVersion;
- expectedPacketRevisionId.

Scheduling mutations additionally include:

- expectedRoundVersion.

Manager closeout includes at minimum:

- clientRequestId;
- expectedAssignmentVersion;
- expectedCompletionReportId;
- expectedCommunicationVersion.

Exact replay of the same request key/fingerprint returns the same committed result.

Reusing the key with changed intent returns STATE_CONFLICT.

Stale expected versions return STATE_CONFLICT and require reload.

The client never blindly retries an ambiguous mutation as a new command.

---

## 52. Response-loss / uncertain-result behavior

For side effects, the design requires durable request identity and authoritative readback.

On transport timeout or uncertain response:

1. do not claim success;
2. reload authoritative assignment/report/receipt state;
3. replay only the same idempotent request when the contract permits;
4. never create a fresh clientRequestId merely to “try again” without reconciliation.

No success UI is based solely on a client-side optimistic transition.

---

## 53. Hidden-resource error semantics

Vendor and tenant APIs must not reveal whether unrelated IDs exist.

Cross-assignment, cross-ticket, cross-unit and revoked-resource reads use the project’s hidden-resource behavior.

The design does not expose different “exists but forbidden” messages for guessed vendor-owned resource IDs.

---

## 54. RLS / database authorization requirements

New durable vendor resources require:

- organization scoping;
- FORCE RLS where consistent with the existing core_flow security model;
- explicit owner/runtime function grants;
- PUBLIC DML revoked;
- PUBLIC EXECUTE revoked by default;
- no runtime direct table DML;
- exact-resource authorization rechecked inside SECURITY DEFINER boundaries;
- current assignment/session recheck after relevant waits;
- current manager authorization recheck for manager mutations.

Client-provided scope identifiers never replace the server’s current authorization context.

The implementation plan must derive exact PostgreSQL owner/runtime roles from the final main ref without weakening existing B1–B5/core-flow boundaries.

---

## 55. Privacy / logging requirements

Never log or commit:

- raw capability tokens;
- vendor session cookie values;
- CSRF values;
- real tenant data;
- real vendor contact details;
- real access secrets;
- private completion photos.

Public-repo tests use clearly synthetic fixtures only.

Browser screenshots containing sensitive session data remain private evidence.

---

## 56. Time semantics

Durable times use timestamptz / offset-aware ISO timestamps.

The Korean development UI displays Asia/Seoul local time.

Scheduling comparisons are performed on absolute instants.

The implementation must reject invalid or non-finite timestamps and startAt >= endAt.

---

## 57. Scope exclusions

Not included in v1:

- Vendor Auth0 accounts;
- vendor organization/IAM;
- vendor employee roster;
- vendor marketplace;
- vendor scorecard;
- vendor CRM/address book;
- automated SMS/Kakao/email/push;
- estimates;
- quote comparison;
- cost approval;
- invoices;
- payment;
- warranty management;
- insurance claim packet;
- GPS or live location;
- ETA tracking;
- time-clock/payroll;
- free-form tenant/vendor chat;
- AI dispatch;
- AI repair-success determination;
- AI root-cause determination;
- automatic Maintenance Fact extraction;
- tenant-visible unit maintenance ledger;
- production hosting;
- production database credential provisioning;
- real tenant/vendor/address data;
- real-data retention-policy finalization.

---

## 58. State-machine summary

### Assignment

~~~text
PREPARING
→ OFFERED
→ ACTIVE
→ ENDED

ENDED reason:
DECLINED | WITHDRAWN | REVOKED | SUPERSEDED | CLOSED
~~~

### Scheduling round

~~~text
OPEN
→ CONFIRMED

or:
OPEN → SUPERSEDED
OPEN → CANCELLED
~~~

### Visit/work

~~~text
Appointment SCHEDULED
→ VISIT_STARTED
→ Appointment OCCURRED

optional:
BLOCKER_RECORDED
→ BLOCKER_CLEARED
→ FOLLOW_UP SchedulingRound
~~~

### Completion

~~~text
VendorCompletionReport
→ Manager:
   ├─ Closeout
   ├─ Report correction request
   └─ Follow-up work
~~~

### Product result

~~~text
Vendor Completion Report
≠ Manager COMPLETED
≠ Tenant RESOLVED
≠ Maintenance Fact
~~~

---

## 59. Required invariants

1. At most one non-ended VendorAssignment per ticket.
2. No ordinary assignment for SAFETY_ESCALATED.
3. No assignment without a human-approved external vendor route.
4. No secure link before a current published Work Packet exists.
5. Raw capability tokens are never durably stored or logged.
6. At most one active vendor browser session per assignment in v1.
7. Vendor authority is assignment-scoped and cannot cross tickets.
8. Vendor DTO is not a filtered Ticket or LandlordRepairPacket DTO.
9. Vendor input photos use an explicit allowlist.
10. serviceAddress/unit/issue are server-derived snapshots.
11. Tenant-reported details remain labeled TENANT_REPORTED.
12. Work Packet revisions are immutable.
13. Completion-reported state freezes packet publication until manager disposition.
14. Exactly one OPEN SchedulingRound per assignment.
15. Appointment start/end are immutable.
16. RESCHEDULE and FOLLOW_UP are different histories.
17. ENTRY_PREAUTHORIZED Appointment references the exact tenant authorization.
18. Preauthorized visit start rechecks current occupancy authority.
19. One VISIT_STARTED per Appointment.
20. At most one current blocker per assignment.
21. Blocker history is append-only.
22. Completion Report requires no current blocker/open scheduling round.
23. Completion photo evidence is bounded and metadata-sanitized.
24. Completion report correction is append-only.
25. Vendor completion cannot write ticket COMPLETED.
26. Vendor completion cannot write tenant outcome.
27. Manager vendor closeout is atomic with assignment CLOSED.
28. Existing Q&A completion guard remains in force.
29. Existing manager-only completion remains valid when no non-ended assignment exists.
30. Historical ended assignments never force a vendor closeout.
31. Tenant outcome remains post-COMPLETED only.
32. UNRESOLVED/RECURRENCE continues to create a fresh linked ticket.
33. Maintenance Fact remains explicit and manager-reviewed.
34. Vendor completion data is not automatically copied into Maintenance Fact.
35. Reassignment preserves occurred visits and historical vendor evidence.
36. Reassignment revokes old vendor access atomically.
37. All side effects are idempotent and stale-version protected.
38. Hidden resources do not leak existence through vendor errors.
39. Vendor screens are no-store and no-referrer.
40. No external notification delivery is implied by Web state changes.

---

## 60. Acceptance criteria

### AC01 — manager authorization
ORG_ADMIN and currently scoped PROPERTY_STAFF can act only on currently authorized source tickets.

### AC02 — external-route gate
No VendorAssignment can be created unless the human-selected route is GENERAL_VENDOR or MANUFACTURER_AS.

### AC03 — safety gate
SAFETY_ESCALATED prevents ordinary assignment, packet publish and link issue.

### AC04 — one-current-assignment
Concurrent create/reassign attempts commit at most one non-ended assignment.

### AC05 — no vendor IAM
A vendor completes the accepted flow without Auth0/user/org membership creation.

### AC06 — token storage
Database/public logs contain only token digest/metadata, never raw capability.

### AC07 — one-time redeem
A redeemed raw link cannot be redeemed again.

### AC08 — session replacement
Redeeming a replacement link revokes the previous vendor session.

### AC09 — assignment-scoped authorization
A vendor session for assignment A cannot read/write assignment B even with a known ID.

### AC10 — packet minimum data
Vendor job DTO contains only the fields defined by this design.

### AC11 — private data non-disclosure
Raw ticket text, full Q&A, private manager data, tenant contact data and unrelated history are absent from vendor responses.

### AC12 — detail provenance
TENANT_REPORTED / BUILDING_VERIFIED / MANAGER_REVIEWED remains visible and is not silently promoted.

### AC13 — address provenance
Vendor service address is server-derived; missing canonical address blocks publication.

### AC14 — photo allowlist
Only manager-selected same-ticket input photos are vendor-readable.

### AC15 — packet immutability
Publishing a packet creates a new immutable revision; prior revision remains unchanged.

### AC16 — stale packet mutation
Vendor mutation against an obsolete packet revision returns a conflict and does not commit.

### AC17 — redeem is not accept
Opening/redeeming a link leaves the assignment OFFERED until explicit vendor accept.

### AC18 — decline semantics
Vendor decline ends assignment as DECLINED without completing/cancelling the source ticket.

### AC19 — withdrawal semantics
Accepted vendor withdrawal ends assignment as WITHDRAWN and preserves all prior evidence.

### AC20 — scheduling round uniqueness
Only one OPEN SchedulingRound exists per assignment.

### AC21 — tenant confirmation scheduling
RESIDENT_CONFIRMATION_REQUIRED requires explicit tenant slot confirmation before Appointment creation.

### AC22 — preauthorized containment
PREAUTHORIZED_ENTRY_WINDOW is possible only when accessPolicy permits it and the current tenant explicitly authorized the relevant window; the confirmed vendor slot must be fully contained inside that window.

### AC23 — preauthorized occupancy recheck
If the authorizing tenant is no longer current for the unit, vendor VISIT_STARTED is denied.

### AC24 — immutable appointment time
Changing a scheduled time preserves the old Appointment and creates a new one.

### AC25 — reschedule/follow-up distinction
An occurred visit remains OCCURRED when a later FOLLOW_UP visit is scheduled.

### AC26 — no routine manager scheduling relay
Normal vendor/tenant scheduling succeeds without manager confirmation at each step.

### AC27 — no external notification claim
No test or UI claims SMS/Kakao/email/push delivery in v1.

### AC28 — visit start
Valid ACTIVE assignment/current Appointment permits exactly one VISIT_STARTED.

### AC29 — blocker overlay
A blocker does not erase the current operational phase/history.

### AC30 — blocker clear
Clearing a blocker references the exact blocker and preserves both events.

### AC31 — follow-up visit
A real prior visit plus additional work creates FOLLOW_UP history rather than rewriting the old Appointment.

### AC32 — completion requirements
Vendor cannot submit Completion Report with an active blocker or OPEN SchedulingRound.

### AC33 — completion-photo contract
Completion Report has one to five sanitized images or an explicit omission reason.

### AC34 — completion-photo metadata
Stored/served completion photos do not preserve EXIF/GPS metadata from the vendor input.

### AC35 — report correction
Manager correction request preserves old report; vendor submits a new report revision.

### AC36 — completion is not closeout
Vendor Completion Report leaves ticket IN_PROGRESS and assignment ACTIVE.

### AC37 — pending-completion freeze
Packet/scheduling/visit mutations are rejected while manager disposition of the current report is pending.

### AC38 — manager closeout atomicity
Successful closeout commits ticket COMPLETED and assignment ENDED/CLOSED together.

### AC39 — communication guard
A stale public-Q&A expectedCommunicationVersion prevents manager closeout with no partial vendor/ticket transition.

### AC40 — access revoked at closeout
Vendor capability/session cannot read the job after assignment CLOSED.

### AC41 — existing direct handling regression
A ticket with no non-ended VendorAssignment can still use the accepted manager-only completion flow.

### AC42 — historical vendor regression
An old DECLINED/REVOKED/SUPERSEDED assignment does not prevent later manager-only completion.

### AC43 — tenant outcome unchanged
Tenant RESOLVED / UNRESOLVED / RECURRENCE_CLAIM semantics remain unchanged after vendor closeout.

### AC44 — follow-up ticket unchanged
UNRESOLVED / RECURRENCE creates a new linked ticket and does not reopen the completed source ticket/assignment.

### AC45 — maintenance fact remains explicit
Manager completion/vendor report does not auto-create Unit Maintenance Fact.

### AC46 — tenant vendor-photo isolation
Tenant cannot call the raw vendor completion-photo endpoint.

### AC47 — RLS / ACL
New resources enforce exact org/assignment authorization, FORCE RLS where applicable, no PUBLIC runtime DML and bounded EXECUTE grants.

### AC48 — idempotency
Exact mutation replay produces one durable action and the same receipt/result.

### AC49 — changed replay
Same idempotency key with changed payload returns conflict.

### AC50 — stale concurrency
Concurrent manager/vendor mutations with stale expected versions do not overwrite newer state.

### AC51 — response-loss recovery
Ambiguous response is reconciled from authoritative state before retry; no duplicate action appears.

### AC52 — 390 px vendor Web
Vendor accept/schedule/work/blocker/completion flow is usable at 390 px without horizontal overflow.

### AC53 — 390 px manager/tenant integration
Manager handoff/closeout and tenant scheduling controls remain usable at 390 px within the accepted Web shell.

### AC54 — restart persistence
Assignment, packet revisions, scheduling, appointments, work events and completion-report history survive the owned-server restart scenario.

### AC55 — synthetic/public-data safety
Public Git/test fixtures/screenshots contain no real tenant/vendor data, real access secrets or raw capability/session values.

### AC56 — existing regression suite
Accepted RC1 manager queue, public Q&A, tenant outcome, photos, route/safety and Maintenance Fact Timeline behavior remains green.

### AC57 — exact-head hosted CI
The eventual published implementation candidate must obtain fresh required hosted checks on the exact candidate HEAD.

---

## 61. Runtime verification scenario

The implementation plan must eventually cover at least this synthetic scenario:

1. manager opens a reviewable synthetic ticket with an approved GENERAL_VENDOR route;
2. manager creates PREPARING assignment;
3. packet preview excludes raw tenant/private manager data;
4. manager publishes revision 1;
5. manager issues link and ticket becomes IN_PROGRESS if previously OPEN;
6. first token redeem succeeds and raw token cannot be reused;
7. vendor sees only current assignment packet;
8. vendor accepts;
9. tenant submits availability;
10. vendor proposes slots;
11. tenant confirms one;
12. Appointment is created;
13. vendor starts visit;
14. vendor records and clears a synthetic blocker;
15. FOLLOW_UP scheduling preserves the first occurred Appointment;
16. vendor starts follow-up visit;
17. vendor submits completion with sanitized synthetic photo;
18. manager requests one report correction;
19. vendor submits corrected report revision;
20. manager closes out;
21. ticket becomes COMPLETED and assignment ENDED/CLOSED atomically;
22. vendor session can no longer read the job;
23. tenant records one accepted outcome flow;
24. manager may explicitly record a Maintenance Fact separately;
25. no vendor data is automatically copied into that fact;
26. manager-only ticket with no vendor assignment still completes through the existing path;
27. cross-assignment vendor resource probes fail without existence leakage;
28. restart preserves all required vendor history;
29. 390 px vendor/tenant/manager flows pass;
30. existing RC1/Timeline regression paths remain valid.

A separate PREAUTHORIZED_ENTRY_WINDOW scenario must verify:

1. explicit tenant preauthorization;
2. vendor slot contained inside the authorized window;
3. Appointment links the authorization source;
4. current occupancy recheck before VISIT_STARTED;
5. stale/ended occupancy blocks visit start.

---

## 62. Migration / compatibility principles

Implementation must be additive.

Requirements:

- never rewrite migrations 0001–0018;
- first new database change is migration 0019 or later;
- no backfill of vendor assignments for historical tickets;
- historical tickets remain valid with zero VendorAssignments;
- historical completed tickets remain valid;
- no automatic Maintenance Fact creation;
- accepted B1–B5/core-flow roles/functions are not weakened;
- existing manager-only handling continues to work.

The exact number and shape of additive migrations are implementation-plan decisions.

---

## 63. Expected implementation boundaries

The future implementation is expected to add focused contracts/application/persistence/client/Web modules for:

- vendor assignment;
- vendor capability/session;
- work packet;
- scheduling;
- work execution;
- completion reports;
- manager integration;
- tenant scheduling projection;
- vendor standalone Web.

Integration edits will likely be required in:

- CoreScope/application exports;
- persistence adapter;
- Web HTTP routing;
- API client/contracts;
- manager ticket workspace;
- tenant ticket task zone;
- migration/test infrastructure.

The implementation plan must resolve exact paths from the then-current final main/spec HEAD.

This spec does not authorize those changes.

---

## 64. Security review focus for the implementation plan

Before implementation authorization, the plan must explicitly map tests for:

1. capability entropy/digest/redeem/reissue;
2. one active vendor session;
3. hidden-resource behavior;
4. assignment cross-scope denial;
5. packet photo allowlist;
6. route/safety preconditions;
7. stale assignment/round/packet versions;
8. preauthorized-entry occupancy recheck;
9. completion image type/size/pixel/metadata sanitization;
10. closeout lock/recheck/atomicity;
11. manager authorization revocation during waits;
12. vendor session revocation during waits;
13. response-loss/idempotency;
14. direct manager-only completion regression;
15. tenant outcome/Timeline regressions.

---

## 65. Evidence boundary

This document is a reviewed design specification only.

At publication time:

- product implementation: NOT_RUN;
- PostgreSQL migration/runtime verification: NOT_RUN;
- browser runtime: NOT_RUN;
- vendor external service: N/A in v1;
- production/real-data verification: NOT_AUTHORIZED;
- implementation CI: NOT_RUN.

A green docs-only repository check would prove document publication only, not product behavior.

---

## 66. Retained project risks

This slice does not resolve previously retained risks around:

- native/Expo/device runtime;
- actual-manager Auth0 limitations already documented by current canonical receipts;
- historical dependency security advisories;
- CI maintenance warnings;
- unrelated B3/B4 residual findings;
- real-data privacy/retention;
- production hosting/IAM.

Those remain separate from this design.

---

## 67. Success definition

The design succeeds when the future implementation can prove:

> A currently authorized manager can hand one approved, non-safety-escalated ticket to one external vendor without creating a vendor account; expose only a reviewed minimum-data packet; let vendor and current tenant coordinate a visit under explicit access rules; preserve reschedule/follow-up/work evidence; accept a bounded completion report; and atomically close the manager handling while keeping vendor report, manager completion, tenant outcome and Maintenance Fact as separate meanings.

The product must still work for manager-only tickets that never use a vendor.

---

## 68. Design freeze summary

If the operator approves this written spec, the following design decisions become frozen for the implementation plan:

- Ticket-scoped Vendor Secure Link;
- no vendor Auth0/IAM/profile/marketplace in v1;
- manual link delivery;
- VendorAssignment 1:N history, max one non-ended;
- PREPARING / OFFERED / ACTIVE / ENDED plus endReason;
- one-time raw token redeem;
- token digest only;
- 72-hour default raw-link expiry;
- one active assignment-scoped vendor session;
- 7-day absolute vendor-session maximum;
- manager-reviewed immutable Work Packet revisions;
- separate vendor DTO, no filtered Ticket reuse;
- explicit input-photo allowlist;
- Work Packet accessPolicy limited to TENANT_PRESENT_REQUIRED / TENANT_PREAUTHORIZATION_ALLOWED;
- realized scheduling limited to RESIDENT_CONFIRMATION_REQUIRED / PREAUTHORIZED_ENTRY_WINDOW;
- only the current tenant can create the preauthorization that enables PREAUTHORIZED_ENTRY_WINDOW;
- SchedulingRound aggregate;
- RESCHEDULE distinct from FOLLOW_UP;
- immutable Appointment times;
- explicit preauthorization provenance and occupancy recheck;
- append-only visit/blocker evidence;
- bounded completion report with sanitized photo closeout;
- append-only completion-report correction;
- vendor completion distinct from manager completion;
- manager closeout distinct from tenant outcome;
- Maintenance Fact remains explicit/manual;
- existing manager-only completion preserved;
- estimates/cost/invoices/payments/notifications/vendor accounts remain out of scope.

A frozen decision may reopen only under the repository’s existing new-evidence rule or explicit operator instruction.
