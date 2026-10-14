# 건물 정보 없는 건물도 접수되게 (C1 1단계) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A unit whose building has no `core_flow.building_context` row is listed, readable and usable in every Core flow (tenant intake, manager queue, maintenance history, vendor section) with the fixed name `건물` and no building facts.

**Architecture:** One new migration `0025` adds a private helper `core_flow.building_body(org, property)` that returns the stored body or a fallback, and `CREATE OR REPLACE`s the five Core functions that read building context so they use an outer join or the helper. No application, domain or UI code changes; the domain already asks instead of guessing when building facts are missing.

**Tech Stack:** PostgreSQL 18.6 SQL migrations run by node-pg-migrate (`packages/persistence-postgres/src/testing/migrate.ts`), Vitest PostgreSQL tests with testcontainers (`vitest.postgres.config.ts`), Node 24.21.0 / npm 11.19.0.

Spec: [`docs/superpowers/specs/2026-10-14-building-context-fallback-c1-design.md`](../specs/2026-10-14-building-context-fallback-c1-design.md) (operator approval 2026-10-14, D1–D3 as recommended).

## Global Constraints

- Risk tier 고위험 (DEV-01): DB functions in FROZEN RC1 Core. Follow DEV-04: failing tests first, full `test:postgres` and related `test:e2e:*`, independent review in a fresh context, `ops/` acceptance record.
- Fallback body is exactly `{"id":<property id as text>,"displayName":"건물","demo":false,"sourceNativeIds":{},"context":[]}` (D1).
- Fallback `buildingName` in lists is exactly `건물`, the same text `0014` already uses.
- No vendor address is derived from anything; a building without a stored `serviceAddress` stays blocked (`ADDRESS_REQUIRED`, mapped to `INVALID_INPUT`) (D2).
- No UI copy, application, domain, protocol, routing or safety code changes (D3, spec "범위 밖").
- Replaced functions keep name, arguments, return type, language, volatility, owner `bm_core_flow_owner`, `SECURITY DEFINER` and `SET search_path=pg_catalog`. No new grants. The helper's EXECUTE is revoked from `PUBLIC` and granted to no role.
- Never edit migrations `0001`–`0024` (DEV-08). Stage named paths only (DEV-05). Do not touch other sessions' worktrees.
- Run Node from `C:\Users\admin\AppData\Local\build-manager-b5-runtime\node-24.21.0\node-v24.21.0-win-x64` (put it first on `PATH`).
- Before a full test run, check `docker ps` for leftover containers (DEV-15); other sessions share the machine.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `tests/postgres/core-building-context-fallback.test.ts` | Create (renamed from `c1-building-context-repro.test.ts`) | Behaviour of all Core reads for a building without context, isolation, catalog |
| `tests/postgres/vendor-handoff-manager-preview.test.ts` | Modify (append one test) | Vendor section readable, publishing blocked without context |
| `tests/postgres/core-flow.test.ts:87` | Modify | Exact Core function baseline gains `building_body` (not web-executable) |
| `packages/persistence-postgres/migrations/0025_core_building_context_fallback.sql` | Create | Helper plus five replaced functions |
| `scripts/hosted-demo-provision.mjs:10` | Modify (comment) | Comment names migrations `0001-0025` |
| `research/sources/claim_registry.csv` | Append | Verification follow-up for CLM-115 (new claim row, IDs never change) |
| `ops/building_context_fallback_c1_20261014_acceptance.md` | Create | DEV-04 acceptance record |
| `ops/AI_Execution_Log.csv`, `ops/pending_external_sync.md` | Append | AGENTS.md log rows |
| `STATUS.md` | Modify | One row for C1 step 1 |

---

### Task 1: Behaviour tests for a building without context (RED)

**Files:**
- Create: `tests/postgres/core-building-context-fallback.test.ts` (by `git mv tests/postgres/c1-building-context-repro.test.ts tests/postgres/core-building-context-fallback.test.ts`, then replace the content)

**Interfaces:**
- Consumes: `createBuildingRegistrationPort` (`@build-manager/persistence-postgres/b3`), `createCoreOnboardingPort`, `createCoreFlowPort` (`createCoreFlowPort(db)` for fixture accounts, `createCoreFlowPort(db,org)` for a B1 tenant bound to an organisation), `performCoreAction`, `selectProtocol`, `CoreUnitsSchema`, `CoreManagerWorkItemsSchema`, `CoreUnitMaintenanceFactSchema`.
- Produces: nothing used by later tasks except the file itself.

- [ ] **Step 1: Rename the reproduction file and write the tests**

```bash
git mv tests/postgres/c1-building-context-repro.test.ts tests/postgres/core-building-context-fallback.test.ts
```

Replace the whole file with:

```ts
import { createHash,randomBytes,randomUUID } from "node:crypto";
import { afterAll,beforeAll,expect,it } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createBuildingRegistrationPort } from "@build-manager/persistence-postgres/b3";
import { createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { createCoreOnboardingPort } from "@build-manager/persistence-postgres/core-onboarding";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { performCoreAction,type CoreAction,type CoreScope,type OnboardingAction,type OnboardingResult } from "@build-manager/application";
import { CoreManagerWorkItemsSchema,CoreUnitMaintenanceFactSchema,CoreUnitsSchema } from "@build-manager/api-contracts";
import { selectProtocol,type Building } from "@build-manager/domain";
import { createB1Fixture } from "./helpers/b1-fixture";

// C1 step 1 (docs/superpowers/specs/2026-10-14-building-context-fallback-c1-design.md): a building registered through B3 has
// no core_flow.building_context row. Its units must still work in every Core read, with the fixed name 건물 and no facts.
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>;
const token=()=>createHash("sha256").update(randomBytes(32)).digest("hex");
beforeAll(async()=>{f=await createB1Fixture();await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);},120_000);
afterAll(async()=>{await db?.close();await f?.close();});
type View={invitationId:string;requestNumber:string|null;state:string};
function value(r:OnboardingResult):View {expect(r).toHaveProperty("data");return (r as {data:View}).data;}
async function actor(){const digest=token();await f.login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '1 hour') id",["https://c1.synthetic.invalid/",randomUUID(),Buffer.from(digest,"hex")]);return {digest};}
const onboard=(action:OnboardingAction,input:Record<string,unknown>,digest=data.accounts.manager.digest,org:string|null=data.orgA)=>createCoreOnboardingPort(db).execute(digest,action,org,input);
const now={now:()=>new Date().toISOString()},ids={next:()=>randomUUID()};
const fixtureRun=<T>(who:string,op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db).run(data.accounts[who].digest,op);
const fixtureAct=(who:string,a:CoreAction)=>fixtureRun(who,s=>performCoreAction(s,a,now,ids));
const contextRows=async(property:string)=>(await f.p.admin.query("SELECT count(*)::int n FROM core_flow.building_context WHERE property_id=$1",[property])).rows[0].n as number;

/** Registers a building and unit as /workspace does, then invites and approves a new tenant for that unit. */
async function registeredAndConnected(label:string){
 const registration=createBuildingRegistrationPort(db),manager=data.accounts.manager.digest;
 const property=await registration.createProperty(manager,data.orgA,{addressReference:`합성 C1 건물 ${label}`});
 const unit=await registration.createUnit(manager,data.orgA,property.id,{label:`합성 C1 ${label}`});
 const tokenDigest=token(),tenant=await actor();
 expect(value(await onboard("CREATE",{unitId:unit.id,tokenDigest})).state).toBe("OPEN");
 const claim=value(await onboard("CLAIM",{tokenDigest},tenant.digest,null));
 expect(value(await onboard("APPROVE",{invitationId:claim.invitationId,requestNumber:claim.requestNumber})).state).toBe("APPROVED");
 const run=<T>(op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db,data.orgA).run(tenant.digest,op);
 return {property,unit,tenant,run,act:(a:CoreAction)=>run(s=>performCoreAction(s,a,now,ids))};
}

it("lists the unit and returns the fallback building with no facts",async()=>{
 const c=await registeredAndConnected("A");
 expect(await contextRows(c.property.id)).toBe(0);
 const units=CoreUnitsSchema.parse(await c.run(s=>s.units()));
 expect(units).toContainEqual({id:c.unit.id,buildingId:c.property.id,label:"합성 C1 A",buildingName:"건물"});
 const building=await c.run(s=>s.building(c.unit.id)) as Building;
 expect(building).toEqual({id:c.property.id,displayName:"건물",demo:false,sourceNativeIds:{},context:[]});
 expect(selectProtocol(building,"HEATING").id).toBe("HEATING_UNKNOWN_V1");
},60_000);

it("lets the tenant create heating and leak requests that ask instead of guessing",async()=>{
 const c=await registeredAndConnected("B");
 const heating=await c.act({type:"CREATE",unitId:c.unit.id,issueType:"HEATING",rawUserText:"합성 C1 난방 접수"});
 expect(heating.ticket.protocolId).toBe("HEATING_UNKNOWN_V1");
 expect(heating.building).toEqual({id:c.property.id,displayName:"건물",demo:false,sourceNativeIds:{},context:[]});
 const leak=await c.act({type:"CREATE",unitId:c.unit.id,issueType:"LEAK",rawUserText:"합성 C1 누수 접수"});
 expect(leak.ticket.protocolId).toBe("LEAK_V1");
 expect((await c.run(s=>s.read(heating.ticket.id))).building.displayName).toBe("건물");
},60_000);

it("keeps the manager queue, the work read and the maintenance history whole",async()=>{
 const c=await registeredAndConnected("C");
 const t=await c.act({type:"CREATE",unitId:c.unit.id,issueType:"LEAK",rawUserText:"합성 C1 관리자 확인"});
 const queue=CoreManagerWorkItemsSchema.parse(await fixtureRun("manager",s=>s.manager.list()));
 expect(queue.find(x=>x.ticketId===t.ticket.id)).toMatchObject({unitId:c.unit.id,buildingId:c.property.id,buildingName:"건물",unitLabel:"합성 C1 C"});
 expect(await fixtureRun("manager",s=>s.manager.read(t.ticket.id))).toMatchObject({ticketId:t.ticket.id,buildingName:"건물"});
 await fixtureAct("manager",{type:"HANDLING",ticketId:t.ticket.id,status:"IN_PROGRESS",message:"합성 처리 시작"});
 const p=await fixtureRun("manager",s=>s.communication.read(t.ticket.id));
 await fixtureAct("manager",{type:"HANDLING",ticketId:t.ticket.id,status:"COMPLETED",message:"합성 완료 기록",expectedCommunicationVersion:p.version});
 const saved=await fixtureRun("manager",s=>s.maintenance.create(t.ticket.id,{clientRequestId:randomUUID(),actionKind:"REPAIR",componentLabel:"합성 배관"}));
 expect(CoreUnitMaintenanceFactSchema.parse(saved.fact)).toMatchObject({unitId:c.unit.id,buildingName:"건물"});
 const history=await fixtureRun("manager",s=>s.maintenance.listUnit(c.unit.id));
 expect(history.map(x=>CoreUnitMaintenanceFactSchema.parse(x).factId)).toEqual([saved.fact.factId]);
},90_000);

it("shows the new unit to nobody outside its tenant and the organisation's managers",async()=>{
 const c=await registeredAndConnected("D");
 for(const who of ["tenantOther","otherTenant","staff"]){
  const units=await fixtureRun(who,s=>s.units());
  expect(units.map(x=>x.id)).not.toContain(c.unit.id);
  await expect(fixtureRun(who,s=>s.building(c.unit.id))).rejects.toMatchObject({code:"NOT_FOUND"});
 }
},60_000);

it("uses a stored building context row instead of the fallback",async()=>{
 const c=await registeredAndConnected("E");
 await f.p.admin.query("INSERT INTO core_flow.building_context(org_id,property_id,body) SELECT $1::uuid,$2::uuid,body||jsonb_build_object('id',($2::uuid)::text,'displayName','합성 C1 대조 건물') FROM core_flow.building_context WHERE org_id=$1 AND property_id=$3",[data.orgA,c.property.id,data.propertyA]);
 expect(await contextRows(c.property.id)).toBe(1);
 expect((await c.run(s=>s.units())).find(x=>x.id===c.unit.id)?.buildingName).toBe("합성 C1 대조 건물");
 const building=await c.run(s=>s.building(c.unit.id)) as Building;
 expect(building.displayName).toBe("합성 C1 대조 건물");
 expect(building.context.length).toBeGreaterThan(0);
},60_000);

it("adds only a private owner-only helper and keeps the replaced functions' owner, definer and search path",async()=>{
 const names=["building","building_body","maintenance_fact_json","manager_work_json","units","vendor_handoff_source"];
 const funcs=(await f.p.admin.query("SELECT proname,prosecdef,proconfig,pg_get_userbyid(proowner) owner,has_function_privilege('bm_b1_web',oid,'EXECUTE') web,has_function_privilege('bm_vendor_handoff_owner',oid,'EXECUTE') vendor FROM pg_proc WHERE pronamespace='core_flow'::regnamespace AND proname=ANY($1) ORDER BY proname",[names])).rows;
 expect(funcs).toEqual(names.map(proname=>({proname,prosecdef:true,proconfig:["search_path=pg_catalog"],owner:"bm_core_flow_owner",
  web:proname==="building"||proname==="units",vendor:proname==="vendor_handoff_source"})));
 const helperAcl=(await f.p.admin.query("SELECT array_agg(pg_get_userbyid(a.grantee)::text ORDER BY pg_get_userbyid(a.grantee)) executors FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.pronamespace='core_flow'::regnamespace AND p.proname='building_body' AND a.privilege_type='EXECUTE'")).rows[0].executors;
 expect(helperAcl).toEqual(["bm_core_flow_owner"]);
});
```

- [ ] **Step 2: Run the file and check each test fails for the right reason**

Run (from the worktree root, pinned Node on `PATH`):

```bash
npx vitest run --config vitest.postgres.config.ts tests/postgres/core-building-context-fallback.test.ts
```

Expected before the migration (write the real output into the acceptance record):
- `lists the unit…`: FAIL. `units` has no entry for the new unit (the first expectation that fails is `toContainEqual`).
- `lets the tenant create…`: FAIL with `NOT_FOUND` from `core_flow.building` during `CREATE`.
- `keeps the manager queue…`: FAIL with `NOT_FOUND` at the tenant's `CREATE`.
- `shows the new unit to nobody…`: PASS. It is a guard that must stay green after the migration.
- `uses a stored building context row…`: PASS. It is the positive control from the reproduction.
- `adds only a private owner-only helper…`: FAIL because `building_body` is missing. This is a structural RED, not behaviour evidence (R06); the behaviour REDs are the first three.

If any of the first three fails for another reason (fixture, import, timeout), fix the test before going on.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/postgres/core-building-context-fallback.test.ts
git commit -m "test(db): pin Core reads for a building without context (fails until 0025)"
```

The commit body names the risk tier `고위험` and the RED results from Step 2 (DEV-02 allows a failing-test commit in TDD; the branch is not pushed until Task 3 passes).

---

### Task 2: Vendor section and Core baseline expectations (RED)

**Files:**
- Modify: `tests/postgres/vendor-handoff-manager-preview.test.ts` (append one test at the end)
- Modify: `tests/postgres/core-flow.test.ts:87`

**Interfaces:**
- Consumes: `createVendorHandoffFixture()` → `f.prepared()`, `f.manager.readHandoff(digest,ticketId)`, `f.manager.publishPacket(digest,assignmentId,input)`, `f.data.orgA`, `f.data.propertyA`; `ManagerVendorHandoffDtoSchema`.
- Produces: nothing used later.

- [ ] **Step 1: Append the vendor test**

At the end of `tests/postgres/vendor-handoff-manager-preview.test.ts` add (the file already imports `randomUUID`, `ManagerVendorHandoffDtoSchema` and the fixture):

```ts
it("keeps the vendor section readable for a building without context and blocks publishing without an address",async()=>{
  // C1 step 1 (docs/superpowers/specs/2026-10-14-building-context-fallback-c1-design.md, D2): no address is derived.
  const {t,handoff}=await f.prepared();
  const saved=(await f.p.admin.query("DELETE FROM core_flow.building_context WHERE org_id=$1 AND property_id=$2 RETURNING body",[f.data.orgA,f.data.propertyA])).rows[0].body;
  try{
    const h=await f.manager.readHandoff(f.data.accounts.manager.digest,t.ticket.id);
    expect(ManagerVendorHandoffDtoSchema.safeParse(h).success).toBe(true);
    expect((h as unknown as {packetSource:{buildingName:string;serviceAddress:string|null;sharedDetails:{sourceType:string}[]}}).packetSource)
      .toMatchObject({buildingName:"건물",serviceAddress:null});
    expect((h as unknown as {packetSource:{sharedDetails:{sourceType:string}[]}}).packetSource.sharedDetails.some(d=>d.sourceType==="BUILDING_VERIFIED")).toBe(false);
    await expect(f.manager.publishPacket(f.data.accounts.manager.digest,handoff.assignment!.id,{clientRequestId:randomUUID(),
      expectedAssignmentVersion:handoff.assignment!.version,expectedPacketRevisionId:null,workSummary:"합성 점검",sharedDetailKeys:[],allowedPhotoIds:[],
      accessPolicy:"TENANT_PRESENT_REQUIRED",accessInstruction:null})).rejects.toMatchObject({code:"INVALID_INPUT"});
  }finally{
    await f.p.admin.query("INSERT INTO core_flow.building_context(org_id,property_id,body) VALUES($1,$2,$3)",[f.data.orgA,f.data.propertyA,saved]);
  }
});
```

- [ ] **Step 2: Add `building_body` to the exact Core function baseline**

In `tests/postgres/core-flow.test.ts:87`, change the start of the expected name list from

```ts
expect(baselineFuncs).toEqual(["access_organizations","append_internal_note","bind_organization","building","can_unit",
```

to

```ts
expect(baselineFuncs).toEqual(["access_organizations","append_internal_note","bind_organization","building","building_body","can_unit",
```

and in the same line change the not-web list from

```ts
web:!["can_unit","maintenance_current_fact",
```

to

```ts
web:!["building_body","can_unit","maintenance_current_fact",
```

This is an intended catalog change (a new private helper), not a fixture correction; say so in the PR.

- [ ] **Step 3: Run both files and check the failures**

```bash
npx vitest run --config vitest.postgres.config.ts tests/postgres/vendor-handoff-manager-preview.test.ts tests/postgres/core-flow.test.ts
```

Expected: the new vendor test FAILS. Either `readHandoff` throws or `safeParse(h).success` is `false`, because `packetSource.buildingName` is `null`. The catalog test in `core-flow.test.ts` FAILS because `building_body` is missing. Every other test in the two files passes.

- [ ] **Step 4: Commit**

```bash
git add tests/postgres/vendor-handoff-manager-preview.test.ts tests/postgres/core-flow.test.ts
git commit -m "test(db): expect the vendor section and the Core baseline for the building fallback"
```

---

### Task 3: Migration 0025 (GREEN)

**Files:**
- Create: `packages/persistence-postgres/migrations/0025_core_building_context_fallback.sql`
- Modify: `scripts/hosted-demo-provision.mjs:10` (comment only)

**Interfaces:**
- Produces: `core_flow.building_body(p_org uuid,p_property uuid) RETURNS jsonb`, private to `bm_core_flow_owner`.

- [ ] **Step 1: Write the migration**

Create `packages/persistence-postgres/migrations/0025_core_building_context_fallback.sql`:

```sql
-- C1 step 1 (docs/superpowers/specs/2026-10-14-building-context-fallback-c1-design.md): a property registered through B3 has no
-- core_flow.building_context row, so the five Core functions below dropped its units (inner joins) or failed (NOT_FOUND, null
-- list entries, a null vendor building name). building_body returns the stored body, or a fallback named 건물 with no
-- context facts: protocol selection then asks, and route recommendation never guesses. The replaced functions keep their
-- signatures, owner, SECURITY DEFINER, search_path and grants; only the building read changes. No address is derived.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;

CREATE FUNCTION core_flow.building_body(p_org uuid,p_property uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(
  (SELECT c.body FROM core_flow.building_context c WHERE c.org_id=p_org AND c.property_id=p_property),
  jsonb_build_object('id',p_property::text,'displayName','건물','demo',false,'sourceNativeIds','{}'::jsonb,'context','[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION core_flow.building_body(uuid,uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION core_flow.units(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; result jsonb;
BEGIN
 s:=core_flow.session(p_digest);
 SELECT coalesce(jsonb_agg(x ORDER BY x->>'buildingName',x->>'label'),'[]'::jsonb) INTO result FROM (
 SELECT jsonb_build_object('id',u.id,'buildingId',u.property_id,'label',u.label,
 'buildingName',coalesce(c.body->>'displayName','건물')) AS x FROM app.unit u LEFT JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id
 WHERE u.org_id=(s->>'orgId')::uuid AND core_flow.can_unit(p_digest,u.id) ORDER BY u.id LIMIT 200) q;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION core_flow.building(p_digest bytea,p_unit uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF NOT core_flow.can_unit(p_digest,p_unit) THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 SELECT core_flow.building_body(u.org_id,u.property_id) INTO result FROM app.unit u
 WHERE u.org_id=app.current_org_id() AND u.id=p_unit;
 IF result IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION core_flow.manager_work_json(t core_flow.ticket) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('ticketId',t.id,'unitId',t.unit_id,'buildingId',t.property_id,
 'buildingName',coalesce(c.body->>'displayName','건물'),'unitLabel',u.label,'issueType',t.body->>'issueType',
 'workStatus',t.work_status,'priority',coalesce(w.priority,'NORMAL'),'assigneeLabel',w.assignee_label,
 'dueAt',w.due_at,'createdAt',t.created_at,'updatedAt',coalesce(w.updated_at,t.updated_at),'version',coalesce(w.version,1))
 FROM app.unit u LEFT JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id
 LEFT JOIN core_flow.ticket_work w ON w.org_id=t.org_id AND w.ticket_id=t.id
 WHERE u.org_id=t.org_id AND u.id=t.unit_id AND t.org_id=app.current_org_id()
$$;

CREATE OR REPLACE FUNCTION core_flow.maintenance_fact_json(f core_flow.unit_maintenance_fact) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 WITH RECURSIVE ancestors AS (
  SELECT f.id,f.replaces_fact_id,0 AS depth
  UNION ALL SELECT p.id,p.replaces_fact_id,a.depth+1 FROM core_flow.unit_maintenance_fact p JOIN ancestors a ON p.id=a.replaces_fact_id
 )
 SELECT jsonb_build_object('factId',f.id,'unitId',f.unit_id,'buildingId',u.property_id,'buildingName',coalesce(c.body->>'displayName','건물'),'unitLabel',u.label,
 'sourceTicketId',f.source_ticket_id,'issueType',f.issue_type,'actionKind',f.action_kind,'componentLabel',f.component_label,
 'sourceCompletedAt',f.source_completed_at,'recordedAt',f.recorded_at,'corrected',f.replaces_fact_id IS NOT NULL,'correctionCount',(SELECT max(depth) FROM ancestors),
 'tenantOutcome',coalesce((SELECT kind FROM core_flow.ticket_outcome_assertion WHERE org_id=f.org_id AND ticket_id=f.source_ticket_id ORDER BY created_at DESC,id DESC LIMIT 1),'UNCONFIRMED'),
 'previousTicketId',(SELECT source_ticket_id FROM core_flow.ticket_follow_up WHERE org_id=f.org_id AND target_ticket_id=f.source_ticket_id),
 'followUpTicketId',(SELECT target_ticket_id FROM core_flow.ticket_follow_up WHERE org_id=f.org_id AND source_ticket_id=f.source_ticket_id))
 FROM app.unit u LEFT JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id
 WHERE u.org_id=f.org_id AND u.id=f.unit_id AND f.org_id=app.current_org_id()
$$;

CREATE OR REPLACE FUNCTION core_flow.vendor_handoff_source(p_digest bytea,p_ticket text,p_photo_ids uuid[],p_lock boolean) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb;actor jsonb;t core_flow.ticket;b jsonb;photos jsonb;unit_label text;
BEGIN
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  actor:=core_flow.session(p_digest);
  IF p_lock THEN PERFORM core_flow.vendor_handoff_lock_ticket((c->>'orgId')::uuid,p_ticket); END IF;
  c:=core_flow.vendor_handoff_manager_context(p_digest,p_ticket);
  SELECT * INTO t FROM core_flow.ticket WHERE org_id=(c->>'orgId')::uuid AND id=p_ticket;
  b:=core_flow.building_body(t.org_id,t.property_id);
  SELECT label INTO unit_label FROM app.unit WHERE org_id=t.org_id AND id=t.unit_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('photoId',p.id,'mime',p.mime,'byteSize',octet_length(p.content),'width',p.width,'height',p.height)
    ORDER BY p.id),'[]'::jsonb) INTO photos
    FROM core_flow.ticket_photo p WHERE p.org_id=t.org_id AND p.ticket_id=t.id AND (p_photo_ids IS NULL OR p.id=ANY(p_photo_ids));
  RETURN jsonb_build_object('actorId',actor->>'actorId','orgId',t.org_id,'ticketId',t.id,'propertyId',t.property_id,'unitId',t.unit_id,'unitLabel',unit_label,
    'ticketVersion',t.version,'workStatus',t.work_status,'ticket',t.body,'building',b,'photos',photos);
END $$;

RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;
```

The five bodies are copied from `0011` 94–115, `0015` 48–57, `0018` 53–67 and `0019` 259–276. Diff each one against its source before going on. The only differences allowed are the `JOIN`/`LEFT JOIN`, the `coalesce(…,'건물')` and the `building_body` call.

- [ ] **Step 2: Update the provision script comment**

In `scripts/hosted-demo-provision.mjs:10` change `applies migrations 0001-0024` to `applies migrations 0001-0025`. Comment only; the script itself does not change.

- [ ] **Step 3: Run the three test files**

```bash
npx vitest run --config vitest.postgres.config.ts tests/postgres/core-building-context-fallback.test.ts tests/postgres/vendor-handoff-manager-preview.test.ts tests/postgres/core-flow.test.ts
```

Expected: every test passes.

- [ ] **Step 4: Commit**

```bash
git add packages/persistence-postgres/migrations/0025_core_building_context_fallback.sql scripts/hosted-demo-provision.mjs
git commit -m "fix(db): keep units without building context in every Core read"
```

---

### Task 4: Full checks, records, PR and review

**Files:**
- Append: `research/sources/claim_registry.csv` (new row `CLM-133`: CLM-115 was reproduced on 2026-10-14 and fixed by 0025; source `SRC-143` plus the reproduction run; IDs never change, RES-04)
- Create: `ops/building_context_fallback_c1_20261014_acceptance.md`
- Append: `ops/AI_Execution_Log.csv`, `ops/pending_external_sync.md` (one row each; byte-level append, never re-quote old rows)
- Modify: `STATUS.md` (one row: C1 step 1 on main, not on the demo)

- [ ] **Step 1: Run every required check (DEV-04, DEV-06) and keep the outputs**

```bash
docker ps
npm run test:postgres
npm run test:e2e:core
npm run test:e2e:b1
npm run test:e2e:vendor
npm run test:shared
npm run test:web
npm run lint
npm run typecheck
npm run build:web
npm run check:deps
python scripts/verify_repository.py --history
```

Expected: all pass. Check results by exit code, not by `| tail` (DEV-06). A flaky test gets one rerun, recorded in the PR. Run e2e and Vitest one after another, not together (DEV-15).

- [ ] **Step 2: Write the records**

- Acceptance record: tiers and decisions (spec link, operator approval 2026-10-14), the RED outputs from Tasks 1–2, the GREEN outputs and every check from Step 1, the rollback plan from the spec, and retained risks (D1 ambiguity, D2 vendor block, step 2 not yet specified).
- `CLM-133` row in the claim registry. Leave CLM-115's row unchanged.
- STATUS row, execution-log row and pending-sync row.
- Run `python scripts/verify_repository.py` again with these files staged.

- [ ] **Step 3: Open the PR**

The first body line is `Risk tier: 고위험`. The body states the purpose, the spec link, the checks run with their results, the intended change at `core-flow.test.ts:87`, the remaining risks, and that the demo deploy will be asked separately. End with the Claude Code line.

- [ ] **Step 4: Independent review in a fresh context**

Run the `code-review` skill (or a fresh review agent) on the PR at high effort. Fix every correctness finding, then do a delta check on what changed. Write the review result into the acceptance record.

- [ ] **Step 5: Merge after CI passes on the exact head**

```bash
gh pr merge <PR> --merge --match-head-commit <HEAD_SHA>
```

Ask the operator before any demo deploy (DEV-04 IMPORTANT, DEV-12).

---

### Task 5 (amendment): Manager responses for an unverified building

Added on 2026-10-14 after the independent review of #147 found that the landlord passport schema turns every manager ticket response into a 503 once a fallback building has a request. Spec section "보완: 관리자 응답의 건물 칸"; the operator chose "이 PR에 같이 고치기 (추천)".

**Files:**
- Modify: `packages/api-contracts/src/building.ts` (new `UnverifiedBuildingDtoSchema`), `packages/api-contracts/src/ticket.ts` (`LandlordTicketDetailDtoSchema.building` becomes passport or unverified), `apps/web/src/server/http/presenters.ts` (`presentLandlordBuilding`)
- Tests: `packages/api-contracts/src/contracts.test.ts`, `apps/web/src/server/http/presenters.test.ts`, `tests/postgres/core-building-context-fallback.test.ts` (manager list, detail and handling through `handleCoreFlow`)

- [x] **Step 1:** Write the three tests and see them fail: the contract rejects the unverified building, the presenter throws a `ZodError`, and the HTTP list answers 503.
- [x] **Step 2:** Add the schema and the presenter branch (only for a non-demo building with empty context), and see the tests pass.
- [x] **Step 3:** Run every check in Task 4 Step 1 again, plus `npm run test:mobile` (the mobile app reads the same contract).
- [x] **Step 4:** Update the acceptance record, research rows and PR body, then run a delta review in a fresh context on the change since `c15a19b`.

---

## Self-Review

- Spec coverage
  - Goal items 1–5 → Task 1 (units, building, intake, manager, maintenance) and Task 2 (vendor).
  - Threats: T1/T2 → Task 1 isolation test. T3 → Task 1 fallback and protocol assertions. T4 → Task 2. T5/T6 → Task 1 catalog test and `core-flow.test.ts` baseline. T7 → Task 1 manager and history tests.
  - Rollback → acceptance record (Task 4). Tests 8 (regression) and 9 (control) → full `test:postgres` and the control test in Task 1.
- Placeholders: none. `<PR>` and `<HEAD_SHA>` are filled in at run time.
- Names: `building_body(uuid,uuid)` is the same in the migration, the catalog test and the baseline list. Fallback fields are the same in the spec, migration and tests.
