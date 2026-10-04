import { expect,it } from "vitest";
import { CoreCommunicationSendSchema,CoreCommunicationPageSchema,CorePublicMessageSchema } from "./core-ticket-communication";
const base={clientRequestId:"12345678-1234-4234-8234-123456789abc",expectedVersion:0,intent:"TENANT_MESSAGE",body:"합성 문답"};
it("normalizes bounded multiline plain text and rejects control/format or identity input",()=>{
  expect(CoreCommunicationSendSchema.parse({...base,body:"  합성\r\n문답  "}).body).toBe("합성\r\n문답");
  for(const body of [" ","x".repeat(2001),"a\tb","a\u200bb","a\u0001b"])expect(CoreCommunicationSendSchema.safeParse({...base,body}).success).toBe(false);
  for(const extra of [{actorId:"x"},{orgId:"x"},{visibility:"PUBLIC"},{replyToMessageId:base.clientRequestId},{expectedVersion:-1}])expect(CoreCommunicationSendSchema.safeParse({...base,...extra}).success).toBe(false);
  expect(CoreCommunicationSendSchema.safeParse({...base,body:"x".repeat(2000)}).success).toBe(true);
});
it("permits version zero and rejects private or exact-role fields at all public DTO levels",()=>{
  const page={version:0,waitingFor:"NONE",readOnly:false,messages:[],nextBeforeSequence:null};expect(CoreCommunicationPageSchema.parse(page)).toEqual(page);
  for(const field of ["internalNotes","noteCount","priority","assigneeLabel","actorId"])expect(CoreCommunicationPageSchema.safeParse({...page,[field]:null}).success).toBe(false);
  const message={id:base.clientRequestId,sequence:1,intent:"MANAGER_UPDATE",authorRole:"MANAGER",body:base.body,replyToMessageId:null,createdAt:"2026-10-04T00:00:00Z"};expect(CorePublicMessageSchema.safeParse(message).success).toBe(true);
  expect(CorePublicMessageSchema.safeParse({...message,authorRole:"ORG_ADMIN"}).success).toBe(false);expect(CorePublicMessageSchema.safeParse({...message,actorId:base.clientRequestId}).success).toBe(false);
});
