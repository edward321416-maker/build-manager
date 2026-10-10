"use client";

import { createCoreFlowClient,ApiClientError } from "@build-manager/api-client";
import { CoreCreateFollowUpSchema,type CoreCreateFollowUp,type CoreSessionDto,type CoreTicketDto,type CoreUnitDto,type ManagerVendorHandoffDto } from "@build-manager/api-contracts";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import { TicketIntake } from "../../components/tenant/ticket-intake";
import { TicketReview } from "../../components/landlord/ticket-review";
import { PhotoPicker,PhotoGallery,photoError,type PendingPhoto } from "../../components/core-photos";
import { DraftBadge,isIntakeDraft,WorkStatusBadge } from "./ui/work-status-badge";
import { EnvironmentNote,TicketProgress,ManagerInspector,TaskZone } from "./ui/core-display";
import styles from "./core-design.module.css";
import { ManagerWorkQueue,ManagerWorkDetail } from "./manager-work";
import { ManagerMaintenanceFactEditor,ManagerMaintenanceTimeline } from "./manager-maintenance-timeline";
import { TicketCommunication,CommunicationBadge,useCommunicationSummaries } from "./ticket-communication";
import { clearCommunicationRecovery } from "./communication-recovery";
import { clearOutcomeRecovery,saveOutcomeRecovery } from "./outcome-recovery";
import { FollowUpContext,freshFollowUp,OutcomeRecoveryPanel,TicketOutcome,type FollowUpKind } from "./ticket-outcome";
import { createRequestFence,sendFollowUp } from "./follow-up-request";
import { VendorHandoffManager,ManagerDirectCompletionGate } from "./vendor-handoff-manager";
import { VendorHandoffTenant } from "./vendor-handoff-tenant";

const eventLabels:Record<string,string>={CREATED:"접수 내용 저장",ANSWERED:"답변 저장",FINALIZED:"수리 요청 제출",MORE_INFO:"추가 확인 요청",DECISION:"추천 경로 결정",HANDLING:"처리 기록"};
type IntakeState=CoreTicketDto["detail"]["status"];
// Intake steps that still wait on the tenant stay open above the record instead of collapsed at the bottom.
const openIntakeStates:IntakeState[]=["IN_PROGRESS","NEEDS_MORE_INFO","SAFETY_ESCALATED"];
const tenantIntakeOpen=(t:CoreTicketDto)=>t.workStatus==="OPEN"&&openIntakeStates.includes(t.detail.status);
const intakeTaskMessage=(status:IntakeState)=>status==="NEEDS_MORE_INFO"?"답한 뒤 다시 제출해 주세요.":status==="SAFETY_ESCALATED"?"아래 안내를 먼저 확인해 주세요.":"질문에 모두 답하면 '수리 요청 제출' 버튼이 나와요.";
function progressMessage(t:CoreTicketDto,tenant:boolean){
  if(t.workStatus==="COMPLETED")return "관리자가 완료로 기록했습니다.";
  if(t.workStatus==="IN_PROGRESS")return tenant?"관리자가 확인하고 있어요.":"처리 중이에요.";
  switch(t.detail.status){
    case "IN_PROGRESS":return tenant?"아직 보내지 않았어요. 아래 질문에 답하고 '수리 요청 제출'을 눌러야 관리자에게 전달돼요.":"세입자가 아직 질문에 답하는 중이에요.";
    case "NEEDS_MORE_INFO":return tenant?"관리자가 추가 확인을 요청했어요. 아래 질문에 답해 주세요.":"세입자의 추가 답변을 기다리고 있어요.";
    case "SAFETY_ESCALATED":return tenant?"안전 확인이 필요해요.":"안전 확인이 필요한 접수예요.";
    case "PARTIAL":return tenant?"관리자에게 보냈어요. 부족한 정보가 있으면 관리자가 다시 물어볼 거예요.":"세입자가 제출했어요. 필수 정보가 부족해요.";
    default:return tenant?"관리자에게 보냈어요. 확인을 기다리고 있어요.":"세입자가 제출했어요.";
  }
}
const sessionMessage="접속이 만료되었거나 코드가 유효하지 않습니다. 개발 환경에서 새 코드를 발급받아 다시 들어가 주세요.";
const accessMessage="이 계정의 접근 권한을 확인할 수 없습니다. 관리자에게 소속·호실 권한을 확인한 뒤 다시 들어가 주세요.";
function describeError(error:unknown,saving:boolean){
  if(error instanceof ApiClientError){
    if(error.status===401)return sessionMessage;
    if(error.status===403)return accessMessage;
    if(error.status===404)return "접수 내역을 열 수 없습니다. 목록을 새로고침하고 접근 가능한 내역을 선택해 주세요.";
    if(error.status===409)return "다른 변경이 먼저 저장되었습니다. 새로고침으로 최신 상태를 확인한 뒤 다시 진행해 주세요.";
    if(error.status===400)return "입력 내용을 확인해 주세요. 설명이나 처리 기록에 공백만 입력할 수 없습니다.";
  }
  return saving?"저장 결과를 확인하지 못했습니다. 입력은 유지했습니다. 연결을 확인하고 새로고침으로 이력을 먼저 확인해 주세요. 중복 접수를 막기 위해 바로 다시 제출하지 마세요.":"내용을 불러오지 못했습니다. 연결을 확인하고 다시 불러오기를 눌러 주세요.";
}
export default function CoreFlowPage({b1,onDenied,onLogout}:{b1?:{orgId:string;csrf:string};onDenied?:()=>void;onLogout?:()=>void}={}){
  const [session,setSession]=useState<CoreSessionDto|null>(null),[code,setCode]=useState("");
  const [units,setUnits]=useState<CoreUnitDto[]>([]),[unit,setUnit]=useState("");
  const [tickets,setTickets]=useState<CoreTicketDto[]>([]),[selected,setSelected]=useState<CoreTicketDto|null>(null);
  const [managerView,setManagerView]=useState<"WORK_QUEUE"|"MAINTENANCE">("WORK_QUEUE"),[maintenanceUnit,setMaintenanceUnit]=useState("");
  const [inspectorExpanded,setInspectorExpanded]=useState(false);
  const [issue,setIssue]=useState<"HEATING"|"LEAK">("HEATING"),[text,setText]=useState(""),[message,setMessage]=useState("");
  const [busy,setBusy]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[revision,setRevision]=useState(0);
  const [pending,setPending]=useState<PendingPhoto[]>([]),[photoMessage,setPhotoMessage]=useState("");
  const [communicationVersion,setCommunicationVersion]=useState<{ticketId:string;version:number}|null>(null);
  const [managerHandoff,setManagerHandoff]=useState<ManagerVendorHandoffDto|null>(null);
  const onManagerHandoff=useCallback((value:ManagerVendorHandoffDto|null)=>setManagerHandoff(value),[]);
  const [followUp,setFollowUp]=useState<ReturnType<typeof freshFollowUp>|null>(null),[followAttempt,setFollowAttempt]=useState<CoreCreateFollowUp|null>(null);
  const followSending=useRef(false);
  const [accessGeneration]=useState(createRequestFence);
  const detailHeading=useRef<HTMLHeadingElement>(null),errorPanel=useRef<HTMLDivElement>(null);
  const clearAccess=useCallback(()=>{accessGeneration.invalidate();clearCommunicationRecovery();clearOutcomeRecovery();setFollowUp(null);setFollowAttempt(null);setCommunicationVersion(null);setManagerHandoff(null);setSession(null);setSelected(null);setTickets([]);setUnits([]);setUnit("");setText("");setMessage("");setCode("");setNotice("");setPending([]);setPhotoMessage("");setManagerView("WORK_QUEUE");setMaintenanceUnit("");},[accessGeneration]);
  // The embedded intake/review also uses this client: a denied nested request
  // must clear the parent screen, not leave old protected content visible.
  const client=useMemo(()=>{const guarded:typeof fetch=async(input,init)=>{
    const headers=new Headers(init?.headers);if(b1){headers.set("x-core-organization",b1.orgId);headers.set("x-b1-csrf",b1.csrf);}
    const response=await fetch(input,{...init,headers});
    if(response.status===401||response.status===403){clearCommunicationRecovery();clearOutcomeRecovery();}
    if(b1&&(response.status===401||response.status===403))onDenied?.();
    if((response.status===401||response.status===403)&&!String(input).endsWith("/session")){
      clearAccess();setError(response.status===401?sessionMessage:accessMessage);
    }
    if(response.status===404&&String(input).includes("/manager/")&&String(input).includes("maintenance")){
      clearAccess();setError(accessMessage);
    }
    return response;
  };return createCoreFlowClient({baseUrl:"",fetchImpl:guarded,photoFetchImpl:guarded});},[clearAccess,b1,onDenied]);
  const conversationSummaries=useCommunicationSummaries(client,session?.role==="TENANT"&&!selected?tickets.map(t=>t.ticketId):[],revision);
  const run=async(action:()=>Promise<void>,saving=false)=>{
    setBusy(true);setError("");setNotice("");
    try{await action();}catch(e){
      if(e instanceof ApiClientError&&(e.status===401||e.status===403))clearAccess();
      else if(e instanceof ApiClientError&&e.status===404)setSelected(null);
      setError(describeError(e,saving));
    }finally{setBusy(false);}
  };
  useEffect(()=>{let live=true;void (async()=>{
    try{const s=await client.session(),u=await client.units(),t=await client.tickets();if(live){setSession(s);setUnits(u);setUnit(u[0]?.id??"");setTickets(t);}}
    catch(e){if(live&&!(e instanceof ApiClientError&&e.status===401))setError(describeError(e,false));}
    finally{if(live)setBusy(false);}
  })();return()=>{live=false;};},[client]);
  useEffect(()=>{if(selected?.ticketId)detailHeading.current?.focus();},[selected?.ticketId]);
  useEffect(()=>{if(error)errorPanel.current?.focus();},[error]);
  // The embedded questions report every server status; re-read the summary once per new status (submit, safety check).
  const intakeSync=useRef("");
  const onIntakeStatus=(status:IntakeState)=>{
    if(!selected||status===selected.detail.status)return;
    const key=`${selected.ticketId}:${status}`;if(intakeSync.current===key)return;intakeSync.current=key;
    const id=selected.ticketId;void run(async()=>setSelected(await client.read(id)));
  };
  const restore=async()=>{
    try{const s=await client.session(),u=await client.units(),t=await client.tickets();setSession(s);setUnits(u);setUnit(u[0]?.id??"");setTickets(t);}
    catch(e){if(e instanceof ApiClientError&&e.status===401)clearAccess();else throw e;}
  };
  const refresh=async()=>{const u=await client.units();setUnits(u);setUnit(current=>u.some(item=>item.id===current)?current:(u[0]?.id??""));setTickets(await client.tickets());if(selected)setSelected(await client.read(selected.ticketId));setRevision(r=>r+1);};
  const login=()=>run(async()=>{clearCommunicationRecovery();clearOutcomeRecovery();const s=await client.login(code),u=await client.units(),t=await client.tickets();setSession(s);setCode("");setUnits(u);setUnit(u[0]?.id??"");setTickets(t);});
  const selectedUnit=units.find(u=>u.id===selected?.unitId);
  const upload=async(ticketId:string,files:PendingPhoto[])=>{
    setPhotoMessage("");
    try{const stored=await client.photos(ticketId);setPending(current=>current.filter(f=>!stored.some(p=>p.uploadId===f.uploadId)));for(const file of files.filter(f=>!stored.some(p=>p.uploadId===f.uploadId))){await client.uploadPhoto(ticketId,file.uploadId,file.file);setPending(current=>current.filter(f=>f.uploadId!==file.uploadId));setRevision(r=>r+1);}setRevision(r=>r+1);if(files.length)setPhotoMessage("사진을 저장했습니다. 관리자도 같은 사진을 확인할 수 있습니다.");}
    catch(e){if(e instanceof ApiClientError&&(e.status===401||e.status===403))throw e;setPhotoMessage(photoError(e));}
  };
  const checkPhotos=async()=>{if(!selected)return;const ticket=await client.read(selected.ticketId),photos=await client.photos(selected.ticketId);setSelected(ticket);setPending(current=>current.filter(f=>!photos.some(p=>p.uploadId===f.uploadId)));setRevision(r=>r+1);setPhotoMessage(`저장된 사진 ${photos.length}장을 확인했습니다. ${ticket.workStatus==="COMPLETED"?"처리 완료된 접수에는 사진을 추가할 수 없습니다.":"남은 미전송 사진만 다시 전송할 수 있습니다."}`);};
  const openOutcome=(id:string)=>void run(async()=>{const ticket=await client.read(id);setSelected(ticket);setFollowUp(null);setFollowAttempt(null);setText("");setMessage("");setRevision(r=>r+1);});
  const openMaintenanceTicket=(id:string)=>void run(async()=>{
    try{const ticket=await client.read(id);setSelected(ticket);setManagerView("WORK_QUEUE");setFollowUp(null);setFollowAttempt(null);setText("");setMessage("");setRevision(r=>r+1);}
    catch(e){if(e instanceof ApiClientError&&[401,403,404].includes(e.status??0))clearAccess();throw e;}
  });
  const beginFollowUp=(kind:FollowUpKind)=>{if(!selected)return;const fresh=freshFollowUp(selected,kind);setFollowUp(fresh);setFollowAttempt(null);setUnit(fresh.unitId);setIssue(fresh.issueType);setText("");setPending([]);setPhotoMessage("");setSelected(null);};
  const submit=()=>{
    if(followSending.current)return;
    const parsed=followUp?CoreCreateFollowUpSchema.safeParse(followAttempt??{clientRequestId:crypto.randomUUID(),claimKind:followUp.claimKind,issueType:issue,rawUserText:text}):null;
    if(parsed&&!parsed.success){setError("문제 설명을 확인해 주세요. 공백이나 제어 문자만으로 접수할 수 없습니다.");return;}
    followSending.current=true;
    void run(async()=>{
      const generation=accessGeneration.read();
      let ticket:CoreTicketDto;
      if(followUp&&parsed?.success){
        const input=parsed.data;setFollowAttempt(input);saveOutcomeRecovery({sourceTicketId:followUp.sourceTicketId,clientRequestId:input.clientRequestId,claimKind:input.claimKind});
        try{ticket=await sendFollowUp(client,followUp.sourceTicketId,input,Boolean(followAttempt));}
        catch(e){if(e instanceof ApiClientError&&[400,401,403,404,409].includes(e.status??0)){clearOutcomeRecovery(followUp.sourceTicketId);setFollowAttempt(null);if(e.status===409){setSelected(await client.read(followUp.sourceTicketId));setFollowUp(null);setText("");setPending([]);}}throw e;}
        if(generation!==accessGeneration.read())return;clearOutcomeRecovery(followUp.sourceTicketId);
      }else ticket=await client.create({unitId:unit,issueType:issue,rawUserText:text});
      if(generation!==accessGeneration.read())return;
      setFollowUp(null);setFollowAttempt(null);setSelected(ticket);setText("");setNotice("접수 내용을 저장했어요. 이어서 아래 질문에 답해 주세요.");await upload(ticket.ticketId,pending);
    },true).finally(()=>{followSending.current=false;});
  };
  const Workspace=b1?"section":"main";
  return <Workspace id="core-tickets" className="page-shell core-flow" aria-label="수리 접수 작업" data-role={session?.role}>
    <header className={styles.heading} data-testid="unit-context"><div className={styles.toolbarLeading}>{selected&&managerView==="WORK_QUEUE"?<button disabled={busy||pending.length>0} onClick={()=>void run(async()=>{setSelected(null);setPhotoMessage("");setTickets(await client.tickets());})}>← 목록으로</button>:null}<div><h1>{session?.role==="TENANT"?(selected?"접수 내용":units.find(u=>u.id===unit)?.label??"수리 접수"):session?(managerView==="MAINTENANCE"?"호실 정비 이력":"업무함"):"수리 접수"}</h1>
    {session?.role==="TENANT"&&!selected?<p>{units.find(u=>u.id===unit)?.buildingName}</p>:null}
    </div></div>
    {!b1?<EnvironmentNote>검증용 환경으로 실제 업체 배정이나 알림은 전송되지 않습니다.</EnvironmentNote>:null}
    {session?<nav className="core-actions" aria-label="접속 및 새로고침">{selected&&session.role!=="TENANT"&&managerView==="WORK_QUEUE"?<button id="ticket-inspector-trigger" aria-controls="ticket-inspector" aria-expanded={inspectorExpanded} onClick={()=>{if(window.matchMedia("(min-width: 1120px) and (max-width: 1439px)").matches)setInspectorExpanded(value=>!value);else{setInspectorExpanded(true);document.querySelector<HTMLDetailsElement>("#ticket-inspector")?.querySelector("summary")?.focus();}}}>업무 정보</button>:null}
        <button disabled={busy} onClick={()=>void run(refresh)}>새로고침</button>
        {!b1?<button disabled={busy} onClick={()=>{if(onLogout){clearAccess();onLogout();}else void run(async()=>{await client.logout();clearAccess();});}}>로그아웃</button>:null}
      </nav>:null}
    </header>
    {error?<div className="state-error" role="alert" tabIndex={-1} ref={errorPanel}><p>{error}</p><button disabled={busy} onClick={()=>void run(session?refresh:restore)}>다시 불러오기</button></div>:null}
    {busy?<p role="status">불러오는 중…</p>:notice?<p className="save-ok" role="status">{notice}</p>:null}
    {!session?(b1?<p>내 소속·호실을 확인하고 있습니다.</p>:<form onSubmit={e=>{e.preventDefault();void login();}}>
      <label>개발 접근 코드 <input aria-label="개발 접근 코드" type="password" disabled={busy} value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" /></label>
      <button className={styles.primary} disabled={busy||!/^[a-f0-9]{64}$/.test(code)}>들어가기</button>
      <p>개발 환경에서 발급한 계정별 코드를 사용하세요. 코드가 만료되면 새 코드를 발급받아 다시 들어오세요. 역할과 호실은 서버에서 확인합니다.</p>
    </form>):<>

      {session.role==="TENANT"?<OutcomeRecoveryPanel client={client} onOpen={openOutcome}/>:null}
      {session.role!=="TENANT"?<nav className="core-actions core-view-switch" aria-label="관리자 보기"><button disabled={busy} aria-pressed={managerView==="WORK_QUEUE"} onClick={()=>setManagerView("WORK_QUEUE")}>업무함</button><button disabled={busy} aria-pressed={managerView==="MAINTENANCE"} onClick={()=>setManagerView("MAINTENANCE")}>호실 정비 이력</button></nav>:null}
      {session.role!=="TENANT"&&managerView==="MAINTENANCE"?<ManagerMaintenanceTimeline key={maintenanceUnit} client={client} units={units} revision={revision} disabled={busy} initialUnit={maintenanceUnit} onOpenTicket={openMaintenanceTicket}/>:<div className={session.role!=="TENANT"?styles.managerWorkspace:styles.tenantWorkspace} data-detail={Boolean(selected)}>
      {session.role!=="TENANT"?<div className={styles.queuePane}><ManagerWorkQueue key={`${selected?.ticketId??"list"}-${selected?.version??0}`} client={client} units={units} revision={revision} disabled={busy} selectedId={selected?.ticketId} onOpen={id=>void run(async()=>{setSelected(await client.read(id));setMessage("");})}/></div>:null}
      {selected?<section className={styles.selectedPane} aria-label="선택한 접수">

        {pending.length?<p>목록으로 돌아가기 전에 미전송 사진을 저장하거나 선택 취소해 주세요.</p>:null}
        <div className={styles.detailGrid}>
        <section className={`core-result ${styles.summary}`} aria-label="접수 요약">
          <h2 ref={detailHeading} tabIndex={-1} data-testid="ticket-heading">{selected.detail.issueType==="HEATING"?"난방":"누수"}{selectedUnit?` · ${selectedUnit.label}`:""}</h2>
          <p className={styles.ticketSubject}>{selectedUnit?.buildingName}</p>
          <TicketProgress workStatus={selected.workStatus} intakeStatus={selected.detail.status}>
            {progressMessage(selected,session.role==="TENANT")}
          </TicketProgress>

        </section>
        {b1&&session.role==="TENANT"?<VendorHandoffTenant key={`vendor-tenant-${b1.orgId}-${selected.ticketId}`} client={client} ticketId={selected.ticketId} revision={revision}/>:null}
        <TicketOutcome key={`outcome-${selected.ticketId}`} client={client} ticket={selected} tenant={session.role==="TENANT"} revision={revision} onFollowUp={beginFollowUp} onOpen={openOutcome}/>
        <TicketCommunication key={selected.ticketId} client={client} ticketId={selected.ticketId} tenant={session.role==="TENANT"} revision={revision} completed={selected.workStatus==="COMPLETED"} onVersion={setCommunicationVersion}>
        {/* Tenant-only children render right after the conversation's own to-do, so a pending reply stays first. */}
        {session.role==="TENANT"&&tenantIntakeOpen(selected)?<TaskZone tenant label="지금 할 일: 추가 확인" message={intakeTaskMessage(selected.detail.status)}><TicketIntake key={`${selected.ticketId}-${revision}`} ticketId={selected.ticketId} client={client.protocol} coreFlow onStatusChange={onIntakeStatus}/></TaskZone>:null}
        <div className={styles.photoArea}>
        <PhotoGallery client={client} ticketId={selected.ticketId} revision={revision} />
        {session.role==="TENANT"?<>
          {selected.workStatus!=="COMPLETED"||pending.length?<PhotoPicker files={pending} onChange={setPending} disabled={busy||selected.workStatus==="COMPLETED"} />:null}
          {selected.workStatus==="COMPLETED"&&pending.length?<button disabled={busy} onClick={()=>setPending([])}>미전송 사진 선택 취소</button>:null}
          {photoMessage?<p role="status">{photoMessage}</p>:null}
          {selected.workStatus!=="COMPLETED"?<div className="core-actions"><button disabled={busy||!pending.length} onClick={()=>void run(()=>upload(selected.ticketId,pending),true)}>사진 저장</button><button disabled={busy} onClick={()=>void run(checkPhotos)}>저장된 사진 확인</button></div>:null}
        </>:null}
        </div>

        <section className={styles.history} aria-label="진행 이력"><h2>진행 이력</h2>{selected.events.map(event=><p key={event.id}><time dateTime={event.at}>{new Date(event.at).toLocaleString("ko-KR")}</time> · {event.actorRole==="TENANT"?"세입자":"관리자"} · {eventLabels[event.kind]??"접수 정보 변경"}{event.message?` · ${event.message}`:""}</p>)}</section></TicketCommunication>
          <details className={styles.technicalDetails}><summary>접수 세부 정보</summary><p className={styles.ticketId}>접수번호 {selected.ticketId}</p></details>
        {selected.workStatus==="COMPLETED"?<p>관리자의 완료 기록을 확인했습니다. 목록에서 이력을 다시 볼 수 있습니다.</p>:session.role==="TENANT"&&tenantIntakeOpen(selected)?null:<details className={styles.protocolDetails}><summary>{session.role==="TENANT"?"추가 확인":"추가 확인·결정 기록"}</summary>{session.role==="TENANT"?<TicketIntake key={`${selected.ticketId}-${revision}`} ticketId={selected.ticketId} client={client.protocol} coreFlow />:<TicketReview key={`${selected.ticketId}-${revision}`} ticketId={selected.ticketId} client={client.protocol} coreFlow />}</details>}
        </div>
        {session.role!=="TENANT"?<ManagerInspector expanded={inspectorExpanded} onExpandedChange={setInspectorExpanded}><div className={styles.actionRail}>
        <ManagerWorkDetail key={selected.ticketId} client={client} ticket={selected} revision={revision}/>
        {b1?<VendorHandoffManager communicationVersion={communicationVersion?.ticketId===selected.ticketId?communicationVersion.version:undefined} key={`vendor-${b1.orgId}-${selected.ticketId}`} client={client} ticket={selected} revision={revision} onHandoff={onManagerHandoff} onChanged={()=>void run(async()=>{const ticket=await client.read(selected.ticketId);setSelected(current=>current?.ticketId===ticket.ticketId?ticket:current);setTickets(current=>current.map(item=>item.ticketId===ticket.ticketId?ticket:item));})}/>:null}
        <ManagerMaintenanceFactEditor key={`maintenance-${selected.ticketId}`} client={client} ticket={selected} revision={revision} onOpenTicket={openMaintenanceTicket} onChanged={()=>setRevision(r=>r+1)} onViewUnit={id=>{setMaintenanceUnit(id);setManagerView("MAINTENANCE");}}/>
        <ManagerDirectCompletionGate enabled={Boolean(b1)} handoff={managerHandoff?.ticketId===selected.ticketId?managerHandoff:null} loading={Boolean(b1&&managerHandoff?.ticketId!==selected.ticketId)}>{selected.workStatus!=="COMPLETED"?<form className={styles.handling} onSubmit={e=>{e.preventDefault();void run(async()=>{const starting=selected.workStatus==="OPEN";setSelected(await client.handling(selected.ticketId,{status:starting?"IN_PROGRESS":"COMPLETED",message,...(!starting&&communicationVersion?.ticketId===selected.ticketId?{expectedCommunicationVersion:communicationVersion.version}:{})}));setMessage("");setNotice(starting?"처리 시작 기록을 저장했습니다. 세입자도 새로고침하면 확인할 수 있습니다.":"처리 완료 기록을 저장했습니다. 세입자도 새로고침하면 확인할 수 있습니다.");detailHeading.current?.focus();},true);}}>
          <label>처리 기록 <textarea aria-label="처리 기록" maxLength={2000} required value={message} onChange={e=>setMessage(e.target.value)} /></label>
          <button className={styles.primary} disabled={busy||!message.trim()||(selected.workStatus==="IN_PROGRESS"&&communicationVersion?.ticketId!==selected.ticketId)}>{selected.workStatus==="OPEN"?"처리 시작 기록":"처리 완료 기록"}</button>
          <p>담당자가 확인한 사실을 기록하세요. 자동 출동이나 수리 검증을 뜻하지 않습니다.</p>
        </form>:null}</ManagerDirectCompletionGate>
        </div></ManagerInspector>:null}
      </section>:session.role!=="TENANT"?null:<>
        {followUp?<><FollowUpContext kind={followUp.claimKind}/><button disabled={busy||Boolean(followAttempt)} onClick={()=>openOutcome(followUp.sourceTicketId)}>원본 접수로 돌아가기</button></>:null}
        {units.length!==1?<label>건물·호실 <select aria-label="건물·호실" disabled={!units.length||Boolean(followUp)} value={unit} onChange={e=>setUnit(e.target.value)}>{units.map(u=><option key={u.id} value={u.id}>{u.buildingName} · {u.label}</option>)}</select></label>:null}
        {!units.length?<p>접근 가능한 호실이 없습니다. 관리자에게 소속·호실 배정을 확인한 뒤 새로고침을 눌러 주세요.</p>:null}
        {session.role==="TENANT"&&unit?<form onSubmit={e=>{e.preventDefault();submit();}}>
          <h2>어떤 문제가 있나요?</h2><fieldset disabled={Boolean(followAttempt)} className={styles.issueChoice}><legend>문제 유형</legend>{(["HEATING","LEAK"] as const).map(value=><label key={value}><input type="radio" name="issueType" value={value} checked={issue===value} onChange={e=>setIssue(e.target.value as "HEATING"|"LEAK")}/><span>{value==="HEATING"?"난방":"누수"}</span></label>)}</fieldset>
          <label>문제 설명 <textarea aria-label="문제 설명" readOnly={Boolean(followAttempt)} value={text} maxLength={2000} required onChange={e=>setText(e.target.value)} /></label>
          <PhotoPicker files={pending} onChange={setPending} disabled={busy||Boolean(followAttempt)} compact />
          <div className={styles.submitZone}><button className={styles.primary} disabled={busy||!text.trim()}>{followAttempt?"같은 후속 접수 다시 확인·전송":"접수하기"}</button></div>
        </form>:null}
        <h2>최근 접수 <small>{tickets.filter(t=>t.unitId===unit).length}건</small></h2>
        {conversationSummaries.error?<p role="alert">대화 대기 상태를 확인하지 못했습니다. 새로고침을 눌러 주세요.</p>:null}
        {tickets.filter(t=>t.unitId===unit).length===0?<p>{!unit?"호실 배정 후 접수 이력을 볼 수 있습니다.":session.role==="TENANT"?"선택한 호실의 접수 내역이 없습니다. 위의 문제 접수에서 첫 내용을 남겨 주세요.":"선택한 호실의 접수 내역이 없습니다. 다른 호실을 선택하거나 새로고침으로 새 접수를 확인해 주세요."}</p>:<ul className={styles.ticketList}>{tickets.filter(t=>t.unitId===unit).map(t=><li key={t.ticketId} data-ticket-id={t.ticketId}><button data-open-ticket className={styles.ticketRow} disabled={busy||pending.length>0} onClick={()=>void run(async()=>{setSelected(await client.read(t.ticketId));setMessage("");})}><span className={styles.ticketTitle}>{t.detail.issueType==="HEATING"?"난방":"누수"}</span><span> · </span>{isIntakeDraft(t)?<DraftBadge/>:<WorkStatusBadge status={t.workStatus}/>}<CommunicationBadge summary={conversationSummaries.summaries[t.ticketId]} tenant/></button><PhotoGallery compact client={client} ticketId={t.ticketId} revision={revision} /></li>)}</ul>}
      </>}
      </div>}
    </>}
  </Workspace>;
}
