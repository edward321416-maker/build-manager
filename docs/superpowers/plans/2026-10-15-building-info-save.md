# 건물 정보 저장과 응답 (P6 + C1 2단계 PR 1) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- 작성 시점: 설계 승인 뒤, 구현 전에 썼다(DEV-04 2단계).

**Goal:** 조직 관리자가 건물 이름·업체용 주소·난방 방식·관리 방식을 저장하고 읽을 수 있게 하고, 그 사실이 세입자 질문·업체 전달·관리자 응답에 쓰이게 한다. 공개 체험 세션은 쓰지 못한다.

**Architecture:** 관리자 응답의 "데모가 아닌 건물" 형식을 먼저 넓힌다. 새 마이그레이션 `0028`이 `core_flow`에 조직 관리자 전용 읽기·저장 함수를 더하고, 저장은 `core_flow.building_context.body`에 기존 건물 모양(`displayName`, `demo:false`, `context` 사실, `serviceAddress`)과 `version`을 쓴다. Core HTTP(`/api/v2/core/buildings`)가 이 함수를 부르고, 체험 세션의 쓰기는 웹 쪽에서 막는다(Core 저장과 B3 만들기).

**Tech Stack:** PostgreSQL 18(plpgsql, `SECURITY DEFINER`), TypeScript strict, zod 4, Next.js 16 route, vitest(`vitest.shared.config.ts`, `test:postgres`는 Testcontainers).

## Global Constraints

- 설계: `docs/superpowers/specs/2026-10-15-building-setup-p6-design.md`(운영자 2026-10-15 "승인 (추천)")
- 위험 등급: 고위험. 실패 시험부터, 새 문맥 독립 리뷰, `ops/` 수락 기록
- 마이그레이션은 추가만(`0028_core_building_info.sql`). 함수는 `bm_core_flow_owner` 소유, `SECURITY DEFINER`, `SET search_path=pg_catalog`, `PUBLIC` 실행 권한 없음, 웹 역할 `bm_b1_web`에는 공개 함수 셋만 실행 권한
- 오류는 기존 Core 규칙을 따른다: `42501`→403 `FORBIDDEN`, `P0002`→404 `NOT_FOUND`, `22023`→400 `INVALID_INPUT`, `P0001`→409 `STATE_CONFLICT`. Core HTTP는 GET·POST만 받으므로 저장은 `POST /api/v2/core/buildings/{id}`다(설계의 PUT과 새 오류 이름은 이 관례로 바꾼다. 설계 문서도 같이 고친다).
- 입력 범위: 이름 1–50자, 주소 1–200자 또는 `null`, 둘 다 앞뒤 공백 없음·제어 문자 없음. 난방 `INDIVIDUAL`|`CENTRAL_SHARED`|`null`, 관리 `OWNER_DIRECT`|`MANAGEMENT_OFFICE`|`null`, `expectedVersion` 0 이상 정수
- 사실 모양: `{"key","value","sourceType":"OWNER_VERIFIED","sourceRef":"org_admin","verified":true,"routingEligible":true,"fetchedAt":null,"updatedAt"}`
- 체험용 건물(`body.demo = true`)은 저장 거절(403). 체험 세션(세션 사용자가 `demoEntrySubjects`의 값)은 저장·B3 만들기 403
- 시험 데이터는 합성만. 한국어 정렬 순서를 시험에 하드코딩하지 않는다(정렬은 `core_flow.unit_name_order`)
- 화면은 이 PR에 없다(PR 2)

## 파일

| 파일 | 할 일 |
| --- | --- |
| `packages/api-contracts/src/building.ts` | `UnverifiedBuildingDtoSchema` → `OrgBuildingDtoSchema`(데모가 아닌 건물, 확인된 두 칸 선택) |
| `packages/api-contracts/src/ticket.ts` | 관리자 상세의 건물 union이 새 형식을 씀 |
| `packages/api-contracts/src/contracts.test.ts` | 넓힌 형식 시험 |
| `apps/web/src/server/http/presenters.ts`, `.test.ts` | `presentLandlordBuilding`이 데모가 아니면 새 형식 |
| `packages/persistence-postgres/migrations/0028_core_building_info.sql` | 새 함수 |
| `packages/application/src/core-flow.ts` | `CoreBuildingScope` 타입, `CoreScope.buildings` |
| `packages/persistence-postgres/src/core-flow.ts` | `buildings` 범위를 함수에 연결 |
| `packages/api-contracts/src/core-building.ts`(새), `index.ts` | 요청·응답 계약 |
| `apps/web/src/server/b1/demo-entry-config.ts`(+시험) | `isDemoEntrySession` |
| `apps/web/src/server/core-flow/b1-access.ts`(+시험) | 현재 세션에 `demo` 표시 |
| `apps/web/src/server/core-flow/http.ts` | `buildings` 경로 |
| `apps/web/src/server/b3/http.ts`(+시험) | 체험 세션의 만들기 403, 만들기 가능 머리글 `false` |
| `tests/postgres/core-building-info.test.ts`(새) | 함수·권한·버전·사실·HTTP |

### Task 1: 관리자 응답의 건물 형식 넓히기

**Files:**
- Modify: `packages/api-contracts/src/building.ts:37-50`, `packages/api-contracts/src/ticket.ts:2,78`
- Modify: `apps/web/src/server/http/presenters.ts:103-121`
- Test: `packages/api-contracts/src/contracts.test.ts:306-327`, `apps/web/src/server/http/presenters.test.ts:37-56`

**Interfaces:**
- Produces: `OrgBuildingDtoSchema`, `type OrgBuildingDto`(`buildingId`, `displayName`, `demo:false`, `managementMode?`, `heatingType?`, `contextVerified`, `routingEligibleFields`)

- [ ] **Step 1: 실패 시험 쓰기 (계약)** — `contracts.test.ts`의 C1 시험을 바꾼다. 의도: 데모가 아닌 건물이 확인된 칸을 0·1·2개 가질 수 있고, 다른 사실·데모 표시·거짓 확인은 막는다(기존 "사실 0개만" 기대를 설계 결정 D2에 맞게 고침, 구현 변경).

```ts
  it("accepts a non-demo building with zero, one or two verified fields, and nothing that misstates them", () => {
    // P6 + C1 step 2 (docs/superpowers/specs/2026-10-15-building-setup-p6-design.md): org-admin facts on a non-demo building.
    const detailSchema = schema("LandlordTicketDetailDtoSchema");
    const none = { buildingId: "11111111-1111-4111-8111-111111111111", displayName: "건물", demo: false, contextVerified: false, routingEligibleFields: [] };
    const one = { ...none, displayName: "합성 햇살빌라", heatingType: "INDIVIDUAL", routingEligibleFields: ["heatingType"] };
    const both = { ...one, managementMode: "OWNER_DIRECT", contextVerified: true, routingEligibleFields: ["managementMode", "heatingType"] };
    for (const building of [none, one, both]) expect(detailSchema.safeParse({ ...landlordDetail, building }).success).toBe(true);
    for (const building of [
      { ...none, primaryUse: "MULTI_FAMILY_HOUSE" },
      { ...none, demo: true },
      { ...none, contextVerified: true },
      { ...none, routingEligibleFields: ["heatingType"] },
      { ...one, routingEligibleFields: [] },
      { ...one, contextVerified: true },
      { ...both, contextVerified: false },
      { ...both, routingEligibleFields: ["heatingType", "managementMode"] },
      { ...one, heatingType: "DISTRICT" },
    ]) expect(detailSchema.safeParse({ ...landlordDetail, building }).success).toBe(false);
    expect(schema("BuildingPassportDtoSchema").safeParse(none).success).toBe(false);
  });
```

- [ ] **Step 2: 실패 시험 쓰기 (발표)** — `presenters.test.ts`의 "C1 building without context" 묶음에서 두 번째 시험을 바꾼다.

```ts
  it("shows the manager the verified facts of a non-demo building and still a full passport for a demo one", () => {
    const ticket = { ...leakTicket(["CEILING_WALL"]), buildingId: fallback.id };
    const fact = (key: string, value: string, verified = true) => ({ key, value, sourceType: "OWNER_VERIFIED" as const, sourceRef: "org_admin", verified, routingEligible: verified, fetchedAt: null, updatedAt: "2026-10-15T00:00:00.000Z" });
    expect(presentLandlordTicket(ticket, { ...fallback, displayName: "합성 햇살빌라", context: [fact("heatingType", "INDIVIDUAL")] }).building).toEqual({
      buildingId: fallback.id, displayName: "합성 햇살빌라", demo: false, heatingType: "INDIVIDUAL", contextVerified: false, routingEligibleFields: ["heatingType"],
    });
    expect(presentLandlordTicket(ticket, { ...fallback, context: [fact("heatingType", "INDIVIDUAL"), fact("managementMode", "MANAGEMENT_OFFICE")] }).building).toEqual({
      buildingId: fallback.id, displayName: "건물", demo: false, managementMode: "MANAGEMENT_OFFICE", heatingType: "INDIVIDUAL", contextVerified: true, routingEligibleFields: ["managementMode", "heatingType"],
    });
    expect(presentLandlordTicket(ticket, { ...fallback, context: [fact("heatingType", "INDIVIDUAL", false)] }).building).toMatchObject({ contextVerified: false, routingEligibleFields: [] });
    expect(() => presentLandlordTicket(ticket, { ...fallback, demo: true })).toThrow();
  });
```

- [ ] **Step 3: 실패 확인** — Run: `npx vitest run --config vitest.shared.config.ts packages/api-contracts/src/contracts.test.ts apps/web/src/server/http/presenters.test.ts` → 새 두 시험 FAIL(계약은 `one`·`both`를 거절, 발표는 사실 있는 비데모 건물에서 throw)

- [ ] **Step 4: 계약 구현** — `building.ts`의 `UnverifiedBuildingDtoSchema`와 타입을 아래로 바꾼다.

```ts
const OrgVerifiedFieldSchema = z.enum(["managementMode", "heatingType"]);

/**
 * A non-demo building (registered on /workspace or the Core setup screen). It carries only the facts an
 * organisation admin verified (P6 + C1 step 2); with none it is the C1 step 1 unverified building.
 */
export const OrgBuildingDtoSchema = z
  .object({
    buildingId: z.string().trim().min(1),
    displayName: z.string().trim().min(1),
    demo: z.literal(false),
    managementMode: ManagementModeSchema.optional(),
    heatingType: HeatingTypeSchema.optional(),
    contextVerified: z.boolean(),
    routingEligibleFields: z.array(OrgVerifiedFieldSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const present = OrgVerifiedFieldSchema.options.filter((key) => value[key] !== undefined);
    if (value.routingEligibleFields.join() !== present.join()) context.addIssue({ code: "custom", message: "routingEligibleFields" });
    if (value.contextVerified !== (present.length === OrgVerifiedFieldSchema.options.length)) context.addIssue({ code: "custom", message: "contextVerified" });
  });
export type OrgBuildingDto = z.infer<typeof OrgBuildingDtoSchema>;
```

`ticket.ts`: import를 `OrgBuildingDtoSchema`로 바꾸고 78행을 `building: z.union([BuildingPassportDtoSchema, OrgBuildingDtoSchema]),`로.

- [ ] **Step 5: 발표 구현** — `presenters.ts`의 import에서 `UnverifiedBuildingDto`를 `OrgBuildingDto`, `OrgBuildingDtoSchema`로 바꾸고 함수를 바꾼다.

```ts
/**
 * A demo building keeps its full passport. Any other building shows only the facts an organisation admin
 * verified (0 to 2 fields, P6 + C1 step 2); unexpected values still fail the parse.
 */
function presentLandlordBuilding(building: Building): BuildingPassportDto | OrgBuildingDto {
  if (building.demo) return presentBuildingPassport(building);
  const eligible = routingEligibleContextKeys(building);
  const fields = (["managementMode", "heatingType"] as const).filter((key) => eligible.includes(key));
  const verified = Object.fromEntries(fields.map((key) => [key, getBuildingContext(building, key)?.value]));
  return OrgBuildingDtoSchema.parse({
    buildingId: building.id, displayName: building.displayName, demo: false, ...verified,
    contextVerified: fields.length === 2, routingEligibleFields: fields,
  });
}
```

- [ ] **Step 6: 통과 확인** — 같은 명령 → PASS. `grep -rn "UnverifiedBuildingDto" packages apps --include=*.ts`가 아무것도 찾지 않아야 한다.

- [ ] **Step 7: 커밋** — `git add packages/api-contracts/src/building.ts packages/api-contracts/src/ticket.ts packages/api-contracts/src/contracts.test.ts apps/web/src/server/http/presenters.ts apps/web/src/server/http/presenters.test.ts` → `feat(web): show the manager the verified facts of a non-demo building`(본문에 등급, 첫 실패 결과)

### Task 2: 마이그레이션 0028과 Core 범위

**Files:**
- Create: `packages/persistence-postgres/migrations/0028_core_building_info.sql`
- Modify: `packages/application/src/core-flow.ts:23-38`, `packages/persistence-postgres/src/core-flow.ts:58-66`
- Test: `tests/postgres/core-building-info.test.ts`(새)

**Interfaces:**
- Consumes: `core_flow.session`(역할·`orgId`·`actorId`), `authn.can_read_property`, `core_flow.unit_name_order`(0027)
- Produces (SQL): `core_flow.org_buildings(bytea) → jsonb`, `core_flow.building_info(bytea,uuid) → jsonb`, `core_flow.save_building_info(bytea,uuid,integer,text,text,text,text) → jsonb`
- Produces (TS, `@build-manager/application`):

```ts
export type CoreHeatingType = "INDIVIDUAL" | "CENTRAL_SHARED";
export type CoreManagementMode = "OWNER_DIRECT" | "MANAGEMENT_OFFICE";
export type CoreBuildingSummary = { buildingId: string; displayName: string | null; unitCount: number; needsInfo: boolean };
export type CoreBuildingInfo = { buildingId: string; displayName: string | null; serviceAddress: string | null; heatingType: CoreHeatingType | null; managementMode: CoreManagementMode | null; demo: boolean; version: number; unitCount: number };
export type CoreBuildingInfoInput = { expectedVersion: number; displayName: string; serviceAddress: string | null; heatingType: CoreHeatingType | null; managementMode: CoreManagementMode | null };
export type CoreBuildingScope = { list(): Promise<CoreBuildingSummary[]>; read(buildingId: string): Promise<CoreBuildingInfo>; save(buildingId: string, input: CoreBuildingInfoInput): Promise<CoreBuildingInfo> };
```

`CoreScope`에 `buildings: CoreBuildingScope;`를 더한다.

- [ ] **Step 1: 실패 시험 쓰기** — `tests/postgres/core-building-info.test.ts`

```ts
import { createHash,randomBytes,randomUUID } from "node:crypto";
import { afterAll,beforeAll,expect,it } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createBuildingRegistrationPort } from "@build-manager/persistence-postgres/b3";
import { createCoreFlowPort } from "@build-manager/persistence-postgres/core-flow";
import { createCoreOnboardingPort } from "@build-manager/persistence-postgres/core-onboarding";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { performCoreAction,type CoreBuildingInfoInput,type CoreScope,type OnboardingAction,type OnboardingResult } from "@build-manager/application";
import { selectProtocol,type Building } from "@build-manager/domain";
import { createB1Fixture } from "./helpers/b1-fixture";

// P6 + C1 step 2 (docs/superpowers/specs/2026-10-15-building-setup-p6-design.md): organisation admins save building info.
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>;
const token=()=>createHash("sha256").update(randomBytes(32)).digest("hex");
beforeAll(async()=>{f=await createB1Fixture();await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);},120_000);
afterAll(async()=>{await db?.close();await f?.close();});
const run=<T>(who:string,op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db).run(data.accounts[who].digest,op);
const input=(over:Partial<CoreBuildingInfoInput>={}):CoreBuildingInfoInput=>({expectedVersion:0,displayName:"합성 햇살빌라",serviceAddress:"합성 예시로 12",heatingType:"INDIVIDUAL",managementMode:null,...over});
async function registered(label:string){
 const registration=createBuildingRegistrationPort(db),manager=data.accounts.manager.digest;
 const property=await registration.createProperty(manager,data.orgA,{addressReference:`합성 P6 ${label}`});
 const unit=await registration.createUnit(manager,data.orgA,property.id,{label:`합성 P6 ${label} 101`});
 return {property,unit};
}
type View={invitationId:string;requestNumber:string|null;state:string};
const view=(r:OnboardingResult):View=>{expect(r).toHaveProperty("data");return (r as {data:View}).data;};
async function connectedTenant(unitId:string){
 const digest=token();await f.login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '1 hour') id",["https://p6.synthetic.invalid/",randomUUID(),Buffer.from(digest,"hex")]);
 const onboard=(action:OnboardingAction,body:Record<string,unknown>,who=data.accounts.manager.digest,org:string|null=data.orgA)=>createCoreOnboardingPort(db).execute(who,action,org,body);
 const tokenDigest=token();
 expect(view(await onboard("CREATE",{unitId,tokenDigest})).state).toBe("OPEN");
 const claim=view(await onboard("CLAIM",{tokenDigest},digest,null));
 expect(view(await onboard("APPROVE",{invitationId:claim.invitationId,requestNumber:claim.requestNumber})).state).toBe("APPROVED");
 return <T>(op:(s:CoreScope)=>Promise<T>)=>createCoreFlowPort(db,data.orgA).run(digest,op);
}

it("lets the organisation admin read, list and save a registered building",async()=>{
 const b=await registered("A");
 expect(await run("manager",s=>s.buildings.read(b.property.id))).toEqual({buildingId:b.property.id,displayName:null,serviceAddress:null,heatingType:null,managementMode:null,demo:false,version:0,unitCount:1});
 expect((await run("manager",s=>s.buildings.list())).find(x=>x.buildingId===b.property.id)).toEqual({buildingId:b.property.id,displayName:null,unitCount:1,needsInfo:true});
 expect(await run("manager",s=>s.buildings.save(b.property.id,input()))).toEqual({buildingId:b.property.id,displayName:"합성 햇살빌라",serviceAddress:"합성 예시로 12",heatingType:"INDIVIDUAL",managementMode:null,demo:false,version:1,unitCount:1});
 expect((await run("manager",s=>s.buildings.list())).find(x=>x.buildingId===b.property.id)).toEqual({buildingId:b.property.id,displayName:"합성 햇살빌라",unitCount:1,needsInfo:false});
 expect(await run("manager",s=>s.buildings.save(b.property.id,input({expectedVersion:1,serviceAddress:null,heatingType:null,managementMode:"MANAGEMENT_OFFICE"})))).toMatchObject({version:2,serviceAddress:null,heatingType:null,managementMode:"MANAGEMENT_OFFICE"});
 expect((await run("manager",s=>s.buildings.list())).find(x=>x.buildingId===b.property.id)?.needsInfo).toBe(true);
},60_000);

it("stores owner-verified facts the tenant's questions, the unit list and the vendor source use",async()=>{
 const b=await registered("B"),tenant=await connectedTenant(b.unit.id);
 await run("manager",s=>s.buildings.save(b.property.id,input({managementMode:"OWNER_DIRECT"})));
 expect((await tenant(s=>s.units())).find(x=>x.id===b.unit.id)?.buildingName).toBe("합성 햇살빌라");
 const building=await tenant(s=>s.building(b.unit.id)) as Building;
 expect(building).toMatchObject({id:b.property.id,displayName:"합성 햇살빌라",demo:false});
 expect(building.context.map(x=>[x.key,x.value,x.sourceType,x.verified,x.routingEligible])).toEqual([["heatingType","INDIVIDUAL","OWNER_VERIFIED",true,true],["managementMode","OWNER_DIRECT","OWNER_VERIFIED",true,true]]);
 expect(selectProtocol(building,"HEATING").id).toBe("HEATING_INDIVIDUAL_V1");
 const created=await tenant(s=>performCoreAction(s,{type:"CREATE",unitId:b.unit.id,issueType:"HEATING",rawUserText:"합성 P6 난방 접수"},{now:()=>new Date().toISOString()},{next:()=>randomUUID()}));
 expect(created.ticket.protocolId).toBe("HEATING_INDIVIDUAL_V1");
 expect((await f.p.admin.query("SELECT core_flow.building_body($1,$2)->>'serviceAddress' a",[data.orgA,b.property.id])).rows[0].a).toBe("합성 예시로 12");
 await run("manager",s=>s.buildings.save(b.property.id,input({expectedVersion:1,heatingType:null})));
 expect(selectProtocol(await tenant(s=>s.building(b.unit.id)) as Building,"HEATING").id).toBe("HEATING_UNKNOWN_V1");
},90_000);

it("refuses staff, tenants, other organisations and demo buildings",async()=>{
 const b=await registered("C");
 for(const who of ["staff","tenant"]){
  await expect(run(who,s=>s.buildings.list())).rejects.toMatchObject({code:"FORBIDDEN"});
  await expect(run(who,s=>s.buildings.read(b.property.id))).rejects.toMatchObject({code:"FORBIDDEN"});
  await expect(run(who,s=>s.buildings.save(b.property.id,input()))).rejects.toMatchObject({code:"FORBIDDEN"});
 }
 await expect(run("otherManager",s=>s.buildings.read(b.property.id))).rejects.toMatchObject({code:"NOT_FOUND"});
 await expect(run("otherManager",s=>s.buildings.save(b.property.id,input()))).rejects.toMatchObject({code:"NOT_FOUND"});
 expect((await run("otherManager",s=>s.buildings.list())).map(x=>x.buildingId)).not.toContain(b.property.id);
 expect(await run("manager",s=>s.buildings.read(data.propertyA))).toMatchObject({demo:true,displayName:"RC1 합성 건물 A",heatingType:"INDIVIDUAL",managementMode:"OWNER_DIRECT",version:0});
 await expect(run("manager",s=>s.buildings.save(data.propertyA,input()))).rejects.toMatchObject({code:"FORBIDDEN"});
 expect((await f.p.admin.query("SELECT body->>'displayName' n FROM core_flow.building_context WHERE property_id=$1",[data.propertyA])).rows[0].n).toBe("RC1 합성 건물 A");
},60_000);

it("rejects a stale version, including two first saves at once",async()=>{
 const b=await registered("D");
 const both=await Promise.allSettled([run("manager",s=>s.buildings.save(b.property.id,input({displayName:"합성 동시 1"}))),run("manager",s=>s.buildings.save(b.property.id,input({displayName:"합성 동시 2"})))]);
 expect(both.map(x=>x.status).sort()).toEqual(["fulfilled","rejected"]);
 expect((both.find(x=>x.status==="rejected") as PromiseRejectedResult).reason).toMatchObject({code:"STATE_CONFLICT"});
 await expect(run("manager",s=>s.buildings.save(b.property.id,input()))).rejects.toMatchObject({code:"STATE_CONFLICT"});
 expect((await run("manager",s=>s.buildings.read(b.property.id))).version).toBe(1);
},60_000);

it("rejects input outside the bounds",async()=>{
 const b=await registered("E");
 for(const bad of [{displayName:""},{displayName:" 합성"},{displayName:"합성\n건물"},{displayName:"가".repeat(51)},{serviceAddress:""},{serviceAddress:"가".repeat(201)},{serviceAddress:"합성\t주소"},{heatingType:"DISTRICT"},{managementMode:"THIRD_PARTY_MANAGER"},{expectedVersion:-1}] as Partial<CoreBuildingInfoInput>[])
  await expect(run("manager",s=>s.buildings.save(b.property.id,input(bad))),JSON.stringify(bad)).rejects.toMatchObject({code:"INVALID_INPUT"});
 expect(await run("manager",s=>s.buildings.save(b.property.id,input({displayName:"가".repeat(50),serviceAddress:"가".repeat(200)})))).toMatchObject({version:1});
},60_000);

it("adds owner-only definer functions and gives the web role only the three entry points",async()=>{
 const names=["building_info","building_info_json","org_buildings","require_org_admin","save_building_info","verified_fact"];
 const rows=(await f.p.admin.query("SELECT proname,prosecdef,proconfig,pg_get_userbyid(proowner) owner,has_function_privilege('bm_b1_web',oid,'EXECUTE') web,has_function_privilege('public',oid,'EXECUTE') pub FROM pg_proc WHERE pronamespace='core_flow'::regnamespace AND proname=ANY($1) ORDER BY proname",[names])).rows;
 expect(rows).toEqual(names.map(proname=>({proname,prosecdef:true,proconfig:["search_path=pg_catalog"],owner:"bm_core_flow_owner",web:["building_info","org_buildings","save_building_info"].includes(proname),pub:false})));
 expect((await f.p.admin.query("SELECT has_schema_privilege('bm_core_flow_owner','core_flow','CREATE') c")).rows[0].c).toBe(false);
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run --config vitest.postgres.config.ts tests/postgres/core-building-info.test.ts`(Docker 필요) → TS에서 `buildings` 없음, SQL 함수 없음으로 FAIL(구조적 실패)

- [ ] **Step 3: 마이그레이션** — `packages/persistence-postgres/migrations/0028_core_building_info.sql`

```sql
-- P6 + C1 step 2 (docs/superpowers/specs/2026-10-15-building-setup-p6-design.md): organisation admins read their buildings
-- and save a building's name, vendor service address and owner-verified heating/management facts. Demo buildings
-- (body.demo=true) are never saved here. The saved body keeps the 0011 building shape plus version and updatedAt.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;

CREATE FUNCTION core_flow.require_org_admin(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;
BEGIN
 s:=core_flow.session(p_digest);
 IF s->>'role' IS DISTINCT FROM 'ORG_ADMIN' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 RETURN s;
END $$;

CREATE FUNCTION core_flow.verified_fact(p_body jsonb,p_key text) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT f->>'value' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_body->'context')='array' THEN p_body->'context' ELSE '[]'::jsonb END) f
 WHERE f->>'key'=p_key AND f->'verified'='true'::jsonb AND f->'routingEligible'='true'::jsonb AND jsonb_typeof(f->'value')='string'
 LIMIT 1
$$;

CREATE FUNCTION core_flow.building_info_json(p_digest bytea,p_org uuid,p_property uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE b jsonb; heating text; management text;
BEGIN
 PERFORM 1 FROM app.property p WHERE p.org_id=p_org AND p.id=p_property AND p.status='ACTIVE' AND authn.can_read_property(p_digest,p_org,p.id);
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 SELECT c.body INTO b FROM core_flow.building_context c WHERE c.org_id=p_org AND c.property_id=p_property;
 heating:=core_flow.verified_fact(b,'heatingType'); management:=core_flow.verified_fact(b,'managementMode');
 RETURN jsonb_build_object('buildingId',p_property::text,
  'displayName',nullif(btrim(b->>'displayName'),''),
  'serviceAddress',nullif(btrim(b->>'serviceAddress'),''),
  'heatingType',CASE WHEN heating IN ('INDIVIDUAL','CENTRAL_SHARED') THEN heating END,
  'managementMode',CASE WHEN management IN ('OWNER_DIRECT','MANAGEMENT_OFFICE') THEN management END,
  'demo',coalesce(b->'demo'='true'::jsonb,false),
  'version',CASE WHEN jsonb_typeof(b->'version')='number' THEN (b->>'version')::integer ELSE 0 END,
  'unitCount',(SELECT count(*)::integer FROM app.unit u WHERE u.org_id=p_org AND u.property_id=p_property AND u.status='ACTIVE'));
END $$;

CREATE FUNCTION core_flow.org_buildings(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; org uuid; result jsonb;
BEGIN
 s:=core_flow.require_org_admin(p_digest); org:=(s->>'orgId')::uuid;
 SELECT coalesce(jsonb_agg(jsonb_build_object('buildingId',x.id::text,'displayName',x.name,'unitCount',x.units,'needsInfo',x.name IS NULL OR x.address IS NULL)
  ORDER BY x.name IS NULL,x.name COLLATE core_flow.unit_name_order,x.id),'[]'::jsonb) INTO result
 FROM (SELECT p.id,nullif(btrim(c.body->>'displayName'),'') AS name,nullif(btrim(c.body->>'serviceAddress'),'') AS address,
  (SELECT count(*)::integer FROM app.unit u WHERE u.org_id=org AND u.property_id=p.id AND u.status='ACTIVE') AS units
  FROM app.property p LEFT JOIN core_flow.building_context c ON c.org_id=p.org_id AND c.property_id=p.id
  WHERE p.org_id=org AND p.status='ACTIVE' AND authn.can_read_property(p_digest,org,p.id)) x;
 RETURN result;
END $$;

CREATE FUNCTION core_flow.building_info(p_digest bytea,p_property uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb;
BEGIN
 s:=core_flow.require_org_admin(p_digest);
 RETURN core_flow.building_info_json(p_digest,(s->>'orgId')::uuid,p_property);
END $$;

CREATE FUNCTION core_flow.save_building_info(p_digest bytea,p_property uuid,p_expected_version integer,p_name text,
 p_service_address text,p_heating text,p_management text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; org uuid; b jsonb; current_version integer; at_text text; facts jsonb:='[]'::jsonb;
BEGIN
 s:=core_flow.require_org_admin(p_digest); org:=(s->>'orgId')::uuid;
 PERFORM 1 FROM app.property p WHERE p.org_id=org AND p.id=p_property AND p.status='ACTIVE' AND authn.can_read_property(p_digest,org,p.id);
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='NOT_FOUND'; END IF;
 IF p_expected_version IS NULL OR p_expected_version<0
  OR p_name IS NULL OR p_name<>btrim(p_name) OR char_length(p_name) NOT BETWEEN 1 AND 50 OR p_name ~ '[[:cntrl:]]'
  OR (p_service_address IS NOT NULL AND (p_service_address<>btrim(p_service_address) OR char_length(p_service_address) NOT BETWEEN 1 AND 200 OR p_service_address ~ '[[:cntrl:]]'))
  OR (p_heating IS NOT NULL AND p_heating NOT IN ('INDIVIDUAL','CENTRAL_SHARED'))
  OR (p_management IS NOT NULL AND p_management NOT IN ('OWNER_DIRECT','MANAGEMENT_OFFICE'))
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_INPUT'; END IF;
 -- Serialises the first save of a building too, when no row exists yet to lock.
 PERFORM pg_advisory_xact_lock(hashtextextended('core_flow.building_info:'||p_property::text,0));
 SELECT c.body INTO b FROM core_flow.building_context c WHERE c.org_id=org AND c.property_id=p_property;
 IF b->'demo'='true'::jsonb THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FORBIDDEN'; END IF;
 current_version:=CASE WHEN jsonb_typeof(b->'version')='number' THEN (b->>'version')::integer ELSE 0 END;
 IF current_version<>p_expected_version THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STATE_CONFLICT'; END IF;
 at_text:=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 IF p_heating IS NOT NULL THEN facts:=facts||jsonb_build_array(jsonb_build_object('key','heatingType','value',p_heating,'sourceType','OWNER_VERIFIED',
  'sourceRef','org_admin','verified',true,'routingEligible',true,'fetchedAt',NULL,'updatedAt',at_text)); END IF;
 IF p_management IS NOT NULL THEN facts:=facts||jsonb_build_array(jsonb_build_object('key','managementMode','value',p_management,'sourceType','OWNER_VERIFIED',
  'sourceRef','org_admin','verified',true,'routingEligible',true,'fetchedAt',NULL,'updatedAt',at_text)); END IF;
 INSERT INTO core_flow.building_context(org_id,property_id,body)
 VALUES(org,p_property,jsonb_build_object('id',p_property::text,'displayName',p_name,'demo',false,'sourceNativeIds','{}'::jsonb,'context',facts,
  'serviceAddress',p_service_address,'version',current_version+1,'updatedAt',at_text))
 ON CONFLICT(org_id,property_id) DO UPDATE SET body=excluded.body;
 RETURN core_flow.building_info_json(p_digest,org,p_property);
END $$;

REVOKE ALL ON FUNCTION core_flow.require_org_admin(bytea),core_flow.verified_fact(jsonb,text),core_flow.building_info_json(bytea,uuid,uuid),
 core_flow.org_buildings(bytea),core_flow.building_info(bytea,uuid),core_flow.save_building_info(bytea,uuid,integer,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core_flow.org_buildings(bytea),core_flow.building_info(bytea,uuid),
 core_flow.save_building_info(bytea,uuid,integer,text,text,text,text) TO bm_b1_web;
RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;
```

- [ ] **Step 4: 타입과 연결** — `packages/application/src/core-flow.ts`에 위 "Produces (TS)" 타입을 더하고 `CoreScope`에 `buildings: CoreBuildingScope;`. `packages/application/src/index.ts`가 `core-flow.ts`를 그대로 내보내는지 확인한다. `packages/persistence-postgres/src/core-flow.ts`의 `operation({...})` 안 `manager` 다음에:

```ts
          buildings:{
            list:()=>call("SELECT core_flow.org_buildings($1) AS value",[hash]),
            read:id=>call("SELECT core_flow.building_info($1,$2) AS value",[hash,id]),
            save:(id,input)=>call("SELECT core_flow.save_building_info($1,$2,$3,$4,$5,$6,$7) AS value",[hash,id,input.expectedVersion,input.displayName,input.serviceAddress,input.heatingType,input.managementMode]),
          },
```

- [ ] **Step 5: 통과 확인** — Step 2 명령 → 6/6 PASS. 이어서 `tests/postgres/core-building-context-fallback.test.ts`, `core-unit-list.test.ts`, `core-unit-order.test.ts`, `vendor-handoff-foundation.test.ts`도 돌려 기존 동작이 그대로인지 본다.

- [ ] **Step 6: 변형 시험** — scratchpad 스크립트로 마이그레이션 사본을 하나씩 바꿔(조직 관리자 검사 빼기, `demo` 거절 빼기, 버전 검사 빼기, 잠금 빼기, `authn.can_read_property` 빼기, 제어 문자 검사 빼기) Step 1 시험이 잡는지 본다. 파일은 원래 바이트로 되돌리고 `git diff --stat`이 비었는지 확인한다.

- [ ] **Step 7: 커밋** — `git add packages/persistence-postgres/migrations/0028_core_building_info.sql packages/application/src/core-flow.ts packages/persistence-postgres/src/core-flow.ts tests/postgres/core-building-info.test.ts` → `feat(db): let organisation admins save building info (0028)`

### Task 3: 요청·응답 계약, 체험 세션 표시, Core 경로

**Files:**
- Create: `packages/api-contracts/src/core-building.ts`; Modify: `packages/api-contracts/src/index.ts`
- Modify: `apps/web/src/server/b1/demo-entry-config.ts`, `apps/web/src/server/core-flow/b1-access.ts`, `apps/web/src/server/core-flow/http.ts`
- Test: `apps/web/src/server/b1/demo-entry.test.ts`(또는 새 `demo-entry-config.test.ts`), `apps/web/src/server/core-flow/b1-access.test.ts`, `tests/postgres/core-building-info.test.ts`(HTTP 시험 추가)

**Interfaces:**
- Consumes: Task 2의 `CoreScope.buildings`
- Produces: `CoreBuildingSummarySchema`, `CoreBuildingListSchema`(`{editable:boolean;items:CoreBuildingSummary[]}`), `CoreBuildingInfoSchema`(`CoreBuildingInfo & {editable:boolean}`), `CoreBuildingInfoSaveSchema`(요청), `isDemoEntrySession(session:SessionData|null,env?):boolean`, `requireCoreB1Session(...)`의 반환에 `demo:boolean`

- [ ] **Step 1: 실패 시험 쓰기**

`b1-access.test.ts`에 추가:

```ts
it("marks a login-free demo entry session so writes can be refused",async()=>{
 vi.stubEnv("BUILD_MANAGER_MODE","B1");vi.stubEnv("BUILD_MANAGER_DEMO_ENTRY","1");vi.stubEnv("B1_AUTH0_DOMAIN","b1.synthetic.invalid");
 vi.stubEnv("BUILD_MANAGER_DEMO_SUBJECTS",JSON.stringify({manager:"auth0|synthetic-demo-manager",tenant:"auth0|synthetic-demo-tenant"}));
 try{
  await expect(requireCoreB1Session(new NextRequest(base),setup())).resolves.toMatchObject({demo:false});
  const demo=structuredClone(session);demo.user.sub="auth0|synthetic-demo-manager";
  await expect(requireCoreB1Session(new NextRequest(base),setup(demo))).resolves.toMatchObject({demo:true});
  vi.stubEnv("BUILD_MANAGER_DEMO_ENTRY","0");
  await expect(requireCoreB1Session(new NextRequest(base),setup(demo))).resolves.toMatchObject({demo:false});
 }finally{vi.unstubAllEnvs();}
});
```

`tests/postgres/core-building-info.test.ts`에 HTTP 시험 추가(파일 위에 import 두 줄 더함: `import { createCoreAccessPort } from "@build-manager/persistence-postgres/core-flow";`와 `handleCoreFlow`, `CoreHTTPDependencies`):

```ts
const origin="http://127.0.0.1:3130";
function http(who:string,path:string,body?:unknown,demo=false){
 const account=data.accounts[who];
 const d={port:createCoreFlowPort(db),revoke:async()=>{},origins:[origin],
  b1:{current:async()=>({digest:account.digest,csrf:"synthetic-proof",demo}),access:createCoreAccessPort(db)}} as unknown as CoreHTTPDependencies;
 return handleCoreFlow(new Request(`${origin}/api/v2/core/${path}`,{method:body===undefined?"GET":"POST",
  headers:{Origin:origin,"X-Core-Organization":account.orgId,"X-B1-CSRF":"synthetic-proof","Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})}),path.split("/"),()=>d);
}

it("answers the building routes over HTTP and refuses writes from a demo session",async()=>{
 const b=await registered("H"),path=`buildings/${b.property.id}`;
 const list=await http("manager","buildings");
 expect(list.status).toBe(200);
 expect(await list.json()).toMatchObject({editable:true,items:expect.arrayContaining([{buildingId:b.property.id,displayName:null,unitCount:1,needsInfo:true}])});
 expect(await (await http("manager",path)).json()).toMatchObject({buildingId:b.property.id,version:0,editable:true});
 const saved=await http("manager",path,{...input(),displayName:"  합성 HTTP 빌라  "});
 expect(saved.status).toBe(200);
 expect(await saved.json()).toMatchObject({displayName:"합성 HTTP 빌라",version:1,editable:true});
 expect((await http("manager",path,input())).status).toBe(409);
 expect((await http("manager",path,{...input({expectedVersion:1}),extra:true})).status).toBe(400);
 expect((await http("manager",path,input({expectedVersion:1}),true)).status).toBe(403);
 expect(await (await http("manager",path,undefined,true)).json()).toMatchObject({editable:false});
 expect(await (await http("manager","buildings",undefined,true)).json()).toMatchObject({editable:false});
 expect(await (await http("manager",`buildings/${data.propertyA}`)).json()).toMatchObject({demo:true,editable:false});
 expect((await http("staff","buildings")).status).toBe(403);
 expect((await http("manager","buildings/not-a-uuid")).status).toBe(400);
 expect((await http("manager",`buildings/${b.property.id}/extra`)).status).toBe(404);
},60_000);
```

- [ ] **Step 2: 실패 확인** — `npx vitest run --config vitest.shared.config.ts apps/web/src/server/core-flow/b1-access.test.ts`와 Step 1의 PostgreSQL 파일 → 새 시험 FAIL(`demo` 없음, 경로 404)

- [ ] **Step 3: 체험 세션 판별** — `demo-entry-config.ts` 끝에:

```ts
/** True when the session user is one of the configured login-free demo subjects (operator decision D4, 2026-10-15). */
export function isDemoEntrySession(session:SessionData|null,env:Readonly<Record<string,string|undefined>>=process.env):boolean{
  const subjects=demoEntrySubjects(env),sub=session?.user?.sub;
  return Boolean(subjects&&typeof sub==="string"&&Object.values(subjects).includes(sub));
}
```

(파일 위에 `import type { SessionData } from "@auth0/nextjs-auth0/types";`, `demoEntrySubjects` import 추가)

`b1-access.ts`의 `requireCoreB1Session`: 세션을 한 번 읽어 두고 반환에 표시를 더한다.

```ts
 const sessionData=await d.readSession(new NextRequest(request.url,{headers:request.headers}));
 const current=await requireCurrentSession(sessionData,d.sessions);
 ...
 return {...current,demo:isDemoEntrySession(sessionData)};
```

- [ ] **Step 4: 계약** — `packages/api-contracts/src/core-building.ts`

```ts
import { z } from "zod";
import { HeatingTypeSchema,ManagementModeSchema } from "./building";

const uuid=z.string().uuid();
const singleLine=(max:number)=>z.string().trim().min(1).max(max).refine(value=>!/[\u0000-\u001f\u007f]/.test(value),{message:"INVALID_INPUT"});
export const CoreBuildingSummarySchema=z.object({buildingId:uuid,displayName:z.string().min(1).nullable(),unitCount:z.number().int().min(0),needsInfo:z.boolean()}).strict();
export const CoreBuildingListSchema=z.object({editable:z.boolean(),items:z.array(CoreBuildingSummarySchema)}).strict();
export const CoreBuildingInfoSchema=z.object({buildingId:uuid,displayName:z.string().min(1).nullable(),serviceAddress:z.string().min(1).nullable(),
  heatingType:HeatingTypeSchema.nullable(),managementMode:ManagementModeSchema.nullable(),demo:z.boolean(),version:z.number().int().min(0),
  unitCount:z.number().int().min(0),editable:z.boolean()}).strict();
export const CoreBuildingInfoSaveSchema=z.object({expectedVersion:z.number().int().min(0).max(2_147_483_646),displayName:singleLine(50),
  serviceAddress:singleLine(200).nullable(),heatingType:HeatingTypeSchema.nullable(),managementMode:ManagementModeSchema.nullable()}).strict();
export type CoreBuildingListDto=z.infer<typeof CoreBuildingListSchema>;
export type CoreBuildingInfoDto=z.infer<typeof CoreBuildingInfoSchema>;
export type CoreBuildingInfoSave=z.infer<typeof CoreBuildingInfoSaveSchema>;
```

`index.ts`에 `export * from "./core-building";`

- [ ] **Step 5: Core 경로** — `http.ts`
  - `let hash:string,...` 줄에 `demoSession=false`를 더하고, B1 분기의 `const current=await d.b1.current(request);` 다음에 `demoSession=current.demo===true;`
  - `port.run` 안 `manager` 분기 다음에:

```ts
      // P6 + C1 step 2: organisation admins only (B1), never written from a login-free demo session (D4).
      if(segments[0]==="buildings"){
        if(!d.b1)fail("NOT_FOUND");
        if(scope.session.role!=="ORG_ADMIN")fail("FORBIDDEN");
        if(segments.length===1&&request.method==="GET")return json(CoreBuildingListSchema.parse({editable:!demoSession,items:await scope.buildings.list()}));
        const id=segments[1];
        if(segments.length!==2)fail("NOT_FOUND");
        if(!id||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))fail("INVALID_INPUT");
        if(request.method==="GET"){const info=await scope.buildings.read(id);return json(CoreBuildingInfoSchema.parse({...info,editable:!demoSession&&!info.demo}));}
        if(demoSession)fail("FORBIDDEN");
        const info=await scope.buildings.save(id,parse(CoreBuildingInfoSaveSchema,await body(request)));
        return json(CoreBuildingInfoSchema.parse({...info,editable:!info.demo}));
      }
```

  - 위 import에 `CoreBuildingListSchema,CoreBuildingInfoSchema,CoreBuildingInfoSaveSchema` 추가

- [ ] **Step 6: 통과 확인** — Step 2 명령 둘 → PASS. `apps/web/src/server/core-flow/http.test.ts` 전체도 PASS.

- [ ] **Step 7: 커밋** — 계약·판별·경로와 시험 파일을 이름으로 stage → `feat(web): add the Core building info routes and refuse writes from demo sessions`

### Task 4: B3 만들기에서 체험 세션 막기

**Files:**
- Modify: `apps/web/src/server/b3/http.ts:93-150`
- Test: `apps/web/src/server/b3/http.test.ts`

**Interfaces:**
- Consumes: Task 3의 `isDemoEntrySession`

- [ ] **Step 1: 실패 시험 쓰기** — `http.test.ts`의 "B3 HTTP boundary" 묶음에 추가. 같은 파일의 기존 도우미(가짜 의존성, 세션, 요청 만드는 함수)를 쓰고, 세션의 `user.sub`만 체험 대상으로 바꾼다. 확인할 것: 건물 만들기·호실 만들기 POST가 403 `FORBIDDEN`이고 만들기 포트가 불리지 않음, 목록 GET의 `X-B3-Can-Create-Property`·`X-B3-Can-Create-Unit`이 `false`, 체험 설정이 꺼지면 둘 다 지금과 같음.

```ts
  it("P6 D4 refuses creation from a login-free demo session and reports no create capability", async () => {
    const demoSub = "auth0|synthetic-demo-manager";
    vi.stubEnv("BUILD_MANAGER_MODE", "B1"); vi.stubEnv("BUILD_MANAGER_DEMO_ENTRY", "1"); vi.stubEnv("B1_AUTH0_DOMAIN", "b1.synthetic.invalid");
    vi.stubEnv("BUILD_MANAGER_DEMO_SUBJECTS", JSON.stringify({ manager: demoSub, tenant: "auth0|synthetic-demo-tenant" }));
    try {
      const f = fixture();
      f.d.readSession.mockResolvedValue({ ...f.session, user: { sub: demoSub } });
      const property = await call(f, "properties", request("properties", { method: "POST", headers: postHeaders(f.csrf), body: JSON.stringify({ addressReference: "합성 체험 건물" }) }));
      const unitResponse = await call(f, "units", request("units", { method: "POST", headers: postHeaders(f.csrf), body: JSON.stringify({ label: "합성 체험 101" }) }));
      for (const response of [property, unitResponse]) {
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ error: "FORBIDDEN" });
        expectPrivate(response);
      }
      expect(f.d.registration.createProperty).not.toHaveBeenCalled();
      expect(f.d.registration.createUnit).not.toHaveBeenCalled();
      expect((await call(f, "properties", request("properties"))).headers.get("X-B3-Can-Create-Property")).toBe("false");
      expect((await call(f, "property", request("property"))).headers.get("X-B3-Can-Create-Unit")).toBe("false");
      expect((await call(f, "units", request("units"))).headers.get("X-B3-Can-Create-Unit")).toBe("false");

      vi.stubEnv("BUILD_MANAGER_DEMO_ENTRY", "0");
      const allowed = await call(f, "properties", request("properties", { method: "POST", headers: postHeaders(f.csrf), body: JSON.stringify({ addressReference: "합성 일반 건물" }) }));
      expect(allowed.status).toBe(201);
      expect((await call(f, "properties", request("properties"))).headers.get("X-B3-Can-Create-Property")).toBe("true");
    } finally { vi.unstubAllEnvs(); }
  });
```
- [ ] **Step 2: 실패 확인** — `npx vitest run --config vitest.shared.config.ts apps/web/src/server/b3/http.test.ts` → 새 시험 FAIL(201)

- [ ] **Step 3: 구현** — `handleB3Http`에서 세션을 한 번 읽어 둔다.

```ts
    const session = await d.readSession(request);
    const current = await requireCurrentSession(session, d.sessions);
    // P6 D4 (2026-10-15): the shared login-free demo can read but not register buildings or units.
    const demo = isDemoEntrySession(session);

    if (request.method === "POST") {
      csrf(request.headers.get("x-b1-csrf"), current.csrf);
      if (demo) throw new B3Error("FORBIDDEN");
```

목록·건물 GET의 `allowed` 계산을 `const allowed = !demo && await canCreate...(...)`로 바꾼다(세 곳). import `isDemoEntrySession` from `"../b1/demo-entry-config"`.

- [ ] **Step 4: 통과 확인** — Step 2 명령 → 전체 PASS(기존 AC14·AC21 시험 포함)

- [ ] **Step 5: 커밋** — `fix(web): keep the public demo from registering buildings and units`

### Task 5: 기록과 검사

- [ ] 설계 문서의 API 줄을 실제(POST, 기존 오류 코드, `building_info` 권한 없음은 403)로 고친다.
- [ ] DEV-06·DEV-04(다른 세션에 먼저 알림): `npm run test:shared`, `npm run test:web`, `npm run test:postgres`, `npm run lint`, `npm run typecheck`, `npm run build:web`, `npm run check:deps`, `python scripts/verify_repository.py --history`, `npm ci` 뒤 패키지 파일 변화 없음
- [ ] `ops/building_info_save_20261015_acceptance.md`(권한·체험·버전·사실 시험, 변형 결과, 되돌리기 주의), `STATUS.md` 한 줄, 실행 로그·대기 동기화 한 줄
- [ ] PR(첫 줄 등급) → CI → 새 문맥 독립 리뷰 → 반영 → 병합(`--merge --match-head-commit`)
- [ ] 다른 세션에 0028 번호를 쓴다고 알린다(마이그레이션 충돌 방지)
