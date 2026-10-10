"use client";
import { useCallback,useEffect,useRef,useState,type ReactNode } from "react";
import { VendorCloseoutCommandSchema,VendorRequestCorrectionCommandSchema,VendorReassignCommandSchema,VendorCreateAssignmentCommandSchema,VendorPublishPacketCommandSchema,type CoreTicketDto,type ManagerVendorHandoffDto,type VendorLinkIssueDto,type VendorAccessPolicy } from "@build-manager/api-contracts";
import { ApiClientError,type CoreVendorHandoffClient,type CoreFlowClient } from "@build-manager/api-client";
import styles from "./vendor-handoff.module.css";
import Image from "next/image";
import { formatVendorInstant,formatVendorInterval } from "../../lib/vendor-time";
import { BLOCKER_LABELS,OMISSION_LABELS,WAITING_LABELS } from "../../lib/vendor-blocker";
export type VendorPacketDraft={vendorLabel:string;workSummary:string;sharedDetailKeys:string[];allowedPhotoIds:string[];accessPolicy:VendorAccessPolicy;accessInstruction:string};
type PendingLinkRequest={kind:"ISSUE"|"REISSUE";assignmentId:string;input:Parameters<CoreVendorHandoffClient["issueLink"]>[1]};
type ManagerAction="CLOSEOUT"|"CORRECTION"|"MORE_WORK"|"REASSIGN";
export type VendorHandoffViewProps={action?:ManagerAction|null;actionText?:string;onAction?:(action:ManagerAction|null)=>void;onActionText?:(text:string)=>void;onSubmitAction?:()=>void;communicationVersion?:number;ticket:CoreTicketDto;handoff:ManagerVendorHandoffDto|null;loading:boolean;busy:boolean;error:string;validationError?:string;notice:string;uncertain:boolean;pendingLink?:PendingLinkRequest|null;linkUnavailable:boolean;immediateLink:string|null;preview:boolean;draft:VendorPacketDraft;photoPreviews:{photoId:string;url:string}[];onDraft:(draft:VendorPacketDraft)=>void;onPreview:()=>void;onCreate:()=>void;onPublish:()=>void;onIssue:()=>void;onReissue:()=>void;onReconcileLink?:()=>void;onRevoke:()=>void;onRefresh:()=>void;onReview:()=>void;now?:Date;rescheduleReview?:boolean;onRescheduleReview?:(open:boolean)=>void;onReschedule?:()=>void;reportPhotos?:{photoId:string;url:string}[];historyReportId?:string|null;onHistoryReport?:(id:string|null)=>void};
const provenance={TENANT_REPORTED:"세입자 설명",BUILDING_VERIFIED:"확인된 건물 정보",MANAGER_REVIEWED:"관리자 검토"};
const policyLabels={TENANT_PRESENT_REQUIRED:"세입자 재실 필요",TENANT_PREAUTHORIZATION_ALLOWED:"세입자 별도 사전 동의 허용"};
export function vendorHandoffEligible(ticket:CoreTicketDto):boolean{
  if(ticket.workStatus==="COMPLETED"||!("decision" in ticket.detail)||ticket.detail.status==="SAFETY_ESCALATED"||ticket.detail.repairPacket?.safetyEscalated)return false;
  const detail=ticket.detail,decision=detail.decision;
  const route=decision?.type==="OVERRIDE"?decision.routeCode:decision?.type==="APPROVE"?detail.repairPacket?.recommendation?.routeCode:null;
  return route==="GENERAL_VENDOR"||route==="MANUFACTURER_AS";
}
export function ManagerDirectCompletionGate({handoff,loading,children,enabled=true}: {handoff:ManagerVendorHandoffDto|null;loading:boolean;children:ReactNode;enabled?:boolean}){
  if(!enabled)return children;
  if(loading||!handoff||handoff.assignment&&handoff.assignment.status!=="ENDED")return null;
  return children;
}
/** Never invent replay bytes or resolve an alternate origin/path. Raw bytes stay in transient UI state. */
export function resolveDeliverableLink(result:VendorLinkIssueDto,origin:string,current?:ManagerVendorHandoffDto):string|null{
  if(!result.created||!/^\/vendor\/job#[A-Za-z0-9_-]+$/.test(result.link))return null;
  if(current&&(!current.currentPacket||current.assignment?.id!==result.assignmentId||!["OFFERED","ACTIVE"].includes(current.assignment.status)))return null;
  try{const base=new URL(origin);if(!["http:","https:"].includes(base.protocol))return null;return new URL(result.link,base.origin).href;}catch{return null;}
}
export async function reconcileManagerHandoff<T>(client:CoreVendorHandoffClient,ticketId:string,operation:()=>Promise<T>,isCurrent:()=>boolean=()=>true):Promise<{kind:"success"|"uncertain"|"rejected"|"obsolete";value?:T;handoff:ManagerVendorHandoffDto|null;status?:number}>{
  let value:T;
  try{value=await operation();}
  catch(error){
    if(!isCurrent())return {kind:"obsolete",handoff:null};
    const status=error instanceof ApiClientError?error.status:undefined;
    if(status===401||status===403||status===404)return {kind:"rejected",handoff:null,status};
    let handoff:ManagerVendorHandoffDto|null=null;try{handoff=await client.readHandoff(ticketId);}catch{}
    if(!isCurrent())return {kind:"obsolete",handoff:null};
    return {kind:status===400||status===409?"rejected":"uncertain",handoff,status};
  }
  if(!isCurrent())return {kind:"obsolete",handoff:null};
  // A mutation response can be a historical receipt. Refresh before exposing any new authority.
  try{const handoff=await client.readHandoff(ticketId);return isCurrent()?{kind:"success",value,handoff}:{kind:"obsolete",handoff:null};}
  catch{return {kind:isCurrent()?"uncertain":"obsolete",handoff:null};}
}
export function VendorHandoffManagerView(p:VendorHandoffViewProps){
  const historyReport=p.handoff?.reportHistory.find(report=>report.id===p.historyReportId&&report.id!==p.handoff?.currentReport?.id);
  const assignment=p.handoff?.assignment,active=Boolean(assignment&&assignment.status!=="ENDED"),eligible=vendorHandoffEligible(p.ticket);
  const source=p.handoff?.packetSource,packet=p.handoff?.currentPacket;
  const canPrepare=eligible&&(!assignment||assignment.status==="ENDED");
  const canPublish=active&&eligible&&p.handoff?.phase!=="COMPLETION_REPORTED"&&Boolean(source?.serviceAddress&&source.unitLabel);
  const canReissue=eligible&&Boolean(packet)&&["OFFERED","ACTIVE"].includes(assignment?.status??"");
  const blocked=p.busy||p.loading||Boolean(p.error)||p.uncertain;
  const selectedDetails=source?.sharedDetails.filter(d=>p.draft.sharedDetailKeys.includes(d.key))??[];
  const photosReady=p.draft.allowedPhotoIds.every(id=>p.photoPreviews.some(photo=>photo.photoId===id));
  const choose=(values:string[],key:string,checked:boolean)=>checked?[...values,key]:values.filter(v=>v!==key);
  const at=p.now??new Date(),appointment=p.handoff?.appointment?.status==="SCHEDULED"?p.handoff.appointment:null;
  const canReschedule=Boolean(p.onReschedule&&appointment&&assignment?.status==="ACTIVE"&&p.handoff?.currentRound?.status==="CONFIRMED"&&Date.parse(appointment.startAt)>at.getTime());
  return <section id="vendor-handoff" tabIndex={-1} className={styles.panel} aria-label="업체 연결 및 작업 요청">
    <h2>업체 연결 / 작업 요청</h2>
    {p.loading?<p role="status">업체 연결 상태 불러오는 중…</p>:null}
    {/* Menu audit F-05: say why nothing can be prepared yet instead of an empty section. */}
    {!p.loading&&!eligible&&!assignment&&p.ticket.workStatus!=="COMPLETED"?<p>{"업체에 보내려면 먼저 처리 방법을 '일반 수리업체'나 '제조사 A/S'로 정해 주세요."}</p>:null}
    {p.error?<p role="alert">{p.error}</p>:null}
    {p.validationError?<p role="alert">{p.validationError}</p>:null}
    {p.notice?<p role="status">{p.notice}</p>:null}
    {assignment?<p>업체 {assignment.vendorLabel} · {assignment.status==="PREPARING"?"전달 준비":assignment.status==="OFFERED"?"요청 확인 대기":assignment.status==="ACTIVE"?"작업 진행":"연결 종료"}</p>:null}
    {p.handoff?.phase==="SCHEDULING"&&assignment?.status==="ACTIVE"&&!p.handoff.activeBlocker?<p>방문 일정 조율 중 · {p.handoff.waitingOn==="TENANT"?"세입자 응답 대기":"업체 응답 대기"}</p>:null}
    {p.handoff?.activeBlocker&&assignment?.status==="ACTIVE"?<div role="group" aria-label="업체 작업 막힘">
      <p>업체 작업 막힘 · {BLOCKER_LABELS[p.handoff.activeBlocker.code]} · {WAITING_LABELS[p.handoff.waitingOn]}</p>
      {p.handoff.activeBlocker.note?<p>{p.handoff.activeBlocker.note}</p>:null}
    </div>:null}
    {appointment?<div role="group" aria-label="방문 일정">
      <p>방문 일정 · {formatVendorInterval(appointment.startAt,appointment.endAt,at)} · {appointment.confirmationMode==="PREAUTHORIZED_ENTRY"?"세입자가 동의한 시간 안에서 업체가 선택":"세입자 확정"}</p>
      {canReschedule?(p.rescheduleReview?<div role="group" aria-label="방문 일정 변경 확인">
        <p>방문 일정을 바꾸면 기존 방문 일정은 취소되고, 세입자와 업체가 새로 일정을 조율합니다.</p>
        <button type="button" disabled={blocked} onClick={p.onReschedule}>일정 변경하기</button>
        <button type="button" disabled={p.busy} onClick={()=>p.onRescheduleReview?.(false)}>돌아가기</button>
      </div>:<button type="button" disabled={blocked} onClick={()=>p.onRescheduleReview?.(true)}>방문 일정 변경</button>):null}
    </div>:null}
    {p.handoff?.currentReport?<section className={styles.preview} aria-label="업체 작업 보고">
      <h3>업체 작업 보고 · {p.handoff.currentReport.revision}차</h3>
      <p>{formatVendorInstant(p.handoff.currentReport.submittedAt,at)} 제출{p.handoff.phase==="COMPLETION_REPORTED"?" · 관리자 확인 대기":""}</p>
      <p>{p.handoff.currentReport.workSummary}</p>
      {p.handoff.currentReport.componentOrPartNote?<p>사용한 부품·자재: {p.handoff.currentReport.componentOrPartNote}</p>:null}
      {p.handoff.currentReport.photoOmissionReason?<p>보고 사진 없음 · {OMISSION_LABELS[p.handoff.currentReport.photoOmissionReason]}</p>
        :p.handoff.currentReport.completionPhotoIds.map((id,index)=>{const photo=p.reportPhotos?.find(item=>item.photoId===id);
          return <figure key={id}>{photo?<Image unoptimized src={photo.url} width={640} height={480} style={{width:"100%",height:"auto"}} alt={`업체 보고 사진 ${index+1}`}/>:<p>사진 불러오는 중 또는 연결 확인 필요</p>}</figure>;})}
      {p.handoff.reportHistory.length>1?<p>작업 보고 이력 {p.handoff.reportHistory.length}건</p>:null}
    </section>:null}
    {p.handoff?.ticketWorkStatus==="COMPLETED"&&assignment?.status==="ENDED"&&assignment.endReason==="CLOSED"?<p role="status">처리 완료 · COMPLETED / ENDED/CLOSED · 업체 접근 종료</p>:null}
    {active&&p.handoff?.phase==="COMPLETION_REPORTED"?(p.handoff.correctionRequest?<div role="group" aria-label="보고 수정 요청"><p>업체 보고 수정 대기</p><p>{p.handoff.correctionRequest.reason}</p></div>:<div role="group" aria-label="업체 보고 검토">
      <button type="button" disabled={blocked} onClick={()=>p.onAction?.("CLOSEOUT")}>처리 완료 기록</button>
      <button type="button" disabled={blocked} onClick={()=>p.onAction?.("CORRECTION")}>보고 수정 요청</button>
      <button type="button" disabled={blocked} onClick={()=>p.onAction?.("MORE_WORK")}>추가 작업 요청</button>
    </div>):null}
    {p.action?<form aria-label="업체 요청 검토" onSubmit={e=>{e.preventDefault();p.onSubmitAction?.();}}>
      <h3>{p.action==="CLOSEOUT"?"처리 완료 기록 확인":p.action==="CORRECTION"?"보고 수정 요청 확인":p.action==="MORE_WORK"?"추가 작업 요청 확인":"업체 재배정 확인"}</h3>
      {p.action==="MORE_WORK"?<p>이전 보고와 방문은 보존하고 새 방문 일정을 조율합니다.</p>:<label>{p.action==="CLOSEOUT"?"관리자가 확인한 처리 내용":p.action==="CORRECTION"?"수정 요청 사유":"새 업체 표시 이름"}
        <textarea required maxLength={p.action==="CLOSEOUT"?2000:p.action==="CORRECTION"?500:80} value={p.actionText??""} onChange={e=>p.onActionText?.(e.target.value)}/></label>}
      {p.action==="CLOSEOUT"?<p>이 기록으로 접수 처리를 완료하고 업체 접근을 종료합니다. 공개 문답이 바뀌면 다시 확인해야 합니다.</p>:null}
      <button disabled={blocked||(p.action!=="MORE_WORK"&&!p.actionText?.trim())||(p.action==="CLOSEOUT"&&p.communicationVersion===undefined)}>확인한 내용 저장</button>
      <button type="button" disabled={p.busy} onClick={()=>p.onAction?.(null)}>돌아가기</button>
    </form>:null}
    {p.handoff?.assignmentHistory?.length?<details><summary>업체 연결 이력</summary>{p.handoff.assignmentHistory.map(item=><div key={item.id}><p>{item.vendorLabel} · {item.endReason}</p>{item.declineReason?<p>거절 사유: {item.declineReason}</p>:null}{item.operationalNote?<p>{item.operationalNote}</p>:null}</div>)}</details>:null}
    {p.uncertain?<p role="alert">저장 결과를 확정하지 못했습니다. 최신 상태를 먼저 확인하세요. 같은 화면 값만으로 성공을 확정하지 않습니다.</p>:null}
    {p.linkUnavailable?<p role="status">원래 링크는 다시 표시할 수 없습니다. 최신 상태에서 허용되는 경우 보안 링크를 재발급해 직접 전달하세요.</p>:null}
    <button type="button" disabled={p.busy||p.loading} onClick={p.onRefresh}>업체 연결 상태 다시 확인</button>
    {p.pendingLink&&eligible&&assignment?.id===p.pendingLink.assignmentId&&assignment.status!=="ENDED"&&packet?<button type="button" disabled={p.busy||p.loading||Boolean(p.error)} onClick={p.onReconcileLink}>같은 요청으로 발급 결과 확인</button>:null}
    {p.uncertain&&!p.pendingLink&&!p.linkUnavailable&&p.handoff&&!p.error?<button type="button" disabled={p.busy} onClick={p.onReview}>최신 상태와 입력을 검토했습니다</button>:null}
    {canPrepare?<form onSubmit={e=>{e.preventDefault();p.onCreate();}}><label>업체 표시 이름<input aria-label="업체 표시 이름" maxLength={80} required value={p.draft.vendorLabel} disabled={blocked} onChange={e=>p.onDraft({...p.draft,vendorLabel:e.target.value})}/></label><button disabled={blocked||!p.draft.vendorLabel.trim()}>작업 요청 준비</button></form>:null}
    {active&&eligible&&p.handoff?.phase!=="COMPLETION_REPORTED"?<>
      <h3>업체 전달 내용</h3>
      {!source?<p role="alert">전달 후보를 다시 불러오세요. 게시 전 미리보기가 필요합니다.</p>:null}
      <fieldset disabled={blocked} className={styles.editor}><legend>공개 내용 검토</legend>
        <label>작업 설명<textarea aria-label="업체 작업 설명" maxLength={1000} required value={p.draft.workSummary} onChange={e=>p.onDraft({...p.draft,workSummary:e.target.value})}/></label>
        <fieldset><legend>공유할 확인 내용 선택</legend>{source?.sharedDetails.map(detail=><label key={detail.key}><input type="checkbox" checked={p.draft.sharedDetailKeys.includes(detail.key)} onChange={e=>p.onDraft({...p.draft,sharedDetailKeys:choose(p.draft.sharedDetailKeys,detail.key,e.target.checked)})}/>{detail.label}: {detail.value} · {provenance[detail.sourceType]}</label>)}</fieldset>
        <fieldset><legend>공유할 원본 사진 선택</legend><p>사진은 선택한 것만 업체에 공개됩니다.</p>{source?.sourcePhotoIds.map((id,index)=><label key={id}><input type="checkbox" checked={p.draft.allowedPhotoIds.includes(id)} onChange={e=>p.onDraft({...p.draft,allowedPhotoIds:choose(p.draft.allowedPhotoIds,id,e.target.checked)})}/>원본 사진 {index+1}</label>)}</fieldset>
        <label>출입 정책<select aria-label="출입 정책" value={p.draft.accessPolicy} onChange={e=>p.onDraft({...p.draft,accessPolicy:e.target.value as VendorAccessPolicy})}><option value="TENANT_PRESENT_REQUIRED">세입자 재실 필요</option><option value="TENANT_PREAUTHORIZATION_ALLOWED">세입자 별도 사전 동의 허용</option></select></label>
        <p>출입 정책은 세입자 동의가 아닙니다. 세입자가 별도로 선택한 시간에 동의해야 합니다.</p>
        <label>출입 안내<textarea aria-label="출입 안내" aria-describedby="vendor-access-warning" maxLength={500} value={p.draft.accessInstruction} onChange={e=>p.onDraft({...p.draft,accessInstruction:e.target.value})}/></label>
        <p id="vendor-access-warning">개인 연락처나 반복 사용 가능한 출입 비밀번호를 입력하지 마세요. 이 안내는 업체에 공개됩니다.</p>
        <button type="button" disabled={!source} onClick={p.onPreview}>업체 전달 내용 미리보기</button>
      </fieldset>
      {p.preview?<section className={styles.preview} aria-label="업체 전달 내용 미리보기"><h3>게시 전 업체 화면 확인</h3>
        {source?<><dl><dt>접수번호</dt><dd>{source.jobReference}</dd><dt>업체</dt><dd>{assignment?.vendorLabel}</dd><dt>건물</dt><dd>{source.buildingName}</dd><dt>주소</dt><dd>{source.serviceAddress??"주소 확인 필요"}</dd><dt>호실</dt><dd>{source.unitLabel??"호실 확인 필요"}</dd><dt>문제 유형</dt><dd>{source.issueType==="LEAK"?"누수":"난방"}</dd><dt>작업 설명</dt><dd>{p.draft.workSummary}</dd></dl>
          {selectedDetails.map(detail=><p key={detail.key}>{detail.label}: {detail.value} · {provenance[detail.sourceType]}</p>)}
          {source.safetyNotice.map((notice,index)=><p key={index}>{notice}</p>)}
          <h4>선택한 원본 사진</h4>{p.draft.allowedPhotoIds.length?p.draft.allowedPhotoIds.map((id,index)=>{const photo=p.photoPreviews.find(item=>item.photoId===id);return <figure key={id}>{photo?<Image unoptimized src={photo.url} width={640} height={480} style={{width:"100%",height:"auto"}} alt={`선택한 원본 사진 ${index+1}`}/>:<p>사진 불러오는 중 또는 연결 확인 필요</p>}<figcaption>원본 사진 {(source.sourcePhotoIds.indexOf(id)+1)}</figcaption></figure>}):<p>공유 사진 없음</p>}
          <p>출입 정책: {policyLabels[p.draft.accessPolicy]}</p>{p.draft.accessInstruction?<p>출입 안내: {p.draft.accessInstruction}</p>:null}
        </>:null}
        <button type="button" disabled={blocked||!canPublish||!photosReady||!p.draft.workSummary.trim()} onClick={p.onPublish}>업체 전달 내용 게시</button>
      </section>:null}
    </>:null}
    {packet?<details><summary>현재 게시된 전달 내용 · {packet.revision}차</summary><p>{packet.workSummary}</p><p>{packet.buildingName} · {packet.serviceAddress} · {packet.unitLabel}</p>{packet.sharedDetails?.map(detail=><p key={detail.key}>{detail.label}: {detail.value} · {provenance[detail.sourceType]}</p>)}<p>공유 사진 {packet.allowedPhotoIds?.length??0}장 · {policyLabels[packet.accessPolicy]}</p></details>:null}
    {eligible&&packet&&assignment?.status==="PREPARING"&&!p.linkUnavailable?<button type="button" disabled={blocked} onClick={p.onIssue}>보안 링크 발급</button>:null}
    {canReissue&&!p.pendingLink?<button type="button" disabled={p.busy||p.loading||Boolean(p.error)} onClick={p.onReissue}>보안 링크 재발급</button>:null}
    {p.immediateLink?<div className={styles.link}><label>직접 전달할 보안 링크<input aria-label="직접 전달할 보안 링크" readOnly value={p.immediateLink}/></label><p>이 화면의 링크를 복사해 업체에 직접 전달하세요. 새로고침하거나 다른 접수로 이동하면 다시 표시할 수 없습니다.</p></div>:null}
    {active&&p.handoff?.phase!=="COMPLETION_REPORTED"?<button type="button" disabled={blocked} onClick={()=>p.onAction?.("REASSIGN")}>업체 재배정</button>:null}
    {active&&p.handoff?.phase!=="COMPLETION_REPORTED"?<button type="button" disabled={blocked} onClick={p.onRevoke}>업체 접근 철회</button>:null}
    {p.handoff&&(p.handoff.packetHistory.length>0||p.handoff.reportHistory.length>0)?<details className={styles.preview}>
      <summary>전달 내용과 작업 보고 이력 · 읽기 전용</summary>
      <p>이력 조회는 현재 업체나 보고에 대한 처리 대상을 바꾸지 않습니다.</p>
      {p.handoff.packetHistory.map(revision=><details key={revision.id}>
        <summary>{revision.vendorLabel} · 전달 내용 {revision.revision}차 · {formatVendorInstant(revision.publishedAt,at)}</summary>
        <dl><dt>접수번호</dt><dd>{revision.jobReference}</dd><dt>건물</dt><dd>{revision.buildingName}</dd><dt>주소</dt><dd>{revision.serviceAddress}</dd><dt>호실</dt><dd>{revision.unitLabel}</dd><dt>작업 설명</dt><dd>{revision.workSummary}</dd></dl>
        {revision.sharedDetails.map(detail=><p key={detail.key}>{detail.label}: {detail.value} · {provenance[detail.sourceType]}</p>)}
        {revision.safetyNotice.map((notice,index)=><p key={index}>{notice}</p>)}
        <p>출입 정책: {policyLabels[revision.accessPolicy]}</p>{revision.accessInstruction?<p>출입 안내: {revision.accessInstruction}</p>:null}
        <p>공유한 원본 사진 {revision.allowedPhotoIds.length}장</p>
      </details>)}
      <label>이전 작업 보고<select aria-label="이전 작업 보고" value={historyReport?.id??""} onChange={e=>p.onHistoryReport?.(e.target.value||null)}>
        <option value="">조회할 보고 선택</option>{p.handoff.reportHistory.filter(report=>report.id!==p.handoff?.currentReport?.id).map(report=><option key={report.id} value={report.id}>
          {p.handoff?.packetHistory.find(packet=>packet.assignmentId===report.assignmentId)?.vendorLabel??"업체"} · 보고 {report.revision}차 · {formatVendorInstant(report.submittedAt,at)}
        </option>)}
      </select></label>
      {historyReport?<section aria-label="이전 작업 보고 내용"><h3>이전 작업 보고 · {historyReport.revision}차</h3><p>{historyReport.workSummary}</p>
        {historyReport.componentOrPartNote?<p>사용한 부품·자재: {historyReport.componentOrPartNote}</p>:null}
        {historyReport.photoOmissionReason?<p>보고 사진 없음 · {OMISSION_LABELS[historyReport.photoOmissionReason]}</p>:historyReport.completionPhotoIds.map((id,index)=>{const photo=p.reportPhotos?.find(item=>item.photoId===id);return <figure key={id}>{photo?<Image unoptimized src={photo.url} width={640} height={480} style={{width:"100%",height:"auto"}} alt={`이전 업체 보고 사진 ${index+1}`}/>:<p>사진 불러오는 중 또는 연결 확인 필요</p>}</figure>;})}
      </section>:null}
    </details>:null}
  </section>;
}

type ManagerActionIntent={kind:ManagerAction;assignmentId:string;assignmentVersion:number;reportId:string|null;communicationVersion?:number;clientRequestId:string};
function currentActionIntent(intent:ManagerActionIntent|null,handoff:ManagerVendorHandoffDto|null,communicationVersion?:number):boolean{
  if(!intent||!handoff?.assignment||handoff.assignment.status==="ENDED"||handoff.assignment.id!==intent.assignmentId||handoff.assignment.version!==intent.assignmentVersion)return false;
  if(intent.kind==="REASSIGN")return handoff.phase!=="COMPLETION_REPORTED";
  return handoff.phase==="COMPLETION_REPORTED"&&!handoff.correctionRequest&&handoff.currentReport?.id===intent.reportId
    &&(intent.kind!=="CLOSEOUT"||intent.communicationVersion===communicationVersion);
}
const blankDraft:VendorPacketDraft={vendorLabel:"",workSummary:"",sharedDetailKeys:[],allowedPhotoIds:[],accessPolicy:"TENANT_PRESENT_REQUIRED",accessInstruction:""};
type ManagerProps={communicationVersion?:number;client:CoreFlowClient;ticket:CoreTicketDto;revision:number;onHandoff:(handoff:ManagerVendorHandoffDto|null)=>void;onChanged:()=>void;now?:()=>Date};
const systemNow=()=>new Date();
export function VendorHandoffManager(props:ManagerProps){return <LoadedVendorHandoffManager key={`${props.ticket.ticketId}-${props.revision}`} {...props}/>;}
function LoadedVendorHandoffManager({client,ticket,onHandoff,onChanged,communicationVersion,now=systemNow}:ManagerProps){
  const [handoff,setHandoff]=useState<ManagerVendorHandoffDto|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [draft,setDraft]=useState(blankDraft),[preview,setPreview]=useState(false),[uncertain,setUncertain]=useState(false),[linkUnavailable,setLinkUnavailable]=useState(false),[immediateLink,setImmediateLink]=useState<string|null>(null);
  const [validationError,setValidationError]=useState(""),[pendingLink,setPendingLink]=useState<PendingLinkRequest|null>(null);
  const [photoPreviews,setPhotoPreviews]=useState<{photoId:string;url:string}[]>([]),[rescheduleReview,setRescheduleReview]=useState(false);
  const [historyReportId,setHistoryReportId]=useState<string|null>(null);
  const [reportPhotos,setReportPhotos]=useState<{photoId:string;url:string}[]>([]);
  const [intent,setIntent]=useState<ManagerActionIntent|null>(null),[actionText,setActionText]=useState("");
  const action=currentActionIntent(intent,handoff,communicationVersion)?intent!.kind:null;
  const generation=useRef(0),sending=useRef(false);
  const pendingLinkRef=useRef<PendingLinkRequest|null>(null);
  const linkAssignmentRef=useRef<string|null>(null);
  const rememberLink=useCallback((value:PendingLinkRequest|null)=>{if(value)linkAssignmentRef.current=value.assignmentId;pendingLinkRef.current=value;setPendingLink(value);},[]);
  const invalidate=useCallback(()=>{generation.current++;},[]);
  const apply=useCallback((value:ManagerVendorHandoffDto|null)=>{
    const linkAssignment=linkAssignmentRef.current;
    if(value&&linkAssignment&&(value.assignment?.id!==linkAssignment||value.assignment.status==="ENDED")){
      linkAssignmentRef.current=null;rememberLink(null);setUncertain(false);setLinkUnavailable(false);setImmediateLink(null);setNotice("");
    }
    setIntent(previous=>currentActionIntent(previous,value,previous?.communicationVersion)?previous:null);
    setHandoff(value);onHandoff(value);
  },[onHandoff,rememberLink]);
  const refresh=useCallback(async()=>{
    const current=++generation.current;setLoading(true);setImmediateLink(null);setError("");setRescheduleReview(false);onHandoff(null);
    try{const h=await client.vendorHandoff.readHandoff(ticket.ticketId);if(current===generation.current)apply(h);}
    catch{if(current===generation.current){apply(null);setError("업체 연결 상태를 확인하지 못했습니다. 다시 불러오세요.");}}
    finally{if(current===generation.current)setLoading(false);}
  },[client,ticket.ticketId,apply,onHandoff]);
  useEffect(()=>{let live=true;void Promise.resolve().then(()=>{if(live)void refresh();});return()=>{live=false;invalidate();};},[refresh,invalidate]);
  const photoKey=draft.allowedPhotoIds.join(",");
  useEffect(()=>{
    let live=true;const urls:string[]=[];
    void (async()=>{const loaded:{photoId:string;url:string}[]=[];try{
      if(photoKey){const metadata=await client.photos(ticket.ticketId);for(const id of photoKey.split(",")){const photo=metadata.find(item=>item.photoId===id);if(!photo)throw new Error("PHOTO_UNAVAILABLE");const blob=await client.readPhoto(photo);if(!live)return;const url=URL.createObjectURL(blob);urls.push(url);loaded.push({photoId:id,url});}}
      if(live)setPhotoPreviews(loaded);
    }catch{if(live)setPhotoPreviews([]);}})();return()=>{live=false;urls.forEach(url=>URL.revokeObjectURL(url));};
  },[client,ticket.ticketId,photoKey]);
  // Current and explicitly selected historical report photos share the existing ATTACHED-only Manager authorization.
  const historicalReport=handoff?.reportHistory.find(report=>report.id===historyReportId);
  const reportKey=[...new Set([...(handoff?.currentReport?.completionPhotoIds??[]),...(historicalReport?.completionPhotoIds??[])])].join(",");
  useEffect(()=>{
    let live=true;const urls:string[]=[];
    void (async()=>{const loaded:{photoId:string;url:string}[]=[];try{
      for(const id of reportKey?reportKey.split(","):[]){const blob=await client.vendorCompletionPhoto(ticket.ticketId,id);if(!live)return;const url=URL.createObjectURL(blob);urls.push(url);loaded.push({photoId:id,url});}
      if(live)setReportPhotos(loaded);
    }catch{if(live)setReportPhotos([]);}})();return()=>{live=false;urls.forEach(url=>URL.revokeObjectURL(url));};
  },[client,ticket.ticketId,reportKey]);
  const mutate=async(kind:"CREATE"|"PUBLISH"|"ISSUE"|"REISSUE"|"REVOKE"|"RESCHEDULE"|ManagerAction,operation:()=>Promise<ManagerVendorHandoffDto|VendorLinkIssueDto>)=>{
    if(sending.current)return;sending.current=true;const current=++generation.current;setBusy(true);setError("");setNotice("");setImmediateLink(null);setRescheduleReview(false);onHandoff(null);
    try{
      const result=await reconcileManagerHandoff(client.vendorHandoff,ticket.ticketId,operation,()=>current===generation.current);
      if(current!==generation.current)return;apply(result.handoff);
      // Every completed attempt needs a new explicit review; an uncertain result never reuses old text.
      setIntent(null);setActionText("");
      if(result.kind!=="success"){
        const rejected=result.kind==="rejected";
        setUncertain(!rejected&&((kind!=="ISSUE"&&kind!=="REISSUE")||pendingLinkRef.current!==null));setPreview(false);
        if(kind==="ISSUE"||kind==="REISSUE"){
          if(rejected)rememberLink(null);
          setLinkUnavailable(false);
        }
        if(!result.handoff)setError("최신 상태를 확인하지 못했습니다. 다시 불러오세요.");
        else if(result.kind==="rejected")setNotice("입력 또는 최신 상태를 확인한 뒤 명시적으로 다시 검토하세요.");
        return;
      }
      setUncertain(false);setPreview(false);
      if(kind==="ISSUE"||kind==="REISSUE"){
        rememberLink(null);
        const value=result.value as VendorLinkIssueDto,currentAssignment=result.handoff?.assignment;
        const currentAuthority=Boolean(result.handoff?.currentPacket&&currentAssignment?.id===value.assignmentId&&["OFFERED","ACTIVE"].includes(currentAssignment.status));
        const link=result.handoff?resolveDeliverableLink(value,window.location.origin,result.handoff):null;
        linkAssignmentRef.current=currentAuthority?value.assignmentId:null;setImmediateLink(link);setLinkUnavailable(currentAuthority&&!link);
        setNotice(link?"보안 링크를 발급했습니다. 업체에 직접 전달하세요.":currentAuthority?"발급 기록을 확인했습니다. 원래 링크는 다시 표시할 수 없습니다.":"발급 기록은 이전 상태입니다. 최신 업체 연결 상태를 확인하세요.");
      }else{
        if(kind==="CREATE"){linkAssignmentRef.current=null;setLinkUnavailable(false);}
        setNotice(kind==="CREATE"?"작업 요청 준비를 저장했습니다.":kind==="PUBLISH"?"업체 전달 내용을 게시했습니다.":kind==="RESCHEDULE"?"방문 일정 변경을 기록했습니다. 세입자와 업체가 새로 일정을 조율합니다.":kind==="CLOSEOUT"?"최신 처리 완료 및 업체 접근 종료 상태를 확인했습니다.":kind==="CORRECTION"?"보고 수정 요청을 기록했습니다.":kind==="MORE_WORK"?"추가 작업 요청을 기록했습니다.":kind==="REASSIGN"?"업체 재배정을 기록했습니다.":"업체 접근 철회를 기록했습니다.");
      }
      onChanged();
    }finally{if(current===generation.current)setBusy(false);sending.current=false;}
  };
  const create=()=>{
    const parsed=VendorCreateAssignmentCommandSchema.safeParse({clientRequestId:crypto.randomUUID(),expectedTicketVersion:ticket.version,vendorLabel:draft.vendorLabel});
    if(!parsed.success){setValidationError("업체 표시 이름을 확인하세요.");return;}setValidationError("");void mutate("CREATE",()=>client.vendorHandoff.createAssignment(ticket.ticketId,parsed.data));
  };
  const publish=()=>{
    if(!handoff?.assignment||!preview)return;
    const parsed=VendorPublishPacketCommandSchema.safeParse({clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:handoff.assignment.version,expectedPacketRevisionId:handoff.currentPacket?.id??null,workSummary:draft.workSummary,sharedDetailKeys:draft.sharedDetailKeys,allowedPhotoIds:draft.allowedPhotoIds,accessPolicy:draft.accessPolicy,accessInstruction:draft.accessInstruction.trim()||null});
    if(!parsed.success){setValidationError("업체 전달 내용의 입력을 확인하세요.");return;}setValidationError("");void mutate("PUBLISH",()=>client.vendorHandoff.publishPacket(handoff.assignment!.id,parsed.data));
  };
  const recoverLink=(request:PendingLinkRequest)=>void mutate(request.kind,()=>request.kind==="REISSUE"?client.vendorHandoff.reissueLink(request.assignmentId,request.input):client.vendorHandoff.issueLink(request.assignmentId,request.input));
  const link=(reissue:boolean)=>{
    if(pendingLink||!handoff?.assignment||!handoff.currentPacket)return;
    const input={clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:handoff.assignment.version,expectedPacketRevisionId:handoff.currentPacket.id};
    const request:PendingLinkRequest={kind:reissue?"REISSUE":"ISSUE",assignmentId:handoff.assignment.id,input};
    rememberLink(request);recoverLink(request);
  };
  const reschedule=()=>{
    const assignment=handoff?.assignment,round=handoff?.currentRound,appointment=handoff?.appointment,packet=handoff?.currentPacket;
    if(!assignment||!round||!packet||appointment?.status!=="SCHEDULED")return;
    void mutate("RESCHEDULE",()=>client.vendorHandoff.reschedule(assignment.id,{clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:assignment.version,expectedRoundVersion:round.version,expectedAppointmentId:appointment.id,expectedPacketRevisionId:packet.id}));
  };
  const revoke=()=>{if(handoff?.assignment)void mutate("REVOKE",()=>client.vendorHandoff.revoke(handoff.assignment!.id,{clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:handoff.assignment!.version}));};
  const submitAction=()=>{
    if(!action||!intent||!handoff?.assignment)return;
    const id=intent.assignmentId,base={clientRequestId:intent.clientRequestId,expectedAssignmentVersion:intent.assignmentVersion};
    if(action==="REASSIGN"){
      const parsed=VendorReassignCommandSchema.safeParse({...base,vendorLabel:actionText});
      if(!parsed.success){setValidationError("새 업체 표시 이름을 확인하세요.");return;}
      void mutate(action,()=>client.vendorHandoff.reassign(id,parsed.data));return;
    }
    if(!handoff.currentReport||handoff.correctionRequest)return;
    const report={...base,expectedCompletionReportId:intent.reportId!};
    if(action==="MORE_WORK"){void mutate(action,()=>client.vendorHandoff.requireFollowUp(id,report));return;}
    if(action==="CORRECTION"){
      const parsed=VendorRequestCorrectionCommandSchema.safeParse({...report,reason:actionText});
      if(!parsed.success){setValidationError("수정 요청 사유를 확인하세요.");return;}
      void mutate(action,()=>client.vendorHandoff.requestCorrection(id,parsed.data));return;
    }
    const parsed=VendorCloseoutCommandSchema.safeParse({...report,expectedCommunicationVersion:intent.communicationVersion,message:actionText});
    if(!parsed.success){setValidationError("처리 내용과 최신 공개 문답을 확인하세요.");return;}
    void mutate(action,()=>client.vendorHandoff.closeout(id,parsed.data));
  };
  return <VendorHandoffManagerView action={action} actionText={actionText} onAction={value=>{setIntent(value&&handoff?.assignment?{kind:value,assignmentId:handoff.assignment.id,assignmentVersion:handoff.assignment.version,reportId:handoff.currentReport?.id??null,communicationVersion,clientRequestId:crypto.randomUUID()}:null);setActionText("");setValidationError("");}} onActionText={setActionText} onSubmitAction={submitAction} communicationVersion={communicationVersion} ticket={ticket} handoff={handoff} loading={loading} busy={busy} error={error} validationError={validationError} notice={notice} uncertain={uncertain} pendingLink={pendingLink} linkUnavailable={linkUnavailable} immediateLink={immediateLink} preview={preview} draft={draft} photoPreviews={photoPreviews} onDraft={value=>{setDraft(value);setPreview(false);setValidationError("");}} onPreview={()=>setPreview(true)} onCreate={create} onPublish={publish} onIssue={()=>link(false)} onReissue={()=>link(true)} onReconcileLink={()=>{if(pendingLink)recoverLink(pendingLink);}} onRevoke={revoke} onRefresh={()=>void refresh()} onReview={()=>{setUncertain(false);setNotice("");}}
    now={now()} rescheduleReview={rescheduleReview} onRescheduleReview={setRescheduleReview} onReschedule={reschedule} reportPhotos={reportPhotos} historyReportId={historyReportId} onHistoryReport={setHistoryReportId}/>;
}
