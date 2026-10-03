import { it,expect,vi } from "vitest";
import { createCoreFlowClient } from "./core-flow";
const id="00000000-0000-4000-8000-000000000001",photo={photoId:id,uploadId:id,createdAt:"2026-10-03T00:00:00Z",mime:"image/png" as const,byteSize:3,width:1,height:1,path:`/api/v2/core/tickets/${id}/photos/${id}`};
it("uses a raw bounded photo body and bearer header, never JSON/base64 or URL credentials",async()=>{
  const transport=vi.fn<typeof fetch>().mockResolvedValue(Response.json(photo,{status:201}));
  const c=createCoreFlowClient({baseUrl:"http://synthetic.invalid",accessCode:"synthetic-bearer",photoFetchImpl:transport}),blob=new Blob(["abc"],{type:"image/png"});
  expect(await c.uploadPhoto(id,id,blob)).toEqual(photo);
  const [url,init]=transport.mock.calls[0];expect(url).toBe(`http://synthetic.invalid/api/v2/core/tickets/${id}/photos`);expect(init?.body).toBe(blob);expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic-bearer");expect(new Headers(init?.headers).get("x-upload-id")).toBe(id);expect(init?.cache).toBe("no-store");
  expect(c.photoSource(photo)).toEqual({uri:`http://synthetic.invalid${photo.path}`,headers:{Authorization:"Bearer synthetic-bearer"},cache:"reload"});
});
it("preserves cookie mode, validates metadata and sanitizes rejected responses without retry",async()=>{
  const transport=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json([photo])).mockResolvedValueOnce(new Response("private response",{status:403})).mockResolvedValueOnce(Response.json({privateInput:"not retained"}));
  const c=createCoreFlowClient({baseUrl:"",photoFetchImpl:transport});expect(await c.photos(id)).toEqual([photo]);expect(new Headers(transport.mock.calls[0][1]?.headers).has("authorization")).toBe(false);
  await expect(c.readPhoto(photo)).rejects.toMatchObject({status:403,message:"사진 요청을 처리하지 못했습니다."});await expect(c.photos(id)).rejects.toMatchObject({code:"INVALID_RESPONSE"});expect(transport).toHaveBeenCalledTimes(3);
});
it("checks protected binary MIME and exact size",async()=>{
  const transport=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("abc",{headers:{"Content-Type":"image/png"}})).mockResolvedValueOnce(new Response("abc",{headers:{"Content-Type":"text/html"}})).mockResolvedValueOnce(new Response("a",{headers:{"Content-Type":"image/png"}}));
  const c=createCoreFlowClient({baseUrl:"",photoFetchImpl:transport});expect((await c.readPhoto(photo)).size).toBe(3);await expect(c.readPhoto(photo)).rejects.toMatchObject({code:"INVALID_RESPONSE"});await expect(c.readPhoto(photo)).rejects.toMatchObject({code:"INVALID_RESPONSE"});
});
