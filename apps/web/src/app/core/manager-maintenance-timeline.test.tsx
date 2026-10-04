import { renderToStaticMarkup } from "react-dom/server";
import { expect,it } from "vitest";
import type { ComponentProps } from "react";
import type { CoreUnitMaintenanceFact } from "@build-manager/api-contracts";
import { MaintenanceEditorView,MaintenanceFactCard,MaintenanceTimelineView } from "./manager-maintenance-timeline";
const noop=()=>{};
const base:ComponentProps<typeof MaintenanceEditorView>={completed:true,detail:{current:null,revisions:[]},loading:false,error:"",notice:"",busy:false,editing:false,uncertain:false,reviewRequired:false,action:"INSPECTION",label:"",reason:"ACTION_CLASSIFICATION",onAction:noop,onLabel:noop,onReason:noop,onSubmit:noop,onEdit:noop,onRefresh:noop,onRetry:noop,onReview:noop,onOpenTicket:noop,onViewUnit:noop};
const view=(props:Partial<typeof base>={})=>renderToStaticMarkup(<MaintenanceEditorView {...base} {...props}/>);
const fact:CoreUnitMaintenanceFact={factId:"fact",unitId:"unit",buildingId:"building",buildingName:"합성 건물",unitLabel:"합성 호실",sourceTicketId:"source",issueType:"HEATING",actionKind:"REPAIR",componentLabel:"합성 펌프",sourceCompletedAt:"2026-10-04T00:00:00Z",recordedAt:"2026-10-04T01:00:00Z",corrected:false,correctionCount:0,tenantOutcome:"UNCONFIRMED",previousTicketId:null,followUpTicketId:null};
it("shows creation only for completed tickets with five reviewed actions and privacy warning",()=>{
 expect(view({completed:false})).toBe("");const html=view();expect(html).toContain("호실 정비 사실 기록");expect(html).toContain("개인 이름·연락처·출입정보는 적지 마세요.");
 for(const label of ["점검","수리","부품 교체","조정","기타"])expect(html).toContain(label);
 expect(html).not.toContain("자동 완료");
});
it("keeps loading, error and absent-fact states distinct with a recovery action",()=>{
 expect(view({loading:true,detail:null})).toContain("정비 사실 불러오는 중");expect(view({loading:true,detail:null})).not.toContain("정비 사실 저장");
 const error=view({error:"연결 확인",detail:null});expect(error).toContain("정비 사실 다시 불러오기");expect(error).not.toContain("정비 사실 저장");
});
it("shows existing append-only history and explicit correction without edit/delete claims",()=>{
 const html=view({detail:{current:{...fact,corrected:true,correctionCount:1},revisions:[{factId:"fact",actionKind:"REPAIR",componentLabel:"합성 펌프",recordedAt:fact.recordedAt,correctionReason:null,current:false}]}});
 expect(html).toContain("정정 기록 추가");expect(html).toContain("호실 이력에서 보기");expect(html).toContain("정정 이력");expect(html).not.toContain("삭제");expect(html).not.toContain("정비 사실 저장");
});
it("retains stale input visibly and requires an explicit review before another correction",()=>{
 const html=view({editing:true,detail:{current:fact,revisions:[]},reviewRequired:true,label:"내가 입력한 합성 부품"});expect(html).toContain("내가 입력한 합성 부품");expect(html).toContain("최신 기록을 확인했습니다");expect(html).toContain("정정 이유");expect(html).toContain("disabled");
});
it("does not claim matching server values prove the uncertain request succeeded",()=>{
 const html=view({editing:true,uncertain:true,detail:{current:fact,revisions:[]},label:fact.componentLabel!});expect(html).toContain("같은 요청으로 저장 확인");expect(html).toContain("요청의 성공을 확정하지 않습니다");expect(html).not.toContain("저장했습니다");
});
it("renders component labels as text and describes tenant claims neutrally",()=>{
 const html=renderToStaticMarkup(<MaintenanceFactCard fact={{...fact,componentLabel:"<script>synthetic</script>",tenantOutcome:"RECURRENCE_CLAIM",previousTicketId:"old",followUpTicketId:"new"}} onOpenTicket={noop}/>);
 expect(html).not.toContain("<script>");expect(html).toContain("&lt;script&gt;");expect(html).toContain("세입자가 다시 문제가 생겼다고 응답");expect(html).toContain("이전 완료 접수에서 이어진 건");expect(html).toContain("후속 접수 있음");expect(html).not.toContain("재발 확인");
});
it("distinguishes timeline loading, empty, error and no authorized unit",()=>{
 const props={units:[{id:"unit",buildingId:"building",buildingName:"합성 건물",label:"합성 호실"}],unitId:"unit",items:[],loading:false,error:"",disabled:false,onUnit:noop,onRefresh:noop,onOpenTicket:noop};
 const html=(changes:Partial<typeof props>={})=>renderToStaticMarkup(<MaintenanceTimelineView {...props} {...changes}/>);
 expect(html()).toContain("아직 기록된 정비 사실이 없습니다.");expect(html({loading:true})).not.toContain("아직 기록된");expect(html({error:"연결 확인"})).not.toContain("아직 기록된");expect(html({error:"연결 확인"})).toContain("이력 다시 불러오기");expect(html({units:[],unitId:""})).toContain("접근 가능한 호실이 없습니다");
});
it("keeps the supplied timeline order and only renders the approved projection fields",()=>{
 const html=renderToStaticMarkup(<MaintenanceTimelineView units={[{id:"unit",buildingId:"building",buildingName:"합성 건물",label:"합성 호실"}]} unitId="unit" items={[{...fact,componentLabel:"첫 번째 합성"},{...fact,factId:"second",componentLabel:"두 번째 합성"}]} loading={false} error="" disabled={false} onUnit={noop} onRefresh={noop} onOpenTicket={noop}/>);
 expect(html.indexOf("첫 번째 합성")).toBeLessThan(html.indexOf("두 번째 합성"));for(const value of ["내부 메모","담당자","긴급도","사진"])expect(html).not.toContain(value);
});
