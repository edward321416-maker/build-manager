// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi,type Mock } from "vitest";
import { downloadFile } from "../lib/download-file";
import { VisitCalendarButton } from "./visit-calendar-button";

vi.mock("../lib/download-file",()=>({downloadFile:vi.fn()}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const save=downloadFile as unknown as Mock<(fileName:string,text:string,type:string)=>void>;
let root:Root|undefined,host:HTMLDivElement|undefined;
beforeEach(()=>save.mockReset());
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();document.body.querySelectorAll("[data-toast]").forEach(node=>node.remove());});
async function mount(build:()=>string,disabled=false){host=document.createElement("div");document.body.append(host);root=createRoot(host);await act(async()=>root!.render(<VisitCalendarButton fileName="방문일정_2026-10-17.ics" build={build} disabled={disabled}/>));}
const button=()=>host!.querySelector("button")!;

it("saves the calendar text as a text/calendar file and says what to do next",async()=>{
  await mount(()=>"BEGIN:VCALENDAR\r\n");await act(async()=>button().click());
  expect(save).toHaveBeenCalledWith("방문일정_2026-10-17.ics","BEGIN:VCALENDAR\r\n","text/calendar;charset=utf-8");
  expect(document.body.querySelector("[data-toast]")?.textContent).toBe("캘린더 파일을 받았어요. 파일을 열어 캘린더에 추가해 주세요.");
});
it("keeps a failure in place and shows no toast, whether building or saving fails",async()=>{
  await mount(()=>{throw new RangeError("INVALID_INSTANT");});await act(async()=>button().click());
  expect(host!.querySelector('[role="alert"]')?.textContent).toBe("캘린더 파일을 만들지 못했어요. 다시 받아 주세요.");expect(document.body.querySelector("[data-toast]")).toBeNull();expect(save).not.toHaveBeenCalled();
  await act(async()=>root!.unmount());root=undefined;host!.remove();
  save.mockImplementationOnce(()=>{throw new Error("blocked");});await mount(()=>"BEGIN:VCALENDAR\r\n");await act(async()=>button().click());
  expect(host!.querySelector('[role="alert"]')).not.toBeNull();expect(document.body.querySelector("[data-toast]")).toBeNull();
});
it("cannot be pressed while the screen is busy",async()=>{
  await mount(()=>"x",true);expect(button().disabled).toBe(true);expect(button().textContent).toBe("캘린더에 추가");
});
