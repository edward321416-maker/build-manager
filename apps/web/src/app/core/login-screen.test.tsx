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
