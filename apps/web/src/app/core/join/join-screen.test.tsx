// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,expect,it,vi } from "vitest";
import { JoinScreen } from "./join-screen";

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const token="a".repeat(64),csrf="b".repeat(64);
const invite={invitationId:"11111111-1111-4111-8111-111111111111",requestNumber:null,unitId:"22222222-2222-4222-8222-222222222222",buildingId:"33333333-3333-4333-8333-333333333333",buildingName:"합성 건물",unitLabel:"101호",state:"OPEN",createdAt:"2026-10-13T00:00:00.000Z",expiresAt:"2026-10-14T00:00:00.000Z",requestedAt:null,decidedAt:null};
const json=(body:unknown)=>new Response(JSON.stringify(body),{status:200,headers:{"content-type":"application/json"}});
let root:Root|undefined,host:HTMLDivElement,paths:string[];
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();vi.unstubAllGlobals();window.history.replaceState(null,"","/");});
async function mount(hash=""){
  paths=[];
  vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL)=>{
    const path=new URL(String(input),"http://localhost").pathname;paths.push(path);
    if(path==="/api/v2/core/access")return json({authentication:"B1",synthetic:true,csrf,organizations:[]});
    if(path==="/api/v2/core/onboarding/inspect")return json(invite);
    if(path==="/api/v2/core/onboarding/mine")return json({items:[{...invite,state:"REQUESTED"}],nextCursor:null});
    throw new Error(`unexpected request ${path}`);
  }));
  window.history.replaceState(null,"","/core/join"+hash);
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>{root!.render(<JoinScreen/>);});
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
}
const button=(label:string)=>Array.from(host.querySelectorAll("button")).find(item=>item.textContent===label);
async function click(label:string){expect(Boolean(button(label)),label).toBe(true);await act(async()=>{button(label)!.click();await new Promise(resolve=>setTimeout(resolve,0));});}

it("offers no status check without an inspected invite, so it never reads every saved request",async()=>{
  await mount();
  expect(host.textContent).toContain("초대 링크 정보가 없어요.");
  expect(button("요청 상태 확인")).toBeUndefined();
  expect(paths).toEqual(["/api/v2/core/access"]);
});

it("asks to inspect a linked invite first, without a status check that cannot name it",async()=>{
  await mount("#"+token);
  expect(Boolean(button("초대 내용 확인"))).toBe(true);
  expect(button("요청 상태 확인")).toBeUndefined();
});

it("checks the saved state of the invite it inspected",async()=>{
  await mount("#"+token);
  await click("초대 내용 확인");
  await click("요청 상태 확인");
  expect(paths).toEqual(["/api/v2/core/access","/api/v2/core/onboarding/inspect","/api/v2/core/onboarding/mine"]);
  expect(host.textContent).toContain("저장된 연결 상태를 확인했어요.");
  expect(host.textContent).toContain("연결 요청을 보냈어요");
});
