import { expect,expectTypeOf,it,vi } from "vitest";
import type { CoreTicketDto,CoreTicketOutcome,CoreOutcomeReceipt } from "@build-manager/api-contracts";
import { createCoreFlowClient } from "./core-flow";

const id="11111111-1111-4111-8111-111111111111",key="22222222-2222-4222-8222-222222222222";
const outcome:CoreTicketOutcome={ticketId:id,kind:"RESOLVED",assertedAt:"2026-10-04T00:00:00Z",followUpTicketId:null};
it("exposes typed public results and preserves the request key without automatic retries",async()=>{
 const fetcher=vi.fn().mockRejectedValueOnce(new Error("synthetic lost response")).mockResolvedValueOnce(new Response(JSON.stringify({outcome,targetTicketId:null})));
 const client=createCoreFlowClient({baseUrl:"https://synthetic.invalid",fetchImpl:fetcher});
 expectTypeOf<ReturnType<typeof client.outcome.read>>().toEqualTypeOf<Promise<CoreTicketOutcome>>();
 expectTypeOf<ReturnType<typeof client.outcome.confirmResolved>>().toEqualTypeOf<Promise<CoreTicketOutcome>>();
 expectTypeOf<ReturnType<typeof client.outcome.createFollowUp>>().toEqualTypeOf<Promise<{sourceOutcome:CoreTicketOutcome;ticket:CoreTicketDto}>>();
 expectTypeOf<ReturnType<typeof client.outcome.receipt>>().toEqualTypeOf<Promise<CoreOutcomeReceipt>>();
 expectTypeOf<ReturnType<typeof client.outcome.source>>().toEqualTypeOf<Promise<{sourceTicketId:string|null}>>();
 await expect(client.outcome.confirmResolved(id,{clientRequestId:key})).rejects.toMatchObject({code:"NETWORK_ERROR"});
 expect(fetcher).toHaveBeenCalledTimes(1);expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({clientRequestId:key});
 expect(await client.outcome.receipt(id,key)).toEqual({outcome,targetTicketId:null});expect(fetcher).toHaveBeenCalledTimes(2);
 expect(fetcher.mock.calls[1][0]).toBe(`https://synthetic.invalid/api/v2/core/tickets/${id}/outcome/requests/${key}`);expect(fetcher.mock.calls[1][1].method).toBe("GET");
});
it("does not expose private response fields or send client-owned identity/location",async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({...outcome,actorId:id}))),client=createCoreFlowClient({baseUrl:"",fetchImpl:fetcher});
 await expect(client.outcome.read(id)).rejects.toMatchObject({code:"INVALID_RESPONSE"});
 expect(()=>client.outcome.createFollowUp(id,{clientRequestId:key,claimKind:"UNRESOLVED",issueType:"LEAK",rawUserText:"새 합성 증상",unitId:id} as never)).toThrow();
 expect(fetcher).toHaveBeenCalledTimes(1);
});
