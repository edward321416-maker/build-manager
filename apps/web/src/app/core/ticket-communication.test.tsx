import { renderToStaticMarkup } from "react-dom/server";
import { expect,it } from "vitest";
import { CommunicationBadge } from "./ticket-communication";
it("renders viewer-specific next-action labels independently of work status",()=>{
  expect(renderToStaticMarkup(<CommunicationBadge tenant summary={{waitingFor:"TENANT",readOnly:false}}/>)).toContain("내 답변 필요");
  expect(renderToStaticMarkup(<CommunicationBadge summary={{waitingFor:"TENANT",readOnly:false}}/>)).toContain("세입자 답변 대기");
  expect(renderToStaticMarkup(<CommunicationBadge tenant summary={{waitingFor:"MANAGER",readOnly:false}}/>)).toContain("관리자 답변 대기");
});
it("does not project an active wait for completed, empty or unavailable conversations",()=>{
  expect(renderToStaticMarkup(<CommunicationBadge summary={{waitingFor:"MANAGER",readOnly:true}}/>)).toBe("");
  expect(renderToStaticMarkup(<CommunicationBadge summary={{waitingFor:"NONE",readOnly:false}}/>)).toBe("");expect(renderToStaticMarkup(<CommunicationBadge/>)).toBe("");
});
