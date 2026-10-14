// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,expect,it,vi } from "vitest";
import { CoreLoginScreen } from "./login-screen";

// The signed-out panel never renders the workspace; keep its unrelated module graph out of this test.
vi.mock("./core-screen",()=>({default:()=>null}));
vi.mock("./onboarding-panel",()=>({OnboardingPanel:()=>null}));

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root|undefined,host:HTMLDivElement|undefined;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();vi.unstubAllGlobals();});
async function mount(demoEntry:boolean){
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({error:"UNAUTHENTICATED"}),{status:401})));
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>root!.render(<CoreLoginScreen demoEntry={demoEntry}/>));
  await act(async()=>{await Promise.resolve();await Promise.resolve();});
  return host;
}

it("demo entry offers role buttons that post same-origin forms instead of the provider login",async()=>{
  const page=await mount(true);
  expect(page.querySelector('a[href="/auth/login"]')).toBeNull();
  const forms=[...page.querySelectorAll<HTMLFormElement>('form[action="/api/v2/session/demo"]')];
  expect(forms.map(form=>[form.method,form.querySelector<HTMLInputElement>('input[name="role"]')?.value,form.querySelector("button")?.textContent])).toEqual([
    ["post","manager","관리자로 체험하기"],["post","tenant","세입자로 체험하기"]]);
  expect(page.textContent).toContain("로그인 없이");
});

it("without demo entry the existing account login link stays unchanged",async()=>{
  const page=await mount(false);
  expect(page.querySelector('a[href="/auth/login"]')?.textContent).toBe("계정으로 로그인");
  expect(page.querySelector('form[action="/api/v2/session/demo"]')).toBeNull();
});

const ORG_A="00000000-0000-4000-8000-00000000000a",ORG_B="00000000-0000-4000-8000-00000000000b";
async function mountAccess(organizations:{id:string;name:string;role:"TENANT"|"ORG_ADMIN"}[]){
  vi.stubGlobal("fetch",vi.fn((input:RequestInfo|URL)=>{
    const url=String(input);
    if(url.endsWith("/api/v2/core/access"))return Promise.resolve(new Response(JSON.stringify({authentication:"B1",synthetic:true,csrf:"c".repeat(64),organizations}),{status:200}));
    // The organisation choice stays pending, so the sign-in column keeps showing the 내 소속 field.
    if(url.endsWith("/api/v2/core/organization"))return new Promise<Response>(()=>{});
    return Promise.resolve(new Response(JSON.stringify({error:"UNAUTHENTICATED"}),{status:401}));
  }));
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>root!.render(<CoreLoginScreen/>));
  await act(async()=>{for(let i=0;i<5;i++)await Promise.resolve();});
  return host;
}

it("a single organisation shows its name as text, with nothing to choose (P5 spec §1)",async()=>{
  const page=await mountAccess([{id:ORG_A,name:"합성 소속 A",role:"TENANT"}]);
  expect(page.querySelector("select")).toBeNull();
  expect(page.querySelector(".core-org-name")?.textContent).toBe("합성 소속 A · 세입자");
});

it("two organisations keep the 내 소속 choice",async()=>{
  const page=await mountAccess([{id:ORG_A,name:"합성 소속 A",role:"ORG_ADMIN"},{id:ORG_B,name:"합성 소속 B",role:"ORG_ADMIN"}]);
  expect([...page.querySelectorAll('select[aria-label="내 소속"] option')].map(option=>option.textContent)).toEqual(["소속을 선택해 주세요","합성 소속 A · 조직 관리자","합성 소속 B · 조직 관리자"]);
});
