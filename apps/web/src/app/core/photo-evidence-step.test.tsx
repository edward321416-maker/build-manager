// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import type { CorePhotoDto,SyntheticEvidenceRequirementDto } from "@build-manager/api-contracts";
import { PhotoEvidenceStep } from "./photo-evidence-step";

// P1b PR 2: the tenant names one of the ticket's own photos as each required evidence (spec D1-D6).
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const ticketId="5f0c3e9a-1b2c-4d3e-8f4a-5b6c7d8e9f01";
const id=(n:number,prefix="0")=>`${prefix.repeat(8)}-0000-4000-8000-${String(n).padStart(12,"0")}`;
const photo=(n:number,uploadId=id(n,"a")):CorePhotoDto=>({photoId:id(n),uploadId,createdAt:"2026-10-11T03:00:00.000Z",mime:"image/png",byteSize:100,width:4,height:3,path:`/api/v2/core/tickets/${ticketId}/photos/${id(n)}`});
const requirement:SyntheticEvidenceRequirementDto={evidenceType:"LEAK_LOCATION",label:"DEMO 누수 위치 이미지",required:true,demoFixtureId:"demo-leak-location",instruction:"안전한 거리에서 누수 부위와 주변 위치가 함께 보이도록 촬영해 주세요."};

type Props=Parameters<typeof PhotoEvidenceStep>[0];
let root:Root|undefined,host:HTMLDivElement,props:Props;
let stored:CorePhotoDto[];
const calls={choose:vi.fn(),without:vi.fn(),changed:vi.fn()};
function fake(overrides:Partial<Record<"photos"|"uploadPhoto"|"readPhoto",(...args:never[])=>Promise<unknown>>>={}){
  const api={
    photos:vi.fn(overrides.photos??(async()=>stored)),
    readPhoto:vi.fn(overrides.readPhoto??(async()=>new Blob(["x"],{type:"image/png"}))),
    uploadPhoto:vi.fn(overrides.uploadPhoto??(async(_ticket:string,uploadId:string)=>{const added=photo(stored.length+1,uploadId);stored=[...stored,added];return added;})),
  };
  return {api,client:api as unknown as CoreFlowClient};
}
beforeEach(()=>{
  stored=[photo(1),photo(2)];calls.choose.mockReset();calls.without.mockReset();calls.changed.mockReset();
  Object.assign(URL,{createObjectURL:vi.fn(()=>"blob:synthetic"),revokeObjectURL:vi.fn()});
});
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();document.body.replaceChildren();});
async function flush(){await act(async()=>{for(let i=0;i<20;i++)await Promise.resolve();});}
async function render(changes:Partial<Props>={}){
  props={...props,...changes};
  await act(async()=>{root!.render(<PhotoEvidenceStep {...props}/>);});await flush();
}
async function mount(client:CoreFlowClient,changes:Partial<Props>={}){
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  props={client,ticketId,requirement,named:[],revision:0,busy:false,onChoose:calls.choose,onSubmitWithout:calls.without,onPhotosChanged:calls.changed};
  await render(changes);
}
const text=()=>host.textContent??"";
const button=(label:string)=>Array.from(host.querySelectorAll("button")).find(item=>item.textContent===label);
const radios=()=>Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
const fileInput=()=>host.querySelector<HTMLInputElement>('input[type="file"]')!;
async function click(element:HTMLElement|undefined){expect(element).toBeDefined();await act(async()=>{element!.click();});await flush();}
async function choose(files:File[]){
  const input=fileInput();Object.defineProperty(input,"files",{value:files,configurable:true});
  await act(async()=>{input.dispatchEvent(new Event("change",{bubbles:true}));});await flush();
}
const png=(bytes=10)=>new File([new Uint8Array(bytes)],"synthetic.png",{type:"image/png"});

describe("PhotoEvidenceStep",()=>{
  it("asks for the requirement with the protocol's own instruction and lists the stored photos as choices",async()=>{
    await mount(fake().client);
    expect(host.querySelector("h2")?.textContent).toBe("누수 부위가 보이는 사진을 골라 주세요");
    expect(text()).toContain(requirement.instruction);
    expect(radios().map(radio=>radio.closest("label")?.textContent)).toEqual(["사진 1","사진 2"]);
    // The radio is named by its caption only; the photo keeps its own alt text (an e2e found "올린 사진 1 사진 1").
    expect(radios().map(radio=>document.getElementById(radio.getAttribute("aria-labelledby")??"")?.textContent)).toEqual(["사진 1","사진 2"]);
    expect(Array.from(host.querySelectorAll("img")).map(img=>img.alt)).toEqual(["올린 사진 1","올린 사진 2"]);
    const primary=button("이 사진으로 정하기")!;
    expect(primary.disabled).toBe(true);
    expect(document.getElementById(primary.getAttribute("aria-describedby")!)?.textContent).toBe("사진을 하나 골라 주세요.");
  });

  it("names the photo the tenant picked",async()=>{
    await mount(fake().client);
    await click(radios()[1]);
    expect(button("이 사진으로 정하기")!.disabled).toBe(false);
    await click(button("이 사진으로 정하기"));
    expect(calls.choose).toHaveBeenCalledWith(id(2));
  });

  it("adds a photo in place, refreshes the screen's photos and picks the new one",async()=>{
    const {api,client}=fake();await mount(client);
    await choose([png()]);
    expect(api.uploadPhoto).toHaveBeenCalledTimes(1);
    const [ticket,uploadId,file]=api.uploadPhoto.mock.calls[0]! as unknown as [string,string,File];
    expect([ticket,file.name]).toEqual([ticketId,"synthetic.png"]);expect(uploadId).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls.changed).toHaveBeenCalledTimes(1);
    expect(radios().map(radio=>radio.checked)).toEqual([false,false,true]);
    await click(button("이 사진으로 정하기"));
    expect(calls.choose).toHaveBeenCalledWith(id(3));
  });

  it("offers a retry with the same upload id after a connection failure, and does not send it twice when the photo was stored after all",async()=>{
    let attempts=0;
    const {api,client}=fake({uploadPhoto:async(_ticket:string,uploadId:string)=>{attempts++;stored=[...stored,photo(3,uploadId)];throw new ApiClientError("NETWORK_ERROR","사진 연결을 확인하지 못했습니다.");}});
    await mount(client);
    await choose([png()]);
    expect(host.querySelector('[role="alert"] p')?.textContent).toBe("사진을 올리지 못했어요. 연결을 확인하고 다시 올려 주세요.");
    const firstUploadId=(api.uploadPhoto.mock.calls[0] as unknown as [string,string])[1];
    await click(button("다시 올리기"));
    expect(attempts).toBe(1);
    expect(api.photos.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(stored.at(-1)!.uploadId).toBe(firstUploadId);
    expect(radios().map(radio=>radio.checked)).toEqual([false,false,true]);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it.each([
    [413,"사진 용량이나 화소가 한도를 넘어요. 5MiB·2천만 화소 이하 사진을 골라 주세요."],
    [415,"읽을 수 있는 JPEG·PNG 사진을 골라 주세요."],
    [409,"사진을 더 올릴 수 없어요. 사진은 최대 3장이고, 처리가 끝난 접수에는 올릴 수 없어요."],
  ])("explains a %i refusal without offering a retry that cannot work",async(status,message)=>{
    const {api,client}=fake({uploadPhoto:async()=>{throw new ApiClientError("PHOTO_ERROR","사진 요청을 처리하지 못했습니다.",{status});}});
    await mount(client);
    await choose([png()]);
    expect(host.querySelector('[role="alert"] p')?.textContent).toBe(message);
    expect(button("다시 올리기")).toBeUndefined();
    expect(api.uploadPhoto).toHaveBeenCalledTimes(1);
  });

  it("reads the stored photos again after a 409, so a stale list does not keep offering to add",async()=>{
    const {api,client}=fake({uploadPhoto:async()=>{stored=[photo(1),photo(2),photo(3)];throw new ApiClientError("PHOTO_ERROR","사진 요청을 처리하지 못했습니다.",{status:409});}});
    await mount(client);
    expect(fileInput().disabled).toBe(false);
    await choose([png()]);
    expect(api.photos).toHaveBeenCalledTimes(3);
    expect(radios()).toHaveLength(3);
    expect(fileInput().disabled).toBe(true);
  });

  it("refuses a file that is not a JPEG or PNG or is too large, without sending it",async()=>{
    const {api,client}=fake();await mount(client);
    await choose([new File(["x"],"note.gif",{type:"image/gif"})]);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("JPEG·PNG 사진만 올릴 수 있어요. 한 장당 5MiB 이하예요.");
    await choose([png(5*1024*1024+1)]);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("JPEG·PNG 사진만 올릴 수 있어요. 한 장당 5MiB 이하예요.");
    expect(api.uploadPhoto).not.toHaveBeenCalled();
  });

  it("stops adding at three photos and says to pick from them",async()=>{
    stored=[photo(1),photo(2),photo(3)];
    await mount(fake().client);
    expect(fileInput().disabled).toBe(true);
    expect(text()).toContain("한 접수에 사진은 최대 3장이에요. 올린 사진 중에서 골라 주세요.");
  });

  it("asks for a first photo when none is stored yet",async()=>{
    stored=[];
    await mount(fake().client);
    expect(radios()).toHaveLength(0);
    expect(text()).toContain("아직 올린 사진이 없어요. '사진 추가하기'로 올려 주세요.");
    expect(button("이 사진으로 정하기")!.disabled).toBe(true);
  });

  it("offers 사진 없이 제출하기 as a text button (spec D6)",async()=>{
    await mount(fake().client);
    await click(button("사진 없이 제출하기"));
    expect(calls.without).toHaveBeenCalledTimes(1);
    expect(text()).toContain("사진 없이 보내도 접수돼요.");
  });

  it("shows which evidence a photo already names",async()=>{
    await mount(fake().client,{named:[{evidenceId:"evidence-1",evidenceType:"FIXTURE_VIEW",label:"DEMO 세대 설비 화면 이미지",photoId:id(1)}]});
    expect(radios().map(radio=>radio.closest("label")?.textContent)).toEqual(["사진 1 · 관련 기기 사진","사진 2"]);
  });

  it("locks every action, a chosen photo included, while the intake is saving",async()=>{
    await mount(fake().client);
    await click(radios()[0]);
    expect(button("이 사진으로 정하기")!.disabled).toBe(false);
    await render({busy:true});
    expect(button("이 사진으로 정하기")!.disabled).toBe(true);
    expect(button("사진 없이 제출하기")!.disabled).toBe(true);
    expect(fileInput().disabled).toBe(true);
    expect(radios().every(radio=>radio.disabled)).toBe(true);
    expect(radios()[0]!.checked).toBe(true);
  });

  it("continues from its heading when the control that led here is gone",async()=>{
    await mount(fake().client);
    expect(document.activeElement).toBe(host.querySelector("h2"));
  });

  it("leaves focus alone when the tenant is working elsewhere on the screen",async()=>{
    const elsewhere=document.createElement("input");document.body.append(elsewhere);elsewhere.focus();
    await mount(fake().client);
    expect(document.activeElement).toBe(elsewhere);
  });

  it("says when the stored photos cannot be read and reads them again on request",async()=>{
    let fail=true;
    const {api,client}=fake({photos:async()=>{if(fail)throw new ApiClientError("PHOTO_ERROR","사진 요청을 처리하지 못했습니다.",{status:500});return stored;}});
    await mount(client);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("올린 사진을 불러오지 못했어요.");
    fail=false;await click(button("사진 다시 불러오기"));
    expect(api.photos).toHaveBeenCalledTimes(2);
    expect(radios()).toHaveLength(2);
  });
});
