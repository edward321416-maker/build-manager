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
