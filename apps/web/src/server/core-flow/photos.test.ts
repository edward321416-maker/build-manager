import { describe,it,expect,vi } from "vitest";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { CoreFlowError,type CoreFlowPort,type CoreScope } from "@build-manager/application";
import { normalizePhoto } from "./photos";
import { handleCoreFlow } from "./http";
const png=()=>sharp({create:{width:80,height:40,channels:3,background:"#16846b"}}).png().toBuffer();
const request=(bytes:Uint8Array,mime="image/png",length?:string)=>new Request("http://local.invalid",{method:"POST",headers:{"Content-Type":mime,...(length?{"Content-Length":length}:{})},body:new Uint8Array(bytes).buffer});
describe("photo decoding boundary",()=>{
  it("decodes PNG and JPEG, strips EXIF/GPS and applies orientation to pixels",async()=>{
    const input=await sharp(await png()).jpeg().withMetadata({orientation:6}).withExif({IFD0:{Artist:"SYNTHETIC_TEST"},IFD3:{GPSLatitudeRef:"N",GPSLatitude:"1/1 2/1 3/1"}}).toBuffer();
    const original=await sharp(input).metadata();expect(original.exif).toBeDefined();expect(original.orientation).toBe(6);
    const out=await normalizePhoto(request(input,"image/jpeg")),meta=await sharp(out.bytes).metadata();
    expect([out.width,out.height]).toEqual([40,80]);expect(meta.orientation).toBeUndefined();expect(meta.exif).toBeUndefined();expect(meta.icc).toBeUndefined();expect(meta.xmp).toBeUndefined();
    expect(Buffer.from(out.bytes)).not.toEqual(input);expect((await normalizePhoto(request(await png()))).mime).toBe("image/png");
  });
  it("rejects unsupported MIME, forged magic, mismatch, broken decoding and empty input",async()=>{
    for(const [bytes,mime,status] of [[await png(),"image/svg+xml",415],[Buffer.from("not an image"),"image/png",415],[await png(),"image/jpeg",415],[Buffer.from([137,80,78,71,13,10,26,10]),"image/png",400],[Buffer.alloc(0),"image/png",400]] as const)
      await expect(normalizePhoto(request(bytes,mime))).rejects.toMatchObject({status});
  });
  it("bounds received bytes even with a missing or false Content-Length",async()=>{
    for(const length of [undefined,"1"])await expect(normalizePhoto(request(Buffer.alloc(5*1024*1024+1),"image/png",length))).rejects.toMatchObject({status:413});
  });
  it("rejects compressed images exceeding 20 megapixels",async()=>{
    const bytes=await sharp({create:{width:4500,height:4500,channels:3,background:"white"}}).png().toBuffer();expect(bytes.length).toBeLessThan(5*1024*1024);
    await expect(normalizePhoto(request(bytes))).rejects.toMatchObject({status:413});
  });
});
describe("photo HTTP transaction/authentication boundary",()=>{
  const ticket=randomUUID(),upload=randomUUID(),url=`http://127.0.0.1:3130/api/v2/core/tickets/${ticket}/photos`;
  const headers={Authorization:`Bearer ${"a".repeat(64)}`,"Content-Type":"image/png","X-Upload-Id":upload};
  it("finishes preflight before decoding, rechecks in a new transaction and maps idempotent responses",async()=>{
    const bytes=await png(),metadata={photoId:randomUUID(),uploadId:upload,createdAt:new Date().toISOString(),mime:"image/png",byteSize:bytes.length,width:80,height:40};
    let transactions=0,active=false,created=true;
    const checkPhotoWrite=vi.fn(async()=>{expect(active).toBe(true);});
    const savePhoto=vi.fn(async()=>{expect(active).toBe(true);expect(transactions).toBe(2);return{photo:metadata,created};});
    const port={run:async(_hash,op)=>{transactions++;active=true;try{return await op({checkPhotoWrite,savePhoto} as unknown as CoreScope);}finally{active=false;}}} satisfies CoreFlowPort;
    for(const expected of [201,200]){transactions=0;const r=new Request(url,{method:"POST",headers,body:new Uint8Array(bytes).buffer});const body=r.body!;
      Object.defineProperty(r,"body",{get(){expect(active).toBe(false);expect(transactions).toBe(1);return body;}});
      const response=await handleCoreFlow(r,["tickets",ticket,"photos"],()=>({port,revoke:vi.fn(),origins:[]}));expect(response.status).toBe(expected);expect(response.headers.get("cache-control")).toBe("private, no-store");expect((await response.json()).path).toBe(`/api/v2/core/tickets/${ticket}/photos/${metadata.photoId}`);created=false;
    }
    expect(checkPhotoWrite).toHaveBeenCalledTimes(2);expect(savePhoto).toHaveBeenCalledTimes(2);
  });
  it("rejects missing session before decoding and sanitizes write conflicts",async()=>{
    const run=vi.fn().mockRejectedValue(new CoreFlowError("STATE_CONFLICT")),deps={port:{run},revoke:vi.fn(),origins:[]};
    expect((await handleCoreFlow(new Request(url),["tickets",ticket,"photos"],()=>deps)).status).toBe(401);expect(run).not.toHaveBeenCalled();
    const r=await handleCoreFlow(new Request(url,{method:"POST",headers,body:"invalid"}),["tickets",ticket,"photos"],()=>deps);expect(r.status).toBe(409);expect(await r.text()).not.toContain("stack");expect(run).toHaveBeenCalledTimes(1);
  });
});
