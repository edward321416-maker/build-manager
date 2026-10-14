# 호실이 200개를 넘어도 모두 보이게 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `core_flow.units`가 세션이 볼 수 있는 호실을 개수 제한 없이 건물 이름·호실 이름·호실 id 순으로 돌려주고, 권한을 호실마다가 아니라 건물마다 한 번 검사하게 한다.

**Architecture:** 마이그레이션 `0026_core_units_all.sql` 하나가 `core_flow.units(bytea)`를 같은 소유자·정의자·`search_path`·권한으로 다시 만든다. 볼 수 있는 건물을 `authn.can_read_property`로 한 번씩 고르고(세입자는 건물 검사 없이 입주 조건으로 고름), 그 건물의 `ACTIVE` 호실을 한 번에 묶는다. 응답 모양은 그대로라 API·웹·모바일 코드는 바뀌지 않는다.

**Tech Stack:** PostgreSQL 18(시험은 testcontainers `postgres:18.6`), plpgsql, vitest 5(`vitest.postgres.config.ts`), Node 24.

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-10-14-unit-list-over-200-design.md`(운영자 2026-10-14 "A안 승인 (추천)").
- 위험 등급: 고위험(DEV-04). 데모 배포는 이 계획에 없다(운영자에게 따로 묻는다).
- 0026은 C1의 `0025_core_building_context_fallback.sql`(2-d4, 아직 병합 전) 위에 올라간다. **0025가 main에 병합되기 전에는 0026을 쓰거나 올리지 않는다.** 0025 파일은 고치지 않는다.
- 0025의 건물 이름 규칙을 그대로 쓴다: `building_context` 바깥 조인, `coalesce(c.body->>'displayName','건물')`.
- 바꾸지 않는 것: `core_flow.can_unit`, 다른 Core 함수, RLS·역할·권한 부여, API 계약(`CoreUnitsSchema`), 웹·모바일 코드, 기존 마이그레이션.
- 새 패키지 없음. `npm ci` 뒤에 `package.json`·`package-lock.json`·`apps/mobile/package.json`·`apps/mobile/app.json`이 바뀌면 안 된다.
- 공용 로컬 시험 DB(`build-manager-core-flow-rc1`)와 포트 3131·3133·3134를 쓰지 않는다(다른 세션이 쓰는 중). DB 시험은 testcontainers 전용 컨테이너로만 돌리고, `test:e2e:*`는 CI에 맡긴다.
- 저장소 파일은 Edit/Write 도구로만 고친다. 바꾼 경로만 이름으로 스테이징한다(`git add -A`, `git add .` 금지). amend·force·이력 고쳐 쓰기 금지.
- 데모 주소, IP, 이메일 주소를 문서·커밋·PR에 적지 않는다. 커밋 끝줄은 작업 환경이 정한 공동 작성자 줄이다.
- 셸은 Git Bash, 작업 폴더는 `worktree/build-manager-unit-list`다.

## 파일

| 파일 | 할 일 |
| --- | --- |
| `tests/postgres/core-unit-list.test.ts` (새 파일) | 스펙 "시험" 1–7번 |
| `packages/persistence-postgres/migrations/0026_core_units_all.sql` (새 파일) | `core_flow.units` 다시 만들기 |
| `scripts/hosted-demo-provision.mjs` 10행 | 주석의 마이그레이션 범위 `0001-0025` → `0001-0026` (0025 PR이 `0001-0024`를 `0001-0025`로 바꾼 뒤) |
| `ops/unit_list_over_200_20261014_acceptance.md` (새 파일) | 고위험 수락 기록 |
| `STATUS.md`, `ops/AI_Execution_Log.csv`, `ops/pending_external_sync.md` | 기록 한 줄씩 |

---

### Task 1: 실패하는 시험

**Files:**
- Create: `tests/postgres/core-unit-list.test.ts`

**Interfaces:**
- Consumes: `seedCoreFlowFixture`(조직 A: 건물 A `RC1 합성 건물 A`, 호실 `합성 호실 1`=`unitA`, `합성 호실 2`=`unitOther`; 조직 B: `unitB`; 계정 `tenant`·`tenantPeer`(unitA), `tenantOther`(unitOther), `manager`(ORG_ADMIN), `staff`(PROPERTY_STAFF, 건물 A 배정), `otherTenant`, `otherManager`), `createB1Fixture`, `createCoreAccessPort(...).inOrganization(org).run(digest, s=>s.units())`
- Produces: Task 2가 통과시켜야 하는 시험 7개

- [ ] **Step 1: 시험 파일 쓰기**

```ts
import { randomUUID } from "node:crypto";
import { beforeAll,afterAll,expect,it } from "vitest";
import { createPostgresDatabase } from "@build-manager/persistence-postgres";
import { createCoreAccessPort } from "@build-manager/persistence-postgres/core-flow";
import { seedCoreFlowFixture,type CoreFixture } from "@build-manager/persistence-postgres/testing";
import { createB1Fixture } from "./helpers/b1-fixture";

// core_flow.units past 200 units: docs/superpowers/specs/2026-10-14-unit-list-over-200-design.md
let f:Awaited<ReturnType<typeof createB1Fixture>>,data:CoreFixture,db:ReturnType<typeof createPostgresDatabase>,port:ReturnType<typeof createCoreAccessPort>;
const MANY=230;
// Two buildings without a building context row share the fallback name 건물; each has a unit called 101호.
const bare=[randomUUID(),randomUUID()],bareUnits=[randomUUID(),randomUUID()];
const archivedUnit=randomUUID(),archivedProperty=randomUUID(),unitInArchivedProperty=randomUUID();
const padded=(i:number)=>`대량 호실 ${String(i).padStart(3,"0")}`;
const q=(sql:string,values:unknown[])=>f.p.admin.query(sql,values);
const list=(name:string)=>{const a=data.accounts[name];return port.inOrganization(a.orgId).run(a.digest,s=>s.units());};

beforeAll(async()=>{
 f=await createB1Fixture();
 await f.p.admin.query(`COMMENT ON DATABASE "${f.p.database.replaceAll('"','""')}" IS 'CORE_FLOW_SYNTHETIC_LOCAL'`);
 data=await seedCoreFlowFixture(f.p.admin,f.login);db=createPostgresDatabase(f.roles.b1.webConfig);port=createCoreAccessPort(db);
 await q("INSERT INTO app.unit(id,org_id,property_id,label,status) SELECT gen_random_uuid(),$1,$2,'대량 호실 '||lpad(g::text,3,'0'),'ACTIVE' FROM generate_series(1,$3::int) g",[data.orgA,data.propertyA,MANY]);
 await q("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'보관 호실','ARCHIVED')",[archivedUnit,data.orgA,data.propertyA]);
 for(const [i,property] of bare.entries()){
  await q("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')",[property,data.orgA]);
  await q("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'101호','ACTIVE')",[bareUnits[i],data.orgA,property]);
 }
 await q("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ARCHIVED')",[archivedProperty,data.orgA]);
 await q("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,'보관 건물 호실','ACTIVE')",[unitInArchivedProperty,data.orgA,archivedProperty]);
},300_000);
afterAll(async()=>{await db?.close();await f?.close();});

it("lists every active unit an organisation admin can read, past 200",async()=>{
 const ids=(await list("manager")).map(u=>u.id);
 expect(ids).toHaveLength(2+MANY+2);
 expect(new Set(ids).size).toBe(ids.length);
 expect(ids).toEqual(expect.arrayContaining([data.unitA,data.unitOther,...bareUnits]));
 expect(ids).not.toContain(archivedUnit);
 expect(ids).not.toContain(unitInArchivedProperty);
});

it("orders the list by building name, unit label and unit id",async()=>{
 const units=await list("manager");
 expect(units.filter(u=>u.buildingId===data.propertyA).map(u=>u.label).sort()).toEqual([...Array.from({length:MANY},(_,i)=>padded(i+1)),"합성 호실 1","합성 호실 2"].sort());
 // Text order is the database default collation's call, exactly as inside the function,
 // so the database sorts the returned rows again and the two orders must match.
 const resorted=(await q("SELECT x->>'id' AS id FROM jsonb_array_elements($1::jsonb) x ORDER BY x->>'buildingName',x->>'label',(x->>'id')::uuid",[JSON.stringify(units)])).rows.map(r=>r.id as string);
 expect(units.map(u=>u.id)).toEqual(resorted);
 // Same fallback name and same label: unit id decides.
 expect(units.filter(u=>u.buildingName==="건물").map(u=>u.id)).toEqual([...bareUnits].sort());
});

it("gives a property staff member every unit of the assigned building and nothing else",async()=>{
 const units=await list("staff");
 expect(units).toHaveLength(2+MANY);
 expect(new Set(units.map(u=>u.buildingId))).toEqual(new Set([data.propertyA]));
});

it("gives a tenant only the units they live in now",async()=>{
 expect((await list("tenant")).map(u=>u.id)).toEqual([data.unitA]);
 expect((await list("tenantOther")).map(u=>u.id)).toEqual([data.unitOther]);
 const tenant=data.accounts.tenant.userId,now=randomUUID(),later=randomUUID();
 await q("INSERT INTO app.occupancy(id,org_id,unit_id,starts_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '1 minute','ACTIVE')",[now,data.orgA,bareUnits[0]]);
 await q("INSERT INTO app.occupancy(id,org_id,unit_id,starts_at,status) VALUES($1,$2,$3,clock_timestamp()+interval '1 day','ACTIVE')",[later,data.orgA,bareUnits[1]]);
 for(const occupancy of [now,later])await q("INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '1 minute','ACTIVE')",[data.orgA,occupancy,tenant]);
 expect((await list("tenant")).map(u=>u.id).sort()).toEqual([data.unitA,bareUnits[0]].sort());
 await q("UPDATE app.occupancy_member SET status='ENDED',ended_at=clock_timestamp() WHERE occupancy_id=$1",[now]);
 expect((await list("tenant")).map(u=>u.id)).toEqual([data.unitA]);
});

it("keeps each organisation's units to itself",async()=>{
 expect((await list("otherManager")).map(u=>u.id)).toEqual([data.unitB]);
 expect((await list("otherTenant")).map(u=>u.id)).toEqual([data.unitB]);
 expect((await list("manager")).map(u=>u.id)).not.toContain(data.unitB);
});

// The reference answer: every unit of the account's organisation for which core_flow.can_unit is true.
async function allowedByCanUnit(name:string){
 const a=data.accounts[name],hash=Buffer.from(a.digest,"hex");
 await f.p.admin.query("BEGIN");
 try{
  await f.p.admin.query("SELECT core_flow.session($1)",[hash]);
  return (await f.p.admin.query("SELECT u.id FROM app.unit u WHERE u.org_id=$2 AND core_flow.can_unit($1,u.id) ORDER BY u.id",[hash,a.orgId])).rows.map(r=>r.id as string);
 }finally{await f.p.admin.query("ROLLBACK");}
}

it("returns exactly the units core_flow.can_unit allows, for every account",async()=>{
 await q("INSERT INTO app.property_assignment(org_id,membership_id,property_id,status) VALUES($1,$2,$3,'ACTIVE')",[data.orgA,data.accounts.staff.membershipId,bare[1]]);
 expect((await list("staff")).map(u=>u.id)).toContain(bareUnits[1]);
 for(const name of Object.keys(data.accounts)){
  const ids=(await list(name)).map(u=>u.id);
  expect([...ids].sort(),name).toEqual(await allowedByCanUnit(name));
 }
});

it("keeps core_flow.units a definer function owned by bm_core_flow_owner with a pinned search path",async()=>{
 const row=(await q("SELECT p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) AS owner,has_function_privilege('bm_b1_web',p.oid,'EXECUTE') AS web,has_function_privilege('public',p.oid,'EXECUTE') AS everyone FROM pg_proc p WHERE p.oid='core_flow.units(bytea)'::regprocedure",[])).rows[0];
 expect(row).toEqual({prosecdef:true,proconfig:["search_path=pg_catalog"],owner:"bm_core_flow_owner",web:true,everyone:false});
});
```

- 메모
  - `uuid` 정렬은 16바이트 비교라서, 소문자 표준 문자열을 JS로 정렬한 순서와 같다. 그래서 `[...bareUnits].sort()`와 `ORDER BY u.id`를 그대로 비교한다.
  - 글자 순서는 DB 기본 정렬 규칙이 정한다. 처음 계획은 "라틴 글자가 한글보다 앞"이라고 가정했지만, 2026-10-14 0025 위 미리 확인에서 시험 이미지의 정렬은 `건물`을 `RC1 합성 건물 A`보다 앞에 두고 `합성 호실 1`을 `대량 호실 099`와 `100` 사이에 두었다(한글을 첫 비교에서 건너뜀). 그래서 순서 시험은 돌려받은 행을 DB가 `건물 이름, 호실 이름, id`로 다시 정렬한 결과와 비교하고, 세입자 시험은 순서 없이 비교한다. 이 정렬은 지금 화면에서도 같고, 이번 범위에서 바꾸지 않는다(스펙 "남은 위험").
  - `allowedByCanUnit`은 시험 컨테이너의 관리자 연결(슈퍼유저)로 한 트랜잭션 안에서 `core_flow.session`을 부른 뒤 `can_unit`을 부르고, 끝에 되돌린다.

- [ ] **Step 2: main(0025 이전) 위에서 돌려 컴파일과 실패를 확인한다**

Run: `npx vitest run --config vitest.postgres.config.ts tests/postgres/core-unit-list.test.ts`
Expected: FAIL. 1·2·3·6번은 목록이 200개라서 실패한다. 4번은 건물 정보가 없는 호실이 빠져서(C1, 0025가 고침) 실패한다. 5·7번은 통과한다. 이 결과는 참고용이다. 목표 행동의 RED 증거는 Task 2 Step 2에서 0025 위에서 다시 잡는다.

- [ ] **Step 3: 커밋**

```bash
git add tests/postgres/core-unit-list.test.ts
git commit -m "test(db): pin the Core unit list past 200 units (fails until 0026)"
```

---

### Task 2: 0025 위에 0026 쓰기

**Files:**
- Create: `packages/persistence-postgres/migrations/0026_core_units_all.sql`
- Modify: `scripts/hosted-demo-provision.mjs:10`

**Interfaces:**
- Consumes: main에 병합된 0025(`core_flow.units`를 바깥 조인 + `LIMIT 200`으로 다시 만듦), Task 1의 시험
- Produces: 같은 이름·인자(`p_digest bytea`)·반환형(`jsonb`)의 `core_flow.units`

- [ ] **Step 1: 0025가 main에 병합됐는지 확인하고 이 브랜치에 main을 병합한다**

```bash
git fetch origin
git ls-tree --name-only origin/main packages/persistence-postgres/migrations/ | tail -2
```

Expected: 마지막 줄이 `packages/persistence-postgres/migrations/0025_core_building_context_fallback.sql`. 없으면 멈추고 기다린다.

```bash
git merge --no-edit origin/main
git show HEAD:packages/persistence-postgres/migrations/0025_core_building_context_fallback.sql | grep -n -A12 "FUNCTION core_flow.units"
```

Expected: `LEFT JOIN core_flow.building_context`, `coalesce(c.body->>'displayName','건물')`, `ORDER BY u.id LIMIT 200`이 보인다. 다르면 아래 SQL의 건물 이름 규칙을 0025에 맞추고 스펙에 적는다.

- [ ] **Step 2: 0025 위에서 RED를 확인한다**

Run: `npx vitest run --config vitest.postgres.config.ts tests/postgres/core-unit-list.test.ts`
Expected: FAIL 4건(1·2·3·6번)이고, 실패 이유는 모두 목록 길이 200이다(`expected [ …(200) ] to have a length of 234`, 2번은 건물 A 호실 이름 200개 대 232개, 3번 `… of 232`, 6번은 `manager` 이름표와 함께 200 대 234). 4·5·7번은 통과한다. 실패 출력을 수락 기록에 붙인다.

- [ ] **Step 3: 마이그레이션 쓰기**

`packages/persistence-postgres/migrations/0026_core_units_all.sql`:

```sql
-- Unit list over 200 (docs/superpowers/specs/2026-10-14-unit-list-over-200-design.md, option A). core_flow.units cut the list
-- to 200 units in random id order and ran core_flow.can_unit once per unit of the organisation. It now returns every unit
-- the session can read, ordered by building name, unit label and unit id, and checks building access once per building
-- with the rules of can_unit: a manager or staff member reads the active units of every active building
-- authn.can_read_property allows; a tenant reads the active units of active buildings they live in now. The building
-- name keeps the 0025 fallback. Signature, owner, SECURITY DEFINER, search_path and grants stay; can_unit is unchanged.
GRANT CREATE ON SCHEMA core_flow TO bm_core_flow_owner;
SET LOCAL ROLE bm_core_flow_owner;

CREATE OR REPLACE FUNCTION core_flow.units(p_digest bytea) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s jsonb; org uuid; actor uuid; tenant boolean; result jsonb;
BEGIN
 s:=core_flow.session(p_digest);
 org:=(s->>'orgId')::uuid; actor:=(s->>'actorId')::uuid; tenant:=s->>'role'='TENANT';
 WITH readable AS (
  SELECT p.id FROM app.property p
  WHERE p.org_id=org AND p.status='ACTIVE' AND (tenant OR authn.can_read_property(p_digest,org,p.id))
 ), visible AS (
  SELECT u.id,u.property_id,u.label,coalesce(c.body->>'displayName','건물') AS building_name
  FROM app.unit u JOIN readable r ON r.id=u.property_id
  LEFT JOIN core_flow.building_context c ON c.org_id=u.org_id AND c.property_id=u.property_id
  WHERE u.org_id=org AND u.status='ACTIVE'
  AND (NOT tenant OR EXISTS(SELECT 1 FROM app.occupancy o JOIN app.occupancy_member m ON m.org_id=o.org_id AND m.occupancy_id=o.id
   WHERE o.org_id=org AND o.unit_id=u.id AND o.status='ACTIVE' AND m.status='ACTIVE' AND m.user_id=actor
   AND m.joined_at<=clock_timestamp() AND o.starts_at<=clock_timestamp() AND (o.ends_at IS NULL OR o.ends_at>clock_timestamp())))
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'buildingId',v.property_id,'label',v.label,'buildingName',v.building_name)
  ORDER BY v.building_name,v.label,v.id),'[]'::jsonb) INTO result FROM visible v;
 RETURN result;
END $$;

RESET ROLE;
REVOKE CREATE ON SCHEMA core_flow FROM bm_core_flow_owner;
```

- `can_unit`과 한 줄씩 맞춰 본 것(0011 80–92행)
  - 호실 `ACTIVE`, 건물 `ACTIVE`, 같은 조직 → `readable`의 `p.status`, `visible`의 `u.status`·`u.org_id`
  - 세입자가 아니면 `authn.can_read_property(p_digest,org,property)` → `readable`
  - 세입자면 입주·구성원 조건 → `visible`의 `EXISTS`, 조건 글자 그대로
- 변수 이름(`org`, `actor`, `tenant`)은 읽는 테이블의 열 이름과 겹치지 않는다(열은 `org_id`, `tenant_id` 등).

- [ ] **Step 4: 시험이 통과하는지 확인한다**

Run: `npx vitest run --config vitest.postgres.config.ts tests/postgres/core-unit-list.test.ts`
Expected: PASS 7건.

- [ ] **Step 5: 데모 준비 스크립트 주석을 고친다**

`scripts/hosted-demo-provision.mjs` 10행의 `applies migrations 0001-0025`를 `applies migrations 0001-0026`으로 바꾼다(Edit 도구). 0025 PR이 이 줄을 바꾸지 않았다면 실제 줄을 보고 범위만 `0026`으로 맞춘다.

- [ ] **Step 6: DB 시험 전체를 돌린다**

Run: `docker ps --format '{{.Names}}' | wc -l` (남은 컨테이너 수를 적는다), 그다음 `npm run test:postgres > "$TEMP/unit-list-test-postgres.log" 2>&1; echo "EXIT=$?"`
Expected: `EXIT=0`. 기존 Core 시험(`core-flow*.test.ts`, `core-building-context-fallback.test.ts` 등)이 모두 통과한다. 특히 0025의 격리 시험(`core-building-context-fallback.test.ts`의 `tenantOther`·`otherTenant`·`staff`가 새 호실을 못 보는 시험)과 건물 이름 `건물` 시험이 0026 위에서 그대로 통과해야 한다(2-e8 요청, PR #147). 실패하면 `grep -E "FAIL|×" "$TEMP/unit-list-test-postgres.log"`로 보고, 일시 실패면 그 파일만 1회 재실행하고 기록한다(DEV-06).

- [ ] **Step 7: 커밋**

```bash
git add packages/persistence-postgres/migrations/0026_core_units_all.sql scripts/hosted-demo-provision.mjs
git commit -m "fix(db): list every readable Core unit and check access once per building"
```

---

### Task 3: 나머지 검사, 기록, 리뷰, PR

**Files:**
- Create: `ops/unit_list_over_200_20261014_acceptance.md`
- Modify: `STATUS.md`, `ops/AI_Execution_Log.csv`, `ops/pending_external_sync.md`

- [ ] **Step 1: DEV-06 검사**

각각 종료 코드를 확인한다(`| tail`로 가리지 않는다).

```bash
python scripts/verify_repository.py --history; echo "EXIT=$?"
npm run test:shared; echo "EXIT=$?"
npm run test:web; echo "EXIT=$?"
npm run lint; echo "EXIT=$?"
npm run typecheck; echo "EXIT=$?"
npm run build:web; echo "EXIT=$?"
npm run check:deps; echo "EXIT=$?"
git status --short package.json package-lock.json apps/mobile/package.json apps/mobile/app.json
```

Expected: 모두 `EXIT=0`, 마지막 줄은 출력 없음. `test:shared`가 호스트 부하로 시간 초과하면 1회만 재실행하고 기록한다.

- [ ] **Step 2: 수락 기록과 상태 줄을 쓴다**

- `ops/unit_list_over_200_20261014_acceptance.md`: POLICY_REF, TARGET_REF(head SHA), 결정(운영자 문구), 범위, RED 출력(Task 2 Step 2), GREEN 결과, 측정 표(스펙과 같은 값, 환경), 검사 명령과 결과, 독립 리뷰 결과, 남은 위험(고르는 칸이 길어짐 → C 후속), 롤백. 0025의 수락 기록 형식을 따른다.
- `STATUS.md`: Core 흐름 줄 근처에 한 줄(호실 목록 상한 해제, PR 번호는 PR을 연 뒤 채움).
- `ops/AI_Execution_Log.csv`: 이 PR을 주요 단계 하나로 한 줄. 기존 열 순서를 따르고 CSV로 유효해야 한다.
- `ops/pending_external_sync.md`: 외부 동기화 대기 한 줄.

- [ ] **Step 3: 새 문맥에서 독립 리뷰를 받는다**

리뷰 에이전트(새 문맥)에 스펙, 계획, `git diff origin/main...HEAD`를 주고 정확성·권한(T1–T6)·`can_unit`과의 동등성·요구사항 위반만 보게 한다. 지적은 고치고, 바뀐 부분만 다시 리뷰받는다.

- [ ] **Step 4: 커밋하고 PR을 연다**

```bash
git add ops/unit_list_over_200_20261014_acceptance.md STATUS.md ops/AI_Execution_Log.csv ops/pending_external_sync.md
git commit -m "docs(ops): record the unit list over 200 acceptance"
git push -u origin fix/unit-list-over-200
```

PR 본문 첫 줄은 `Risk tier: 고위험`. 목적, 실행한 검사와 결과(로컬 Node 24.14.0 / npm 11.9.0과 CI 버전 차이 포함), R05 자체 점검 요약, 남은 위험, 롤백을 쓴다.

- [ ] **Step 5: CI 통과 뒤 병합**

```bash
gh pr checks <PR> --watch
gh pr merge <PR> --merge --match-head-commit <head SHA>
```

병합 뒤 main CI를 확인하고, 인수인계 파일 `채팅방 인수인계 파일/개발.md`를 갱신한다. 데모 배포는 운영자에게 따로 묻는다.
