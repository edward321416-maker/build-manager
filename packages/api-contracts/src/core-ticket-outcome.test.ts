import { expect,it } from "vitest";
import { CoreTicketOutcomeSchema,CoreConfirmResolvedSchema,CoreCreateFollowUpSchema,CoreOutcomeReceiptSchema,CoreFollowUpSourceSchema } from "./core-ticket-outcome";
const id="11111111-1111-4111-8111-111111111111",key="22222222-2222-4222-8222-222222222222";
it("accepts separate public outcome kinds and rejects identity and internal work fields",()=>{
 for(const kind of ["UNCONFIRMED","RESOLVED","UNRESOLVED","RECURRENCE_CLAIM"]){const value={ticketId:id,kind,assertedAt:kind==="UNCONFIRMED"?null:"2026-10-04T00:00:00Z",followUpTicketId:kind==="UNRESOLVED"||kind==="RECURRENCE_CLAIM"?key:null};expect(CoreTicketOutcomeSchema.safeParse(value).success).toBe(true);for(const field of ["actorId","tenantId","priority","assigneeLabel","dueAt","internalNotes","provenance"])expect(CoreTicketOutcomeSchema.safeParse({...value,[field]:"private"}).success).toBe(false);}
});
it("requires fresh bounded text and only the server-owned location and identity",()=>{
 const valid={clientRequestId:key,claimKind:"UNRESOLVED",issueType:"HEATING",rawUserText:"새 합성 설명"};expect(CoreCreateFollowUpSchema.parse({...valid,rawUserText:" 새 합성 설명 "})).toEqual(valid);
 for(const field of ["actorId","unitId","orgId","targetTicketId","sourceTicketId","answers","photos","messages","relatedTicketId"])expect(CoreCreateFollowUpSchema.safeParse({...valid,[field]:id}).success).toBe(false);
 for(const rawUserText of [" ","x".repeat(2001),"a\u0001b","a\u200bb"])expect(CoreCreateFollowUpSchema.safeParse({...valid,rawUserText}).success).toBe(false);
 expect(CoreCreateFollowUpSchema.safeParse({...valid,rawUserText:"<b>합성</b>\n새 줄"}).success).toBe(true);
 for(const claimKind of ["RESOLVED","UNCONFIRMED","RECURRENCE_CONFIRMED"])expect(CoreCreateFollowUpSchema.safeParse({...valid,claimKind}).success).toBe(false);
});
it("bounds confirmation, receipt and neutral source navigation",()=>{
 expect(CoreConfirmResolvedSchema.parse({clientRequestId:key})).toEqual({clientRequestId:key});expect(CoreConfirmResolvedSchema.safeParse({clientRequestId:key,actorId:id}).success).toBe(false);
 expect(CoreFollowUpSourceSchema.parse({sourceTicketId:id})).toEqual({sourceTicketId:id});expect(CoreFollowUpSourceSchema.safeParse({sourceTicketId:id,sourceBody:"old"}).success).toBe(false);
 const receipt={outcome:{ticketId:id,kind:"RESOLVED",assertedAt:"2026-10-04T00:00:00Z",followUpTicketId:null},targetTicketId:null};expect(CoreOutcomeReceiptSchema.safeParse(receipt).success).toBe(true);expect(CoreOutcomeReceiptSchema.safeParse({...receipt,requestText:"draft"}).success).toBe(false);
});
