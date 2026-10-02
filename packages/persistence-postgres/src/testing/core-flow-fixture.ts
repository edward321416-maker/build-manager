import { randomBytes, randomUUID, createHash } from "node:crypto";
import type { Client } from "pg";

export type CoreFixture = {
  orgA:string;orgB:string;propertyA:string;propertyB:string;unitA:string;unitOther:string;unitB:string;
  accounts:Record<string,{handle:string;digest:string;userId:string;orgId:string;membershipId?:string}>;
};
/** Explicit synthetic setup only, never imported by an application/runtime route. */
export async function seedCoreFlowFixture(admin:Client,login:Client):Promise<CoreFixture> {
  const marker=(await admin.query("SELECT pg_catalog.shobj_description(oid,'pg_database') AS marker FROM pg_catalog.pg_database WHERE datname=current_database()")).rows[0].marker;
  if(marker!=="CORE_FLOW_SYNTHETIC_LOCAL")throw new Error("CORE_FIXTURE_MARKER_REQUIRED");
  const orgA=randomUUID(),orgB=randomUUID(),propertyA=randomUUID(),propertyB=randomUUID(),unitA=randomUUID(),unitOther=randomUUID(),unitB=randomUUID();
  for(const [org,property,units] of [[orgA,propertyA,[unitA,unitOther]],[orgB,propertyB,[unitB]]] as const){
    await admin.query("INSERT INTO app.organization(id,display_name,status) VALUES($1,'RC1 합성 개발 조직','ACTIVE')",[org]);
    await admin.query("INSERT INTO app.property(id,org_id,status) VALUES($1,$2,'ACTIVE')",[property,org]);
    for(const [i,id] of units.entries())await admin.query("INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,$4,'ACTIVE')",[id,org,property,`합성 호실 ${i+1}`]);
    const at=new Date().toISOString();
    const body={id:property,displayName:org===orgA?"RC1 합성 건물 A":"RC1 합성 건물 B",demo:true,sourceNativeIds:{},context:[
      {key:"primaryUse",value:"합성 공동주택",sourceType:"FIXTURE_OFFICIAL",verified:false,routingEligible:false,updatedAt:at},
      {key:"approvalYear",value:"2020",sourceType:"FIXTURE_OFFICIAL",verified:false,routingEligible:false,updatedAt:at},
      {key:"heatingType",value:"INDIVIDUAL",sourceType:"OWNER_VERIFIED",verified:true,routingEligible:true,updatedAt:at},
      {key:"managementMode",value:"OWNER_DIRECT",sourceType:"OWNER_VERIFIED",verified:true,routingEligible:true,updatedAt:at},
    ]};
    await admin.query("INSERT INTO core_flow.building_context(org_id,property_id,body) VALUES($1,$2,$3)",[org,property,JSON.stringify(body)]);
  }
  const accounts:CoreFixture["accounts"]={};
  for(const [name,org,unit,role] of [
    ["tenant",orgA,unitA,null],["tenantPeer",orgA,unitA,null],["tenantOther",orgA,unitOther,null],
    ["manager",orgA,null,"ORG_ADMIN"],["staff",orgA,null,"PROPERTY_STAFF"],
    ["otherTenant",orgB,unitB,null],["otherManager",orgB,null,"ORG_ADMIN"],
  ] as const){
    const handle=randomBytes(32).toString("hex"),digest=createHash("sha256").update(handle).digest("hex");
    const userId=(await login.query("SELECT authn.begin_session($1,$2,$3,clock_timestamp()+interval '55 minutes') AS id",["https://rc1.synthetic.invalid/",`synthetic-${name}-${randomUUID()}`,Buffer.from(digest,"hex")])).rows[0].id as string;
    accounts[name]={handle,digest,userId,orgId:org};
    if(role){
      const member=randomUUID();accounts[name].membershipId=member;
      await admin.query("INSERT INTO app.organization_membership(id,org_id,user_id,role,status) VALUES($1,$2,$3,$4,'ACTIVE')",[member,org,userId,role]);
      if(role==="PROPERTY_STAFF")await admin.query("INSERT INTO app.property_assignment(org_id,membership_id,property_id,status) VALUES($1,$2,$3,'ACTIVE')",[org,member,propertyA]);
    }else{
      let occ=(await admin.query("SELECT id FROM app.occupancy WHERE org_id=$1 AND unit_id=$2 AND status='ACTIVE'",[org,unit])).rows[0]?.id;
      if(!occ){occ=randomUUID();await admin.query("INSERT INTO app.occupancy(id,org_id,unit_id,starts_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '1 minute','ACTIVE')",[occ,org,unit]);}
      await admin.query("INSERT INTO app.occupancy_member(org_id,occupancy_id,user_id,joined_at,status) VALUES($1,$2,$3,clock_timestamp()-interval '1 minute','ACTIVE')",[org,occ,userId]);
    }
    await admin.query("INSERT INTO core_flow.session_scope(digest,org_id) VALUES($1,$2)",[Buffer.from(digest,"hex"),org]);
  }
  return {orgA,orgB,propertyA,propertyB,unitA,unitOther,unitB,accounts};
}
