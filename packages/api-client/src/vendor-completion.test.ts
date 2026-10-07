import { expect,it,vi } from "vitest";
import { createCoreFlowClient } from "./core-flow";
import { createVendorJobClient } from "./vendor-job";

const id="00000000-0000-4000-8000-000000000001",appointment="00000000-0000-4000-8000-000000000002",packet="00000000-0000-4000-8000-000000000003";
const photo={photoId:id,mime:"image/png" as const,byteSize:3,width:1,height:1,createdAt:"2026-10-07T00:00:00Z"};
const input={clientRequestId:id,expectedAssignmentVersion:6,expectedPacketRevisionId:packet,expectedAppointmentId:appointment,expectedCorrectionRequestId:null};

it("uploads a Vendor completion photo as a raw body with the exact upload identity and command header",async()=>{
  const binary=vi.fn<typeof fetch>().mockResolvedValue(Response.json(photo));
  const client=createVendorJobClient(async()=>({ok:true,status:200,text:async()=>"{}"}),"http://synthetic.invalid",binary);
  const blob=new Blob(["abc"],{type:"image/png"});
  expect(await client.uploadCompletionPhoto("synthetic-csrf",input,blob)).toEqual(photo);
  const [url,init]=binary.mock.calls[0];
  const headers=new Headers(init?.headers);
  expect(url).toBe("http://synthetic.invalid/api/v2/vendor/job/completion-photos");
  expect([init?.method,init?.body,init?.credentials,init?.cache]).toEqual(["POST",blob,"same-origin","no-store"]);
  expect([headers.get("content-type"),headers.get("x-upload-id"),headers.get("x-vendor-csrf")]).toEqual(["image/png",id,"synthetic-csrf"]);
  expect(JSON.parse(headers.get("x-vendor-upload-command")!)).toEqual(input);
  expect(client.completionPhotoPath(id)).toBe(`http://synthetic.invalid/api/v2/vendor/job/completion-photos/${id}`);
});
it("keeps the HTTP status of a rejected upload and refuses a malformed response",async()=>{
  const binary=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("private",{status:413})).mockResolvedValueOnce(Response.json({photoId:"x"}));
  const client=createVendorJobClient(async()=>({ok:true,status:200,text:async()=>"{}"}),"",binary);
  const blob=new Blob(["abc"],{type:"image/png"});
  await expect(client.uploadCompletionPhoto("synthetic-csrf",input,blob)).rejects.toMatchObject({status:413});
  await expect(client.uploadCompletionPhoto("synthetic-csrf",input,blob)).rejects.toMatchObject({code:"INVALID_RESPONSE"});
});
it("reads a Manager completion photo as a bounded binary with an image MIME",async()=>{
  const transport=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("abc",{headers:{"Content-Type":"image/png"}})).mockResolvedValueOnce(new Response("abc",{headers:{"Content-Type":"text/html"}}));
  const client=createCoreFlowClient({baseUrl:"",photoFetchImpl:transport});
  expect((await client.vendorCompletionPhoto(id,appointment)).size).toBe(3);
  expect(transport.mock.calls[0][0]).toBe(`/api/v2/core/manager/tickets/${id}/vendor-completion-photos/${appointment}`);
  await expect(client.vendorCompletionPhoto(id,appointment)).rejects.toMatchObject({code:"INVALID_RESPONSE"});
});
