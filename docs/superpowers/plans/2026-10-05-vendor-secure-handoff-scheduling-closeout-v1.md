# Vendor Secure Handoff, Scheduling & Closeout v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Add a development-only ticket-scoped vendor handoff that lets one external vendor securely receive a reviewed work packet, coordinate appointments with the current tenant, record visit/blocker/completion evidence, and reach atomic manager closeout without creating vendor IAM or changing existing tenant outcome / Maintenance Fact semantics.

**Architecture:** Extend the existing \`core_flow\` PostgreSQL boundary through additive migrations \`0019+\`, while keeping authenticated manager/tenant traffic under \`/api/v2/core\` and creating a separate \`/api/v2/vendor\` capability-session boundary backed by a dedicated restricted database runtime role. Build the feature in vertical RED→GREEN slices: assignment/packet, capability/session, scheduling, visit/blocker, completion report/photo, closeout, then the three Web surfaces and whole-flow verification.

**Tech Stack:** Node 24.21.x, TypeScript 6.0.3, Next.js 16.3.4, React 19.2.3, Zod 4.6.5, PostgreSQL 18, pg 8.23.0, sharp 0.35.4, Vitest 5.0.0, Playwright 1.63.0.

**Spec:** \`docs/superpowers/specs/2026-10-05-vendor-secure-handoff-scheduling-closeout-v1-design.md\`

**POLICY_REF:** \`954ef347efef9db29465aefa2e72003b176ee150\`  
**PLAN_TARGET_REF:** \`bdeb5deb07f20efe808659b5fd93cd1696bcfd98\`  
**Approved design status:** \`DESIGN_APPROVED / IMPLEMENTATION_PLAN_DRAFTING_AUTHORIZED\`  
**Product implementation authority while this plan is under review:** \`NOT_GRANTED\`

## Global Constraints

- Never rewrite migrations \`0001\`–\`0018\`; all database work is additive beginning at \`0019\`.
- Preserve accepted RC1 behavior, existing manager-only completion, public Q&A completion guard, tenant outcome/follow-up, and Unit Maintenance Fact Timeline semantics.
- No vendor Auth0 account, vendor organization membership, marketplace, vendor profile, staff roster, vendor CRM, automatic SMS/Kakao/email/push, estimate/cost/invoice/payment, warranty, insurance, GPS/ETA, free-form tenant/vendor chat, autonomous dispatch, AI success/root-cause decision, automatic Maintenance Fact, production hosting, production credential provisioning, or real tenant/vendor/address data.
- Reuse installed dependencies. Do not add a dependency unless a RED test proves the existing stack cannot implement an approved requirement and the operator separately approves the dependency.
- Vendor HTTP and database authority stays separate from B1/Auth0 manager/tenant authority.
- \`bm_b1_web\` must not be the vendor runtime database credential.
- New vendor database runtime grants are exact EXECUTE/USAGE only; no direct table DML.
- Work Packet is a dedicated minimum-data projection, not a filtered Ticket / LandlordRepairPacket DTO.
- At most one non-ended VendorAssignment exists per ticket.
- Vendor completion report, manager COMPLETED, tenant outcome, and Maintenance Fact remain four distinct meanings.
- Raw capability/session/CSRF values never enter logs, Git, screenshots, evidence receipts, or test fixtures.
- Public tests use synthetic data only.
- Vendor completion image input is JPEG/PNG only, max 5 MiB, max 20,000,000 pixels, decoded/re-encoded so EXIF/GPS/XMP/ICC metadata does not survive.
- Web changes reuse the accepted RC1 Apple/Toss responsive system; no redesign.
- Vendor, manager and tenant v1 flows must be usable at 390 px without horizontal overflow.
- All consequential mutations use durable \`clientRequestId\` plus expected-version contracts and reconcile uncertain responses before replay.
- Production/IAM/real-data execution remains forbidden even after product implementation is later approved.
- Implementation stops before Ready/merge/deployment until a fixed implementation candidate receives the required review and exact-head hosted checks.

## Review Focus

1. **Capability replay / reissue race:** two redeems or a redeem racing link reissue must yield one valid current session, one-time token consumption, and no resurrected old session. Task 3 owns the concurrent PostgreSQL + HTTP tests.
2. **Stale tenant preauthorization:** tenant preauthorizes a window, then occupancy ends before visit start; appointment history remains, but \`VISIT_STARTED\` is denied with no work event. Task 5 owns this test.
3. **Packet revision during open scheduling:** manager publishes a non-scheduling packet revision while an OPEN round exists; old vendor mutation must 409, current round history must survive, and fresh reload may continue. Task 4 owns this test.
4. **Closeout race:** manager closeout races report correction/follow-up/revocation or manager authorization withdrawal; at most one valid disposition commits and no \`COMPLETED + ACTIVE assignment\` state can exist. Task 7 owns these tests.
5. **Hostile completion image:** forged MIME, metadata-bearing JPEG, oversized bytes, oversized pixels and malformed codec input must fail or normalize without leaking codec/metadata details. Task 6 owns these tests.

---

## File / Responsibility Map

### Shared contracts and application interfaces

- Create \`packages/api-contracts/src/core-vendor-handoff.ts\` — strict manager, tenant and vendor DTOs/schemas.
- Modify \`packages/api-contracts/src/index.ts\` — export the vendor-handoff contract.
- Create \`packages/application/src/core-vendor-handoff.ts\` — authenticated manager/tenant scope types, vendor capability port types, orchestration helpers.
- Modify \`packages/application/src/core-flow.ts\` — add authenticated vendor-handoff scope to \`CoreScope\`; add direct-completion guard integration point.
- Modify \`packages/application/src/index.ts\` — export the vendor-handoff application boundary.

### PostgreSQL and development-role boundary

- Create \`packages/persistence-postgres/src/testing/core-vendor-roles.ts\` — disposable development/test \`bm_core_vendor_web\` LOGIN role and config only.
- Modify \`packages/persistence-postgres/src/testing/roles.ts\` — return \`vendorConfig\`.
- Modify \`packages/persistence-postgres/src/testing/index.ts\` — export vendor-role helper/types.
- Create migrations:
  - \`0019_core_vendor_assignment.sql\`
  - \`0020_core_vendor_capability.sql\`
  - \`0021_core_vendor_scheduling.sql\`
  - \`0022_core_vendor_execution.sql\`
  - \`0023_core_vendor_completion.sql\`
  - \`0024_core_vendor_closeout.sql\`
- Modify \`packages/persistence-postgres/src/core-flow.ts\` — authenticated manager/tenant vendor-handoff scope implementation.
- Create \`packages/persistence-postgres/src/core-vendor.ts\` — capability-session-scoped vendor port using the restricted vendor database connection.
- Modify \`packages/persistence-postgres/package.json\` — export \`./core-vendor\`.
- Modify \`packages/persistence-postgres/src/testing/core-flow-fixture.ts\` — add clearly synthetic canonical \`normalizedAddress\` fixture only.

### Authenticated core HTTP/client

- Create \`apps/web/src/server/core-flow/vendor-manager.ts\` — manager vendor-assignment/packet/link/closeout routes.
- Create \`apps/web/src/server/core-flow/vendor-tenant.ts\` — tenant scheduling routes.
- Create \`apps/web/src/server/core-flow/vendor-manager.test.ts\`.
- Create \`apps/web/src/server/core-flow/vendor-tenant.test.ts\`.
- Modify \`apps/web/src/server/core-flow/http.ts\` — delegate only approved manager/tenant vendor routes.
- Create \`packages/api-client/src/core-vendor-handoff.ts\` — manager + tenant authenticated client.
- Modify \`packages/api-client/src/core-flow.ts\` — attach \`vendor\` client.
- Modify \`packages/api-client/src/index.ts\` — export public client types as needed.

### Vendor capability HTTP/client

- Create \`apps/web/src/server/vendor-flow/container.ts\`.
- Create \`apps/web/src/server/vendor-flow/http.ts\`.
- Create \`apps/web/src/server/vendor-flow/photos.ts\`.
- Create \`apps/web/src/server/vendor-flow/http.test.ts\`.
- Create \`apps/web/src/server/vendor-flow/photos.test.ts\`.
- Create \`apps/web/src/app/api/v2/vendor/[...path]/route.ts\`.
- Create \`packages/api-client/src/vendor-flow.ts\`.
- Modify development launch scripts to pass the private \`vendorConfig\` as \`CORE_VENDOR_DATABASE_CONFIG\`.

### Web UI

- Create \`apps/web/src/app/core/manager-vendor-handoff.tsx\` and focused module CSS/test.
- Create \`apps/web/src/app/core/tenant-vendor-scheduling.tsx\` and focused test.
- Modify \`apps/web/src/app/core/core-screen.tsx\` only for integration into the existing manager inspector / tenant task zone.
- Create \`apps/web/src/app/vendor/job/page.tsx\`.
- Create \`apps/web/src/app/vendor/job/vendor-job-screen.tsx\`, module CSS and focused test.

### Runtime / integration evidence

- Create focused PostgreSQL tests \`tests/postgres/core-vendor-*.test.ts\`.
- Create \`apps/web/tests/core-e2e/vendor-handoff.spec.ts\`.
- Create \`apps/web/tests/core-login-e2e/vendor-handoff.spec.ts\`.
- Create \`scripts/core-vendor-restart-check.mjs\`.
- Update \`docs/core-flow-rc1-running.md\` only with synthetic-development run instructions required by the accepted implementation.
- Create/update one sanitized implementation receipt under \`ops/\` during execution; do not place raw tokens/photos in it.

---

### Task 1: Freeze Contracts and Application Boundaries

**Files:**
- Create: \`packages/api-contracts/src/core-vendor-handoff.ts\`
- Test: \`packages/api-contracts/src/core-vendor-handoff.test.ts\`
- Modify: \`packages/api-contracts/src/index.ts\`
- Create: \`packages/application/src/core-vendor-handoff.ts\`
- Modify: \`packages/application/src/core-flow.ts\`
- Modify: \`packages/application/src/index.ts\`

**Interfaces:**
- Produces \`CoreVendorAuthenticatedScope\`, \`CoreVendorManagerScope\`, \`CoreVendorTenantScope\`, and \`VendorFlowPort\`.
- Produces DTO/schema names used verbatim by later tasks.
- No SQL or HTTP implementation in this task.

- [ ] **Step 1: Add RED contract tests for strict minimum-data DTOs**

Test names:
- \`rejects tenant/private manager fields from VendorJobSchema\`
- \`accepts only TENANT_PRESENT_REQUIRED or TENANT_PREAUTHORIZATION_ALLOWED packet policy\`
- \`requires clientRequestId and expected versions on every mutation\`
- \`bounds vendorLabel/workSummary/accessInstruction/correctionReason text\`
- \`requires one-to-five scheduling windows/slots and validates offset timestamps\`
- \`requires one-to-five completion photos or an omission reason\`

Key assertions:

~~~ts
expect(() => VendorJobSchema.parse({...validJob, tenantName:"forbidden"})).toThrow();
expect(() => VendorPacketPublishSchema.parse({...validPacket, accessPolicy:"MANAGER_COORDINATED"})).toThrow();
expect(VendorCompletionReportCreateSchema.safeParse({
  ...validReport,
  completionPhotoIds:[],
  photoOmissionReason:null,
}).success).toBe(false);
~~~

- [ ] **Step 2: Run RED**

Run:

~~~bash
npm run test:shared -- --run packages/api-contracts/src/core-vendor-handoff.test.ts
~~~

Expected: FAIL because the contract module/schemas do not exist.

- [ ] **Step 3: Define exact contract enums and DTOs**

In \`packages/api-contracts/src/core-vendor-handoff.ts\`, define/export these exact enums:

~~~ts
CoreVendorAssignmentStatus = "PREPARING" | "OFFERED" | "ACTIVE" | "ENDED";
CoreVendorAssignmentEndReason = "DECLINED" | "WITHDRAWN" | "REVOKED" | "SUPERSEDED" | "CLOSED";
CoreVendorAccessPolicy = "TENANT_PRESENT_REQUIRED" | "TENANT_PREAUTHORIZATION_ALLOWED";
CoreVendorSchedulingMode = "RESIDENT_CONFIRMATION_REQUIRED" | "PREAUTHORIZED_ENTRY_WINDOW";
CoreVendorSchedulingPurpose = "INITIAL" | "RESCHEDULE" | "FOLLOW_UP";
CoreVendorSchedulingRoundStatus = "OPEN" | "CONFIRMED" | "SUPERSEDED" | "CANCELLED";
CoreVendorAppointmentDisposition = "SCHEDULED" | "OCCURRED" | "SUPERSEDED" | "CANCELLED";
CoreVendorAppointmentConfirmationMode = "TENANT_CONFIRMED" | "PREAUTHORIZED_ENTRY";
CoreVendorBlockerCode = "PARTS_REQUIRED" | "ACCESS_BLOCKED" | "SCOPE_REVIEW_REQUIRED" | "FOLLOW_UP_VISIT_REQUIRED" | "OTHER";
CoreVendorWaitingOn = "NONE" | "TENANT" | "VENDOR" | "MANAGER" | "PARTS";
CoreVendorDeclineReason = "NO_CAPACITY" | "OUT_OF_SERVICE_AREA" | "SKILL_MISMATCH" | "CANNOT_MEET_TIMING" | "OTHER";
CoreVendorPhotoOmissionReason = "NOT_APPLICABLE" | "SAFETY_OR_PRIVACY" | "TECHNICAL_FAILURE";
CoreVendorSharedDetailSource = "TENANT_REPORTED" | "BUILDING_VERIFIED" | "MANAGER_REVIEWED";
~~~

Define strict schemas/types for:
- assignment summary/detail;
- Work Packet revision;
- packet publish;
- manager create/issue/revoke/reassign/closeout/correction/follow-up inputs;
- vendor redeem result + VendorJob;
- accept/decline/withdraw;
- SchedulingRound / availability / proposal / Appointment;
- visit start / blocker record / blocker clear;
- Completion Report + report correction request;
- vendor completion photo metadata.

Reuse existing Core photo byte/pixel constants; add \`CORE_VENDOR_COMPLETION_PHOTO_MAX_COUNT = 5\`.

- [ ] **Step 4: Define application scope signatures**

In \`packages/application/src/core-vendor-handoff.ts\`, define the exact top-level boundary:

~~~ts
export type CoreVendorAuthenticatedScope = {
  manager: CoreVendorManagerScope;
  tenant: CoreVendorTenantScope;
};

export type CoreVendorManagerScope = {
  read(ticketId:string):Promise<CoreVendorAssignmentDetail|null>;
  create(ticketId:string,input:CoreVendorAssignmentCreate):Promise<CoreVendorAssignmentDetail>;
  publishPacket(assignmentId:string,input:CoreVendorPacketPublish):Promise<CoreVendorAssignmentDetail>;
  issueLink(assignmentId:string,input:CoreVendorLinkIssuePersistenceInput):Promise<CoreVendorLinkIssuePersistenceResult>;
  revoke(assignmentId:string,input:CoreVendorAssignmentCommand):Promise<CoreVendorAssignmentDetail>;
  reassign(assignmentId:string,input:CoreVendorReassignPersistenceInput):Promise<CoreVendorAssignmentDetail>;
  requestReportCorrection(assignmentId:string,input:CoreVendorCompletionCorrectionRequest):Promise<CoreVendorAssignmentDetail>;
  followUp(assignmentId:string,input:CoreVendorFollowUpCommand):Promise<CoreVendorAssignmentDetail>;
  closeout(assignmentId:string,input:CoreVendorCloseoutCommand):Promise<CoreVendorCloseoutResult>;
  guardDirectCompletion(ticketId:string):Promise<void>;
};

export type CoreVendorTenantScope = {
  read(ticketId:string):Promise<CoreVendorTenantSchedulingView|null>;
  submitAvailability(ticketId:string,input:CoreVendorAvailabilityCreate):Promise<CoreVendorTenantSchedulingView>;
  confirm(ticketId:string,input:CoreVendorAppointmentConfirm):Promise<CoreVendorTenantSchedulingView>;
  reschedule(ticketId:string,input:CoreVendorTenantReschedule):Promise<CoreVendorTenantSchedulingView>;
};

export type VendorFlowPort = {
  redeem(tokenDigest:string,sessionDigest:string,csrfDigest:string):Promise<CoreVendorRedeemPersistenceResult>;
  run<T>(sessionDigest:string, operation:(scope:VendorScope)=>Promise<T>):Promise<T>;
};
~~~

Define \`VendorScope\` methods for:
- read job;
- accept/decline/withdraw;
- propose/reschedule;
- visitStart;
- recordBlocker / clearBlocker;
- completion photo preflight/read/save;
- submit completion report.

Do not put raw tokens/cookies into any shared DTO.

- [ ] **Step 5: Wire exports and \`CoreScope.vendor\`**

Modify \`CoreScope\`:

~~~ts
vendor: CoreVendorAuthenticatedScope;
~~~

No behavior changes yet; persistence implementation follows later.

- [ ] **Step 6: Run GREEN + package typecheck**

Run:

~~~bash
npm run test:shared -- --run packages/api-contracts/src/core-vendor-handoff.test.ts
npm run typecheck
~~~

Expected: PASS.

- [ ] **Step 7: Commit**

~~~bash
git add packages/api-contracts/src/core-vendor-handoff.ts packages/api-contracts/src/core-vendor-handoff.test.ts packages/api-contracts/src/index.ts packages/application/src/core-vendor-handoff.ts packages/application/src/core-flow.ts packages/application/src/index.ts
git commit -m "feat: define vendor handoff contracts"
~~~

---

### Task 2: Add VendorAssignment and Immutable Work Packet Foundation

**Files:**
- Create: \`packages/persistence-postgres/migrations/0019_core_vendor_assignment.sql\`
- Modify: \`packages/persistence-postgres/src/core-flow.ts\`
- Modify: \`packages/persistence-postgres/src/testing/core-flow-fixture.ts\`
- Test: \`tests/postgres/core-vendor-assignment.test.ts\`
- Create: \`apps/web/src/server/core-flow/vendor-manager.ts\`
- Create: \`apps/web/src/server/core-flow/vendor-manager.test.ts\`
- Modify: \`apps/web/src/server/core-flow/http.ts\`
- Create: \`packages/api-client/src/core-vendor-handoff.ts\`
- Modify: \`packages/api-client/src/core-flow.ts\`

**Interfaces:**
- Consumes Task 1 manager scope/contracts.
- Produces manager create/read/publish packet API.
- Link issuance is declared in contracts but stays unimplemented until Task 3.

- [ ] **Step 1: Write RED PostgreSQL tests for assignment/packet invariants**

Test names:
- \`creates one PREPARING assignment only after an approved external route\`
- \`rejects SAFETY_ESCALATED and non-external routes\`
- \`allows manager and assigned PROPERTY_STAFF but hides foreign/unassigned tickets\`
- \`publishes immutable packet with server-derived address/unit/issue\`
- \`rejects missing normalizedAddress instead of using tenant raw text\`
- \`persists only allowlisted sharedDetails and selected same-ticket photos\`
- \`concurrent assignment create commits at most one non-ended row\`
- \`stale packet publish version returns STATE_CONFLICT\`
- \`vendor tables are FORCE RLS and runtime has no direct DML\`

Synthetic fixture change:

~~~ts
body.normalizedAddress = org === orgA
  ? "서울특별시 합성구 테스트로 101"
  : "서울특별시 합성구 테스트로 202";
~~~

- [ ] **Step 2: Run RED**

~~~bash
npm run test:postgres -- --run tests/postgres/core-vendor-assignment.test.ts
~~~

Expected: FAIL because migration/functions are absent.

- [ ] **Step 3: Implement migration \`0019_core_vendor_assignment.sql\`**

Create tables owned by \`bm_core_flow_owner\`:

~~~text
core_flow.vendor_assignment
core_flow.vendor_work_packet_revision
core_flow.vendor_work_packet_detail
core_flow.vendor_work_packet_photo
~~~

Required constraints:
- partial unique index: one assignment per ticket where status <> ENDED;
- \`end_reason IS NULL\` iff status <> ENDED;
- immutable packet revision number unique per assignment;
- packet location/issue snapshot columns non-null;
- access policy exact enum;
- Work Packet text bounds from spec;
- detail source enum exact;
- packet photo FK to same source ticket photo through server validation;
- FORCE RLS + restrictive org ceiling consistent with current core_flow pattern.

Manager functions exposed to \`bm_b1_web\`:
- \`read_vendor_assignment(bytea,text)\`
- \`create_vendor_assignment(bytea,text,uuid,text,bigint)\`
- \`publish_vendor_packet(bytea,uuid,uuid,bigint,text,text,text,jsonb,uuid[])\`

Private helper:
- \`vendor_manager_assignment(bytea,uuid,boolean)\`

Lock order begins with source ticket, then assignment.

- [ ] **Step 4: Implement authenticated persistence scope**

In \`packages/persistence-postgres/src/core-flow.ts\`, wire:

~~~ts
vendor: {
  manager: {
    read,
    create,
    publishPacket,
    // later methods may throw FORBIDDEN/DEPENDENCY_UNAVAILABLE until owning tasks wire them
  },
  tenant: { /* task 4 */ },
}
~~~

Do not return unimplemented methods silently; use an explicit internal unsupported function only until the owning task in this same branch replaces it.

- [ ] **Step 5: Add manager HTTP RED tests**

Test:
- POST create requires current manager role + CSRF and valid expected ticket version;
- GET returns null/no-current or current assignment;
- publish rejects extra private fields;
- cross-org/tenant probes return existing hidden/forbidden semantics;
- response contains no tenant raw text, Q&A, manager note/priority/due.

Run:

~~~bash
npm run test:web -- --run src/server/core-flow/vendor-manager.test.ts
~~~

Expected: FAIL.

- [ ] **Step 6: Implement manager create/read/publish routes**

Delegate from \`handleCoreFlow\` to \`vendor-manager.ts\` for only:
- \`GET /api/v2/core/manager/tickets/:ticketId/vendor-assignment\`
- \`POST /api/v2/core/manager/tickets/:ticketId/vendor-assignment\`
- \`POST /api/v2/core/manager/vendor-assignments/:assignmentId/packet-revisions\`

Follow existing bounded JSON-body parser, origin/CSRF and manager role behavior.

- [ ] **Step 7: Add authenticated API client methods**

In \`core-vendor-handoff.ts\` expose:

~~~ts
manager.read(ticketId)
manager.create(ticketId,input)
manager.publishPacket(assignmentId,input)
~~~

Attach as \`client.vendor.manager\`.

- [ ] **Step 8: Run GREEN**

~~~bash
npm run test:postgres -- --run tests/postgres/core-vendor-assignment.test.ts
npm run test:web -- --run src/server/core-flow/vendor-manager.test.ts
npm run test:shared
npm run typecheck
~~~

Expected: PASS.

- [ ] **Step 9: Commit**

~~~bash
git add packages/persistence-postgres/migrations/0019_core_vendor_assignment.sql packages/persistence-postgres/src/core-flow.ts packages/persistence-postgres/src/testing/core-flow-fixture.ts tests/postgres/core-vendor-assignment.test.ts apps/web/src/server/core-flow/vendor-manager.ts apps/web/src/server/core-flow/vendor-manager.test.ts apps/web/src/server/core-flow/http.ts packages/api-client/src/core-vendor-handoff.ts packages/api-client/src/core-flow.ts
git commit -m "feat: add vendor assignment work packets"
~~~

---

### Task 3: Add One-Time Capability Redemption and Separate Vendor Database Session

**Files:**
- Create: \`packages/persistence-postgres/src/testing/core-vendor-roles.ts\`
- Modify: \`packages/persistence-postgres/src/testing/roles.ts\`
- Modify: \`packages/persistence-postgres/src/testing/index.ts\`
- Create: \`packages/persistence-postgres/migrations/0020_core_vendor_capability.sql\`
- Create: \`packages/persistence-postgres/src/core-vendor.ts\`
- Modify: \`packages/persistence-postgres/package.json\`
- Test: \`tests/postgres/core-vendor-capability.test.ts\`
- Create: \`apps/web/src/server/vendor-flow/container.ts\`
- Create: \`apps/web/src/server/vendor-flow/http.ts\`
- Create: \`apps/web/src/server/vendor-flow/http.test.ts\`
- Create: \`apps/web/src/app/api/v2/vendor/[...path]/route.ts\`
- Create: \`packages/api-client/src/vendor-flow.ts\`
- Modify: \`packages/api-client/src/index.ts\`
- Modify: \`scripts/core-flow-dev.mjs\`
- Modify: \`scripts/core-flow-b1-dev.mjs\`
- Modify: \`apps/web/src/server/core-flow/vendor-manager.ts\`

**Interfaces:**
- Consumes current assignment/packet from Task 2.
- Produces \`bm_core_vendor_web\` development/test connection and \`createVendorFlowPort(database)\`.
- Produces manager link issue, vendor redeem/job/read, accept/decline/withdraw.

- [ ] **Step 1: Write RED role and capability PostgreSQL tests**

Assert:
- \`bm_core_vendor_web\` is LOGIN only in disposable test/dev cluster, not superuser/create/db/role/bypassrls;
- it has no membership in \`bm_core_flow_owner\`, \`bm_b1_web\`, or manager/tenant capability roles;
- it cannot execute \`core_flow.read_ticket\`, \`store_ticket\`, manager functions or direct table DML;
- it can execute only explicitly granted vendor-safe functions;
- raw link digest is the durable credential form;
- exact token redeem is one-time;
- concurrent two-session redeem/reissue leaves exactly one active vendor session;
- new redemption revokes previous active session;
- expired/revoked capability cannot redeem;
- assignment end invalidates session reads.

- [ ] **Step 2: Run RED**

~~~bash
npm run test:postgres -- --run tests/postgres/core-vendor-capability.test.ts
~~~

Expected: FAIL.

- [ ] **Step 3: Add disposable vendor test role**

\`provisionCoreVendorTestRole(admin, base)\` creates:
- user: \`bm_core_vendor_web\`;
- random development/test password;
- LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, NOINHERIT.

Extend \`TestRoleCredentials\`:

~~~ts
readonly vendorConfig: ClientConfig;
~~~

Do not add production provisioning code.

- [ ] **Step 4: Implement migration \`0020_core_vendor_capability.sql\`**

Create:
- \`core_flow.vendor_capability\`
- \`core_flow.vendor_session\`

Durable columns use digests only.

Rules:
- issue expiry = database clock + 72 hours;
- session expiry = database clock + 7 days;
- redeemed capability cannot redeem again;
- reissue revokes old unredeemed capability;
- redeem revokes any old active session before inserting the new one;
- one active non-revoked session row per assignment;
- assignment ENDED denies all vendor reads/mutations.

Manager function to \`bm_b1_web\`:
- \`issue_vendor_link(bytea,uuid,uuid,bigint,bytea)\`

Vendor runtime functions to \`bm_core_vendor_web\` only:
- \`redeem_vendor_capability(bytea,bytea,bytea)\`
- \`read_vendor_job(bytea)\`
- \`accept_vendor_assignment(bytea,uuid,bigint,uuid)\`
- \`decline_vendor_assignment(bytea,uuid,bigint,uuid,text,text)\`
- \`withdraw_vendor_assignment(bytea,uuid,bigint,uuid,text)\`

Private helpers remain executable only by owner:
- vendor session resolver;
- current-assignment resolver;
- vendor job projection.

- [ ] **Step 5: Implement \`createVendorFlowPort\`**

\`packages/persistence-postgres/src/core-vendor.ts\` creates a pool from the vendor config and exposes exactly Task 1’s \`VendorFlowPort\`.

Do not import/use the B1 session resolver.

Map SQL errors to \`CoreFlowError\` without logging credential values.

- [ ] **Step 6: Add RED vendor HTTP tests**

Tests:
- redeem accepts exactly one 64-hex raw token JSON field;
- HTTP hashes raw token and generates random raw session/CSRF values;
- raw token never appears in response, log, DB spy args other than digest;
- cookie: HttpOnly, SameSite=Strict, Path=/api/v2/vendor, Secure on https;
- response returns CSRF + current VendorJob;
- no valid cookie → 401;
- POST without matching \`x-vendor-csrf\` → 403 before mutation;
- headers include no-store/no-referrer/nosniff/frame protection;
- method/query/body are strict;
- vendor route never calls Core/B1 port.

- [ ] **Step 7: Implement separate vendor HTTP/container/route**

Environment:
- \`CORE_VENDOR_DATABASE_CONFIG\` must be loopback-only in SYNTHETIC_LOCAL, same defensive parsing style as core container.
- no B1 access/client.
- no third-party analytics/scripts in vendor route.

Routes:
- POST \`/api/v2/vendor/session/redeem\`
- POST \`/api/v2/vendor/session/logout\`
- GET \`/api/v2/vendor/job\`
- POST \`/api/v2/vendor/job/accept\`
- POST \`/api/v2/vendor/job/decline\`
- POST \`/api/v2/vendor/job/withdraw\`

- [ ] **Step 8: Wire manager link issue**

Manager HTTP route:

\`POST /api/v2/core/manager/vendor-assignments/:assignmentId/link\`

HTTP generates 32 random bytes as 64 lowercase hex, persists only \`sha256(rawToken)\`, and returns the raw token exactly once to the manager client as a link fragment payload.

No raw token is returned by subsequent GET.

- [ ] **Step 9: Update synthetic launch scripts**

Pass:

~~~text
CORE_VENDOR_DATABASE_CONFIG = state.roles.vendorConfig
~~~

Never print it.

Persist the config only inside the existing private state file outside Git.

- [ ] **Step 10: Run GREEN and Review Focus #1**

~~~bash
npm run test:postgres -- --run tests/postgres/core-vendor-capability.test.ts
npm run test:web -- --run src/server/vendor-flow/http.test.ts
npm run typecheck
~~~

Expected: PASS including concurrent redeem/reissue.

- [ ] **Step 11: Commit**

~~~bash
git add packages/persistence-postgres/src/testing/core-vendor-roles.ts packages/persistence-postgres/src/testing/roles.ts packages/persistence-postgres/src/testing/index.ts packages/persistence-postgres/migrations/0020_core_vendor_capability.sql packages/persistence-postgres/src/core-vendor.ts packages/persistence-postgres/package.json tests/postgres/core-vendor-capability.test.ts apps/web/src/server/vendor-flow apps/web/src/app/api/v2/vendor packages/api-client/src/vendor-flow.ts packages/api-client/src/index.ts scripts/core-flow-dev.mjs scripts/core-flow-b1-dev.mjs apps/web/src/server/core-flow/vendor-manager.ts
git commit -m "feat: add vendor capability sessions"
~~~

---

### Task 4: Add SchedulingRound, Tenant Availability, Proposals and Appointments

**Files:**
- Create: \`packages/persistence-postgres/migrations/0021_core_vendor_scheduling.sql\`
- Modify: \`packages/persistence-postgres/src/core-flow.ts\`
- Modify: \`packages/persistence-postgres/src/core-vendor.ts\`
- Test: \`tests/postgres/core-vendor-scheduling.test.ts\`
- Create: \`apps/web/src/server/core-flow/vendor-tenant.ts\`
- Create: \`apps/web/src/server/core-flow/vendor-tenant.test.ts\`
- Modify: \`apps/web/src/server/core-flow/http.ts\`
- Modify: \`apps/web/src/server/vendor-flow/http.ts\`
- Modify: \`apps/web/src/server/vendor-flow/http.test.ts\`
- Modify: \`packages/api-client/src/core-vendor-handoff.ts\`
- Modify: \`packages/api-client/src/vendor-flow.ts\`

**Interfaces:**
- Consumes ACTIVE assignment and current packet.
- Produces tenant scheduling view and vendor proposal/appointment state.
- SchedulingRound is the sole scheduling concurrency anchor.

- [ ] **Step 1: Write RED PostgreSQL tests**

Cover:
- exactly one OPEN round;
- INITIAL opens after vendor accept;
- tenant submission requires current ticket tenant/current occupancy;
- one-to-five non-overlapping future windows;
- manager cannot manufacture tenant preauthorization;
- vendor cannot manufacture tenant preauthorization;
- \`TENANT_PRESENT_REQUIRED\` rejects preauthorization;
- resident-confirmation requires vendor proposal then exact tenant slot selection;
- preauthorized slot must be fully contained in exact authorized window;
- appointment time immutable;
- RESCHEDULE supersedes only unoccurred future appointment;
- stale \`expectedRoundVersion\` rejects;
- stale packet revision during OPEN round rejects vendor mutation while the round remains intact;
- foreign/cross-assignment scheduling IDs do not leak.

- [ ] **Step 2: Run RED**

~~~bash
npm run test:postgres -- --run tests/postgres/core-vendor-scheduling.test.ts
~~~

- [ ] **Step 3: Implement migration \`0021_core_vendor_scheduling.sql\`**

Create:
- \`vendor_scheduling_round\`
- \`vendor_tenant_availability_submission\`
- \`vendor_tenant_availability_window\`
- \`vendor_scheduling_proposal\`
- \`vendor_scheduling_slot\`
- \`vendor_appointment\`

Required uniqueness:
- one OPEN round/assignment;
- immutable submission/proposal/slot rows;
- one selected/confirmed Appointment per confirmed round;
- old appointment disposition changes only through controlled transition function, not runtime direct DML.

Authenticated \`bm_b1_web\` functions:
- read tenant scheduling;
- submit tenant availability;
- confirm vendor slot;
- request tenant reschedule.

Vendor \`bm_core_vendor_web\` functions:
- propose slots;
- request vendor reschedule.

- [ ] **Step 4: Implement authenticated tenant HTTP/client**

Routes:
- GET \`/api/v2/core/tickets/:ticketId/vendor-scheduling\`
- POST \`.../availability\`
- POST \`.../confirm\`
- POST \`.../reschedule\`

Keep current tenant ownership/occupancy checks server-side.

- [ ] **Step 5: Implement vendor scheduling HTTP/client**

Routes:
- POST \`/api/v2/vendor/scheduling/proposals\`
- POST \`/api/v2/vendor/scheduling/reschedule\`

Every mutation checks vendor CSRF, assignment version, round version and packet revision.

- [ ] **Step 6: Add HTTP RED→GREEN tests**

Test strict query/body, stale versions, cross-resource IDs, current tenant denial, and no manager approval dependency.

- [ ] **Step 7: Run GREEN + Review Focus #3**

~~~bash
npm run test:postgres -- --run tests/postgres/core-vendor-scheduling.test.ts
npm run test:web -- --run src/server/core-flow/vendor-tenant.test.ts src/server/vendor-flow/http.test.ts
npm run test:shared
npm run typecheck
~~~

Expected: PASS, including stale packet during open scheduling.

- [ ] **Step 8: Commit**

~~~bash
git add packages/persistence-postgres/migrations/0021_core_vendor_scheduling.sql packages/persistence-postgres/src/core-flow.ts packages/persistence-postgres/src/core-vendor.ts tests/postgres/core-vendor-scheduling.test.ts apps/web/src/server/core-flow/vendor-tenant.ts apps/web/src/server/core-flow/vendor-tenant.test.ts apps/web/src/server/core-flow/http.ts apps/web/src/server/vendor-flow/http.ts apps/web/src/server/vendor-flow/http.test.ts packages/api-client/src/core-vendor-handoff.ts packages/api-client/src/vendor-flow.ts
git commit -m "feat: add vendor tenant scheduling"
~~~

---

### Task 5: Add Visit Start, Blocker History and FOLLOW_UP Scheduling

**Files:**
- Create: \`packages/persistence-postgres/migrations/0022_core_vendor_execution.sql\`
- Modify: \`packages/persistence-postgres/src/core-vendor.ts\`
- Modify: \`packages/persistence-postgres/src/core-flow.ts\`
- Test: \`tests/postgres/core-vendor-execution.test.ts\`
- Modify: \`apps/web/src/server/vendor-flow/http.ts\`
- Modify: \`apps/web/src/server/vendor-flow/http.test.ts\`
- Modify: \`apps/web/src/server/core-flow/vendor-manager.ts\`
- Modify: \`packages/api-client/src/vendor-flow.ts\`
- Modify: \`packages/api-client/src/core-vendor-handoff.ts\`

**Interfaces:**
- Produces append-only \`VISIT_STARTED\`, \`BLOCKER_RECORDED\`, \`BLOCKER_CLEARED\`.
- Adds FOLLOW_UP round creation sourced from blocker evidence.

- [ ] **Step 1: Write RED PostgreSQL tests**

Cover:
- exactly one VISIT_STARTED per Appointment;
- cancelled/superseded appointment cannot start;
- preauthorized appointment rechecks the authorizing tenant’s current occupancy immediately before VISIT_STARTED;
- stale ended occupancy produces no work event;
- one active blocker only;
- blocker clear must reference the active exact blocker;
- blocker history remains immutable;
- FOLLOW_UP from blocker preserves OCCURRED appointment;
- opening FOLLOW_UP can atomically clear the source blocker and records source evidence;
- foreign assignment/vendor session cannot touch events.

- [ ] **Step 2: Run RED**

~~~bash
npm run test:postgres -- --run tests/postgres/core-vendor-execution.test.ts
~~~

- [ ] **Step 3: Implement migration \`0022_core_vendor_execution.sql\`**

Create:
- \`vendor_work_event\`

Add controlled source-blocker linkage to SchedulingRound.

Vendor functions:
- \`vendor_visit_started\`
- \`vendor_record_blocker\`
- \`vendor_clear_blocker\`

Manager function:
- \`manager_vendor_follow_up_from_blocker\`

VISIT_STARTED:
- locks source ticket → assignment → appointment;
- rechecks vendor session;
- for PREAUTHORIZED_ENTRY, rechecks occupancy/user authorization;
- marks appointment OCCURRED and appends event atomically.

- [ ] **Step 4: Wire vendor/manager HTTP and clients**

Vendor:
- POST \`/api/v2/vendor/appointments/:appointmentId/visit-start\`
- POST \`/api/v2/vendor/blockers\`
- POST \`/api/v2/vendor/blockers/:blockerId/clear\`

Manager:
- POST approved follow-up endpoint with source blocker ID.

- [ ] **Step 5: Run GREEN + Review Focus #2**

~~~bash
npm run test:postgres -- --run tests/postgres/core-vendor-execution.test.ts
npm run test:web -- --run src/server/vendor-flow/http.test.ts src/server/core-flow/vendor-manager.test.ts
npm run typecheck
~~~

Expected: stale occupancy blocks VISIT_STARTED without a work event.

- [ ] **Step 6: Commit**

~~~bash
git add packages/persistence-postgres/migrations/0022_core_vendor_execution.sql packages/persistence-postgres/src/core-vendor.ts packages/persistence-postgres/src/core-flow.ts tests/postgres/core-vendor-execution.test.ts apps/web/src/server/vendor-flow/http.ts apps/web/src/server/vendor-flow/http.test.ts apps/web/src/server/core-flow/vendor-manager.ts packages/api-client/src/vendor-flow.ts packages/api-client/src/core-vendor-handoff.ts
git commit -m "feat: add vendor visit execution"
~~~

---

### Task 6: Add Completion Reports, Sanitized Completion Photos and Append-Only Report Correction

**Files:**
- Create: \`packages/persistence-postgres/migrations/0023_core_vendor_completion.sql\`
- Modify: \`packages/persistence-postgres/src/core-vendor.ts\`
- Modify: \`packages/persistence-postgres/src/core-flow.ts\`
- Test: \`tests/postgres/core-vendor-completion.test.ts\`
- Create: \`apps/web/src/server/vendor-flow/photos.ts\`
- Create: \`apps/web/src/server/vendor-flow/photos.test.ts\`
- Modify: \`apps/web/src/server/vendor-flow/http.ts\`
- Modify: \`apps/web/src/server/vendor-flow/http.test.ts\`
- Modify: \`apps/web/src/server/core-flow/vendor-manager.ts\`
- Modify: \`apps/web/src/server/core-flow/vendor-manager.test.ts\`
- Modify: \`packages/api-client/src/vendor-flow.ts\`
- Modify: \`packages/api-client/src/core-vendor-handoff.ts\`

**Interfaces:**
- Produces assignment-scoped normalized completion photos.
- Produces immutable Completion Report revisions and durable correction request.
- Leaves ticket IN_PROGRESS and assignment ACTIVE.

- [ ] **Step 1: Write RED image-boundary tests**

Reuse the accepted \`normalizePhoto\` decoder/re-encoder rather than introducing a second codec policy.

Assertions:
- metadata-bearing JPEG output has no EXIF/GPS/orientation/XMP/ICC;
- unsupported MIME → 415;
- forged magic → 415;
- broken decode → 400;
- >5 MiB → 413 even with false/missing Content-Length;
- >20,000,000 decoded pixels → 413;
- errors do not contain codec input/metadata/filename.

- [ ] **Step 2: Run RED vendor photo tests**

~~~bash
npm run test:web -- --run src/server/vendor-flow/photos.test.ts
~~~

Expected: FAIL because vendor photo handler does not exist.

- [ ] **Step 3: Implement migration \`0023_core_vendor_completion.sql\`**

Create:
- \`vendor_completion_photo\`
- \`vendor_completion_report\`
- \`vendor_completion_report_photo\`
- \`vendor_completion_correction_request\`

Rules:
- photo belongs to one assignment;
- report revision chain via \`supersedes_report_id\`;
- at most one current unsuperseded report;
- at most one unresolved correction request;
- report has 1–5 photo links OR exact omission reason;
- no active blocker / no OPEN round at report submit;
- report submit does not update source ticket workStatus or assignment status.

Vendor functions:
- completion photo preflight/save/read;
- submit completion report/revision.

Manager functions:
- read completion detail/photo;
- request correction.

- [ ] **Step 4: Implement vendor photo HTTP**

Use preflight transaction before reading/decoding bytes, matching existing ticket-photo pattern.

Routes:
- POST \`/api/v2/vendor/completion-photos\`
- GET \`/api/v2/vendor/photos/:photoId\`

Maximum count for a single current report = 5.

- [ ] **Step 5: Implement manager completion-photo read boundary**

Manager reads a vendor completion photo only through current authenticated manager authorization on the source ticket/assignment.

Tenant routes must not expose this photo.

- [ ] **Step 6: Implement report submit/correction APIs**

Vendor:
- POST \`/api/v2/vendor/completion-reports\`

Manager:
- POST \`/api/v2/core/manager/vendor-assignments/:assignmentId/completion-correction\`

During current COMPLETION_REPORTED:
- normal packet/scheduling/visit/report writes conflict;
- exact correction revision responding to current request is the only vendor mutation permitted.

Correction manager reason = 1–500 plain-text chars.

- [ ] **Step 7: Run GREEN + Review Focus #5**

~~~bash
npm run test:web -- --run src/server/vendor-flow/photos.test.ts src/server/vendor-flow/http.test.ts src/server/core-flow/vendor-manager.test.ts
npm run test:postgres -- --run tests/postgres/core-vendor-completion.test.ts
npm run typecheck
~~~

Expected: PASS.

- [ ] **Step 8: Commit**

~~~bash
git add packages/persistence-postgres/migrations/0023_core_vendor_completion.sql packages/persistence-postgres/src/core-vendor.ts packages/persistence-postgres/src/core-flow.ts tests/postgres/core-vendor-completion.test.ts apps/web/src/server/vendor-flow/photos.ts apps/web/src/server/vendor-flow/photos.test.ts apps/web/src/server/vendor-flow/http.ts apps/web/src/server/vendor-flow/http.test.ts apps/web/src/server/core-flow/vendor-manager.ts apps/web/src/server/core-flow/vendor-manager.test.ts packages/api-client/src/vendor-flow.ts packages/api-client/src/core-vendor-handoff.ts
git commit -m "feat: add vendor completion reports"
~~~

---

### Task 7: Add Atomic Closeout, Revoke/Reassign and Direct-Completion Guard

**Files:**
- Create: \`packages/persistence-postgres/migrations/0024_core_vendor_closeout.sql\`
- Modify: \`packages/persistence-postgres/src/core-flow.ts\`
- Modify: \`packages/application/src/core-vendor-handoff.ts\`
- Modify: \`packages/application/src/core-flow.ts\`
- Test: \`tests/postgres/core-vendor-closeout.test.ts\`
- Modify: \`apps/web/src/server/core-flow/vendor-manager.ts\`
- Modify: \`apps/web/src/server/core-flow/vendor-manager.test.ts\`
- Modify: \`packages/api-client/src/core-vendor-handoff.ts\`

**Interfaces:**
- Produces final manager dispositions: closeout, follow-up from report, revoke, reassign.
- Modifies generic manager HANDLING COMPLETED only to guard a non-ended vendor assignment; manager-only tickets preserve old behavior.

- [ ] **Step 1: Write RED PostgreSQL tests**

Cover:
- manager-only ticket with zero assignment still completes exactly as current RC1;
- historical DECLINED/REVOKED/SUPERSEDED assignment does not block direct completion;
- PREPARING/OFFERED/ACTIVE assignment blocks generic direct COMPLETED;
- closeout requires ACTIVE assignment + current report + no blocker/open round/pending correction;
- stale public-Q&A version rolls back everything;
- closeout commits ticket COMPLETED + assignment ENDED/CLOSED + session revoke atomically;
- manager auth/property assignment revoked while waiting → no closeout;
- report correction/follow-up racing closeout yields one valid disposition;
- reassign atomically ends old assignment, revokes session, supersedes OPEN round/future Appointment, preserves OCCURRED/work/report history, creates one PREPARING new assignment;
- revoke preserves history and does not complete ticket.

- [ ] **Step 2: Run RED**

~~~bash
npm run test:postgres -- --run tests/postgres/core-vendor-closeout.test.ts
~~~

- [ ] **Step 3: Implement migration \`0024_core_vendor_closeout.sql\`**

Manager functions:
- prepare/finish vendor closeout primitives needed by application orchestration;
- revoke;
- reassign;
- follow-up from Completion Report.

Use consistent lock order:

~~~text
source ticket
→ current assignment
→ current report / scheduling dependent rows
~~~

Recheck authorization after waits.

No direct table DML grant to Web roles.

- [ ] **Step 4: Implement application closeout orchestration**

Add exact helper:

~~~ts
export async function closeCoreVendorAssignment(
  scope:CoreScope,
  assignmentId:string,
  input:CoreVendorCloseoutCommand,
  clock:Clock,
  ids:IdGenerator,
):Promise<CoreVendorCloseoutResult>;
~~~

Sequence in the existing CoreFlow transaction:
1. lock/read source ticket;
2. prepare/lock current assignment/report;
3. call existing \`performCoreAction(... HANDLING COMPLETED ...)\` so existing event/public-Q&A semantics remain authoritative;
4. finish assignment CLOSED + revoke vendor access;
5. return current ticket + assignment.

- [ ] **Step 5: Guard generic direct completion**

Inside the existing HANDLING COMPLETED branch, before communication completion:

~~~ts
await scope.vendor.manager.guardDirectCompletion(action.ticketId);
~~~

The guard:
- returns normally when no non-ended assignment exists;
- STATE_CONFLICT when PREPARING/OFFERED/ACTIVE exists.

Do not change HANDLING IN_PROGRESS behavior.

- [ ] **Step 6: Implement manager HTTP/client endpoints**

- POST \`.../:assignmentId/revoke\`
- POST \`.../:assignmentId/reassign\`
- POST \`.../:assignmentId/follow-up\`
- POST \`.../:assignmentId/reschedule\`
- POST \`.../:assignmentId/closeout\`

Closeout input carries:
- \`clientRequestId\`
- \`expectedAssignmentVersion\`
- \`expectedCompletionReportId\`
- \`expectedCommunicationVersion\`
- bounded manager handling message.

- [ ] **Step 7: Run GREEN + Review Focus #4**

~~~bash
npm run test:postgres -- --run tests/postgres/core-vendor-closeout.test.ts tests/postgres/core-flow.test.ts tests/postgres/core-maintenance-fact.test.ts
npm run test:web -- --run src/server/core-flow/vendor-manager.test.ts
npm run typecheck
~~~

Expected: PASS; no state with source ticket COMPLETED and current assignment ACTIVE.

- [ ] **Step 8: Commit**

~~~bash
git add packages/persistence-postgres/migrations/0024_core_vendor_closeout.sql packages/persistence-postgres/src/core-flow.ts packages/application/src/core-vendor-handoff.ts packages/application/src/core-flow.ts tests/postgres/core-vendor-closeout.test.ts apps/web/src/server/core-flow/vendor-manager.ts apps/web/src/server/core-flow/vendor-manager.test.ts packages/api-client/src/core-vendor-handoff.ts
git commit -m "feat: add atomic vendor closeout"
~~~

---

### Task 8: Integrate Manager and Tenant Web UI Without Redesign

**Files:**
- Create: \`apps/web/src/app/core/manager-vendor-handoff.tsx\`
- Create: \`apps/web/src/app/core/manager-vendor-handoff.module.css\`
- Test: \`apps/web/src/app/core/manager-vendor-handoff.test.tsx\`
- Create: \`apps/web/src/app/core/tenant-vendor-scheduling.tsx\`
- Create: \`apps/web/src/app/core/tenant-vendor-scheduling.module.css\`
- Test: \`apps/web/src/app/core/tenant-vendor-scheduling.test.tsx\`
- Modify: \`apps/web/src/app/core/core-screen.tsx\`
- Test: \`apps/web/tests/core-e2e/vendor-handoff.spec.ts\`
- Test: \`apps/web/tests/core-login-e2e/vendor-handoff.spec.ts\`

**Interfaces:**
- Consumes \`client.vendor.manager\` and \`client.vendor.tenant\`.
- Manager integrates inside existing inspector/action rail.
- Tenant scheduling integrates inside existing selected-ticket task area.
- No new global manager navigation section.

- [ ] **Step 1: Write RED manager component tests**

Assert:
- no vendor handoff action before approved external route;
- SAFETY_ESCALATED shows no ordinary vendor action;
- create assignment → packet form;
- preview states exact vendor-visible fields and excludes private data;
- explicit source-photo selection;
- accessPolicy only two approved values;
- link issue shows raw link once with copy action and warns that product does not send it;
- OFFERED/ACTIVE state shows progress/revoke/reassign;
- COMPLETION_REPORTED shows exactly three manager dispositions: closeout, correction request, follow-up;
- vendor completion photos visible manager-only;
- 409 preserves entered packet/correction text until refresh/review.

- [ ] **Step 2: Write RED tenant component tests**

Assert:
- vendorLabel absent;
- current appointment visible;
- tenant can submit windows;
- preauthorization controls only when packet policy allows;
- confirm exact vendor slot;
- reschedule request;
- no claim that SMS/Kakao/push was sent;
- completion raw vendor photo absent;
- existing post-COMPLETED outcome component remains authoritative.

- [ ] **Step 3: Run RED**

~~~bash
npm run test:web -- --run src/app/core/manager-vendor-handoff.test.tsx src/app/core/tenant-vendor-scheduling.test.tsx
~~~

- [ ] **Step 4: Implement focused components**

Reuse existing design tokens/components/classes.

Do not copy vendor subsystem state into \`CoreTicketDto\`; each component fetches its dedicated projection.

- [ ] **Step 5: Integrate \`core-screen.tsx\`**

Manager:
- render \`ManagerVendorHandoff\` in the inspector before Maintenance Fact editor when ticket is not COMPLETED or when historical vendor detail is useful.

Tenant:
- render \`TenantVendorScheduling\` in selected ticket task area.

On 401/403/404 from vendor manager/tenant nested reads, use the same protected-content clearing discipline as maintenance timeline/public Q&A rather than retaining stale protected state.

- [ ] **Step 6: Add 390 px actual-browser flow**

\`apps/web/tests/core-e2e/vendor-handoff.spec.ts\` covers synthetic DEMO manager + tenant parts.

\`apps/web/tests/core-login-e2e/vendor-handoff.spec.ts\` covers:
- B1 manager;
- assigned staff current property;
- staff assignment revocation clears protected vendor content;
- tenant scheduling current occupancy;
- cross-org hidden-resource denial.

Set viewport \`390 × 844\` for at least the critical manager/tenant screens.

- [ ] **Step 7: Run GREEN**

~~~bash
npm run test:web -- --run src/app/core/manager-vendor-handoff.test.tsx src/app/core/tenant-vendor-scheduling.test.tsx
cd apps/web && npx playwright test --config playwright.core.config.ts tests/core-e2e/vendor-handoff.spec.ts
cd apps/web && npx playwright test --config playwright.core-login.config.ts tests/core-login-e2e/vendor-handoff.spec.ts
cd ../..
npm run typecheck
~~~

Expected: PASS.

- [ ] **Step 8: Commit**

~~~bash
git add apps/web/src/app/core/manager-vendor-handoff.tsx apps/web/src/app/core/manager-vendor-handoff.module.css apps/web/src/app/core/manager-vendor-handoff.test.tsx apps/web/src/app/core/tenant-vendor-scheduling.tsx apps/web/src/app/core/tenant-vendor-scheduling.module.css apps/web/src/app/core/tenant-vendor-scheduling.test.tsx apps/web/src/app/core/core-screen.tsx apps/web/tests/core-e2e/vendor-handoff.spec.ts apps/web/tests/core-login-e2e/vendor-handoff.spec.ts
git commit -m "feat: add manager tenant vendor handoff ui"
~~~

---

### Task 9: Build the Standalone 390 px Vendor Job Surface

**Files:**
- Create: \`apps/web/src/app/vendor/job/page.tsx\`
- Create: \`apps/web/src/app/vendor/job/vendor-job-screen.tsx\`
- Create: \`apps/web/src/app/vendor/job/vendor-job.module.css\`
- Test: \`apps/web/src/app/vendor/job/vendor-job-screen.test.tsx\`
- Extend: \`apps/web/tests/core-e2e/vendor-handoff.spec.ts\`

**Interfaces:**
- Consumes \`createVendorFlowClient\`.
- Uses URL fragment only for the first redeem request, then removes it from visible browser URL.
- Does not import B1/Core manager session code.

- [ ] **Step 1: Write RED component tests**

Cases:
- fragment token detected → redeem once → \`history.replaceState\` removes fragment;
- already-sessioned page loads \`GET /api/v2/vendor/job\` without token;
- redeem error never re-renders token;
- OFFERED shows packet + Accept/Decline only;
- ACTIVE scheduling shows only currently valid availability/proposal actions;
- confirmed appointment shows date/access mode;
- visit start, blocker, clear, completion report actions follow current phase;
- COMPLETION_REPORTED is read-mostly except exact requested report correction;
- ENDED shows read-only ended state or no authorized job according to API;
- no tenant identity/contact/Q&A/manager-private fields;
- no external-notification claims;
- no horizontal overflow at 390 px.

- [ ] **Step 2: Run RED**

~~~bash
npm run test:web -- --run src/app/vendor/job/vendor-job-screen.test.tsx
~~~

- [ ] **Step 3: Implement page/screen**

\`page.tsx\` wraps only the accepted design root primitives needed for consistent typography; it must not load analytics/third-party scripts.

\`vendor-job-screen.tsx\`:
- reads \`window.location.hash\` only client-side;
- validates exactly \`#[a-f0-9]{64}\`;
- redeems once;
- replaces URL with \`/vendor/job\`;
- keeps CSRF only in component memory;
- uses HttpOnly session cookie automatically;
- clears local job/CSRF state on 401/403/404.

- [ ] **Step 4: Extend browser E2E**

Use a manager-created synthetic raw link in test memory only.

Assert:
- browser URL no longer contains token after redeem;
- browser storage/localStorage/sessionStorage do not contain raw token;
- Accept → schedule → visit → report works;
- completion correction revision works;
- closeout revokes subsequent vendor read;
- 390 px no overflow.

Never write the raw link/token to test artifact/evidence files.

- [ ] **Step 5: Run GREEN**

~~~bash
npm run test:web -- --run src/app/vendor/job/vendor-job-screen.test.tsx
cd apps/web && npx playwright test --config playwright.core.config.ts tests/core-e2e/vendor-handoff.spec.ts
cd ../..
npm run lint
npm run typecheck
npm run build:web
~~~

Expected: PASS.

- [ ] **Step 6: Commit**

~~~bash
git add apps/web/src/app/vendor/job apps/web/tests/core-e2e/vendor-handoff.spec.ts
git commit -m "feat: add vendor secure job ui"
~~~

---

### Task 10: Whole-Slice Security, Restart, Regression and Candidate Evidence

**Files:**
- Create: \`scripts/core-vendor-restart-check.mjs\`
- Modify: \`docs/core-flow-rc1-running.md\`
- Create: \`ops/core_vendor_handoff_v1.md\`
- Modify: \`ops/AI_Execution_Log.csv\`
- Modify: \`ops/pending_external_sync.md\`
- Any test-only inventory updates required by new tables/functions/roles must be limited to exact expected new resources; do not weaken old assertions.

**Interfaces:**
- Consumes all previous tasks.
- Produces fixed implementation candidate evidence only.
- Does not authorize Ready/merge/deployment.

- [ ] **Step 1: Add restart RED test**

\`scripts/core-vendor-restart-check.mjs\` must use the existing private synthetic database and:
1. create/prepare/offer synthetic assignment;
2. redeem and accept;
3. schedule an appointment;
4. create at least one work event;
5. submit a synthetic completion report/photo;
6. stop the owned Web process;
7. start a distinct process;
8. reread exact assignment/packet/scheduling/work/report history;
9. verify old raw link remains unusable and current session behavior matches persisted revocation/expiry state;
10. print only sanitized PASS labels, never token/session/config.

- [ ] **Step 2: Run targeted restart check RED then GREEN**

Follow the existing private-state/owned-server pattern. Do not remove containers/volumes or overwrite real/private data.

Expected success labels:
- \`VENDOR_HANDOFF_RESTART_PASS\`
- \`VENDOR_CAPABILITY_RESTART_PASS\`

- [ ] **Step 3: Run full PostgreSQL suite**

~~~bash
npm run test:postgres
~~~

Expected: all tests PASS.

Pay special attention to legacy exact table/function inventory tests. Update expected inventories only for the exact new tables/functions/role; never exclude them from existing security assertions without a specific reason.

- [ ] **Step 4: Run full shared/Web/Mobile and static gates**

~~~bash
npm run test:shared
npm run test:web
npm run test:mobile
npm run lint
npm run typecheck
npm run build:web
npm run check:deps
npm run verify
~~~

Classify any pre-existing Mobile/native failure separately; do not hide or silently waive it.

- [ ] **Step 5: Run full Core browser suites**

~~~bash
cd apps/web
npx playwright test --config playwright.core.config.ts
npx playwright test --config playwright.core-login.config.ts
npx playwright test --config playwright.b1.config.ts
cd ../..
~~~

Expected: existing flows plus vendor additions PASS. Any historical actual-provider claims remain separate from synthetic SDK evidence.

- [ ] **Step 6: Run privacy/public-tree checks**

Use the repository’s current scanner/gates at the implementation HEAD.

Explicitly search candidate diff/evidence for:
- raw vendor token;
- vendor session cookie;
- CSRF value;
- connection config/password;
- real email/phone/address;
- private image bytes or screenshot paths.

Synthetic addresses must be explicitly synthetic.

- [ ] **Step 7: Verify spec AC01–AC57 mapping**

In \`ops/core_vendor_handoff_v1.md\`, map every AC to:
- implementation path;
- focused test/evidence;
- status;
- evidence class (EXECUTOR_LOCAL / HOSTED_CI / etc.).

Do not call NOT_RUN runtime items PASS.

- [ ] **Step 8: Update run guide**

Document only synthetic-development commands/config names, not values:
- prepare/migrate;
- DEMO server;
- synthetic B1 SDK server;
- vendor link usage;
- restart checker.

State clearly:
- no production;
- no real vendor;
- no automated external notification;
- no vendor IAM.

- [ ] **Step 9: Freeze candidate**

Before publication:
- working tree/index clean except reviewed paths;
- compare against the implementation base;
- record exact HEAD and changed paths;
- run public data scanner;
- no force/rebase/reset.

- [ ] **Step 10: Publish only an implementation Draft PR after authorization**

When implementation execution itself has been authorized:
- push the reviewed branch;
- create/update a dedicated Draft PR;
- obtain fresh required hosted Repository + App checks on the exact implementation HEAD;
- classify those runs as candidate HOSTED_CI.

Stop before:
- Ready conversion;
- merge;
- deployment;
- production/provider/IAM work.

- [ ] **Step 11: Commit execution evidence**

~~~bash
git add scripts/core-vendor-restart-check.mjs docs/core-flow-rc1-running.md ops/core_vendor_handoff_v1.md ops/AI_Execution_Log.csv ops/pending_external_sync.md
git commit -m "docs: record vendor handoff candidate evidence"
~~~

---

## Plan Completion Gate

This plan is complete when:

1. every task has an exact owning test cycle;
2. migrations are additive \`0019\`–\`0024\`;
3. vendor runtime DB authority is separate from B1 Web;
4. manager-only completion regression is explicitly tested;
5. Review Focus #1–#5 each has a named test in its owning task;
6. all spec AC01–AC57 have an implementation/evidence owner;
7. implementation still has not begun until the operator approves this plan and selects the execution method.

## Execution Stop Point

After plan approval, choose exactly one execution mode:

- **Subagent-driven** — fresh implementer + fresh reviewer per task, then whole-branch review.
- **Native** — one executor completes all tasks from this frozen plan, then one independent whole-branch review.

No task may begin merely because this plan file exists.
