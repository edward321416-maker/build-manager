// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach,expect,it,vi } from "vitest";
import { Toast,useToastMessage } from "./toast";

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root|undefined,host:HTMLDivElement|undefined;
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();vi.useRealTimers();});
const note="업무함 2건을 엑셀 파일(CSV)로 받았어요.";
function Harness(){const [message,show]=useToastMessage();return <><button onClick={()=>show(note)}>보이기</button><Toast message={message}/></>;}
async function mount(){vi.useFakeTimers();host=document.createElement("div");document.body.append(host);root=createRoot(host);await act(async()=>root!.render(<Harness/>));}
const show=()=>act(async()=>host!.querySelector("button")!.click());
const visible=()=>document.body.querySelector("[data-toast]")?.textContent??null;
const live=()=>host!.querySelector('[role="status"]')?.textContent??null;

it("keeps an empty polite live region in place and shows nothing before a result",async()=>{
  await mount();expect(live()).toBe("");expect(visible()).toBeNull();
});
it("shows the note on <body>, outside the card, for 3 seconds and tells screen readers once",async()=>{
  await mount();await show();
  expect(visible()).toBe(note);expect(live()).toBe(note);
  const toast=document.body.querySelector("[data-toast]")!;expect(host!.contains(toast)).toBe(false);expect(toast.getAttribute("aria-hidden")).toBe("true");
  await act(async()=>{vi.advanceTimersByTime(2_999);});expect(visible()).toBe(note);
  await act(async()=>{vi.advanceTimersByTime(1);});expect(visible()).toBeNull();expect(live()).toBe("");
});
it("restarts the 3 seconds when the same note is shown again",async()=>{
  await mount();await show();await act(async()=>{vi.advanceTimersByTime(2_000);});await show();
  await act(async()=>{vi.advanceTimersByTime(2_000);});expect(visible()).toBe(note);
  await act(async()=>{vi.advanceTimersByTime(1_000);});expect(visible()).toBeNull();
});
it("renders only the live region on the server",()=>{
  const html=renderToStaticMarkup(<Toast message=""/>);expect(html).toContain('role="status"');expect(html).not.toContain("data-toast");
});
