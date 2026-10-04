import { randomUUID } from "node:crypto";
import { expect,it } from "vitest";
import { CoreMaintenanceFactCreateSchema,CoreMaintenanceFactCorrectionSchema,CoreUnitMaintenanceFactSchema } from "./core-maintenance-fact";
const input={clientRequestId:randomUUID(),actionKind:"REPAIR",componentLabel:"합성 순환펌프"};
it("accepts the five reviewed actions and normalizes only the component label",()=>{
 for(const actionKind of ["INSPECTION","REPAIR","PART_REPLACEMENT","ADJUSTMENT","OTHER"])
  expect(CoreMaintenanceFactCreateSchema.parse({...input,actionKind,componentLabel:"  합성 밸브  "})).toEqual({...input,actionKind,componentLabel:"합성 밸브"});
 expect(CoreMaintenanceFactCreateSchema.parse({...input,componentLabel:null})).toEqual({...input,componentLabel:null});
});
it.each([{actionKind:"REPLACE"},{componentLabel:" "},{componentLabel:"x".repeat(81)},{componentLabel:"a\u200bb"},{componentLabel:"a\nb"},{tenantId:randomUUID()},{sourceCompletedAt:"2026-10-04T00:00:00Z"},{componentLabel:undefined}])("rejects unsafe or unapproved create fields %j",change=>{
 expect(CoreMaintenanceFactCreateSchema.safeParse({...input,...change}).success).toBe(false);
});
it("requires explicit correction target and the exact reason enum",()=>{
 const correction={...input,expectedCurrentFactId:randomUUID(),correctionReason:"COMPONENT_LABEL"};
 expect(CoreMaintenanceFactCorrectionSchema.parse(correction)).toEqual(correction);
 for(const change of [{expectedCurrentFactId:undefined},{correctionReason:"MISTAKE"},{sourceTicketId:randomUUID()}])
  expect(CoreMaintenanceFactCorrectionSchema.safeParse({...correction,...change}).success).toBe(false);
});
it("accepts only the manager fact projection and rejects person-linked or work details",()=>{
 const fact={factId:randomUUID(),unitId:randomUUID(),buildingId:randomUUID(),buildingName:"합성 건물",unitLabel:"합성 호실",sourceTicketId:randomUUID(),issueType:"HEATING",actionKind:"REPAIR",componentLabel:null,sourceCompletedAt:"2026-10-04T00:00:00Z",recordedAt:"2026-10-04T01:00:00Z",corrected:false,correctionCount:0,tenantOutcome:"UNCONFIRMED",previousTicketId:null,followUpTicketId:null};
 expect(CoreUnitMaintenanceFactSchema.parse(fact)).toEqual(fact);
 for(const key of ["tenantId","actorId","rawUserText","message","photo","internalNote","priority","assigneeLabel","dueAt","recordedBy"])
  expect(CoreUnitMaintenanceFactSchema.safeParse({...fact,[key]:"PRIVATE"}).success).toBe(false);
});
