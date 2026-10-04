import { expect,it,vi } from "vitest";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import { sendFollowUp } from "./follow-up-request";
const input={clientRequestId:"11111111-1111-4111-8111-111111111111",claimKind:"UNRESOLVED" as const,issueType:"LEAK" as const,rawUserText:"새 합성 설명"};
const fixture=()=>{const read=vi.fn().mockResolvedValue({ticketId:"exact-target"}),receipt=vi.fn(),createFollowUp=vi.fn().mockResolvedValue({ticket:{ticketId:"exact-target"}});return {client:{read,outcome:{receipt,createFollowUp}} as unknown as CoreFlowClient,read,receipt,createFollowUp};};
it("uses the atomic endpoint once, then recovers the exact committed target without another write",async()=>{
 const f=fixture();expect(await sendFollowUp(f.client,"source",input,false)).toEqual({ticketId:"exact-target"});f.receipt.mockResolvedValue({targetTicketId:"exact-target"});expect(await sendFollowUp(f.client,"source",input,true)).toEqual({ticketId:"exact-target"});expect(f.createFollowUp).toHaveBeenCalledExactlyOnceWith("source",input);expect(f.read).toHaveBeenCalledWith("exact-target");
});
it("retries only the original key and payload after an explicit receipt miss",async()=>{
 const f=fixture();f.receipt.mockRejectedValue(new ApiClientError("NOT_FOUND","missing",{status:404}));await sendFollowUp(f.client,"source",input,true);expect(f.createFollowUp).toHaveBeenCalledExactlyOnceWith("source",input);
});
it.each([401,403,503])("never writes when receipt verification fails with %i",async status=>{
 const f=fixture();f.receipt.mockRejectedValue(new ApiClientError("UNAVAILABLE","denied",{status}));await expect(sendFollowUp(f.client,"source",input,true)).rejects.toMatchObject({status});expect(f.createFollowUp).not.toHaveBeenCalled();expect(f.read).not.toHaveBeenCalled();
});
it("does not re-submit a committed request when its target is no longer readable",async()=>{
 const f=fixture();f.receipt.mockResolvedValue({targetTicketId:"exact-target"});f.read.mockRejectedValue(new ApiClientError("NOT_FOUND","hidden",{status:404}));await expect(sendFollowUp(f.client,"source",input,true)).rejects.toMatchObject({status:404});expect(f.createFollowUp).not.toHaveBeenCalled();
});
