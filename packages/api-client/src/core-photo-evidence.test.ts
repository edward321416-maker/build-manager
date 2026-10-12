import { it,expect,vi } from "vitest";
import { createCoreFlowClient } from "./core-flow";
// P1b: the tenant names one of the ticket's photos as required evidence; only a public type and a photo ID leave the client.
const ticketId="00000000-0000-4000-8000-000000000001",photoId="00000000-0000-4000-8000-000000000002";
it("posts one public evidence type and photo ID to the ticket's evidence path and checks the reply",async()=>{
  const transport=vi.fn<typeof fetch>().mockResolvedValue(Response.json({unexpected:true}));
  const c=createCoreFlowClient({baseUrl:"http://synthetic.invalid",accessCode:"synthetic-bearer",fetchImpl:transport});
  await expect(c.submitPhotoEvidence(ticketId,{evidenceType:"LEAK_LOCATION",photoId})).rejects.toMatchObject({code:"INVALID_RESPONSE"});
  const [url,init]=transport.mock.calls[0]!;
  expect(url).toBe(`http://synthetic.invalid/api/v2/core/tickets/${ticketId}/evidence`);
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({evidenceType:"LEAK_LOCATION",photoId});
});
it("refuses a storage reference before sending anything",async()=>{
  const transport=vi.fn<typeof fetch>();
  const c=createCoreFlowClient({baseUrl:"",fetchImpl:transport});
  await expect(c.submitPhotoEvidence(ticketId,{evidenceType:"LEAK_LOCATION",photoId:`core-photo:${photoId}`})).rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
});
