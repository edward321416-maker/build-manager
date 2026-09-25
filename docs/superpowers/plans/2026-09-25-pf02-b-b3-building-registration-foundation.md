# PF02-B / B3 ORG_ADMIN Building Registration Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Implement the approved PF02-B/B3 registration slice so an authenticated ACTIVE ORG_ADMIN can create and read back ACTIVE Property and Unit resources through PostgreSQL, /api/v2, and Web while PROPERTY_STAFF remains read-only and parent-scoped.

**Architecture:** Keep the frozen B1/B2 identity, organization-context, Property-read and assignment architecture intact. Add one additive PostgreSQL migration (0008), isolated B3 application/contracts/PostgreSQL modules, B3 HTTP mutation/read orchestration, and focused Web registration views. Authorization is checked in the application and repeated by actual bm_b1_web ACL/RLS; every create uses READ COMMITTED, SELECT uuidv7(), plain INSERT without RETURNING/ON CONFLICT, next-statement RLS readback, then confirmed COMMIT before HTTP 201.

**Tech Stack:** Node 24.21.0, npm 11.19.0, TypeScript 6.0.3, Next.js 16.3.4, React 19.2.3, Zod 4.6.5, Vitest 5.0.0, Playwright 1.63.0, PostgreSQL 18.6, pg 8.23.0, @testcontainers/postgresql 12.1.0, node-pg-migrate 9.0.0.

**Spec:** <code>docs/superpowers/specs/2026-09-25-pf02-b-b3-building-registration-foundation-design.md</code>

## Plan status and authority

- This document is a PLAN_CANDIDATE only. It does not authorize product implementation.
- Planning POLICY_REF and TARGET_REF are <code>main@9d2916b037a7d421fd60650ffcab18c566df13f2</code>, verified live before this plan branch was created.
- The plan branch is <code>docs/pf02-b-b3-implementation-plan</code>, created from that exact commit.
- The approved B3 design is DESIGN_APPROVED. Implementation-plan drafting, self-audit, and independent plan review are authorized. <code>implementation_authorized=false</code> remains controlling until a later canonical repository update and explicit operator authorization say otherwise.
- The design was originally written against historical TARGET_REF <code>ec3d05f69fe33baab70e4a9268e9dc7eca089428</code>. Live main has since advanced through documentation/maintenance publication; B3 product code inspected for this plan remains unchanged.
- The stale aggregate planning text in <code>STATUS.md</code> and the stale B3 milestone row in <code>ops/CHAT_HANDOFF.md</code> do not override the more specific manifest/current-next-task evidence or merged PR #39. Do not edit those routers in the plan-candidate branch merely to make the summaries prettier.
- No product, SQL migration, test, API, Web, workflow, dependency, or lockfile change belongs in the plan-candidate branch.

## Global Constraints

- Read <code>ops/NEW_CHAT_BOOTSTRAP.md</code>, <code>AGENTS.md</code>, <code>governance/ai_delivery_rules.md</code>, <code>governance/project_policy.md</code>, the manifest, status, handoff, B1/B2 acceptance receipts, this plan, and the approved B3 design from one exact live-main POLICY_REF before implementation.
- If live main has product/security/SQL changes after the reviewed plan base, STOP_AND_REVIEW the delta. A documentation-only accepted plan publication may become the later implementation base only after its exact main SHA is verified.
- PF00 remains FROZEN; PF02-A remains VERIFIED/FROZEN; PF02-B B1/B2 remain VERIFIED/FROZEN.
- Migrations 0001 through 0007 are byte-frozen. Never edit, reformat, rename, regenerate, or replace them.
- Exact frozen migration SHA-256 values:
  - 0001_core_identity_organization.sql: <code>e10a8d4acd3d11fb3bf90b05d3f123081f6ee4a29d325b0b669a56f819b261f1</code>
  - 0002_property_unit_occupancy.sql: <code>1733fbaf57a93e8d8eafc98207700f198a3b67ddfd022058b2aa09c3630aa77a</code>
  - 0003_runtime_isolation.sql: <code>649a0519aa94e2bde319d4eac936dc9c8955739d92ff934211fa2f9d54213cf6</code>
  - 0004_b1_identity_sessions.sql: <code>2ab71a55851cc37e34e62a5ce7b81c03983b95c67e2e15127e7e31edbe79220a</code>
  - 0005_b1_auth_capabilities.sql: <code>22aea03a276673ca9e0e6929cc0193b83463b890845b5551d485100ce572ed33</code>
  - 0006_b1_organization_access.sql: <code>a3dc5101aa69cb3fa65499573fd331273cd311c1349b1a62d38d267b4931a8fe</code>
  - 0007_b2_property_assignment_scope.sql: <code>4b6e9e27dbc87142ad8d9d5f0dce37a57b97b2374ba41c2b9f7d4433183b2ac2</code>
- The only new migration is <code>packages/persistence-postgres/migrations/0008_b3_building_registration.sql</code>.
- The app business-table inventory remains exactly eight: app_user, occupancy, occupancy_member, organization, organization_membership, property, property_assignment, unit.
- No new role, role membership, ORM, dependency, provider, hosted database, production credential, IAM operation, address API, building-register integration, Kakao integration, billing, Mobile auth, Occupancy mutation, invitation, assignment mutation, ticket, CommandReceipt, update/delete/archive mutation, or real tenant/address data.
- REAL_TENANT_DATA remains NOT_AUTHORIZED. PRODUCTION_DB_HOSTING remains NOT_AUTHORIZED.
- Use only synthetic identities, organization names, references, labels, and browser fixtures. Do not place real addresses, session/CSRF material, credentials, raw SQL exceptions, or request bodies in logs, PR prose, screenshots, or assertion diffs.
- Preserve existing B1 flat JSON bodies and strict B1 schemas. Do not add B3 fields to <code>B1PropertySchema</code>, <code>B1PropertyPageSchema</code>, <code>B1ErrorSchema</code>, or <code>B1ErrorCode</code>.
- Property POST body is exactly <code>{ addressReference: string }</code>. New registrations require already-trimmed 1..512 Unicode code points, no C0/C1 controls, and no unpaired surrogate. Existing null address_reference rows remain readable.
- Unit POST body is exactly <code>{ label: string }</code>. Require already-trimmed 1..80 Unicode code points, no C0/C1 controls, and no unpaired surrogate. Preserve case; PostgreSQL <code>unit_active_label_unique</code> remains final case-insensitive conflict authority.
- B3 UnitView is exactly id, orgId, propertyId, label. Never expose status, createdAt, occupancy, assignments, roles, counts, hidden cursors, or hidden IDs.
- Server owns id, orgId, propertyId, userId, membershipId, role, status, createdAt, assignment flags, and authority. Reject unknown/server-owned fields.
- Keep B1 <code>authn.authorize_org</code> as context authorization for admin + staff. It is not B3 write authority.
- New B3 authority is only <code>authn.can_administer_org(bytea,uuid)</code>, STABLE SECURITY DEFINER, owner bm_b1_capability_owner, search_path pg_catalog, returning false/null on failed authority.
- Actual INSERT/SELECT under bm_b1_web RLS is decisive. UI headers and application guards are advisory/defense-in-depth and never credentials.
- Property and Unit create are separate transactions. A successful Property remains after a later Unit failure.
- Create operations use SELECT uuidv7(), plain INSERT, no RETURNING, no ON CONFLICT, then next-statement protected readback in the same transaction.
- Map only the known <code>unit_active_label_unique</code> SQLSTATE 23505 to CONFLICT. Do not turn arbitrary unique/FK failures into existence disclosures.
- Connection loss around COMMIT is DEPENDENCY_UNAVAILABLE/503 with unknown outcome. Never call it a rollback, never auto-retry, and never show success without confirmed commit.
- Keep the existing nine required hosted checks unchanged: verify, repository-safety, apps, mobile-cold-linux, install-mobile-windows, web-e2e, mobile-health, postgres-integration, foundation-gate.
- Do not add a CI job, extend an existing timeout, duplicate Chromium/Web build into postgres-integration, change action majors, or weaken scanner gates.
- No npm audit fix, dependency upgrade, lockfile surgery, force push, rebase, history rewrite, branch deletion, destructive DB command, or credential/IAM operation.
- F01 and F43 remain NOT_RUN during implementation. B3 may later contribute evidence to F01 after fixed-head acceptance; F43 cannot pass because address/public-reference search is not implemented.

## Review Focus

1. **Context mistaken for write authority:** PROPERTY_STAFF can pass authorize_org; tests must prove app guard and actual bm_b1_web INSERT RLS still deny, while hidden/unassigned parents remain 404 rather than 403.
2. **Advisory header trusted as a credential:** forged, stale, missing, malformed, or cached X-B3-Can-Create-* values must never authorize POST; direct registration navigation must re-read current server capability.
3. **String/size boundary mismatch:** HTTP size is actual UTF-8 bytes (8 KiB), while field length is Unicode code points; malformed UTF-8, C0/C1 controls, unpaired surrogates, whitespace, and server-owned fields must fail without mutation.
4. **RLS/ACL false PASS:** new restrictive policies must target bm_b1_web only, combine with existing permissive org scope, keep FORCE RLS, preserve frozen B2 helper paths, and leave capability-owner CREATE revoked after migration.
5. **False concurrency/transaction proof:** the duplicate race must observe a real PostgreSQL lock wait before release; revocation must occur at a real final statement barrier; a COMMIT-uncertain test must permit an actually committed row while still returning 503.

## Planned File Map

The following is the future implementation scope. Creating this plan does not create or modify these product files.

### Create

- <code>packages/api-contracts/src/b3.ts</code>
- <code>packages/api-contracts/src/b3.test.ts</code>
- <code>packages/application/src/b3/errors.ts</code>
- <code>packages/application/src/b3/ports.ts</code>
- <code>packages/application/src/b3/validation.ts</code>
- <code>packages/application/src/b3/building-registration.ts</code>
- <code>packages/application/src/b3/building-registration.test.ts</code>
- <code>packages/persistence-postgres/migrations/0008_b3_building_registration.sql</code>
- <code>packages/persistence-postgres/src/b3/common.ts</code>
- <code>packages/persistence-postgres/src/b3/registration.ts</code>
- <code>packages/persistence-postgres/src/b3/unit-reader.ts</code>
- <code>packages/persistence-postgres/src/b3/index.ts</code>
- <code>tests/postgres/helpers/b3-fixture.ts</code>
- <code>tests/postgres/b3-capabilities.test.ts</code>
- <code>tests/postgres/b3-schema.test.ts</code>
- <code>tests/postgres/b3-registration.test.ts</code>
- <code>tests/postgres/b3-units.test.ts</code>
- <code>tests/postgres/b3-concurrency.test.ts</code>
- <code>tests/postgres/b3-revocation.test.ts</code>
- <code>apps/web/src/server/b3/errors.ts</code>
- <code>apps/web/src/server/b3/request.ts</code>
- <code>apps/web/src/server/b3/http.ts</code>
- <code>apps/web/src/server/b3/http.test.ts</code>
- <code>apps/web/src/components/b3/property-workspace.tsx</code>
- <code>apps/web/src/components/b3/property-workspace.test.tsx</code>
- <code>apps/web/src/components/b3/property-registration.tsx</code>
- <code>apps/web/src/components/b3/property-registration.test.tsx</code>
- <code>apps/web/src/components/b3/unit-workspace.tsx</code>
- <code>apps/web/src/components/b3/unit-workspace.test.tsx</code>
- <code>apps/web/src/components/b3/unit-registration.tsx</code>
- <code>apps/web/src/components/b3/unit-registration.test.tsx</code>
- <code>apps/web/src/components/b3/unit-detail.tsx</code>
- <code>apps/web/src/components/b3/unit-detail.test.tsx</code>
- <code>apps/web/src/app/api/v2/organizations/[orgId]/properties/[propertyId]/units/route.ts</code>
- <code>apps/web/src/app/api/v2/organizations/[orgId]/properties/[propertyId]/units/[unitId]/route.ts</code>
- <code>apps/web/src/app/workspace/organizations/[orgId]/properties/new/page.tsx</code>
- <code>apps/web/src/app/workspace/organizations/[orgId]/properties/[propertyId]/units/new/page.tsx</code>
- <code>apps/web/src/app/workspace/organizations/[orgId]/properties/[propertyId]/units/[unitId]/page.tsx</code>
- <code>apps/web/tests/b1-e2e/b3-fixture.ts</code>
- <code>apps/web/tests/b1-e2e/b3.spec.ts</code>
- <code>tests/architecture/b3-boundary.test.ts</code>

### Modify

- <code>packages/api-contracts/src/index.ts</code>
- <code>packages/application/src/index.ts</code>
- <code>packages/persistence-postgres/package.json</code> only to add the <code>./b3</code> export; no dependency version change
- <code>apps/web/src/server/b1/container.ts</code> only to assemble the B3 ports on the existing B1 database handle; no B1 auth/session logic change
- <code>apps/web/src/app/api/v2/organizations/[orgId]/properties/route.ts</code>
- <code>apps/web/src/app/api/v2/organizations/[orgId]/properties/[propertyId]/route.ts</code>
- <code>apps/web/src/app/workspace/organizations/[orgId]/page.tsx</code>
- <code>apps/web/src/app/workspace/organizations/[orgId]/properties/[propertyId]/page.tsx</code>
- <code>apps/web/tests/b1-e2e/check-results.mjs</code>
- <code>tests/architecture/b1-boundary.test.ts</code> only to change the actual v2 route inventory from six to eight and include the two Unit handlers
- <code>ops/AI_Execution_Log.csv</code> append-only execution receipts
- <code>ops/pending_external_sync.md</code> append-only external-sync queue when Google destinations are unavailable

### Explicitly do not modify in the B3 implementation candidate

- <code>packages/persistence-postgres/migrations/0001_*.sql</code> through <code>0007_*.sql</code>
- <code>packages/application/src/b1/errors.ts</code>
- <code>packages/api-contracts/src/b1.ts</code>
- <code>packages/persistence-postgres/src/b1/org-transaction.ts</code>
- <code>packages/persistence-postgres/src/b1/organization-reader.ts</code>
- <code>apps/web/src/server/b1/logout.ts</code>
- <code>apps/web/src/server/b1/session.ts</code>
- <code>apps/web/src/server/b1/http.ts</code>
- <code>apps/web/src/proxy.ts</code>
- <code>apps/web/src/server/b1/auth0.ts</code>
- <code>apps/web/src/server/b1/complete-session.ts</code>
- <code>docs/production-foundation/acceptance_cases.json</code>
- <code>.github/workflows/app-check.yml</code>
- root <code>package.json</code>, <code>package-lock.json</code>, Mobile files, or dependency versions unless a separately reviewed blocker proves they are required

---

## Implementation Authorization Gate

These steps are not executable until independent plan review has completed and repository/operator authority explicitly changes B3 product implementation to authorized.

- [ ] **P1: Re-bootstrap from one exact live main**

Record:

~~~text
POLICY_REF=<live main SHA>
CURRENT_MAIN=<same live main SHA>
B3_PLAN=<accepted plan path + fixed blob/ref>
B3_IMPLEMENTATION_AUTHORIZED=true
~~~

If <code>B3_IMPLEMENTATION_AUTHORIZED</code> is not true in canonical evidence plus operator authorization, stop before creating a product branch.

- [ ] **P2: Prove the accepted plan base and product delta**

Run:

~~~bash
git fetch origin --prune
git merge-base --is-ancestor 9d2916b037a7d421fd60650ffcab18c566df13f2 origin/main
git diff --name-status 9d2916b037a7d421fd60650ffcab18c566df13f2..origin/main
~~~

Documentation-only plan/review/router publication is acceptable after exact inspection. Any product, migration, B1/B2 security, workflow, package, or dependency delta requires STOP_AND_REVIEW before implementation.

- [ ] **P3: Verify all seven frozen migration hashes before branching**

Run from repository root:

~~~bash
sha256sum packages/persistence-postgres/migrations/0001_core_identity_organization.sql
sha256sum packages/persistence-postgres/migrations/0002_property_unit_occupancy.sql
sha256sum packages/persistence-postgres/migrations/0003_runtime_isolation.sql
sha256sum packages/persistence-postgres/migrations/0004_b1_identity_sessions.sql
sha256sum packages/persistence-postgres/migrations/0005_b1_auth_capabilities.sql
sha256sum packages/persistence-postgres/migrations/0006_b1_organization_access.sql
sha256sum packages/persistence-postgres/migrations/0007_b2_property_assignment_scope.sql
~~~

Every digest must equal Global Constraints. A mismatch is a hard stop, not permission to refresh the expected value.

- [ ] **P4: Create one isolated product branch only after P1-P3 pass**

Use:

~~~text
feat/pf02-b-b3-building-registration
~~~

Record the exact implementation base SHA. Do not reuse PR #30, any B2 branch, or the documentation-plan branch.

---

### Task 1: Add B3 contracts, error vocabulary, ports, input validation, and application use cases

**Files:**
- Create: <code>packages/api-contracts/src/b3.ts</code>
- Create: <code>packages/api-contracts/src/b3.test.ts</code>
- Modify: <code>packages/api-contracts/src/index.ts</code>
- Create: <code>packages/application/src/b3/errors.ts</code>
- Create: <code>packages/application/src/b3/ports.ts</code>
- Create: <code>packages/application/src/b3/validation.ts</code>
- Create: <code>packages/application/src/b3/building-registration.ts</code>
- Create: <code>packages/application/src/b3/building-registration.test.ts</code>
- Modify: <code>packages/application/src/index.ts</code>

**Interfaces:**
- Consumes existing <code>SessionDigest</code>, <code>IdentitySessionPort</code>, <code>PropertyView</code>, <code>PageQuery</code>, and <code>Page</code> from <code>packages/application/src/b1/ports.ts</code>.
- Produces <code>UnitView = { id: string; orgId: string; propertyId: string; label: string }</code>.
- Produces <code>PropertyCreateInput = { addressReference: string }</code>.
- Produces <code>UnitCreateInput = { label: string }</code>.
- Produces <code>BuildingRegistrationPort</code> with createProperty, createUnit, canCreateProperty, canCreateUnit.
- Produces <code>UnitReadPort</code> with listUnits and getUnit.
- Produces B3 use cases <code>createOrganizationProperty</code>, <code>createPropertyUnit</code>, <code>canCreateOrganizationProperty</code>, <code>canCreatePropertyUnit</code>, <code>listPropertyUnits</code>, and <code>getPropertyUnit</code>.
- Produces B3-only error codes without altering B1 errors.

- [ ] **Step 1: Add a compileable narrow B3 contract surface before the behavioral RED**

Create <code>packages/api-contracts/src/b3.ts</code> initially with strict object shapes and permissive string fields so the behavioral test can fail on values rather than on a missing import:

~~~ts
import { z } from "zod";

export const B3PropertyCreateSchema = z.strictObject({
  addressReference: z.string(),
});

export const B3UnitCreateSchema = z.strictObject({
  label: z.string(),
});

export const B3UnitSchema = z.strictObject({
  id: z.uuid(),
  orgId: z.uuid(),
  propertyId: z.uuid(),
  label: z.string(),
});

export const B3UnitPageSchema = z.strictObject({
  items: z.array(B3UnitSchema),
  nextCursor: z.uuid().nullable(),
});

export const B3ErrorSchema = z.strictObject({
  error: z.enum([
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "NOT_FOUND",
    "INVALID_INPUT",
    "CONFLICT",
    "PAYLOAD_TOO_LARGE",
    "DEPENDENCY_UNAVAILABLE",
    "METHOD_NOT_ALLOWED",
  ]),
});

export type B3Unit = z.infer<typeof B3UnitSchema>;
~~~

Export this module from <code>packages/api-contracts/src/index.ts</code>.

- [ ] **Step 2: Write the behavioral RED for field validation and exact DTO/error shapes**

In <code>packages/api-contracts/src/b3.test.ts</code>, pin all of the following:
- empty Property reference rejected;
- 512 Unicode code points accepted, 513 rejected;
- 80 Unit code points accepted, 81 rejected;
- Korean and emoji boundaries count by code point, not UTF-16 code unit;
- leading/trailing whitespace rejected;
- C0 and C1 controls rejected;
- lone high and low surrogate rejected;
- case is preserved;
- unknown/server-owned fields id, orgId, propertyId, status, role, createdAt, assignment, userId and nested substitutes rejected;
- null, array, number, boolean, and scalar body substitutes rejected;
- existing output Property schema remains unchanged in B1; B3 Unit shape has only four keys;
- B3 error enum contains exactly the eight design codes.

Run:

~~~bash
npm run test:shared -- packages/api-contracts/src/b3.test.ts
~~~

Expected RED: schema assertions fail because the initial string fields still accept invalid text. Missing-module/config/container failures do not count as RED.

- [ ] **Step 3: Tighten the contract validator to the approved Unicode rules**

Implement a local B3 string helper:

~~~ts
function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function boundedOperatorText(maxCodePoints: number) {
  return z.string().superRefine((value, context) => {
    const length = Array.from(value).length;
    const invalid =
      value !== value.trim() ||
      length < 1 ||
      length > maxCodePoints ||
      /[\u0000-\u001f\u007f-\u009f]/u.test(value) ||
      hasUnpairedSurrogate(value);
    if (invalid) context.addIssue({ code: "custom", message: "INVALID_INPUT" });
  });
}
~~~

Use max 512 for addressReference and 80 for label. Do not lowercase, NFC-normalize, deduplicate, or trim in the API contract.

Run the contract test again and require GREEN.

- [ ] **Step 4: Define the B3 application errors and ports without changing B1**

Create <code>packages/application/src/b3/errors.ts</code>:

~~~ts
export type B3ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "DEPENDENCY_UNAVAILABLE"
  | "METHOD_NOT_ALLOWED";

export class B3Error extends Error {
  constructor(public readonly code: B3ErrorCode) {
    super(code);
    this.name = "B3Error";
  }
}
~~~

Create <code>packages/application/src/b3/ports.ts</code> with these exact public signatures:

~~~ts
import type {
  IdentitySessionPort,
  Page,
  PageQuery,
  PropertyView,
  SessionDigest,
} from "../b1/ports";

export type PropertyCreateInput = Readonly<{ addressReference: string }>;
export type UnitCreateInput = Readonly<{ label: string }>;
export type UnitView = Readonly<{
  id: string;
  orgId: string;
  propertyId: string;
  label: string;
}>;

export interface BuildingRegistrationPort {
  createProperty(
    digest: SessionDigest,
    orgId: string,
    input: PropertyCreateInput,
  ): Promise<PropertyView>;
  createUnit(
    digest: SessionDigest,
    orgId: string,
    propertyId: string,
    input: UnitCreateInput,
  ): Promise<UnitView>;
  canCreateProperty(digest: SessionDigest, orgId: string): Promise<boolean>;
  canCreateUnit(
    digest: SessionDigest,
    orgId: string,
    propertyId: string,
  ): Promise<boolean>;
}

export interface UnitReadPort {
  listUnits(
    digest: SessionDigest,
    orgId: string,
    propertyId: string,
    page: PageQuery,
  ): Promise<Page<UnitView>>;
  getUnit(
    digest: SessionDigest,
    orgId: string,
    propertyId: string,
    unitId: string,
  ): Promise<UnitView>;
}

export type B3Dependencies = Readonly<{
  sessions: Omit<IdentitySessionPort, "begin">;
  registration: BuildingRegistrationPort;
  units: UnitReadPort;
}>;
~~~

- [ ] **Step 5: Add application-level behavioral RED using fake ports**

Write <code>packages/application/src/b3/building-registration.test.ts</code> using in-memory vi.fn ports. Pin:
- malformed digest and absent current actor reject UNAUTHENTICATED before any B3 port call;
- invalid Property/Unit text rejects INVALID_INPUT before a port call;
- create/read capability calls preserve NOT_FOUND, FORBIDDEN, CONFLICT, DEPENDENCY_UNAVAILABLE from the port;
- list page limit/after shape is forwarded exactly;
- capability false remains a boolean false and is not converted to a denial;
- no role/user/org authority is accepted from an input body.

Add a minimal compileable use-case module that delegates without validation, run the test, and require RED on the actor/input assertions rather than missing imports.

- [ ] **Step 6: Implement application guards and use cases GREEN**

In <code>validation.ts</code>, implement the same code-point/control/surrogate rules without adding a dependency from application to api-contracts. Add canonical UUID/page guards matching the existing B1 lower-case UUID boundary.

In <code>building-registration.ts</code>, every public use case must:
1. require a 64-lowerhex digest;
2. call <code>sessions.currentActor(digest)</code> and require a current actor;
3. validate selectors/input/page as applicable;
4. delegate exactly once to the narrow B3 port;
5. preserve B3Error categories without converting NOT_FOUND to an empty page.

Run:

~~~bash
npm run test:shared -- packages/api-contracts/src/b3.test.ts packages/application/src/b3/building-registration.test.ts
~~~

Expected GREEN.

- [ ] **Step 7: Commit Task 1 only after GREEN**

~~~bash
git add packages/api-contracts/src/b3.ts packages/api-contracts/src/b3.test.ts packages/api-contracts/src/index.ts packages/application/src/b3 packages/application/src/index.ts
git commit -m "feat: define B3 registration contracts"
~~~

---

### Task 2: Add migration 0008, can_administer_org, exact bm_b1_web ACL, restrictive RLS, and migration atomicity evidence

**Files:**
- Create: <code>packages/persistence-postgres/migrations/0008_b3_building_registration.sql</code>
- Create: <code>tests/postgres/b3-capabilities.test.ts</code>
- Create: <code>tests/postgres/b3-schema.test.ts</code>

**Interfaces:**
- Produces <code>authn.can_administer_org(bytea,uuid) RETURNS boolean</code>.
- Produces exactly three new role-specific restrictive policies:
  - b3_property_insert_ceiling
  - b3_unit_read_ceiling
  - b3_unit_insert_ceiling
- Adds only the approved bm_b1_web column privileges.
- Leaves migrations 0001-0007 and the eight-table inventory unchanged.

- [ ] **Step 1: Write catalog RED against the existing 0001-0007 behavior**

Add tests that run the normal migration chain before 0008 exists and make assertions that fail cleanly because:
- <code>to_regprocedure('authn.can_administer_org(bytea,uuid)')</code> is expected non-null;
- the three B3 policies are expected in pg_policy;
- bm_b1_web is expected to hold the exact approved Unit SELECT/INSERT and Property INSERT column privileges;
- capability-owner authn CREATE is expected revoked after the chain.

The RED must be a failed catalog assertion, not an import failure or unavailable PostgreSQL container.

Run:

~~~bash
npm run test:postgres -- tests/postgres/b3-capabilities.test.ts
~~~

Expected RED on missing B3 catalog objects.

- [ ] **Step 2: Implement 0008 with the exact security shape**

The migration must follow this SQL structure. Keep the preflight explicit and fail closed; never CREATE/ALTER a role to repair prerequisites.

~~~sql
DO $b3_preflight$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_roles
      WHERE rolname IN ('bm_b1_login','bm_b1_web','bm_b1_capability_owner')) <> 3 THEN
    RAISE EXCEPTION 'B3_REQUIRED_ROLES_MISSING';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname IN ('bm_b1_login','bm_b1_web','bm_b1_capability_owner')
      AND (
        rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit
        OR rolcanlogin <> (rolname <> 'bm_b1_capability_owner')
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles r ON r.oid=m.member
    WHERE r.rolname IN ('bm_b1_login','bm_b1_web','bm_b1_capability_owner')
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles r ON r.oid=m.roleid
    JOIN pg_catalog.pg_roles member_role ON member_role.oid=m.member
    WHERE r.rolname IN ('bm_b1_login','bm_b1_web','bm_b1_capability_owner')
      AND NOT (
        r.rolname='bm_b1_capability_owner'
        AND member_role.rolname=current_user
        AND NOT m.inherit_option
        AND m.set_option
        AND NOT m.admin_option
      )
  ) THEN
    RAISE EXCEPTION 'B3_ROLE_CONTRACT_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='app' AND c.relkind='r' AND c.relowner<>current_user::regrole::oid
  ) THEN
    RAISE EXCEPTION 'B3_TABLE_OWNER_CONTRACT_INVALID';
  END IF;

  IF to_regprocedure('authn.current_actor(bytea)') IS NULL
     OR to_regprocedure('authn.context_session_digest()') IS NULL
     OR to_regprocedure('authn.can_read_property(bytea,uuid,uuid)') IS NULL
     OR to_regprocedure('app.current_org_id()') IS NULL THEN
    RAISE EXCEPTION 'B3_REQUIRED_CAPABILITY_MISSING';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc
    WHERE oid IN (
      'authn.current_actor(bytea)'::regprocedure,
      'authn.can_read_property(bytea,uuid,uuid)'::regprocedure
    )
      AND proowner <> 'bm_b1_capability_owner'::regrole
  ) THEN
    RAISE EXCEPTION 'B3_CAPABILITY_OWNER_CONTRACT_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class
    WHERE oid IN ('app.property'::regclass,'app.unit'::regclass)
      AND (NOT relrowsecurity OR NOT relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION 'B3_RLS_CONTRACT_INVALID';
  END IF;
END
$b3_preflight$;

GRANT CREATE ON SCHEMA authn TO bm_b1_capability_owner;
SET LOCAL ROLE bm_b1_capability_owner;

CREATE FUNCTION authn.can_administer_org(p_digest bytea,p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT COALESCE(
    p_digest=authn.context_session_digest()
    AND p_org=app.current_org_id()
    AND authn.current_actor(p_digest) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM app.organization o
      JOIN app.organization_membership m ON m.org_id=o.id
      WHERE o.id=p_org
        AND o.status='ACTIVE'
        AND m.user_id=authn.current_actor(p_digest)
        AND m.status='ACTIVE'
        AND m.role='ORG_ADMIN'
    ),
    false
  )
$$;

REVOKE ALL ON FUNCTION authn.can_administer_org(bytea,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authn.can_administer_org(bytea,uuid) TO bm_b1_web;

RESET ROLE;

CREATE POLICY b3_property_insert_ceiling ON app.property
  AS RESTRICTIVE FOR INSERT TO bm_b1_web
  WITH CHECK (
    status='ACTIVE'
    AND org_id=app.current_org_id()
    AND authn.can_administer_org(authn.context_session_digest(),org_id)
  );

CREATE POLICY b3_unit_read_ceiling ON app.unit
  AS RESTRICTIVE FOR SELECT TO bm_b1_web
  USING (
    status='ACTIVE'
    AND authn.can_read_property(
      authn.context_session_digest(),
      org_id,
      property_id
    )
  );

CREATE POLICY b3_unit_insert_ceiling ON app.unit
  AS RESTRICTIVE FOR INSERT TO bm_b1_web
  WITH CHECK (
    status='ACTIVE'
    AND org_id=app.current_org_id()
    AND authn.can_administer_org(authn.context_session_digest(),org_id)
    AND authn.can_read_property(
      authn.context_session_digest(),
      org_id,
      property_id
    )
  );

GRANT INSERT(id,org_id,address_reference,status) ON app.property TO bm_b1_web;
GRANT SELECT(id,org_id,property_id,label,status) ON app.unit TO bm_b1_web;
GRANT INSERT(id,org_id,property_id,label,status) ON app.unit TO bm_b1_web;

REVOKE CREATE ON SCHEMA authn FROM bm_b1_capability_owner;
~~~

Do not grant created_at, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN, SET ROLE, schema CREATE, or new role membership. Do not grant Unit table access to bm_b1_capability_owner.

- [ ] **Step 3: GREEN the function/policy/ACL catalog tests**

Pin:
- owner bm_b1_capability_owner;
- provolatile = s;
- prosecdef = true;
- proconfig exactly search_path=pg_catalog;
- function executors exactly capability owner + bm_b1_web, never PUBLIC/bm_b1_login/bm_pf02a_runtime;
- no grant option;
- all three policies have polpermissive=false and correct polcmd/role OID/USING or WITH CHECK;
- Property/Unit still ENABLE/FORCE RLS;
- no residual capability-owner CREATE on authn;
- no new pg_auth_members rows;
- bm_b1_web exact new column privileges and no UPDATE/DELETE;
- exact eight app tables.

Run:

~~~bash
npm run test:postgres -- tests/postgres/b3-capabilities.test.ts
~~~

Expected GREEN.

- [ ] **Step 4: Add migration freeze and fresh/upgrade/failure-atomic tests**

In <code>b3-schema.test.ts</code>, reuse the existing B2 temp-directory/node-pg-migrate pattern and include all seven frozen hashes from Global Constraints.

Required cases:
1. fresh 0001-0008 succeeds and produces the expected catalog;
2. migrate a temporary copy through 0007, snapshot catalogs, add 0008, migrate again, and require the same final B3 catalog as fresh;
3. inject a deterministic exception after B3 grants/policies in a temporary 0008 copy, run upgrade from a valid 0007 database, require the pre-0008 catalog snapshot byte-for-byte equivalent and no 0008 pgmigrations row;
4. run a fresh-chain failure with the same injected exception and prove no partial app/authn B3 objects survive; treat migration-metadata bootstrap separately rather than calling it a B3 success;
5. missing/invalid role preconditions fail without role creation or repair.

Do not mutate canonical migration files to create the negative controls; copy them to a temporary test directory.

Run:

~~~bash
npm run test:postgres -- tests/postgres/b3-schema.test.ts
~~~

Expected GREEN.

- [ ] **Step 5: Commit Task 2**

~~~bash
git add packages/persistence-postgres/migrations/0008_b3_building_registration.sql tests/postgres/b3-capabilities.test.ts tests/postgres/b3-schema.test.ts
git commit -m "feat: add B3 registration RLS"
~~~

---

### Task 3: Implement PostgreSQL registration commands with admin/parent guards, plain INSERT, protected readback, and sanitized errors

**Files:**
- Create: <code>packages/persistence-postgres/src/b3/common.ts</code>
- Create: <code>packages/persistence-postgres/src/b3/registration.ts</code>
- Create: <code>packages/persistence-postgres/src/b3/index.ts</code>
- Modify: <code>packages/persistence-postgres/package.json</code>
- Create: <code>tests/postgres/helpers/b3-fixture.ts</code>
- Create: <code>tests/postgres/b3-registration.test.ts</code>

**Interfaces:**
- Consumes frozen <code>withB1OrgTransaction(database,digest,orgId,operation)</code>.
- Produces <code>createBuildingRegistrationPort(database): BuildingRegistrationPort</code>.
- Adds package export <code>./b3 -> ./src/b3/index.ts</code>.
- No raw Pool becomes public.

- [ ] **Step 1: Add a compileable adapter factory with the exact method surface, then behavioral RED**

Create the B3 subpath and factory so imports resolve. The first internal version may enter <code>withB1OrgTransaction</code> and return DEPENDENCY_UNAVAILABLE for create operations, but it must not alter B1 code or grant authority.

Write RED tests using actual PostgreSQL/bm_b1_web for:
- AC01 admin Property create;
- AC02 visible staff Property create FORBIDDEN with no row;
- AC03 foreign/PENDING/SUSPENDED/ARCHIVED organization NOT_FOUND with no row;
- AC04 valid Property boundary values and existing null-valued Property read preservation;
- AC05 admin Unit create;
- AC06 assigned staff Unit create FORBIDDEN and same-org unassigned parent NOT_FOUND;
- AC07 foreign/archived Property NOT_FOUND;
- AC08 duplicate ACTIVE Unit label and case variant CONFLICT; same label another Property allowed; archived history does not collide;
- AC23 created defaults and next-statement readback.

Run:

~~~bash
npm run test:postgres -- tests/postgres/b3-registration.test.ts
~~~

Expected RED on behavior, never on an unresolved import/container.

- [ ] **Step 2: Implement shared PostgreSQL B3 guards and error translation**

In <code>common.ts</code>, implement:
- lower-case canonical UUID and 64-lowerhex digest assertions;
- <code>proof(digest) = Buffer.from(digest, "hex")</code>;
- translation of frozen B1 UNAUTHENTICATED/NOT_FOUND/INVALID_INPUT/FORBIDDEN/DEPENDENCY_UNAVAILABLE into B3Error;
- preservation of B3Error;
- all unknown PostgreSQL/driver/cleanup errors to DEPENDENCY_UNAVAILABLE;
- a helper to test parent visibility with <code>authn.can_read_property</code>;
- a helper to test admin authority with <code>authn.can_administer_org</code>;
- UUID allocation using exactly <code>SELECT uuidv7() AS id</code>.

The parent helper must run before the admin helper for Unit capability/create. The admin helper must run only after <code>withB1OrgTransaction</code> has established current context.

- [ ] **Step 3: Implement Property create exactly as INSERT then readback**

Inside one <code>withB1OrgTransaction</code>:
1. require <code>can_administer_org</code>, else FORBIDDEN;
2. allocate UUID with SELECT uuidv7();
3. issue:

~~~sql
INSERT INTO app.property(id,org_id,address_reference,status)
VALUES($1,$2,$3,'ACTIVE')
~~~

4. never include created_at;
5. never use RETURNING or ON CONFLICT;
6. read back with:

~~~sql
SELECT id,org_id,address_reference
FROM app.property
WHERE org_id=$1
  AND id=$2
  AND authn.can_read_property($3::bytea,org_id,id)
~~~

7. require exactly one row before allowing the transaction to commit.

Map no Property unique error to CONFLICT. If readback disappears because authority changed, throw a denial and let the whole create transaction roll back.

- [ ] **Step 4: Implement Unit create with parent-before-admin authority**

Inside one <code>withB1OrgTransaction</code>:
1. require current parent visibility through <code>authn.can_read_property</code>, else NOT_FOUND;
2. require <code>can_administer_org</code>, else FORBIDDEN;
3. allocate UUID;
4. issue:

~~~sql
INSERT INTO app.unit(id,org_id,property_id,label,status)
VALUES($1,$2,$3,$4,'ACTIVE')
~~~

5. no created_at, RETURNING, or ON CONFLICT;
6. read back by exact id/org/property with explicit current <code>can_read_property</code> predicate;
7. return only id/orgId/propertyId/label after successful readback.

Only an error with both <code>code === "23505"</code> and <code>constraint === "unit_active_label_unique"</code> becomes B3 CONFLICT. Any other 23505 is DEPENDENCY_UNAVAILABLE.

For a late 42501 or unit_property_fk 23503 from a relationship race, do not expose the raw SQL error. After the failed transaction has rolled back, run a fresh read-only classification:
- no current actor -> UNAUTHENTICATED;
- no visible org/parent -> NOT_FOUND;
- visible context but no admin -> FORBIDDEN;
- still fully authorized -> DEPENDENCY_UNAVAILABLE.
Never retry the write.

- [ ] **Step 5: Implement capability methods with the same ordering**

<code>canCreateProperty</code>:
- <code>withB1OrgTransaction</code> first;
- return exact boolean from can_administer_org.

<code>canCreateUnit</code>:
- <code>withB1OrgTransaction</code>;
- parent visible first or NOT_FOUND;
- return exact admin boolean.

Thus assigned staff gets false for a visible parent, zero-assignment/unassigned staff gets NOT_FOUND for that parent, and foreign/archived parent is indistinguishable from missing.

- [ ] **Step 6: GREEN the actual-role registration tests**

Also assert:
- no PropertyAssignment row appears after Property create;
- no Occupancy row appears after Unit create;
- Property may share the same addressReference within one or multiple orgs;
- generated IDs are UUIDv7-shaped;
- created_at equals the database transaction timestamp/default without a runtime column grant;
- the result is unavailable until COMMIT is confirmed by the transaction wrapper.

Run:

~~~bash
npm run test:postgres -- tests/postgres/b3-registration.test.ts
~~~

Expected GREEN.

- [ ] **Step 7: Commit Task 3**

~~~bash
git add packages/persistence-postgres/package.json packages/persistence-postgres/src/b3 tests/postgres/helpers/b3-fixture.ts tests/postgres/b3-registration.test.ts
git commit -m "feat: add B3 registration adapter"
~~~

---

### Task 4: Add parent-scoped Unit list/detail and prove raw RLS/ACL/non-disclosure boundaries

**Files:**
- Create: <code>packages/persistence-postgres/src/b3/unit-reader.ts</code>
- Modify: <code>packages/persistence-postgres/src/b3/index.ts</code>
- Create: <code>tests/postgres/b3-units.test.ts</code>
- Modify: <code>tests/postgres/b3-capabilities.test.ts</code>

**Interfaces:**
- Produces <code>createUnitReadPort(database): UnitReadPort</code>.
- Uses the same B3 selector/error helper and frozen <code>withB1OrgTransaction</code>.
- List returns <code>{ items, nextCursor }</code> with limit+1 and last emitted visible id.

- [ ] **Step 1: Write Unit read/security RED against the current adapter surface**

Pin:
- AC10 admin sees only ACTIVE Units under an ACTIVE visible parent, including a visible empty parent returning 200-equivalent empty Page;
- AC11 assigned staff sees ACTIVE Units only under assigned ACTIVE Property; unassigned/foreign/archived parent is NOT_FOUND; zero-assignment staff cannot enumerate;
- AC12 raw bm_b1_web Unit SELECT with a valid staff digest/current org cannot expose a peer unassigned Unit even when application predicates are omitted;
- AC13 raw bm_b1_web Property/Unit INSERT as staff is denied by RLS, forged app.org_id/digest/status cannot widen authority, UPDATE/DELETE grants are absent;
- AC19 pagination filters visibility before id cursor/order/LIMIT and never derives a cursor from hidden rows;
- detail NOT_FOUND is identical for missing, foreign, unassigned, archived parent, archived Unit, and mismatched org/property/unit chain.

Run:

~~~bash
npm run test:postgres -- tests/postgres/b3-units.test.ts
~~~

Expected RED on missing UnitReadPort behavior.

- [ ] **Step 2: Implement visible-parent gate before empty-list success**

For both list/detail, after <code>withB1OrgTransaction</code>, first call:

~~~sql
SELECT authn.can_read_property($1::bytea,$2::uuid,$3::uuid) AS allowed
~~~

If false, throw NOT_FOUND. Only then execute Unit SELECT.

List SQL shape:

~~~sql
SELECT id,org_id,property_id,label
FROM app.unit
WHERE org_id=$1
  AND property_id=$2
  AND status='ACTIVE'
  AND authn.can_read_property($5::bytea,org_id,property_id)
  AND ($3::uuid IS NULL OR id>$3)
ORDER BY id
LIMIT $4
~~~

Arguments are orgId, propertyId, after-or-null, limit+1, digest proof.

Detail SQL shape:

~~~sql
SELECT id,org_id,property_id,label
FROM app.unit
WHERE org_id=$1
  AND property_id=$2
  AND id=$3
  AND status='ACTIVE'
  AND authn.can_read_property($4::bytea,org_id,property_id)
~~~

Do not select status, created_at, occupancy, assignment, user, or membership columns into the DTO.

- [ ] **Step 3: Prove AC09 cross-org Unit parent FK independently of Web RLS**

Using only the isolated migration-owner test client and transaction-local org context:
1. create an org-A Unit tuple that references org-B Property id;
2. prove both parent identifiers independently exist in their own orgs;
3. require SQLSTATE 23503 and constraint <code>unit_property_fk</code>;
4. require rollback leaves no Unit;
5. keep this separate from Web-role tests so a 42501 RLS denial cannot masquerade as FK evidence.

- [ ] **Step 4: Extend catalog tests for exact Web column ACL and no capability-owner Unit grant**

For every Unit column and every SELECT/INSERT/UPDATE/REFERENCES privilege, assert bm_b1_web is true only for the approved columns/operations. For bm_b1_capability_owner, assert there is no Unit table/column grant introduced by B3.

Require bm_b1_web:
- Unit SELECT: id, org_id, property_id, label, status only;
- Unit INSERT: id, org_id, property_id, label, status only;
- no Unit UPDATE/DELETE/TRUNCATE/etc.;
- Property INSERT only id, org_id, address_reference, status, with existing Property SELECT preserved.

- [ ] **Step 5: GREEN Unit read/raw-security tests**

Run:

~~~bash
npm run test:postgres -- tests/postgres/b3-units.test.ts tests/postgres/b3-capabilities.test.ts
~~~

Expected GREEN.

- [ ] **Step 6: Commit Task 4**

~~~bash
git add packages/persistence-postgres/src/b3 tests/postgres/b3-units.test.ts tests/postgres/b3-capabilities.test.ts
git commit -m "feat: scope B3 unit reads"
~~~

---

### Task 5: Prove real concurrency, revocation-at-final-statement, pool restoration, rollback, and unknown-COMMIT semantics

**Files:**
- Modify: <code>tests/postgres/helpers/b3-fixture.ts</code>
- Create: <code>tests/postgres/b3-concurrency.test.ts</code>
- Create: <code>tests/postgres/b3-revocation.test.ts</code>

**Interfaces:**
- Test-only barriers may spy on node-postgres <code>Client.prototype.query</code>, matching exact normalized B3 SQL plus parameters.
- No production test hook, header, environment switch, sleep-based ordering, or exported raw Pool is allowed.

- [ ] **Step 1: Add a reusable observed-query barrier with a sentinel control**

Follow the accepted B2 pattern:
- execute <code>SELECT 1 /* B3_POOLCLIENT_SPY_PROBE */</code> through the real package transaction before arming;
- record sentinelCount;
- match exactly one intended final INSERT or readback SQL statement plus expected org/property parameters;
- fail on an unexpected second match;
- expose reached/release/restore and observed transaction isolation;
- always release and restore the spy in finally.

A test cannot claim a barrier worked unless sentinelCount=1 and the intended statement count=1.

- [ ] **Step 2: RED then GREEN AC16 with two actual bm_b1_web pools and server-observed lock wait**

Use two databases with max=1 and distinct PostgreSQL application_name values, plus a migration/diagnostic Client.

Sequence:
1. A starts actual <code>createUnit</code>.
2. Gate A after its INSERT has succeeded but before readback returns, so A keeps the unique-index transaction open.
3. Start B <code>createUnit</code> with the same case-insensitive label and parent.
4. From the diagnostic connection, poll pg_stat_activity and pg_blocking_pids for B.
5. The only acceptable evidence is <code>wait_event_type='Lock'</code> and blockers containing A's backend pid before release. Poll delay is pacing only and cannot satisfy the assertion.
6. Release A; require A success/confirmed commit.
7. Require B adapter error CONFLICT and, in a raw-control variant, SQLSTATE 23505 with constraint unit_active_label_unique.
8. Require exactly one ACTIVE matching Unit.

Rollback-winner variant:
- force A to fail after INSERT but before COMMIT by making the test-only readback gate raise a synthetic internal error;
- A must roll back and return DEPENDENCY_UNAVAILABLE;
- blocked B then succeeds;
- exactly one ACTIVE Unit belongs to B.

- [ ] **Step 3: RED then GREEN AC22 write revocation at the actual final statement**

Cases:
- admin membership ENDED after application/admin guard but before Property INSERT -> current RLS statement denies; no Property row; fresh classification is NOT_FOUND;
- organization SUSPENDED after guard before Unit INSERT -> NOT_FOUND; no Unit row;
- role changed from ORG_ADMIN to PROPERTY_STAFF while context remains visible before INSERT -> FORBIDDEN; no row.

Require <code>SHOW transaction_isolation</code> at the gated Web backend to equal <code>read committed</code>.

- [ ] **Step 4: RED then GREEN AC22 read revocation and overlapping-write limitation**

Read case:
- assigned staff passes visible-parent guard;
- another backend commits assignment END;
- release actual final Unit SELECT;
- result is NOT_FOUND/zero rows according to the reader contract.

Overlapping case:
- admin INSERT and protected readback both complete under pre-revocation snapshots;
- hold the test immediately after the readback result but before outer COMMIT returns;
- another backend commits membership/org revocation;
- release the writer and permit it to commit as an overlapping operation;
- a subsequent new request must be denied.
This test documents B3D-L02 and must not assert universal revoke/write commit-order serialization.

- [ ] **Step 5: Prove max-one pool/GUC/savepoint restoration AC15**

Reuse a B3 Web database with max=1. Interleave:
- admin create/read;
- assigned staff read;
- zero-assignment/wrong-parent denial;
- failed duplicate insert;
- confirmed rollback;
- anonymous/invalid digest;
- nested SAVEPOINT failure/ROLLBACK TO SAVEPOINT.

Before and after each scoped operation, use a raw transaction on the same backend and require:
- current_setting('app.org_id',true) is null/empty-normalized;
- current_setting('app.b1_session_digest',true) is null/empty-normalized;
- no unintended Property/Unit rows are visible;
- pg_backend_pid stays the same, proving reuse.

- [ ] **Step 6: Prove confirmed rollback versus unknown COMMIT outcome**

Confirmed rollback:
- force protected readback failure before COMMIT;
- require adapter failure and no persisted row.

Unknown COMMIT:
- test-only spy forwards the real COMMIT to PostgreSQL successfully and then throws a synthetic connection-loss error to the transaction wrapper;
- adapter must return DEPENDENCY_UNAVAILABLE/503 category;
- the connection must be disposed;
- a diagnostic owner read may observe the row as committed;
- the test must explicitly assert that the 503 result did not claim rollback and no code automatically issued a second create.

- [ ] **Step 7: Run concurrency/revocation suites GREEN**

~~~bash
npm run test:postgres -- tests/postgres/b3-concurrency.test.ts tests/postgres/b3-revocation.test.ts
~~~

No retries and no skipped cases.

- [ ] **Step 8: Commit Task 5**

~~~bash
git add tests/postgres/helpers/b3-fixture.ts tests/postgres/b3-concurrency.test.ts tests/postgres/b3-revocation.test.ts
git commit -m "test: prove B3 transaction boundaries"
~~~

---

### Task 6: Add B3 HTTP error vocabulary, exact Origin/session/CSRF precedence, bounded JSON reading, GET capability headers, and mutation handlers

**Files:**
- Create: <code>apps/web/src/server/b3/errors.ts</code>
- Create: <code>apps/web/src/server/b3/request.ts</code>
- Create: <code>apps/web/src/server/b3/http.ts</code>
- Create: <code>apps/web/src/server/b3/http.test.ts</code>

**Interfaces:**
- Consumes frozen <code>requireCurrentSession</code>, <code>privateHeaders</code>, B1 organization-read use cases, B1 PageQuery schema, and B3 application use cases.
- Produces handlers for Property collection/detail and Unit collection/detail.
- Produces advisory headers exactly:
  - <code>X-B3-Can-Create-Property: true|false</code>
  - <code>X-B3-Can-Create-Unit: true|false</code>
- Produces B3 flat error responses without modifying B1 error/schema code.

- [ ] **Step 1: Write handler RED using fully compileable fake dependencies**

Define <code>B3HTTPDependencies</code> in the new module as B1 read/session dependencies plus registration and Unit ports. Use fake current sessions and fake ports so no import is missing.

Pin method/security precedence:
1. unsupported explicit application method -> 405 METHOD_NOT_ALLOWED;
2. for POST, missing/wrong/literal-null Origin -> 403 before session/body/resource;
3. valid Origin + absent/expired/revoked session -> 401;
4. current session + missing/malformed/wrong x-b1-csrf -> 403;
5. only then read/validate body and path/query;
6. only then perform visibility/admin/write.

Also pin that invalid CSRF never calls registration ports and malformed body never mutates.

- [ ] **Step 2: Implement B3 error mapping without touching B1ErrorCode/B1ErrorSchema**

<code>toB3ErrorResponse</code> accepts B3Error and the frozen B1 errors thrown by session/B1-read helpers. Map exactly:
- UNAUTHENTICATED -> 401
- FORBIDDEN -> 403
- NOT_FOUND -> 404
- INVALID_INPUT -> 400
- CONFLICT -> 409
- PAYLOAD_TOO_LARGE -> 413
- DEPENDENCY_UNAVAILABLE -> 503
- METHOD_NOT_ALLOWED -> 405

AUTHENTICATION_REJECTED is only a historical B1 auth-flow category; if encountered unexpectedly in a B3 business handler, sanitize it to UNAUTHENTICATED 401 rather than adding it to B3ErrorSchema.

Every B3 response uses the existing private/no-store/max-age=0 and Vary: Cookie values. Never include raw error messages, constraints, inputs, identities, CSRF, or SQL.

- [ ] **Step 3: Implement actual-byte bounded JSON reading**

In <code>request.ts</code>:
- accept only application/json with no media-type parameter other than optional charset;
- when charset is present, require UTF-8 semantics;
- iterate <code>request.body.getReader()</code> and sum Uint8Array byteLength;
- if bytes exceed 8192, cancel reading and throw PAYLOAD_TOO_LARGE;
- decode using <code>new TextDecoder("utf-8", { fatal: true })</code>;
- empty/malformed/invalid UTF-8 -> INVALID_INPUT;
- parse JSON once;
- never trust Content-Length as the sole enforcement.

Tests must include a multibyte body whose character count is below 8192 but UTF-8 bytes exceed 8192.

- [ ] **Step 4: Implement session-bound CSRF check**

After exact Origin and current-session validation:
- submitted token must be header <code>x-b1-csrf</code> only;
- no query/body/form fallback for B3 JSON;
- require both submitted and current token to match 64 lowerhex;
- compare decoded equal-length bytes with <code>timingSafeEqual</code>;
- missing/malformed/mismatch -> FORBIDDEN.

Do not modify frozen logout's existing form fallback.

- [ ] **Step 5: Implement GET handlers and advisory headers**

Property collection GET:
- validate duplicate/unknown query keys and B1 PageQuery;
- validate org UUID;
- require current session;
- call frozen <code>listOrganizationProperties</code>;
- call B3 <code>canCreateOrganizationProperty</code> with the same digest/org;
- return unchanged B1 Property Page JSON plus X-B3-Can-Create-Property exact true/false.

Property detail GET:
- no query;
- get frozen PropertyView;
- call <code>canCreatePropertyUnit</code>;
- return unchanged PropertyView plus X-B3-Can-Create-Unit.

Unit collection GET:
- visible-parent semantics from UnitReadPort;
- B1 PageQuery;
- unchanged B3 Unit Page body;
- X-B3-Can-Create-Unit true/false.

Unit detail GET:
- no query;
- exact chain read;
- no action header required.

If the authority projection becomes NOT_FOUND between read and header derivation, return the generalized denial rather than a success with stale create=true. A false/missing create capability must never become true client-side.

- [ ] **Step 6: Implement POST handlers**

Property POST:
- no query;
- method/origin/session/csrf/body/path precedence above;
- B3PropertyCreateSchema;
- <code>createOrganizationProperty</code>;
- 201 only after the port promise returns from confirmed COMMIT;
- body exact PropertyView;
- relative Location <code>/api/v2/organizations/&lt;orgId&gt;/properties/&lt;id&gt;</code>.

Unit POST:
- same boundary with B3UnitCreateSchema;
- 201 after confirmed COMMIT;
- relative Location to exact Unit detail.

No response includes role, assignment, status, createdAt, raw conflict detail, or submitted input echo.

- [ ] **Step 7: GREEN HTTP unit tests**

Test:
- AC04 strict body/server fields;
- AC14 method/Origin/session/CSRF/body-size/content-type/parse precedence and zero mutations;
- AC21 exact capability header values, absent header on errors, forged input/header cannot authorize;
- known CONFLICT -> 409;
- unknown DB error -> sanitized 503;
- all successes/errors no-store + Vary Cookie;
- duplicate query keys -> 400;
- detail/POST query -> 400;
- invalid UUID -> 400 without resource access.

Run:

~~~bash
npm run test:web -- apps/web/src/server/b3/http.test.ts
~~~

Expected GREEN.

- [ ] **Step 8: Commit Task 6**

~~~bash
git add apps/web/src/server/b3
git commit -m "feat: add B3 secure HTTP handlers"
~~~

---

### Task 7: Wire the existing B1-mode container and exact v2 routes without changing frozen auth/session/logout behavior

**Files:**
- Modify: <code>apps/web/src/server/b1/container.ts</code>
- Modify: <code>apps/web/src/app/api/v2/organizations/[orgId]/properties/route.ts</code>
- Modify: <code>apps/web/src/app/api/v2/organizations/[orgId]/properties/[propertyId]/route.ts</code>
- Create: <code>apps/web/src/app/api/v2/organizations/[orgId]/properties/[propertyId]/units/route.ts</code>
- Create: <code>apps/web/src/app/api/v2/organizations/[orgId]/properties/[propertyId]/units/[unitId]/route.ts</code>
- Modify: <code>tests/architecture/b1-boundary.test.ts</code>
- Create: <code>tests/architecture/b3-boundary.test.ts</code>

**Interfaces:**
- Existing <code>/api/v2/session</code>, <code>/api/v2/session/logout</code>, and <code>/api/v2/me/organizations</code> remain on frozen B1 handlers.
- Existing Property routes keep their URLs and JSON bodies while adding B3 POST/header behavior.
- New Unit routes are nested only under org/property.

- [ ] **Step 1: Add container assembly RED/GREEN without a second database pool**

Modify the return type of <code>getB1Container</code> additively so the cached object contains:
- existing sessions;
- existing organizations;
- existing readSession;
- <code>registration: createBuildingRegistrationPort(database)</code>;
- <code>units: createUnitReadPort(database)</code>.

Use the same existing <code>database</code> handle created from B1_WEB_DATABASE_URL. Do not create a separate B3 credential/pool or expose the database handle to pages.

B1 HTTP tests typed as B1HTTPDependencies must remain valid; do not make B3 fields mandatory in B1 test fixtures.

- [ ] **Step 2: Wire Property collection/detail to B3 handlers**

Property collection exports literal:
- runtime = nodejs;
- dynamic = force-dynamic;
- GET -> B3 Property collection read;
- POST -> B3 Property create.

Property detail exports:
- runtime/dynamic literals;
- GET -> B3 Property detail read.

Explicit unsupported PUT/PATCH/DELETE and detail POST must return the flat B3 405 body with an Allow header listing only the supported application methods for that route. Leave ordinary framework HEAD/OPTIONS behavior non-mutating.

- [ ] **Step 3: Add nested Unit collection/detail routes**

Collection:
- GET list;
- POST create;
- no root/unscoped Unit route.

Detail:
- GET exact chain only.

Retain literal nodejs and force-dynamic declarations.

- [ ] **Step 4: Update architecture inventory from six to eight v2 route files**

In <code>b1-boundary.test.ts</code>:
- change the actual handler inventory expected count 6 -> 8;
- append the Unit collection/detail route paths;
- keep all runtime/dynamic negative controls.

In <code>b3-boundary.test.ts</code>, assert:
- B3 production imports cannot traverse into <code>tests/postgres/helpers/b3-fixture.ts</code> or <code>apps/web/tests/b1-e2e/b3-fixture.ts</code> through static, alias, re-export, require, dynamic, type-only, or workspace indirection;
- B3 server/pages cannot import <code>@build-manager/fixtures</code>, node:sqlite, demo persistence, test-only auth, or raw pg Pool;
- only server modules may import <code>@build-manager/persistence-postgres/b3</code>;
- no client component imports application/persistence server modules.

- [ ] **Step 5: Build/typecheck/architecture GREEN**

Run:

~~~bash
npm run test:shared -- tests/architecture/b1-boundary.test.ts tests/architecture/b3-boundary.test.ts
npm run typecheck
npm run build:web
~~~

Expected GREEN. A build failure must not be fixed by moving DB/application imports into page/layout/client code.

- [ ] **Step 6: Commit Task 7**

~~~bash
git add apps/web/src/server/b1/container.ts apps/web/src/app/api/v2/organizations tests/architecture/b1-boundary.test.ts tests/architecture/b3-boundary.test.ts
git commit -m "feat: wire B3 registration routes"
~~~

---

### Task 8: Add protected Web Property/Unit registration and readback UX with advisory capability state only

**Files:**
- Create B3 components/tests listed in Planned File Map
- Modify: <code>apps/web/src/app/workspace/organizations/[orgId]/page.tsx</code>
- Modify: <code>apps/web/src/app/workspace/organizations/[orgId]/properties/[propertyId]/page.tsx</code>
- Create the three B3 workspace pages listed in Planned File Map

**Interfaces:**
- <code>/workspace</code> keeps the existing B1 organization shell.
- Organization page becomes PropertyWorkspace.
- Property detail page becomes UnitWorkspace and still displays the Property reference.
- Dedicated registration routes are <code>.../properties/new</code> and <code>.../units/new</code>.
- Unit detail route is <code>.../units/[unitId]</code>.

- [ ] **Step 1: Write component RED for advisory-capability behavior**

With mocked fetch responses, pin:
- create controls start hidden;
- only exact response-header string <code>true</code> reveals the matching create link/form;
- false, missing, malformed, duplicate-looking values, network failure, abort, 401, 403, and 404 keep controls hidden;
- stale create=true followed by POST 403/404 clears capability and form state;
- logout/navigation aborts in-flight fetch and clears state;
- staff can navigate visible Unit list/detail but never sees create affordance;
- role-neutral empty copy remains exactly “조회 가능한 건물이 없습니다.” / “조회 가능한 호실이 없습니다.”;
- no ORG_ADMIN/PROPERTY_STAFF badge appears.

Run the focused Web tests and require behavioral RED before implementing components.

- [ ] **Step 2: Implement PropertyWorkspace**

PropertyWorkspace:
- obtains CSRF from existing GET /api/v2/session;
- GETs Property collection no-store/same-origin;
- parses unchanged B1PropertyPageSchema;
- reads X-B3-Can-Create-Property exactly;
- renders existing Property links and pagination;
- when true, renders link to <code>/workspace/organizations/&lt;orgId&gt;/properties/new</code>;
- preserves B2 role-neutral empty state and denial behavior.

Do not infer capability from a role, pathname, existing Property count, JWT claim, or query/header supplied by the browser.

- [ ] **Step 3: Implement direct Property registration page**

Before rendering the form, perform the same protected Property collection GET and require exact create=true. A direct URL with false/missing capability shows no form.

Form:
- one field labelled as an unverified/manual building reference;
- synthetic example only, never a real address;
- may offer trimming before POST, but API remains authoritative;
- sends JSON and x-b1-csrf;
- disables duplicate submit while request is in flight;
- on 201, navigate to returned Property detail path;
- on 400 show validation guidance;
- on 403/404 hide the form and capability;
- on 503/network outcome show uncertainty/reconciliation guidance, never auto-retry and never claim rollback;
- no provider search/map/verified/ownership badge.

- [ ] **Step 4: Implement UnitWorkspace**

On visible Property page:
- GET exact Property detail and Unit collection;
- parse B1 Property and B3 Unit Page;
- show current Property reference;
- show ACTIVE visible Unit links only;
- show role-neutral empty Unit copy;
- read create-Unit header exactly from the successful scoped Unit collection; Property-detail header is independently tested at API level;
- true exposes Unit registration link, otherwise hidden;
- pagination uses only server nextCursor.

No count or hidden ID is shown.

- [ ] **Step 5: Implement direct Unit registration and Unit detail**

Unit registration:
- first performs a protected Unit collection/read for the exact parent and requires create=true;
- one label field only;
- POST JSON with CSRF;
- duplicate 409 -> general “이미 사용 중인 호실 이름입니다.” style message with no conflicting row/tenant detail;
- 503/network -> reconcile list before explicit resubmission, no automatic retry;
- 201 -> exact Unit detail.

Unit detail:
- GET exact nested Unit detail;
- display label and navigation only;
- no status/role/assignment/occupancy fields.

- [ ] **Step 6: Preserve B1/B2 Web behavior**

Run:
- existing workspace-shell unit test;
- all new B3 component tests;
- Web unit suite;
- typecheck/build.

~~~bash
npm run test:web
npm run typecheck
npm run build:web
~~~

Expected GREEN.

- [ ] **Step 7: Commit Task 8**

~~~bash
git add apps/web/src/components/b3 apps/web/src/app/workspace/organizations
git commit -m "feat: add B3 registration workspace"
~~~

---

### Task 9: Add actual Web + PostgreSQL B3 E2E and make the existing result gate non-vacuous

**Files:**
- Create: <code>apps/web/tests/b1-e2e/b3-fixture.ts</code>
- Create: <code>apps/web/tests/b1-e2e/b3.spec.ts</code>
- Modify: <code>apps/web/tests/b1-e2e/check-results.mjs</code>

**Interfaces:**
- Reuse existing Playwright B1 config/global setup, actual built Next server, Testcontainers PostgreSQL, real bm_b1_web credential, and synthetic SDK session path.
- No product test header, demo fallback, direct role injection, or live Auth0 requirement.
- Existing B1/B2 case gate remains exact and is extended, never weakened.

- [ ] **Step 1: Create B3 fixture only under the E2E test tree**

<code>fixtureB3Session</code> may build on <code>fixtureSession</code>/<code>fixtureB2Session</code> to create synthetic:
- ACTIVE admin/staff memberships;
- ACTIVE/ARCHIVED Properties;
- assigned/unassigned PropertyAssignment rows;
- ACTIVE/ARCHIVED Units;
- second organization for foreign controls.

All setup writes go through the migration-owner fixture client, never the product runtime. The product server receives no fixture metadata, role header, raw IDs beyond normal URL navigation, or special B3 environment flag.

- [ ] **Step 2: Add named B3 E2E cases**

Use exactly these case titles so the result gate can require them once each:

~~~text
B3 AC01 adminPropertyCreateReadback
B3 AC02 staffPropertyCreateForbidden
B3 AC03 hiddenOrgPropertyCreate404
B3 AC05 adminUnitCreateReadback
B3 AC06 staffUnitCreateBoundary
B3 AC07 hiddenPropertyUnitCreate404
B3 AC08 duplicateUnit409
B3 AC10 adminUnitReadEmptyAndDetail
B3 AC11 staffAssignedUnitScope
B3 AC14 csrfOriginBodyBoundaries
B3 AC19 hiddenUnitPagination
B3 AC20 syntheticNoFallback
B3 AC21 capabilityUiAndForgedHeader
~~~

Coverage requirements:
- create through real POST and verify DB/readback/Web;
- 403 versus 404 precedence exactly;
- no auto assignment/Occupancy;
- duplicate case variant 409;
- hidden Unit never appears in items/cursor/UI/action metadata;
- capability header true for admin, false for visible staff, absent on errors;
- forged <code>X-B3-Can-Create-*</code>, x-role, x-user-id, x-org-id and body role/user/org fields never authorize;
- direct registration URL without capability displays no form;
- valid Origin + invalid session = 401, missing/wrong Origin = 403, bad CSRF = 403;
- actual >8 KiB UTF-8 body = 413 and malformed JSON = 400 with no row;
- Property failure does not create; Unit failure after previously successful Property does not erase Property;
- after login/session fixture establishment, B3 registration flow makes zero address/building-provider requests and uses only synthetic references/labels.

- [ ] **Step 3: Extend check-results.mjs, including negative controls**

Append all 13 exact B3 titles to the required array. The verifier must still reject:
- missing required case;
- duplicate title;
- skipped;
- failed;
- retry > 0;
- top-level report error.

Keep existing B1/B2 negative controls and add one control that removes a B3 case. Rename the thrown classification string only if necessary to state B1_B2_B3; do not weaken exact-count logic.

- [ ] **Step 4: Run actual B1/B2/B3 E2E GREEN**

~~~bash
npm run test:e2e:b1
node apps/web/tests/b1-e2e/check-results.mjs
~~~

Expected:
- all existing B1/B2 required cases still pass;
- all 13 B3 cases pass;
- zero skip, retry, or failure;
- negative controls all reject;
- result classification remains synthetic-auth + actual Web + actual PostgreSQL, not live provider evidence.

- [ ] **Step 5: Commit Task 9**

~~~bash
git add apps/web/tests/b1-e2e
git commit -m "test: cover B3 web postgres flows"
~~~

---

### Task 10: Run full regression, freeze/security/public-data gates, and publish only a reviewable implementation candidate

**Files:**
- Modify append-only: <code>ops/AI_Execution_Log.csv</code>
- Modify append-only when external sync unavailable: <code>ops/pending_external_sync.md</code>
- No acceptance/status/F-case promotion in the implementation PR.

**Interfaces:**
- Produces one fixed implementation HEAD and Draft/Open PR for independent implementation review/acceptance.
- Does not merge, mark B3 VERIFIED, or advance F01/F43.

- [ ] **Step 1: Re-verify frozen files and authorized diff before full tests**

Run:

~~~bash
git diff --check
git diff --name-status IMPLEMENTATION_BASE...HEAD
sha256sum packages/persistence-postgres/migrations/0001_core_identity_organization.sql
sha256sum packages/persistence-postgres/migrations/0002_property_unit_occupancy.sql
sha256sum packages/persistence-postgres/migrations/0003_runtime_isolation.sql
sha256sum packages/persistence-postgres/migrations/0004_b1_identity_sessions.sql
sha256sum packages/persistence-postgres/migrations/0005_b1_auth_capabilities.sql
sha256sum packages/persistence-postgres/migrations/0006_b1_organization_access.sql
sha256sum packages/persistence-postgres/migrations/0007_b2_property_assignment_scope.sql
~~~

Require every hash exact and no path outside Planned File Map except append-only execution records. Root/package-lock/workflow/Mobile changes are a stop unless separately authorized.

- [ ] **Step 2: Run all local behavioral suites in their correct responsibility**

~~~bash
npm ci
git diff --exit-code -- package.json package-lock.json apps/mobile/package.json apps/mobile/app.json
npm run test:shared
npm run test:postgres
npm run test:web
npm run test:mobile -- --runInBand
npm run lint
npm run typecheck
npm run build:web
npm run check:deps
npm run test:e2e:web
npm run test:e2e:b1
node apps/web/tests/b1-e2e/check-results.mjs
~~~

Classify environment/tooling failures separately. Do not change product behavior or timeouts to force GREEN.

- [ ] **Step 3: Run repository/public-history scanners and inventory guards**

~~~bash
PYTHONPATH="$PWD" python3 tests/test_verify_repository.py -v
PYTHONPATH="$PWD" python3 scripts/tests/test_verify_repository.py -v
python3 scripts/verify_repository.py --history
git diff --check
~~~

Require scanner unittest inventories 3 and 14 and zero public/history findings. Manually inspect changed docs/test fixtures for real addresses, PII, credential-shaped values, session/CSRF material, or raw SQL exception text before publication.

- [ ] **Step 4: Record evidence without promoting acceptance**

Append execution-log rows with:
- exact IMPLEMENTATION_BASE and HEAD;
- task commits;
- direct local test counts/results;
- frozen hash result;
- concurrency lock-wait observation classification;
- scanner inventories/findings;
- B3 AC01-AC23 evidence locations;
- EXTERNAL_SYNC=PENDING if Google destinations are unavailable.

Do not write PASS into canonical acceptance_cases.json, STATUS, or a B3 acceptance receipt in this implementation task.

- [ ] **Step 5: Publish the feature branch with an expected-head boundary**

Immediately before push:
- fetch live main and feature remote;
- prove main ancestry/delta is still acceptable under the reviewed implementation base;
- if the feature branch already exists remotely, prove its remote head equals the executor's recorded expected head;
- push normally, never force.

Suggested PR title:

~~~text
feat: add PF02-B B3 building registration foundation
~~~

Open as Draft until all local required gates are recorded.

PR body must state:
- implementation HEAD;
- approved design path;
- accepted plan path/ref;
- migrations 0001-0007 hashes preserved;
- new migration 0008 only;
- synthetic data only;
- local evidence versus hosted CI clearly separated;
- B3 product implementation candidate, not VERIFIED/production-ready;
- F01/F43 remain NOT_RUN.

- [ ] **Step 6: Require hosted CI 9/9 on the exact candidate HEAD**

Require exact SUCCESS on:
1. verify
2. repository-safety
3. apps
4. mobile-cold-linux
5. install-mobile-windows
6. web-e2e
7. mobile-health
8. postgres-integration
9. foundation-gate

Do not substitute a prior B1/B2/main/docs run. Do not count skipped/cancelled/missing as success.

- [ ] **Step 7: Stop at READY_FOR_ACCEPTANCE**

After fixed-head readback and hosted CI evidence:
- leave the implementation PR unmerged;
- request independent implementation review at the exact candidate HEAD;
- do not merge;
- do not mark B3 VERIFIED/FROZEN;
- do not change F01/F43;
- do not start Occupancy/invitation/B4/PF02-C work.

Terminal state:

~~~text
PF02-B / B3 = READY_FOR_ACCEPTANCE
IMPLEMENTATION_PR = OPEN / NOT_MERGED
PRODUCT_IMPLEMENTATION_BEYOND_B3 = NOT_AUTHORIZED
~~~

---

## AC01-AC23 Traceability Matrix

| AC | Owning task(s) | Required concrete evidence |
| --- | --- | --- |
| AC01 | 3, 8, 9 | actual bm_b1_web Property INSERT/readback + API 201/Location + Web persisted readback after confirmed commit |
| AC02 | 3, 9 | visible staff returns FORBIDDEN/403; raw/app no Property row |
| AC03 | 3, 9 | foreign/PENDING/SUSPENDED/ARCHIVED org generalized NOT_FOUND/404 and no row |
| AC04 | 1, 3, 6, 9 | contract/app/HTTP Unicode-code-point, trim, controls, surrogate, unknown/server fields; existing null Property readable |
| AC05 | 3, 8, 9 | admin Unit create 201/list/detail/Web; no automatic assignment or Occupancy |
| AC06 | 3, 9 | assigned staff 403; same-org unassigned parent 404; no row |
| AC07 | 3, 9 | foreign/archived parent 404, uniform body, no row |
| AC08 | 3, 5, 9 | DB index authority, case variant 409, other Property allowed, archived history allowed, observed concurrent conflict |
| AC09 | 4 | isolated migration-owner cross-org parent control -> unit_property_fk 23503 + rollback |
| AC10 | 4, 8, 9 | admin ACTIVE Unit list/detail and visible empty list |
| AC11 | 4, 8, 9 | staff assigned-only Unit scope; unassigned/foreign/archived denied; zero-assignment no enumeration |
| AC12 | 4 | raw bm_b1_web SELECT without app predicate cannot expose peer Unit |
| AC13 | 2, 4 | real runtime raw INSERT denial, forged GUC/digest/status ineffective, exact no UPDATE/DELETE ACL |
| AC14 | 6, 9 | method/Origin/session/CSRF/body-byte/content-type/parse precedence and zero mutation |
| AC15 | 5 | confirmed rollback, savepoint/max1/GUC restoration, unknown COMMIT classified 503 without false rollback |
| AC16 | 5 | two backends + diagnostic pg_locks/pg_stat_activity observation; commit winner 23505->409; rollback winner succeeds |
| AC17 | 2, 10 | seven hashes, fresh/upgrade/failure atomicity, exact eight tables, function/policy/ACL catalogs |
| AC18 | 8, 9, 10 | full frozen B1 auth/session/logout/replay and B2 scope/revocation plus all nine hosted gates |
| AC19 | 4, 6, 7, 9 | visible filtering before pagination, exact nested chain, no hidden ID/cursor/count/action metadata |
| AC20 | 7, 8, 9, 10 | synthetic-only fixtures/copy, provider calls zero, real PII/address/credential zero, production graph no demo/test fallback |
| AC21 | 6, 7, 8, 9 | server-derived exact headers, hidden staff controls, direct-view denial, forged/stale header ineffective, state clears |
| AC22 | 5 | actual final statement barriers for membership/org/assignment revocation, overlapping limitation, subsequent request denial |
| AC23 | 3, 5 | plain INSERT then protected next-statement readback under bm_b1_web; defaults/column grants; failed readback rollback |

No AC is satisfied by documentation alone. Every runtime row remains NOT_RUN until the future authorized implementation executes the named evidence.

## RED to GREEN discipline

For every task:
1. make imports/types compile first when introducing a brand-new module;
2. write an assertion that exercises the missing or incorrect behavior;
3. run only the smallest owning suite and confirm the failure is behavioral;
4. do not count missing imports, missing containers, absent Docker, broken configuration, or unrelated existing failures as RED;
5. implement the minimal approved behavior;
6. rerun the owning test GREEN;
7. run immediate frozen regressions that share the boundary;
8. commit one reviewable task.

If an expected RED already passes, inspect whether the behavior already exists at the implementation base; do not sabotage code to manufacture RED. If a RED exposes a conflict with the approved design or frozen B1/B2 behavior, STOP_AND_REPORT rather than rewriting the spec during implementation.

## Git publication boundary

### Plan candidate boundary — current authorized task

Current branch:
<code>docs/pf02-b-b3-implementation-plan</code>

Allowed plan-candidate changes:
- this implementation-plan file;
- append-only <code>ops/AI_Execution_Log.csv</code>;
- append-only <code>ops/pending_external_sync.md</code> if needed.

Forbidden in the plan candidate:
- every product source/test/migration/API/Web/workflow/package/lockfile path;
- STATUS/manifest/handoff authorization promotion before independent plan review.

Publish the plan as a Draft PR from the exact branch head. Do not merge it in this task. Independent plan review must anchor to that fixed head/blob. A review finding may produce additional documentation-only commits on the same plan branch, followed by a new fixed-head review.

### Future implementation boundary

Only after:
1. independent plan review has no unresolved BLOCKER/HIGH;
2. operator accepts the reviewed plan;
3. canonical repository/operator evidence explicitly sets B3 product implementation authorized;
4. implementation preflight P1-P4 passes.

Then create <code>feat/pf02-b-b3-building-registration</code> from the exact authorized implementation base. Product commits stay on that branch. Final implementation publication is one normal push/open PR and stops unmerged at READY_FOR_ACCEPTANCE.

## Plan self-review checklist for the candidate author

Before requesting independent plan review, verify:
- every design section 1-18 has a concrete task or Global Constraint;
- AC01 through AC23 appear exactly in the traceability matrix and have executable evidence;
- every future path in Planned File Map is created/modified by a named task;
- method/type names are consistent across Task 1, adapters, HTTP, and Web;
- 0008 SQL names and policy semantics match the approved design;
- no task edits migrations 0001-0007;
- no task modifies B1ErrorCode/B1ErrorSchema/logout/session/org-transaction/organization-reader;
- no task introduces a provider, dependency, new role, real data, ORM, production hosting, or assignment mutation;
- HTTP precedence and 8 KiB actual-byte rule are explicit;
- advisory headers are never authorization;
- unknown COMMIT and B3D-L01/B3D-L02 limitations are preserved;
- F01/F43 are not promoted;
- CI remains the existing nine checks with no timeout/workflow change;
- plan-candidate Git boundary is docs/log-only and product implementation remains blocked until a later authorization.
