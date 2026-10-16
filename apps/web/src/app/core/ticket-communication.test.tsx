// @vitest-environment jsdom
import { act,useEffect,type RefObject } from "react";
import { createRoot,type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach,expect,it,vi } from "vitest";
import type { CoreFlowClient } from "@build-manager/api-client";
import type { CoreCommunicationSummary } from "@build-manager/api-contracts";
import { CommunicationBadge,useCommunicationSummaries } from "./ticket-communication";
it("renders viewer-specific next-action labels independently of work status",()=>{
  expect(renderToStaticMarkup(<CommunicationBadge tenant summary={{waitingFor:"TENANT",readOnly:false}}/>)).toContain("내 답변 필요");
  expect(renderToStaticMarkup(<CommunicationBadge summary={{waitingFor:"TENANT",readOnly:false}}/>)).toContain("세입자 답변 대기");
  expect(renderToStaticMarkup(<CommunicationBadge tenant summary={{waitingFor:"MANAGER",readOnly:false}}/>)).toContain("관리자 답변 대기");
});
it("does not project an active wait for completed, empty or unavailable conversations",()=>{
  expect(renderToStaticMarkup(<CommunicationBadge summary={{waitingFor:"MANAGER",readOnly:true}}/>)).toBe("");
  expect(renderToStaticMarkup(<CommunicationBadge summary={{waitingFor:"NONE",readOnly:false}}/>)).toBe("");expect(renderToStaticMarkup(<CommunicationBadge/>)).toBe("");
});

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
type Api=ReturnType<typeof useCommunicationSummaries>;
let root:Root|undefined,host:HTMLDivElement|undefined;
function Probe({client,ids,api:apiRef}:{client:CoreFlowClient;ids:string[]|null;api:RefObject<Api|null>}){
  const result=useCommunicationSummaries(client,ids,0);
  useEffect(()=>{apiRef.current=result;});
  return null;
}
afterEach(async()=>{if(root)await act(async()=>root?.unmount());root=undefined;host?.remove();host=undefined;});

it("stays not ready while the id set is unknown, then while the real read for it runs, and only turns ready once that read finishes",async()=>{
  let resolve!:(value:CoreCommunicationSummary[])=>void;
  const pending=new Promise<CoreCommunicationSummary[]>(r=>{resolve=r;});
  const summaries=vi.fn().mockReturnValue(pending);
  const client={communication:{summaries}} as unknown as CoreFlowClient;
  const api:RefObject<Api|null>={current:null};
  host=document.createElement("div");document.body.append(host);root=createRoot(host);

  // The session (and so the id set) is not known yet: no read starts, and the hook does not claim to be ready.
  await act(async()=>{root!.render(<Probe client={client} ids={null} api={api}/>);});
  expect(api.current!.ready).toBe(false);
  expect(summaries).not.toHaveBeenCalled();

  // The id set becomes known: the real read starts, but readiness stays false while it is in flight.
  await act(async()=>{root!.render(<Probe client={client} ids={["t1"]} api={api}/>);});
  expect(api.current!.ready).toBe(false);
  expect(summaries).toHaveBeenCalledWith(["t1"]);

  // Only once that read for the current ids has finished does the hook turn ready.
  await act(async()=>{resolve([{ticketId:"t1",version:1,waitingFor:"TENANT",readOnly:false}]);for(let i=0;i<8;i++)await Promise.resolve();});
  expect(api.current!.ready).toBe(true);
  expect(api.current!.summaries.t1?.waitingFor).toBe("TENANT");
});

it("counts every finished read, failed or not, so a retry can tell its own failed read from the one before (review of #172)",async()=>{
  const summaries=vi.fn().mockRejectedValueOnce(new Error("down")).mockRejectedValueOnce(new Error("down")).mockResolvedValue([]);
  const client={communication:{summaries}} as unknown as CoreFlowClient;
  const api:RefObject<Api|null>={current:null};
  const settle=()=>act(async()=>{for(let i=0;i<8;i++)await Promise.resolve();});
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>{root!.render(<Probe client={client} ids={["t1"]} api={api}/>);});await settle();
  expect(api.current).toMatchObject({error:true,landed:1});
  // Coming back to the window reads again: a second failure looks the same except for the count.
  await act(async()=>{window.dispatchEvent(new Event("focus"));});await settle();
  expect(api.current).toMatchObject({error:true,landed:2});
  await act(async()=>{window.dispatchEvent(new Event("focus"));});await settle();
  expect(api.current).toMatchObject({error:false,landed:3});
});
