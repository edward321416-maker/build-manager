// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,expect,it,vi } from "vitest";
import { JoinScreen } from "./join-screen";

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const token="a".repeat(64),csrf="b".repeat(64),requestNumber="44444444-4444-4444-8444-444444444444";
const invite={invitationId:"11111111-1111-4111-8111-111111111111",requestNumber:null as string|null,unitId:"22222222-2222-4222-8222-222222222222",buildingId:"33333333-3333-4333-8333-333333333333",buildingName:"합성 건물",unitLabel:"101호",state:"OPEN",createdAt:"2026-10-13T00:00:00.000Z",expiresAt:"2026-10-14T00:00:00.000Z",requestedAt:null as string|null,decidedAt:null as string|null};
const requested={...invite,state:"REQUESTED",requestNumber,requestedAt:"2026-10-13T01:00:00.000Z"};
const decoy={...invite,invitationId:"55555555-5555-4555-8555-555555555555",unitLabel:"102호",state:"REQUESTED",requestNumber:"66666666-6666-4666-8666-666666666666",requestedAt:"2026-10-13T01:00:00.000Z"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
type Call={path:string;query:string;body:Record<string,unknown>|null;csrf:string|null};
type Route=(call:Call)=>Response|Promise<Response>|undefined;
let root:Root|undefined,host:HTMLDivElement,calls:Call[];
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();vi.unstubAllGlobals();window.history.replaceState(null,"","/");});
async function settle(){await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});}
async function mount(hash:string,route:Route=()=>undefined){
  calls=[];
  vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=new URL(String(input),"http://localhost"),headers=new Headers(init?.headers);
    const call={path:url.pathname,query:url.search,body:init?.body?JSON.parse(String(init.body)):null,csrf:headers.get("x-b1-csrf")};calls.push(call);
    if(call.path==="/api/v2/core/access")return json({authentication:"B1",synthetic:true,csrf,organizations:[]});
    const answer=await route(call);if(answer)return answer;
    throw new Error(`unexpected request ${call.path}${call.query}`);
  }));
  window.history.replaceState(null,"","/core/join"+hash);
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>{root!.render(<JoinScreen/>);});
  await settle();
}
const button=(label:string)=>Array.from(host.querySelectorAll("button")).find(item=>item.textContent===label);
async function click(label:string){expect(Boolean(button(label)),label).toBe(true);await act(async()=>{button(label)!.click();});await settle();}
const paths=()=>calls.map(call=>call.path+call.query);
const hint="이미 신청했다면 내 호실로 돌아가 '내 연결 요청'에서 상태를 확인할 수 있어요. 소속이 선택돼 있다면 'MY'의 '호실 연결'에 있어요.";
const failure=(status:number,code:string)=>json({error:{code,message:"synthetic"}},status);

it("offers no status check without a link, so it never reads the saved requests",async()=>{
  await mount("");
  expect(host.textContent).toContain("초대 링크 정보가 없어요.");
  expect(host.textContent).toContain(hint);
  expect(button("요청 상태 확인")).toBeUndefined();
  expect(paths()).toEqual(["/api/v2/core/access"]);
});

it("asks to inspect a linked invite first and sends nothing until asked",async()=>{
  await mount("#"+token);
  expect(Boolean(button("초대 내용 확인"))).toBe(true);
  expect(button("요청 상태 확인")).toBeUndefined();
  expect(host.textContent).toContain(hint);
  expect(paths()).toEqual(["/api/v2/core/access"]);
});

it("keeps pointing to the saved requests when the linked invite can no longer be inspected",async()=>{
  await mount("#"+token,call=>call.path.endsWith("/inspect")?failure(409,"STATE_CONFLICT"):undefined);
  await click("초대 내용 확인");
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(host.textContent).toContain(hint);
  expect(button("요청 상태 확인")).toBeUndefined();
});

it("offers no status check for an inspected invite that was never claimed",async()=>{
  await mount("#"+token,call=>call.path.endsWith("/inspect")?json(invite):undefined);
  await click("초대 내용 확인");
  expect(Boolean(button("연결 요청 보내기"))).toBe(true);
  expect(button("요청 상태 확인")).toBeUndefined();
  expect(calls.find(call=>call.path.endsWith("/inspect"))).toMatchObject({body:{token},csrf});
});

it("after a lost claim answer, asks about that one invite with the link it still holds",async()=>{
  let inspections=0;
  await mount("#"+token,call=>{
    if(call.path.endsWith("/inspect"))return json(++inspections===1?invite:requested);
    if(call.path.endsWith("/claim"))throw new TypeError("synthetic lost answer");
    return undefined;
  });
  await click("초대 내용 확인");
  await click("연결 요청 보내기");
  expect(host.textContent).toContain("응답이 확인되지 않았어요.");
  await click("요청 상태 확인");
  expect(paths()).toEqual(["/api/v2/core/access","/api/v2/core/onboarding/inspect","/api/v2/core/onboarding/claim","/api/v2/core/onboarding/inspect"]);
  expect(calls[3]).toMatchObject({body:{token},csrf});
  expect(host.textContent).toContain("저장된 연결 상태를 확인했어요.");
  expect(host.textContent).toContain(requestNumber);
  expect(host.textContent).toContain("관리자 확인 대기");
});

it("after a lost claim answer that was never saved, says so and lets the person claim again",async()=>{
  await mount("#"+token,call=>{
    if(call.path.endsWith("/inspect"))return json(invite);
    if(call.path.endsWith("/claim"))throw new TypeError("synthetic lost answer");
    return undefined;
  });
  await click("초대 내용 확인");
  await click("연결 요청 보내기");
  await click("요청 상태 확인");
  expect(host.textContent).toContain("이 초대에 저장된 요청이 없어요.");
  expect(button("연결 요청 보내기")?.disabled).toBe(false);
});

it.each([[409,"STATE_CONFLICT"],[404,"NOT_FOUND"]])("when the held link answers %i, finds the lost claim among the saved requests",async(status,code)=>{
  let inspections=0;
  await mount("#"+token,call=>{
    if(call.path.endsWith("/inspect"))return ++inspections===1?json(invite):failure(status,code);
    if(call.path.endsWith("/claim"))throw new TypeError("synthetic lost answer");
    if(call.path.endsWith("/mine"))return json({items:[{...requested,state:"EXPIRED"}],nextCursor:null});
    return undefined;
  });
  await click("초대 내용 확인");
  await click("연결 요청 보내기");
  await click("요청 상태 확인");
  expect(paths().slice(3)).toEqual(["/api/v2/core/onboarding/inspect","/api/v2/core/onboarding/mine"]);
  expect(host.textContent).toContain("저장된 연결 상태를 확인했어요.");
  expect(host.textContent).toContain("초대 만료");
  expect(host.textContent).toContain(requestNumber);
});

it("says a closed invite with nothing saved can no longer be used, and offers no claim",async()=>{
  await mount("#"+token,call=>{
    if(call.path.endsWith("/inspect"))return call===calls.find(c=>c.path.endsWith("/inspect"))?json(invite):failure(409,"STATE_CONFLICT");
    if(call.path.endsWith("/claim"))return failure(409,"STATE_CONFLICT");
    if(call.path.endsWith("/mine"))return json({items:[decoy],nextCursor:null});
    return undefined;
  });
  await click("초대 내용 확인");
  await click("연결 요청 보내기");
  await click("요청 상태 확인");
  expect(host.textContent).toContain("이 초대는 더 이상 쓸 수 없어요.");
  expect(host.textContent).not.toContain("저장된 요청이 없어요");
  expect(host.textContent).not.toContain("초대 링크 정보가 없어요.");
  expect(button("연결 요청 보내기")).toBeUndefined();
  expect(button("요청 상태 확인")).toBeUndefined();
});

it("does not search the saved requests when the server is only busy",async()=>{
  let inspections=0;
  await mount("#"+token,call=>{
    if(call.path.endsWith("/inspect"))return ++inspections===1?json(invite):failure(429,"RATE_LIMITED");
    if(call.path.endsWith("/claim"))throw new TypeError("synthetic lost answer");
    return undefined;
  });
  await click("초대 내용 확인");
  await click("연결 요청 보내기");
  await click("요청 상태 확인");
  expect(paths().some(path=>path.includes("/mine"))).toBe(false);
  expect(host.textContent).toContain("시도가 많아요.");
  expect(button("연결 요청 보내기")?.disabled).toBe(true);
  expect(button("요청 상태 확인")?.disabled).toBe(false);
});

it("once the link is spent, finds the claimed invite among the saved requests page by page",async()=>{
  await mount("#"+token,call=>{
    if(call.path.endsWith("/inspect"))return json(invite);
    if(call.path.endsWith("/claim"))return json(requested);
    if(call.path.endsWith("/mine"))return json(call.query?{items:[{...requested,state:"APPROVED",decidedAt:"2026-10-13T02:00:00.000Z"}],nextCursor:null}:{items:[decoy],nextCursor:"77777777-7777-4777-8777-777777777777"});
    return undefined;
  });
  await click("초대 내용 확인");
  await click("연결 요청 보내기");
  expect(host.textContent).toContain(requestNumber);
  await click("요청 상태 확인");
  expect(paths().slice(3)).toEqual(["/api/v2/core/onboarding/mine","/api/v2/core/onboarding/mine?cursor=77777777-7777-4777-8777-777777777777"]);
  expect(host.textContent).toContain("연결 승인");
  expect(host.textContent).not.toContain("102호");
});
