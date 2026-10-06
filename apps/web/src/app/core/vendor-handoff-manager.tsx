"use client";
import { useCallback,useEffect,useRef,useState,type ReactNode } from "react";
import { VendorCreateAssignmentCommandSchema,VendorPublishPacketCommandSchema,type CoreTicketDto,type ManagerVendorHandoffDto,type VendorLinkIssueDto,type VendorAccessPolicy } from "@build-manager/api-contracts";
import { ApiClientError,type CoreVendorHandoffClient,type CoreFlowClient } from "@build-manager/api-client";
import styles from "./vendor-handoff.module.css";
import Image from "next/image";
export type VendorPacketDraft={vendorLabel:string;workSummary:string;sharedDetailKeys:string[];allowedPhotoIds:string[];accessPolicy:VendorAccessPolicy;accessInstruction:string};
export type VendorHandoffViewProps={ticket:CoreTicketDto;handoff:ManagerVendorHandoffDto|null;loading:boolean;busy:boolean;error:string;notice:string;uncertain:boolean;linkUnavailable:boolean;immediateLink:string|null;preview:boolean;draft:VendorPacketDraft;photoPreviews:{photoId:string;url:string}[];onDraft:(draft:VendorPacketDraft)=>void;onPreview:()=>void;onCreate:()=>void;onPublish:()=>void;onIssue:()=>void;onReissue:()=>void;onRevoke:()=>void;onRefresh:()=>void;onReview:()=>void};
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
  const assignment=p.handoff?.assignment,active=Boolean(assignment&&assignment.status!=="ENDED"),eligible=vendorHandoffEligible(p.ticket);
  const source=p.handoff?.packetSource,packet=p.handoff?.currentPacket;
  const canPrepare=eligible&&(!assignment||assignment.status==="ENDED");
  const canPublish=active&&eligible&&!p.handoff?.currentReport&&Boolean(source?.serviceAddress&&source.unitLabel);
  const canReissue=eligible&&Boolean(packet)&&["OFFERED","ACTIVE"].includes(assignment?.status??"");
  const blocked=p.busy||p.loading||Boolean(p.error)||p.uncertain;
  const selectedDetails=source?.sharedDetails.filter(d=>p.draft.sharedDetailKeys.includes(d.key))??[];
  const photosReady=p.draft.allowedPhotoIds.every(id=>p.photoPreviews.some(photo=>photo.photoId===id));
  const choose=(values:string[],key:string,checked:boolean)=>checked?[...values,key]:values.filter(v=>v!==key);
  return <section className={styles.panel} aria-label="업체 연결 및 작업 요청">
    <h2>업체 연결 / 작업 요청</h2>
    {p.loading?<p role="status">업체 연결 상태 불러오는 중…</p>:null}
    {p.error?<p role="alert">{p.error}</p>:null}
    {p.notice?<p role="status">{p.notice}</p>:null}
    {assignment?<p>업체 {assignment.vendorLabel} · {assignment.status==="PREPARING"?"전달 준비":assignment.status==="OFFERED"?"요청 확인 대기":assignment.status==="ACTIVE"?"작업 진행":"연결 종료"}</p>:null}
    {p.uncertain?<p role="alert">저장 결과를 확정하지 못했습니다. 최신 상태를 먼저 확인하세요. 같은 화면 값만으로 성공을 확정하지 않습니다.</p>:null}
    {p.linkUnavailable?<p role="status">원래 링크는 다시 표시할 수 없습니다. 최신 상태에서 허용되는 경우 보안 링크를 재발급해 직접 전달하세요.</p>:null}
    <button type="button" disabled={p.busy||p.loading} onClick={p.onRefresh}>업체 연결 상태 다시 확인</button>
    {p.uncertain&&!p.linkUnavailable&&p.handoff&&!p.error?<button type="button" disabled={p.busy} onClick={p.onReview}>최신 상태와 입력을 검토했습니다</button>:null}
    {canPrepare?<form onSubmit={e=>{e.preventDefault();p.onCreate();}}><label>업체 표시 이름<input aria-label="업체 표시 이름" maxLength={80} required value={p.draft.vendorLabel} disabled={blocked} onChange={e=>p.onDraft({...p.draft,vendorLabel:e.target.value})}/></label><button disabled={blocked||!p.draft.vendorLabel.trim()}>작업 요청 준비</button></form>:null}
    {active&&eligible&&!p.handoff?.currentReport?<>
      <h3>업체 전달 내용</h3>
      {!source?<p role="alert">전달 후보를 다시 불러오세요. 게시 전 미리보기가 필요합니다.</p>:null}
      <fieldset disabled={blocked} className={styles.editor}><legend>공개 내용 검토</legend>
        <label>작업 설명<textarea aria-label="업체 작업 설명" maxLength={1000} required value={p.draft.workSummary} onChange={e=>p.onDraft({...p.draft,workSummary:e.target.value})}/></label>
        <fieldset><legend>공유할 확인 내용 선택</legend>{source?.sharedDetails.map(detail=><label key={detail.key}><input type="checkbox" checked={p.draft.sharedDetailKeys.includes(detail.key)} onChange={e=>p.onDraft({...p.draft,sharedDetailKeys:choose(p.draft.sharedDetailKeys,detail.key,e.target.checked)})}/>{detail.label}: {detail.value} · {provenance[detail.sourceType]}</label>)}</fieldset>
        <fieldset><legend>공유할 원본 사진 선택</legend><p>사진은 선택한 것만 업체에 공개됩니다.</p>{source?.sourcePhotoIds.map((id,index)=><label key={id}><input type="checkbox" checked={p.draft.allowedPhotoIds.includes(id)} onChange={e=>p.onDraft({...p.draft,allowedPhotoIds:choose(p.draft.allowedPhotoIds,id,e.target.checked)})}/>원본 사진 {index+1}</label>)}</fieldset>
        <label>출입 정책<select aria-label="출입 정책" value={p.draft.accessPolicy} onChange={e=>p.onDraft({...p.draft,accessPolicy:e.target.value as VendorAccessPolicy})}><option value="TENANT_PRESENT_REQUIRED">세입자 재실 필요</option><option value="TENANT_PREAUTHORIZATION_ALLOWED">세입자 별도 사전 동의 허용</option></select></label>
        <p>출입 정책은 세입자 동의가 아닙니다. 세입자가 별도로 선택한 시간에 동의해야 합니다.</p>
        <label>출입 안내<textarea aria-label="출입 안내" maxLength={500} value={p.draft.accessInstruction} onChange={e=>p.onDraft({...p.draft,accessInstruction:e.target.value})}/></label>
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
    {canReissue?<button type="button" disabled={p.busy||p.loading||Boolean(p.error)} onClick={p.onReissue}>보안 링크 재발급</button>:null}
    {p.immediateLink?<div className={styles.link}><label>직접 전달할 보안 링크<input aria-label="직접 전달할 보안 링크" readOnly value={p.immediateLink}/></label><p>이 화면의 링크를 복사해 업체에 직접 전달하세요. 새로고침하거나 다른 접수로 이동하면 다시 표시할 수 없습니다.</p></div>:null}
    {active?<button type="button" disabled={blocked} onClick={p.onRevoke}>업체 접근 철회</button>:null}
  </section>;
}

const blankDraft:VendorPacketDraft={vendorLabel:"",workSummary:"",sharedDetailKeys:[],allowedPhotoIds:[],accessPolicy:"TENANT_PRESENT_REQUIRED",accessInstruction:""};
type ManagerProps={client:CoreFlowClient;ticket:CoreTicketDto;revision:number;onHandoff:(handoff:ManagerVendorHandoffDto|null)=>void;onChanged:()=>void};
export function VendorHandoffManager(props:ManagerProps){return <LoadedVendorHandoffManager key={`${props.ticket.ticketId}-${props.revision}`} {...props}/>;}
function LoadedVendorHandoffManager({client,ticket,onHandoff,onChanged}:ManagerProps){
  const [handoff,setHandoff]=useState<ManagerVendorHandoffDto|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [draft,setDraft]=useState(blankDraft),[preview,setPreview]=useState(false),[uncertain,setUncertain]=useState(false),[linkUnavailable,setLinkUnavailable]=useState(false),[immediateLink,setImmediateLink]=useState<string|null>(null);
  const [photoPreviews,setPhotoPreviews]=useState<{photoId:string;url:string}[]>([]);
  const generation=useRef(0),sending=useRef(false);
  const invalidate=useCallback(()=>{generation.current++;},[]);
  const apply=useCallback((value:ManagerVendorHandoffDto|null)=>{setHandoff(value);onHandoff(value);},[onHandoff]);
  const refresh=useCallback(async()=>{
    const current=++generation.current;setLoading(true);setImmediateLink(null);setError("");onHandoff(null);
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
  const mutate=async(kind:"CREATE"|"PUBLISH"|"ISSUE"|"REISSUE"|"REVOKE",operation:()=>Promise<ManagerVendorHandoffDto|VendorLinkIssueDto>)=>{
    if(sending.current)return;sending.current=true;const current=++generation.current;setBusy(true);setError("");setNotice("");setImmediateLink(null);onHandoff(null);
    try{
      const result=await reconcileManagerHandoff(client.vendorHandoff,ticket.ticketId,operation,()=>current===generation.current);
      if(current!==generation.current)return;apply(result.handoff);
      if(result.kind!=="success"){
        setUncertain(true);setPreview(false);
        if(kind==="ISSUE"||kind==="REISSUE")setLinkUnavailable(true);
        if(!result.handoff)setError("최신 상태를 확인하지 못했습니다. 다시 불러오세요.");
        else if(result.kind==="rejected")setNotice("입력 또는 최신 상태를 확인한 뒤 명시적으로 다시 검토하세요.");
        return;
      }
      setUncertain(false);setPreview(false);
      if(kind==="ISSUE"||kind==="REISSUE"){
        const value=result.value as VendorLinkIssueDto;const link=result.handoff?resolveDeliverableLink(value,window.location.origin,result.handoff):null;setImmediateLink(link);setLinkUnavailable(!link);
        setNotice(link?"보안 링크를 발급했습니다. 업체에 직접 전달하세요.":"발급 기록을 확인했습니다. 원래 링크는 다시 표시할 수 없습니다.");
      }else{setNotice(kind==="CREATE"?"작업 요청 준비를 저장했습니다.":kind==="PUBLISH"?"업체 전달 내용을 게시했습니다.":"업체 접근 철회를 기록했습니다.");}
      onChanged();
    }finally{if(current===generation.current)setBusy(false);sending.current=false;}
  };
  const create=()=>{
    const parsed=VendorCreateAssignmentCommandSchema.safeParse({clientRequestId:crypto.randomUUID(),expectedTicketVersion:ticket.version,vendorLabel:draft.vendorLabel});
    if(!parsed.success){setError("업체 표시 이름을 확인하세요.");return;}void mutate("CREATE",()=>client.vendorHandoff.createAssignment(ticket.ticketId,parsed.data));
  };
  const publish=()=>{
    if(!handoff?.assignment||!preview)return;
    const parsed=VendorPublishPacketCommandSchema.safeParse({clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:handoff.assignment.version,expectedPacketRevisionId:handoff.currentPacket?.id??null,workSummary:draft.workSummary,sharedDetailKeys:draft.sharedDetailKeys,allowedPhotoIds:draft.allowedPhotoIds,accessPolicy:draft.accessPolicy,accessInstruction:draft.accessInstruction.trim()||null});
    if(!parsed.success){setError("업체 전달 내용의 입력을 확인하세요.");return;}void mutate("PUBLISH",()=>client.vendorHandoff.publishPacket(handoff.assignment!.id,parsed.data));
  };
  const link=(reissue:boolean)=>{
    if(!handoff?.assignment||!handoff.currentPacket)return;
    const input={clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:handoff.assignment.version,expectedPacketRevisionId:handoff.currentPacket.id};
    void mutate(reissue?"REISSUE":"ISSUE",()=>reissue?client.vendorHandoff.reissueLink(handoff.assignment!.id,input):client.vendorHandoff.issueLink(handoff.assignment!.id,input));
  };
  const revoke=()=>{if(handoff?.assignment)void mutate("REVOKE",()=>client.vendorHandoff.revoke(handoff.assignment!.id,{clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:handoff.assignment!.version}));};
  return <VendorHandoffManagerView ticket={ticket} handoff={handoff} loading={loading} busy={busy} error={error} notice={notice} uncertain={uncertain} linkUnavailable={linkUnavailable} immediateLink={immediateLink} preview={preview} draft={draft} photoPreviews={photoPreviews} onDraft={value=>{setDraft(value);setPreview(false);setError("");}} onPreview={()=>setPreview(true)} onCreate={create} onPublish={publish} onIssue={()=>link(false)} onReissue={()=>link(true)} onRevoke={revoke} onRefresh={()=>void refresh()} onReview={()=>{setUncertain(false);setNotice("");}}/>;
}
