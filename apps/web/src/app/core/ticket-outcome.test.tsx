import { renderToStaticMarkup } from "react-dom/server";
import { expect,it } from "vitest";
import type { ComponentProps } from "react";
import type { CoreTicketDto } from "@build-manager/api-contracts";
import { OutcomeSummary,outcomeLabels,OutcomeView,freshFollowUp,FollowUpContext } from "./ticket-outcome";
it("labels tenant assertions separately from managerial completion and objective verification",()=>{
 for(const kind of ["UNCONFIRMED","RESOLVED","UNRESOLVED","RECURRENCE_CLAIM"] as const){
  const html=renderToStaticMarkup(<OutcomeSummary tenant={false} outcome={{ticketId:"synthetic",kind,assertedAt:null,followUpTicketId:null}}/>);expect(html).toContain(outcomeLabels[kind]);expect(html).toContain("세입자 응답");expect(html).toContain("뜻하지 않습니다");
 }
 expect(outcomeLabels.RECURRENCE_CLAIM).not.toContain("재발 확인");
});
const base:ComponentProps<typeof OutcomeView>={completed:true,tenant:true,outcome:{ticketId:"source",kind:"UNCONFIRMED",assertedAt:null,followUpTicketId:null},source:null,loading:false,error:"",busy:false,uncertain:false,onRefresh(){},onConfirm(){},onFollowUp(){},onOpen(){}};
const view=(props:Partial<typeof base>={})=>renderToStaticMarkup(<OutcomeView {...base} {...props}/>);
it("does not flash an unconfirmed result during load or show stale actions on a read error",()=>{
 for(const html of [view({loading:true}),view({error:"불러오지 못했습니다."})]){expect(html).not.toContain("해결됐어요");expect(html).not.toContain("관리자가 남긴 완료 기록을 확인");}
 expect(view({loading:true})).toContain("처리 결과 불러오는 중");expect(view({error:"불러오지 못했습니다."})).toContain("결과 새로고침");
 expect(view({outcome:null,error:"권한을 확인해 주세요."})).not.toContain("후속 접수 보기");
});
it("offers all three initial actions, recurrence alone after resolved and exact navigation after linking",()=>{
 const initial=view();for(const label of ["해결됐어요","아직 문제가 있어요","다시 문제가 생겼어요"])expect(initial).toContain(label);
 const resolved=view({outcome:{...base.outcome!,kind:"RESOLVED"}});expect(resolved).toContain("다시 문제가 생겼어요");expect(resolved).not.toContain("아직 문제가 있어요");expect(resolved).not.toContain("해결됐어요");
 for(const kind of ["UNRESOLVED","RECURRENCE_CLAIM"] as const){const linked=view({outcome:{...base.outcome!,kind,followUpTicketId:"target"}});expect(linked).toContain("후속 접수 보기");expect(linked).not.toContain("해결됐어요");expect(linked).not.toContain("재발 확인");}
});
it("keeps manager and uncertain views read-only and the target relation neutral",()=>{
 for(const html of [view({tenant:false}),view({uncertain:true})])for(const label of ["해결됐어요","아직 문제가 있어요","다시 문제가 생겼어요"])expect(html).not.toContain(label);
 expect(view({completed:false,source:"source",outcome:null})).toContain("이전 완료 접수에서 이어진 요청");
});
it("starts follow-up context with location and editable issue only, never source content",()=>{
 const ticket={ticketId:"source",unitId:"unit",detail:{issueType:"LEAK",rawUserText:"old private body",answers:["old answer"]},photos:["old photo"],events:["old conversation"]} as unknown as CoreTicketDto;
 expect(freshFollowUp(ticket,"UNRESOLVED")).toEqual({sourceTicketId:"source",unitId:"unit",issueType:"LEAK",claimKind:"UNRESOLVED"});
 const html=renderToStaticMarkup(<FollowUpContext kind="RECURRENCE_CLAIM"/>);expect(html).toContain("이전 완료 접수에서 이어서 새로 접수합니다.");expect(html).not.toContain("old");
});
it("uses separate tenant and manager wording for each assertion",()=>{
 const expected={RESOLVED:"해결됐다고 알려주셨어요.",UNRESOLVED:"아직 문제가 있다고 알려 새 접수를 만들었습니다.",RECURRENCE_CLAIM:"다시 문제가 생겼다고 알려 새 접수를 만들었습니다."};
 for(const [kind,label] of Object.entries(expected)){
  const html=renderToStaticMarkup(<OutcomeSummary tenant outcome={{ticketId:"synthetic",kind:kind as keyof typeof expected,assertedAt:null,followUpTicketId:null}}/>);
  expect(html).toContain(label);expect(html).toContain("관리자의 처리 완료 기록과 별도로 남긴 확인입니다.");
 }
});
