import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createB2Harness, seedB2Scope } from "./helpers/b2-fixture";

let h: Awaited<ReturnType<typeof createB2Harness>>;
beforeAll(async () => { h = await createB2Harness(); }, 120_000);
afterAll(async () => { await h?.close(); });
const command = "bm_b5_membership_owner", probe = "bm_b5_effective_admin_probe_owner";

it("installs only the exact B5 functions and helper execution graph", async () => {
  const rows = (await h.p.admin.query(`SELECT p.proname,r.rolname,p.provolatile,p.prosecdef,p.proconfig,
    pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
    WHERE n.nspname='authn' AND p.proname LIKE 'b5_%' ORDER BY p.proname`)).rows;
  expect(rows.map(r => [r.proname,r.rolname,r.provolatile,r.prosecdef,r.proconfig])).toEqual([
    ["b5_classify_caller","bm_b1_capability_owner","s",true,["search_path=pg_catalog"]],
    ["b5_end_organization_membership",command,"v",true,["search_path=pg_catalog, pg_temp"]],
    ["b5_has_other_effective_admin",probe,"s",true,["search_path=pg_catalog, pg_temp"]],
  ]);
  for (const [fn,allowed] of [
    ["authn.b5_classify_caller(bytea,uuid)",command],
    ["authn.b5_has_other_effective_admin(uuid,uuid)",command],
    ["authn.b5_end_organization_membership(bytea,uuid,uuid)","bm_b1_web"],
  ]) {
    const acl = (await h.p.admin.query(`SELECT r.rolname FROM pg_proc p,
      LATERAL aclexplode(p.proacl) a JOIN pg_roles r ON r.oid=a.grantee
      WHERE p.oid=$1::regprocedure AND a.grantee<>p.proowner ORDER BY r.rolname`, [fn])).rows;
    expect(acl).toEqual([{rolname:allowed}]);
    expect((await h.p.admin.query(`SELECT count(*)::int AS n FROM pg_proc p,
      LATERAL aclexplode(p.proacl) a WHERE p.oid=$1::regprocedure AND a.grantee=0`, [fn])).rows[0].n).toBe(0);
  }
  for (const role of [command,probe]) {
    expect((await h.p.admin.query("SELECT pg_has_role('bm_b1_web',$1,'SET') AS allowed",[role])).rows[0].allowed).toBe(false);
    expect((await h.p.admin.query("SELECT has_schema_privilege($1,'authn','CREATE') AS allowed",[role])).rows[0].allowed).toBe(false);
  }
});

it("enforces exact column privileges and no raw Web mutation", async () => {
  const expected: Record<string, Record<string, Record<string,string[]>>> = {
    [command]: { organization: { SELECT:["id","status"], UPDATE:["id"] },
      organization_membership:{SELECT:["id","org_id","role","status","version"],UPDATE:["ended_at","status","version"]}, app_user:{} },
    [probe]: { organization:{}, organization_membership:{SELECT:["id","org_id","role","status","user_id"]},app_user:{SELECT:["id","status"]} },
  };
  for(const [role,tables] of Object.entries(expected)) for(const [table,grants] of Object.entries(tables)) {
    const cols=(await h.p.admin.query("SELECT column_name FROM information_schema.columns WHERE table_schema='app' AND table_name=$1 ORDER BY column_name",[table])).rows;
    for(const privilege of ["SELECT","INSERT","UPDATE","REFERENCES"]) {
      const allowed=[];
      for(const {column_name} of cols) if((await h.p.admin.query("SELECT has_column_privilege($1,$2,$3,$4) AS v",[role,`app.${table}`,column_name,privilege])).rows[0].v) allowed.push(column_name);
      expect(allowed,`${role}.${table}.${privilege}`).toEqual(grants[privilege] ?? []);
    }
    for(const privilege of ["DELETE","TRUNCATE","TRIGGER"]) expect((await h.p.admin.query("SELECT has_table_privilege($1,$2,$3) AS v",[role,`app.${table}`,privilege])).rows[0].v).toBe(false);
  }
  expect((await h.p.admin.query("SELECT has_any_column_privilege('bm_b1_web','app.organization_membership','UPDATE') AS v")).rows[0].v).toBe(false);
});

it("AC15 uses real SET ROLE: positive termination and isolated mutation denials preserve bytes", async () => {
  const s=await seedB2Scope(h);
  const member=s.staffMembership;
  const before=async()=> (await h.p.admin.query("SELECT row_to_json(m)::text AS bytes FROM app.organization_membership m WHERE org_id=$1 ORDER BY id",[s.orgA])).rows;
  const original=await before();
  const attempts: [string,string,unknown[]][] = [
    [command,"UPDATE app.organization_membership SET role='ORG_ADMIN' WHERE id=$1",[member]],
    [command,"UPDATE app.organization_membership SET org_id=$2 WHERE id=$1",[member,s.orgB]],
    [command,"UPDATE app.organization_membership SET user_id=$2 WHERE id=$1",[member,s.noMember.userId]],
    [command,"INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'PROPERTY_STAFF','ACTIVE')",[randomUUID(),s.orgA,s.noMember.userId]],
    [command,"DELETE FROM app.organization_membership WHERE id=$1",[member]],
    ...["status='SUSPENDED'","display_name='Changed'","created_at=clock_timestamp()"].map(set=>[command,`UPDATE app.organization SET ${set} WHERE id=$1`,[s.orgA]] as [string,string,unknown[]]),
    [command,"UPDATE app.organization SET id=$2 WHERE id=$1",[s.orgA,randomUUID()]],
    ...["organization_membership","app_user"].flatMap(table=>[
      [probe,`UPDATE app.${table} SET status='ACTIVE' WHERE id=$1`,[table==='app_user'?s.adminA.userId:member]],
      [probe,`DELETE FROM app.${table} WHERE id=$1`,[table==='app_user'?s.adminA.userId:member]],
      [probe,table==='app_user'?"INSERT INTO app.app_user(id,status) VALUES($1,'ACTIVE')":"INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'ORG_ADMIN','ACTIVE')",[randomUUID(),...(table==='app_user'?[]:[s.orgA,s.noMember.userId])]],
    ] as [string,string,unknown[]][]),
    [probe,"SELECT session_epoch FROM app.app_user WHERE id=$1",[s.adminA.userId]],
    ...["version","created_at","ended_at"].map(col=>[probe,`SELECT ${col} FROM app.organization_membership WHERE id=$1`,[member]] as [string,string,unknown[]]),
  ];
  for(const [role,sql,args] of attempts) {
    await h.migration.query("BEGIN");
    try {
      await h.migration.query(`SET LOCAL ROLE ${role}`);
      await h.migration.query("SELECT set_config('app.org_id',$1,true)",[s.orgA]);
      await expect(h.migration.query(sql,args),sql).rejects.toMatchObject({code:expect.stringMatching(/^(42501|23503)$/)});
    } finally { await h.migration.query("ROLLBACK"); }
    expect(await before()).toEqual(original);
  }
  await h.migration.query("BEGIN");
  try {
    await h.migration.query(`SET LOCAL ROLE ${command}`);
    await h.migration.query("SELECT set_config('app.org_id',$1,true)",[s.orgA]);
    expect((await h.migration.query("UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp(),version=version+1 WHERE id=$1",[member])).rowCount).toBe(1);
    await expect(h.migration.query("UPDATE app.organization_membership SET status='ACTIVE',ended_at=NULL WHERE id=$1",[member])).resolves.toMatchObject({rowCount:0});
  } finally {await h.migration.query("ROLLBACK");}
  expect(await before()).toEqual(original);
  for(const role of [command,probe]) {
    await h.migration.query("BEGIN");
    try {
      await h.migration.query(`SET LOCAL ROLE ${role}`);
      await h.migration.query("SELECT set_config('app.org_id','',true)");
      expect((await h.migration.query("SELECT id FROM app.organization_membership")).rows).toEqual([]);
      if(role===command) expect((await h.migration.query("UPDATE app.organization_membership SET status='ENDED',ended_at=clock_timestamp()")).rowCount).toBe(0);
    } finally {await h.migration.query("ROLLBACK");}
  }
});

it("pins the complete restrictive policy inventory and command definition boundaries", async () => {
  const rows=(await h.p.admin.query("SELECT tablename,policyname,permissive,roles::text[] AS roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='app' AND policyname LIKE 'b5_%' ORDER BY policyname")).rows;
  const norm=(s:string|null)=>s?.replace(/[()\s]/g,"").replaceAll("::text","") ?? null;
  const org="id=app.current_org_idANDstatus='ACTIVE'", member="org_id=app.current_org_id";
  expect(rows.map(r=>[r.tablename,r.policyname,r.permissive,r.roles,r.cmd,norm(r.qual),norm(r.with_check)])).toEqual([
    ["organization_membership","b5_member_select_ceiling","RESTRICTIVE",[command],"SELECT",member,null],
    ["organization_membership","b5_member_update_ceiling","RESTRICTIVE",[command],"UPDATE",member+"ANDstatus='ACTIVE'",member+"ANDstatus='ENDED'ANDended_atISNOTNULL"],
    ["organization","b5_org_select_ceiling","RESTRICTIVE",[command],"SELECT",org,null],
    ["organization","b5_org_update_ceiling","RESTRICTIVE",[command],"UPDATE",org,org],
    ["organization_membership","b5_probe_member_ceiling","RESTRICTIVE",[probe],"SELECT",member+"ANDstatus='ACTIVE'ANDrole='ORG_ADMIN'",null],
  ]);
  const def=(await h.p.admin.query("SELECT pg_get_functiondef('authn.b5_end_organization_membership(bytea,uuid,uuid)'::regprocedure) AS def")).rows[0].def;
  expect(def).not.toMatch(/EXCEPTION\s+WHEN\s+OTHERS|\bEXECUTE\b/i);
  expect(def).toMatch(/ORDER BY m.id FOR NO KEY UPDATE/);
});

it("AC14/AC15 real probe path sees only current active admins and counts only active users", async () => {
  const s=await seedB2Scope(h);
  const second=randomUUID(),ended=randomUUID();
  const first=(await h.p.admin.query("SELECT id FROM app.organization_membership WHERE org_id=$1 AND user_id=$2",[s.orgA,s.adminA.userId])).rows[0].id;
  await h.p.admin.query("INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,'ORG_ADMIN','ACTIVE')",[second,s.orgA,s.adminB.userId]);
  await h.p.admin.query("INSERT INTO app.organization_membership(id,org_id,user_id,role,status,ended_at) VALUES($1,$2,$3,'ORG_ADMIN','ENDED',clock_timestamp())",[ended,s.orgA,s.noMember.userId]);
  const other=async(org:string,target:string)=>{
    await h.migration.query("BEGIN");
    try {
      await h.migration.query(`SET LOCAL ROLE ${command}`);
      await h.migration.query("SELECT set_config('app.org_id',$1,true)",[s.orgA]);
      return (await h.migration.query("SELECT authn.b5_has_other_effective_admin($1,$2) AS allowed",[org,target])).rows[0].allowed;
    } finally {await h.migration.query("ROLLBACK");}
  };
  expect(await other(s.orgA,first)).toBe(true);
  expect(await other(s.orgB,s.foreignMembership)).toBe(false);
  for(const status of ["SUSPENDED","DELETION_PENDING"]) {
    await h.p.admin.query("UPDATE app.app_user SET status=$1 WHERE id=$2",[status,s.adminB.userId]);
    expect(await other(s.orgA,first)).toBe(false);
  }
  await h.p.admin.query("UPDATE app.app_user SET status='ACTIVE' WHERE id=$1",[s.adminB.userId]);
  await h.p.admin.query("UPDATE app.organization_membership SET role='PROPERTY_STAFF' WHERE id=$1",[second]);
  expect(await other(s.orgA,first)).toBe(false);
  await h.migration.query("BEGIN");
  try {
    await h.migration.query(`SET LOCAL ROLE ${probe}`);
    await h.migration.query("SELECT set_config('app.org_id',$1,true)",[s.orgA]);
    expect((await h.migration.query("SELECT id FROM app.organization_membership ORDER BY id")).rows).toEqual([{id:first}]);
  } finally {await h.migration.query("ROLLBACK");}
  await h.p.admin.query("UPDATE app.organization_membership SET role='ORG_ADMIN',status='ENDED',ended_at=clock_timestamp() WHERE id=$1",[second]);
  expect(await other(s.orgA,first)).toBe(false);
});
