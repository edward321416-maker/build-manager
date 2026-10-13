"use client";

import { createCoreFlowClient,ApiClientError } from "@build-manager/api-client";
import { CoreCreateFollowUpSchema,type CoreCreateFollowUp,type CoreSessionDto,type CoreTicketDto,type CoreUnitDto,type ManagerVendorHandoffDto } from "@build-manager/api-contracts";
import { useCallback,useEffect,useMemo,useRef,useState,type MouseEvent as ReactMouseEvent,type ReactNode } from "react";
import { TicketIntake,type EvidenceStepRenderer } from "../../components/tenant/ticket-intake";
import { PhotoEvidenceStep } from "./photo-evidence-step";
import { evidenceStage } from "./evidence-stage";
import { TicketReview } from "../../components/landlord/ticket-review";
import { PhotoPicker,PhotoGallery,photoError,type PendingPhoto } from "../../components/core-photos";
import { DraftBadge,intakeDisplayStatus,isIntakeDraft,WorkStatusBadge } from "./ui/work-status-badge";
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
import { managerNextStep,type ManagerStepTarget } from "./manager-next-step";
import { VendorHandoffTenant } from "./vendor-handoff-tenant";
import { historyLines } from "./history-lines";
import { DateTime } from "../../components/date-time";
import { BackButton,CoreNav,plainClick } from "./nav/core-nav";
import { navHref } from "./nav/nav-location";
import { homeCards,HOME_CARD_LIMIT } from "./nav/tenant-home";
import { MenuList,TodoScreen,UnitsScreen } from "./nav/nav-screens";
import { OpenSourceNotice } from "./nav/open-source-notice";
import { inLeftMenu,meRows,moreRows,navTitle,roleName,type NavLocation } from "./nav/nav-config";
import { detailEntryOnTop,hideDetailEntry,showDetailEntry,useNavLocation } from "./nav/use-nav-location";
import { buildTodoList } from "./nav/todo-list";
import navStyles from "./nav/core-nav.module.css";

type IntakeState=CoreTicketDto["detail"]["status"];
// Intake steps that still wait on the tenant stay open above the record instead of collapsed at the bottom.
const openIntakeStates:IntakeState[]=["IN_PROGRESS","NEEDS_MORE_INFO","SAFETY_ESCALATED"];
const tenantIntakeOpen=(t:CoreTicketDto)=>t.workStatus==="OPEN"&&openIntakeStates.includes(intakeDisplayStatus(t));
const intakeTaskMessage=(status:IntakeState)=>status==="NEEDS_MORE_INFO"?"답한 뒤 다시 제출해 주세요.":status==="SAFETY_ESCALATED"?"아래 안내를 먼저 확인해 주세요.":"질문에 답하고 필요한 사진을 고르면 '수리 요청 제출' 버튼이 나와요.";
function progressMessage(t:CoreTicketDto,tenant:boolean){
  if(t.workStatus==="COMPLETED")return "관리자가 완료로 기록했어요.";
  if(t.workStatus==="IN_PROGRESS")return tenant?"관리자가 확인하고 있어요.":"처리 중이에요.";
  switch(intakeDisplayStatus(t)){
    case "IN_PROGRESS":return tenant?"아직 보내지 않았어요. 아래 할 일을 마치고 '수리 요청 제출'을 눌러야 관리자에게 전달돼요.":"세입자가 아직 제출하지 않았어요.";
    case "NEEDS_MORE_INFO":return tenant?"관리자가 추가 확인을 요청했어요. 아래 질문에 답해 주세요.":"세입자의 추가 답변을 기다리고 있어요.";
    case "SAFETY_ESCALATED":return tenant?"안전 확인이 필요해요.":"안전 확인이 필요한 접수예요.";
    case "PARTIAL":return tenant?"관리자에게 보냈어요. 부족한 정보가 있으면 관리자가 다시 물어볼 거예요.":"세입자가 제출했어요. 필수 정보가 부족해요.";
    case "APPROVED":case "OVERRIDDEN":return tenant?"관리자가 확인했어요. 처리를 기다리고 있어요.":"처리 방법을 정했어요.";
    default:return tenant?"관리자에게 보냈어요. 확인을 기다리고 있어요.":"세입자가 제출했어요.";
  }
}
// Photos picked but not sent would become the opened request's photos, so every request stays shut until they are sent
// or dropped; the lists say why (final review of PR 139).
const pendingPhotosHint="고른 사진이 있어서 요청을 열 수 없어요. 접수하거나 사진 선택을 취소해 주세요.";
const sessionMessage="접속이 만료되었거나 코드가 유효하지 않아요. 개발 환경에서 새 코드를 발급받아 다시 들어가 주세요.";
const accessMessage="이 계정의 접근 권한을 확인할 수 없어요. 관리자에게 소속·호실 권한을 확인한 뒤 다시 들어가 주세요.";
function describeError(error:unknown,saving:boolean){
  if(error instanceof ApiClientError){
    if(error.status===401)return sessionMessage;
    if(error.status===403)return accessMessage;
    if(error.status===404)return "접수 내역을 열 수 없어요. 목록을 새로고침하고 접근 가능한 내역을 선택해 주세요.";
    if(error.status===409)return "다른 변경이 먼저 저장됐어요. 새로고침으로 최신 상태를 확인한 뒤 다시 진행해 주세요.";
    if(error.status===400)return "입력 내용을 확인해 주세요. 설명이나 처리 기록에 공백만 입력할 수 없어요.";
  }
  return saving?"저장 결과를 확인하지 못했어요. 입력은 유지했어요. 연결을 확인하고 새로고침으로 이력을 먼저 확인해 주세요. 중복 접수를 막기 위해 바로 다시 제출하지 마세요.":"내용을 불러오지 못했어요. 연결을 확인하고 다시 불러오기를 눌러 주세요.";
}
/** What the login screen hands the menu (P5 spec §1): the account-area caption, the 내 소속 field, this organisation's
 * move-in link screen, and logout. Development sign-in passes none of it. */
export type CoreAccount={caption:string;organization?:ReactNode;linkPanel?:ReactNode;logout():void};
export default function CoreFlowPage({b1,onDenied,onLogout,account,focusTitle}:{b1?:{orgId:string;csrf:string};onDenied?:()=>void;onLogout?:()=>void;account?:CoreAccount;focusTitle?:boolean}={}){
  const [session,setSession]=useState<CoreSessionDto|null>(null),[code,setCode]=useState("");
  const [units,setUnits]=useState<CoreUnitDto[]>([]),[unit,setUnit]=useState("");
  const [tickets,setTickets]=useState<CoreTicketDto[]>([]),[selected,setSelected]=useState<CoreTicketDto|null>(null);
  const [maintenanceUnit,setMaintenanceUnit]=useState("");
  const [inspectorExpanded,setInspectorExpanded]=useState(false);
  const [issue,setIssue]=useState<"HEATING"|"LEAK">("HEATING"),[text,setText]=useState(""),[message,setMessage]=useState("");
  const [busy,setBusy]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[revision,setRevision]=useState(0);
  const [pending,setPending]=useState<PendingPhoto[]>([]),[photoMessage,setPhotoMessage]=useState("");
  // Photos stored by the intake's evidence step: reloads the photo list without remounting the intake (keyed by revision).
  const [photoRevision,setPhotoRevision]=useState(0);
  const [communicationVersion,setCommunicationVersion]=useState<{ticketId:string;version:number}|null>(null);
  const [managerHandoff,setManagerHandoff]=useState<ManagerVendorHandoffDto|null>(null);
  const onManagerHandoff=useCallback((value:ManagerVendorHandoffDto|null)=>setManagerHandoff(value),[]);
  const [followUp,setFollowUp]=useState<ReturnType<typeof freshFollowUp>|null>(null),[followAttempt,setFollowAttempt]=useState<CoreCreateFollowUp|null>(null);
  const followSending=useRef(false);
  const [accessGeneration]=useState(createRequestFence);
  const detailHeading=useRef<HTMLHeadingElement>(null),errorPanel=useRef<HTMLDivElement>(null),titleRef=useRef<HTMLHeadingElement>(null);
  const clearAccess=useCallback(()=>{accessGeneration.invalidate();clearCommunicationRecovery();clearOutcomeRecovery();setFollowUp(null);setFollowAttempt(null);setCommunicationVersion(null);setManagerHandoff(null);setSession(null);setSelected(null);setTickets([]);setUnits([]);setUnit("");setText("");setMessage("");setCode("");setNotice("");setPending([]);setPhotoMessage("");setMaintenanceUnit("");},[accessGeneration]);
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
  const tenant=session?.role==="TENANT";
  // Tenant rows show every request's conversation state; a manager's to-dos need only unfinished requests. Opening and
  // closing a request re-reads them, as before P5, so a row shows the reply just sent.
  const summaryIds=useMemo(()=>tickets.filter(t=>tenant||t.workStatus!=="COMPLETED").map(t=>t.ticketId),[tickets,tenant]);
  // null until the session is known, so the 알림 tab shows "불러오는 중이에요" instead of an empty list (parts review).
  const conversationSummaries=useCommunicationSummaries(client,session?summaryIds:null,selected?revision+.5:revision);
  const run=async(action:()=>Promise<void>,saving=false)=>{
    setBusy(true);setError("");setNotice("");
    try{await action();}catch(e){
      if(e instanceof ApiClientError&&(e.status===401||e.status===403))clearAccess();
      else if(e instanceof ApiClientError&&e.status===404)setSelected(null);
      setError(describeError(e,saving));
    }finally{setBusy(false);}
  };
  // P5 menu (spec §2–§3): the place lives in the address; an open request is one history entry, so browser back closes it.
  const role=session?.role??null;
  const navContext=useMemo(()=>role?{role,b1:Boolean(b1)}:null,[role,b1]);
  const selectedRef=useRef<CoreTicketDto|null>(null),pendingRef=useRef<PendingPhoto[]>([]);
  useEffect(()=>{selectedRef.current=selected;pendingRef.current=pending;});
  const leaveDetail=()=>void run(async()=>{setSelected(null);setPhotoMessage("");setTickets(await client.tickets());});
  const nav=useNavLocation(navContext,detail=>{
    if(detail){if(!selectedRef.current)hideDetailEntry();return;}
    if(!selectedRef.current)return;
    // Unsent photos keep the request open, as the back button does: put its history entry back.
    if(pendingRef.current.length){showDetailEntry(role==="TENANT"?undefined:"work");return;}
    leaveDetail();
  });
  const detailId=selected?.ticketId??null;
  useEffect(()=>{if(!role)return;if(detailId)showDetailEntry(role==="TENANT"?undefined:"work");else hideDetailEntry();},[detailId,role]);
  const closeDetail=()=>{if(detailEntryOnTop())window.history.back();else leaveDetail();};
  /** A menu link. An open request closes first; unsent photos keep it open, and the request says why. Opening 알림
   * (and tapping it again) reads the requests and their conversation summaries again, so the to-dos are current (spec §5). */
  const navigate=(next:NavLocation)=>{
    if(selected){if(pending.length)return;setSelected(null);setPhotoMessage("");}
    nav.go(next);
    if(next.tab==="alerts"&&session)void run(refresh);
  };
  const todo=useMemo(()=>role?buildTodoList({role,tickets,summaries:conversationSummaries.summaries,summariesFailed:conversationSummaries.error}):{items:[],partial:false},[role,tickets,conversationSummaries.summaries,conversationSummaries.error]);
  const home=useMemo(()=>tenant?homeCards({tickets,todo,unitId:unit}):{cards:[],total:0},[tenant,tickets,todo,unit]);
  /** A menu-like link inside the content: the real address for a new tab, this page's own move for a plain click. */
  const placeLink=(to:NavLocation)=>({href:navHref(to),onClick:(event:ReactMouseEvent)=>{if(plainClick(event)){event.preventDefault();navigate(to);}}});
  const logout=account?.logout??(()=>{if(onLogout){clearAccess();onLogout();}else void run(async()=>{await client.logout();clearAccess();});});
  useEffect(()=>{let live=true;void (async()=>{
    try{const s=await client.session(),u=await client.units(),t=await client.tickets();if(live){setSession(s);setUnits(u);setUnit(u[0]?.id??"");setTickets(t);}}
    catch(e){if(live&&!(e instanceof ApiClientError&&e.status===401))setError(describeError(e,false));}
    finally{if(live)setBusy(false);}
  })();return()=>{live=false;};},[client]);
  useEffect(()=>{if(selected?.ticketId)detailHeading.current?.focus();},[selected?.ticketId]);
  useEffect(()=>{if(error)errorPanel.current?.focus();},[error]);
  // The embedded questions report every server status; re-read the summary once per new status (submit, safety check).
  // Only the latest read may land, so a slow earlier response cannot leave the summary behind.
  const intakeSync=useRef(""),intakeRead=useRef(0);
  /** A fresh read replaces the request on screen while it is still the open one, and in the screen's list, so the
   * manager's queue-row hints match its detail. A late read never reopens a request the user has left. */
  const adopt=(ticket:CoreTicketDto)=>{setSelected(current=>current?.ticketId===ticket.ticketId?ticket:current);setTickets(current=>current.map(item=>item.ticketId===ticket.ticketId?ticket:item));};
  const onIntakeStatus=(status:IntakeState)=>{
    if(!selected||status===selected.detail.status)return;
    const key=`${selected.ticketId}:${status}`;if(intakeSync.current===key)return;intakeSync.current=key;
    // The decision screen reports through the same path; only the tenant's question zone can close with a submission.
    const id=selected.ticketId,seq=++intakeRead.current,wasOpen=session?.role==="TENANT"&&tenantIntakeOpen(selected);
    void run(async()=>{
      const ticket=await client.read(id);if(seq!==intakeRead.current)return;adopt(ticket);
      // The to-do zone that held focus is gone: return focus to the request, and say "sent" only for a real submission.
      if(wasOpen&&!tenantIntakeOpen(ticket)){if(["PARTIAL","READY_FOR_REVIEW"].includes(intakeDisplayStatus(ticket)))setNotice("수리 요청을 관리자에게 보냈어요.");detailHeading.current?.focus();}
    });
  };
  // A route correction keeps the OVERRIDDEN status, so every decision the server accepted re-reads the request. Its
  // status counts as synced, so the status report the decision screen sends next does not read it a second time.
  const onDecided=(status:IntakeState)=>{
    if(!selected)return;
    const id=selected.ticketId,seq=++intakeRead.current;intakeSync.current=`${id}:${status}`;
    void run(async()=>{const ticket=await client.read(id);if(seq===intakeRead.current)adopt(ticket);});
  };
  /** Opening a request re-reads the ticket list too, since the manager's queue reloads its rows on every selection.
   * The list read is best effort: when it fails, the request still opens and the current list stays. A lost session or
   * access (401, 403) still stops the open, so no request stays selected behind the sign-in form. */
  const openWithList=async(id:string)=>{const [ticket,list]=await Promise.all([client.read(id),client.tickets().catch((e:unknown)=>{if(e instanceof ApiClientError&&(e.status===401||e.status===403))throw e;return null;})]);setSelected(ticket);setTickets(current=>(list??current).map(item=>item.ticketId===ticket.ticketId?ticket:item));};
  // Whether the completed request already has a unit maintenance fact; null until the fact editor has loaded.
  const [factRecorded,setFactRecorded]=useState<{ticketId:string;recorded:boolean}|null>(null);
  /** Opens the folded section that holds the step's control and brings it into view with focus. */
  const goToStep=(target:ManagerStepTarget)=>{
    const id={decision:"ticket-decision",vendor:"vendor-handoff",handling:"ticket-handling",fact:"maintenance-fact"}[target];
    if(target==="decision"){const details=document.getElementById(id);if(details instanceof HTMLDetailsElement)details.open=true;}
    else setInspectorExpanded(true);
    // Wait for the inspector to render open, then win over its own focus handling. Focus lands on something a screen
    // reader names: the decision section's title, the named Vendor and fact sections, or the handling record field.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{const section=document.getElementById(id);section?.scrollIntoView({block:"start"});
      const focus=target==="decision"?section?.querySelector("summary"):target==="handling"?section?.querySelector("textarea"):section;focus?.focus({preventScroll:true});}));
  };
  // Naming a photo keeps the status, so onIntakeStatus does not re-read: refresh the summary for the photo names and the
  // history. Only the latest read lands (same sequence as onIntakeStatus); after a failed read the next one catches up.
  const rereadSelected=(id:string)=>{const seq=++intakeRead.current;void client.read(id).then(ticket=>{if(seq===intakeRead.current)setSelected(current=>current?.ticketId===ticket.ticketId?ticket:current);},()=>undefined);};
  // P1b: the intake's evidence stage (evidenceStage). A request never sent names one of this ticket's photos, and an upload
  // there refreshes only the photo list. A request sent without its photos stays as sent (spec D5): it says what happened
  // and offers neither the photo step nor a second submission. A sent request reopened another way keeps the intake's own
  // "수리 요청 제출" (null). The intake's own ticket decides at once, before this screen re-reads its events.
  const sentOnRecord=Boolean(selected?.events.some(event=>event.kind==="FINALIZED"));
  const evidenceStep:EvidenceStepRenderer|undefined=!selected?undefined:step=>{
    const view=evidenceStage(step.ticket,sentOnRecord);
    if(view==="SUBMIT")return null;
    if(view==="SENT")return <p>필요한 사진 없이 보냈어요. 관리자가 확인한 뒤 다시 물어볼 수 있어요.</p>;
    return <PhotoEvidenceStep key={`${selected.ticketId}-${step.requirement.evidenceType}`} client={client} ticketId={selected.ticketId} requirement={step.requirement} named={step.ticket.submittedEvidence} revision={revision} busy={step.busy||busy}
      onChoose={photoId=>step.choose(async()=>{const status=await client.submitPhotoEvidence(selected.ticketId,{evidenceType:step.requirement.evidenceType,photoId});rereadSelected(selected.ticketId);return status;})}
      onSubmitWithout={step.submitWithout} onPhotosChanged={()=>setPhotoRevision(r=>r+1)}/>;
  };
  const restore=async()=>{
    try{const s=await client.session(),u=await client.units(),t=await client.tickets();setSession(s);setUnits(u);setUnit(u[0]?.id??"");setTickets(t);}
    catch(e){if(e instanceof ApiClientError&&e.status===401)clearAccess();else throw e;}
  };
  const refresh=async()=>{const u=await client.units();setUnits(u);setUnit(current=>u.some(item=>item.id===current)?current:(u[0]?.id??""));setTickets(await client.tickets());if(selected)adopt(await client.read(selected.ticketId));setRevision(r=>r+1);};
  const login=()=>run(async()=>{clearCommunicationRecovery();clearOutcomeRecovery();const s=await client.login(code),u=await client.units(),t=await client.tickets();setSession(s);setCode("");setUnits(u);setUnit(u[0]?.id??"");setTickets(t);});
  const selectedUnit=units.find(u=>u.id===selected?.unitId);
  const upload=async(ticketId:string,files:PendingPhoto[])=>{
    setPhotoMessage("");
    try{const stored=await client.photos(ticketId);setPending(current=>current.filter(f=>!stored.some(p=>p.uploadId===f.uploadId)));for(const file of files.filter(f=>!stored.some(p=>p.uploadId===f.uploadId))){await client.uploadPhoto(ticketId,file.uploadId,file.file);setPending(current=>current.filter(f=>f.uploadId!==file.uploadId));setRevision(r=>r+1);}setRevision(r=>r+1);if(files.length)setPhotoMessage("사진을 저장했어요. 관리자도 같은 사진을 확인할 수 있어요.");}
    catch(e){if(e instanceof ApiClientError&&(e.status===401||e.status===403))throw e;setPhotoMessage(photoError(e));}
  };
  const checkPhotos=async()=>{if(!selected)return;const ticket=await client.read(selected.ticketId),photos=await client.photos(selected.ticketId);setSelected(ticket);setPending(current=>current.filter(f=>!photos.some(p=>p.uploadId===f.uploadId)));setRevision(r=>r+1);setPhotoMessage(`저장된 사진 ${photos.length}장을 확인했어요. ${ticket.workStatus==="COMPLETED"?"처리 완료된 접수에는 사진을 추가할 수 없어요.":"남은 미전송 사진만 다시 전송할 수 있어요."}`);};
  const openOutcome=(id:string)=>void run(async()=>{await openWithList(id);setFollowUp(null);setFollowAttempt(null);setText("");setMessage("");setRevision(r=>r+1);});
  const openMaintenanceTicket=(id:string)=>void run(async()=>{
    try{await openWithList(id);setFollowUp(null);setFollowAttempt(null);setText("");setMessage("");setRevision(r=>r+1);}
    catch(e){if(e instanceof ApiClientError&&[401,403,404].includes(e.status??0))clearAccess();throw e;}
  });
  const beginFollowUp=(kind:FollowUpKind)=>{if(!selected)return;const fresh=freshFollowUp(selected,kind);setFollowUp(fresh);setFollowAttempt(null);setUnit(fresh.unitId);setIssue(fresh.issueType);setText("");setPending([]);setPhotoMessage("");setSelected(null);nav.go({tab:"home",view:null});};
  const submit=()=>{
    if(followSending.current)return;
    const parsed=followUp?CoreCreateFollowUpSchema.safeParse(followAttempt??{clientRequestId:crypto.randomUUID(),claimKind:followUp.claimKind,issueType:issue,rawUserText:text}):null;
    if(parsed&&!parsed.success){setError("문제 설명을 확인해 주세요. 공백이나 제어 문자만으로 접수할 수 없어요.");return;}
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
  const managerStep=selected&&session&&session.role!=="TENANT"?managerNextStep({ticket:selected,handoff:managerHandoff?.ticketId===selected.ticketId?managerHandoff:null,vendorEnabled:Boolean(b1),handoffLoading:Boolean(b1&&managerHandoff?.ticketId!==selected.ticketId),factRecorded:factRecorded?.ticketId===selected.ticketId?factRecorded.recorded:null}):null;
  const location=nav.location,tab=location.tab,view=location.view;
  // When the place changes from inside the content (a 더 보기 or 내 정보 row, closing a request), the control that had
  // focus is gone. Focus the new screen's title instead of leaving it on the page body (final review of PR 139).
  const place=`${tab}|${view??""}|${selected?"detail":""}`,lastPlace=useRef<string|null>(null);
  useEffect(()=>{if(!navContext)return;const before=lastPlace.current;lastPlace.current=place;if(before===null||before===place||selected)return;
    const active=document.activeElement;if(!active||active===document.body)titleRef.current?.focus({preventScroll:true});},[navContext,place,selected]);
  // After an organisation is chosen the whole page is new: start keyboard and screen reader at its title, once.
  const titleFocused=useRef(false);
  useEffect(()=>{if(focusTitle&&session&&!titleFocused.current){titleFocused.current=true;titleRef.current?.focus({preventScroll:true});}},[focusTitle,session]);
  const sub=Boolean(selected)||Boolean(view);
  const title=!session?"수리 접수":selected?(tenant?"접수 내용":"업무함"):tenant&&tab==="home"&&!view?(units.find(u=>u.id===unit)?.label??"수리 접수"):navTitle(session.role,location);
  const openFromList=(id:string)=>void run(async()=>{await openWithList(id);setMessage("");});
  const openTenantTicket=(id:string)=>void run(async()=>{setSelected(await client.read(id));setMessage("");});
  const ticketName=(t:CoreTicketDto)=>{const label=units.find(u=>u.id===t.unitId)?.label;return (t.detail.issueType==="HEATING"?"난방":"누수")+(label?` · ${label}`:"");};
  const unitTickets=tickets.filter(t=>t.unitId===unit);
  const requestGroups=[
    {name:"진행 중",list:unitTickets.filter(t=>t.workStatus!=="COMPLETED"),empty:"진행 중인 요청이 없어요. 문제가 생기면 우리 집에서 접수해 주세요."},
    {name:"끝난 요청",list:unitTickets.filter(t=>t.workStatus==="COMPLETED"),empty:"끝난 요청이 없어요."},
  ];
  // The request list area: the tenant's 우리 집 and 내 요청, the manager's 업무함, or any open request.
  const workVisible=Boolean(selected)||(!view&&(tenant?tab==="home"||tab==="requests":tab==="work"));
  return <div className={navStyles.shell} data-nav={navContext?"on":undefined} data-sub={sub?"true":undefined}>
    {navContext&&session?<CoreNav ctx={navContext} location={location} badge={conversationSummaries.ready?todo.items.length:0} caption={account?.caption??roleName(session.role)} onNavigate={navigate}/>:null}
    <div className={navStyles.content}>
    <Workspace id="core-tickets" className="page-shell core-flow" aria-label="수리 접수 작업" data-role={session?.role}>
    <header className={styles.heading} data-testid="unit-context" data-sub={sub?"true":undefined} data-menu-screen={view&&navContext&&inLeftMenu(navContext,view)?"true":undefined}><div className={styles.toolbarLeading}>{selected?<BackButton wide disabled={busy||pending.length>0} onClick={closeDetail}/>:view&&navContext?<BackButton wide={!inLeftMenu(navContext,view)} onClick={nav.back}/>:null}<div><h1 ref={titleRef} tabIndex={-1}>{title}</h1>
    {tenant&&!selected&&tab==="home"&&!view?<p className={styles.headingCaption}>{units.find(u=>u.id===unit)?.buildingName}</p>:null}
    </div></div>
    {!b1?<EnvironmentNote>검증용 환경으로 실제 업체 배정이나 알림은 전송되지 않아요.</EnvironmentNote>:null}
    {session?<nav className="core-actions" aria-label="접속 및 새로고침">{selected&&!tenant?<button id="ticket-inspector-trigger" aria-controls="ticket-inspector" aria-expanded={inspectorExpanded} onClick={()=>{if(window.matchMedia("(min-width: 1120px) and (max-width: 1439px)").matches)setInspectorExpanded(value=>!value);else{setInspectorExpanded(true);/* Menu audit F-20: show the panel's content, not just its heading at the bottom edge. */requestAnimationFrame(()=>{const inspector=document.getElementById("ticket-inspector");inspector?.scrollIntoView({block:"start"});inspector?.querySelector("summary")?.focus({preventScroll:true});});}}}>업무 정보</button>:null}
        <button disabled={busy} onClick={()=>void run(refresh)}>새로고침</button>
      </nav>:null}
    </header>
    {error?<div className="state-error" role="alert" tabIndex={-1} ref={errorPanel}><p>{error}</p><button disabled={busy} onClick={()=>void run(session?refresh:restore)}>다시 불러오기</button></div>:null}
    {busy?<p role="status">불러오는 중…</p>:notice?<p className="save-ok" role="status">{notice}</p>:null}
    {!session?(b1?<p>내 소속·호실을 확인하고 있어요.</p>:<form onSubmit={e=>{e.preventDefault();void login();}}>
      <label>개발 접근 코드 <input aria-label="개발 접근 코드" type="password" disabled={busy} value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" /></label>
      <button className={styles.primary} disabled={busy||!/^[a-f0-9]{64}$/.test(code)}>들어가기</button>
      <p>개발 환경에서 발급한 계정별 코드를 사용하세요. 코드가 만료되면 새 코드를 발급받아 다시 들어오세요. 역할과 호실은 서버에서 확인해요.</p>
    </form>):<>
      {tenant?<OutcomeRecoveryPanel client={client} onOpen={openOutcome}/>:null}
      <div className={tenant?styles.tenantWorkspace:styles.managerWorkspace} data-detail={Boolean(selected)} hidden={!workVisible}>
      {!tenant?<div className={styles.queuePane}><ManagerWorkQueue key={`${selected?.ticketId??"list"}-${selected?.version??0}`} client={client} units={units} tickets={tickets} revision={revision} disabled={busy} selectedId={selected?.ticketId} onOpen={openFromList}/></div>:null}
      {selected?<section className={styles.selectedPane} aria-label="선택한 접수">

        {pending.length?<p>목록으로 돌아가기 전에 미전송 사진을 저장하거나 선택 취소해 주세요.</p>:null}
        <div className={styles.detailGrid}>
        <section className={`core-result ${styles.summary}`} aria-label="접수 요약">
          <h2 ref={detailHeading} tabIndex={-1} data-testid="ticket-heading">{selected.detail.issueType==="HEATING"?"난방":"누수"}{selectedUnit?` · ${selectedUnit.label}`:""}</h2>
          <p className={styles.ticketSubject}>{selectedUnit?.buildingName}</p>
          <TicketProgress workStatus={selected.workStatus} intakeStatus={intakeDisplayStatus(selected)}>
            {/* For a manager the next-step zone below already explains the state; do not say it twice. */}
            {managerStep?null:progressMessage(selected,session.role==="TENANT")}
          </TicketProgress>

        </section>
        {/* Menu audit F-04: the manager's next action, by state, at the top; its button opens the folded section that holds it. */}
        {managerStep?<TaskZone tenant={false} label="다음 할 일" heading="다음 할 일" message={managerStep.title}><p>{managerStep.detail}</p>{managerStep.action?<button type="button" onClick={()=>goToStep(managerStep.action!.target)}>{managerStep.action.label}</button>:null}</TaskZone>:null}
        {b1&&session.role==="TENANT"?<VendorHandoffTenant key={`vendor-tenant-${b1.orgId}-${selected.ticketId}`} client={client} ticketId={selected.ticketId} revision={revision}/>:null}
        <TicketOutcome key={`outcome-${selected.ticketId}`} client={client} ticket={selected} tenant={session.role==="TENANT"} revision={revision} onFollowUp={beginFollowUp} onOpen={openOutcome}/>
        <TicketCommunication key={selected.ticketId} client={client} ticketId={selected.ticketId} tenant={session.role==="TENANT"} revision={revision} completed={selected.workStatus==="COMPLETED"} onVersion={setCommunicationVersion}>
        {/* Tenant-only children render right after the conversation's own to-do, so a pending reply stays first. */}
        {/* Keyed on the shown state, not on photo revisions, so uploads right after 접수하기 do not remount the questions. */}
        {session.role==="TENANT"&&tenantIntakeOpen(selected)?<TaskZone tenant label="지금 할 일: 추가 확인" message={intakeTaskMessage(intakeDisplayStatus(selected))}><TicketIntake key={`${selected.ticketId}-${intakeDisplayStatus(selected)}`} ticketId={selected.ticketId} client={client.protocol} coreFlow onStatusChange={onIntakeStatus} evidenceStep={evidenceStep}/></TaskZone>:null}
        <div className={styles.photoArea}>
        <PhotoGallery client={client} ticketId={selected.ticketId} revision={`${revision}-${photoRevision}`} named={selected.detail.submittedEvidence??[]} />
        {session.role==="TENANT"?<>
          {selected.workStatus!=="COMPLETED"||pending.length?<PhotoPicker files={pending} onChange={setPending} disabled={busy||selected.workStatus==="COMPLETED"} />:null}
          {selected.workStatus==="COMPLETED"&&pending.length?<button disabled={busy} onClick={()=>setPending([])}>미전송 사진 선택 취소</button>:null}
          {photoMessage?<p role="status">{photoMessage}</p>:null}
          {selected.workStatus!=="COMPLETED"?<div className="core-actions"><button disabled={busy||!pending.length} onClick={()=>void run(()=>upload(selected.ticketId,pending),true)}>사진 저장</button><button disabled={busy} onClick={()=>void run(checkPhotos)}>저장된 사진 확인</button></div>:null}
        </>:null}
        </div>

        <section className={styles.history} aria-label="진행 이력"><h2>진행 이력</h2>{historyLines(selected.events).map(line=><p key={line.id}><DateTime at={line.at}/> {line.actor} · {line.label}{line.message?` · ${line.message}`:""}</p>)}</section></TicketCommunication>
          <details className={styles.technicalDetails}><summary>접수 세부 정보</summary><p className={styles.ticketId}>접수번호 {selected.ticketId}</p></details>
        {selected.workStatus==="COMPLETED"?<p>관리자의 완료 기록을 확인했어요. 목록에서 이력을 다시 볼 수 있어요.</p>:session.role==="TENANT"&&tenantIntakeOpen(selected)?null:<details id={session.role==="TENANT"?undefined:"ticket-decision"} className={styles.protocolDetails}><summary>{session.role==="TENANT"?"추가 확인":"추가 확인·결정 기록"}</summary>{session.role==="TENANT"?<TicketIntake key={`${selected.ticketId}-${revision}`} ticketId={selected.ticketId} client={client.protocol} coreFlow onStatusChange={onIntakeStatus} evidenceStep={evidenceStep}/>:<TicketReview key={`${selected.ticketId}-${revision}`} ticketId={selected.ticketId} client={client.protocol} coreFlow onStatusChange={onIntakeStatus} onDecided={onDecided}/>}</details>}
        </div>
        {session.role!=="TENANT"?<ManagerInspector expanded={inspectorExpanded} onExpandedChange={setInspectorExpanded}><div className={styles.actionRail}>
        <ManagerWorkDetail key={selected.ticketId} client={client} ticket={selected} revision={revision}/>
        {b1?<VendorHandoffManager communicationVersion={communicationVersion?.ticketId===selected.ticketId?communicationVersion.version:undefined} key={`vendor-${b1.orgId}-${selected.ticketId}`} client={client} ticket={selected} revision={revision} onHandoff={onManagerHandoff} onChanged={()=>void run(async()=>adopt(await client.read(selected.ticketId)))}/>:null}
        <ManagerMaintenanceFactEditor key={`maintenance-${selected.ticketId}`} client={client} ticket={selected} revision={revision} onOpenTicket={openMaintenanceTicket} onRecorded={recorded=>setFactRecorded(current=>current?.ticketId===selected.ticketId&&current.recorded===recorded?current:{ticketId:selected.ticketId,recorded})} onChanged={()=>setRevision(r=>r+1)} onViewUnit={id=>{setMaintenanceUnit(id);navigate({tab:"more",view:"maintenance"});}}/>
        <ManagerDirectCompletionGate enabled={Boolean(b1)} handoff={managerHandoff?.ticketId===selected.ticketId?managerHandoff:null} loading={Boolean(b1&&managerHandoff?.ticketId!==selected.ticketId)}>{selected.workStatus!=="COMPLETED"?<form id="ticket-handling" className={styles.handling} onSubmit={e=>{e.preventDefault();void run(async()=>{const starting=selected.workStatus==="OPEN";adopt(await client.handling(selected.ticketId,{status:starting?"IN_PROGRESS":"COMPLETED",message,...(!starting&&communicationVersion?.ticketId===selected.ticketId?{expectedCommunicationVersion:communicationVersion.version}:{})}));setMessage("");setNotice(starting?"처리 시작 기록을 저장했어요. 세입자도 새로고침하면 확인할 수 있어요.":"처리 완료 기록을 저장했어요. 세입자도 새로고침하면 확인할 수 있어요.");detailHeading.current?.focus();},true);}}>
          <label>처리 기록 <textarea aria-label="처리 기록" maxLength={2000} required value={message} onChange={e=>setMessage(e.target.value)} /></label>
          <button className={styles.primary} disabled={busy||!message.trim()||(selected.workStatus==="IN_PROGRESS"&&communicationVersion?.ticketId!==selected.ticketId)}>{selected.workStatus==="OPEN"?"처리 시작 기록":"처리 완료 기록"}</button>
          <p>담당자가 확인한 사실을 기록하세요. 자동 출동이나 수리 검증을 뜻하지 않아요.</p>
        </form>:null}</ManagerDirectCompletionGate>
        </div></ManagerInspector>:null}
      </section>:!tenant?null:<>
        {/* P5 PR 1b (spec §4): the to-do line above the unit choice. It counts the 알림 rows, so it waits for the same read. */}
        {tab==="home"&&conversationSummaries.ready&&todo.items.length?<a className={styles.todoLine} {...placeLink({tab:"alerts",view:null})}>처리할 일 {todo.items.length}건 · 알림에서 보기</a>:null}
        {units.length!==1?<label>건물·호실 <select aria-label="건물·호실" disabled={!units.length||Boolean(followUp)} value={unit} onChange={e=>setUnit(e.target.value)}>{units.map(u=><option key={u.id} value={u.id}>{u.buildingName} · {u.label}</option>)}</select></label>:null}
        <div className={styles.tenantHome} hidden={tab!=="home"}>
          {followUp?<><FollowUpContext kind={followUp.claimKind}/><button disabled={busy||Boolean(followAttempt)} onClick={()=>openOutcome(followUp.sourceTicketId)}>원본 접수로 돌아가기</button></>:null}
          {!units.length?<p>접근 가능한 호실이 없어요. 관리자에게 소속·호실 배정을 확인한 뒤 새로고침을 눌러 주세요.</p>:null}
          {home.cards.length?<section className={styles.homeCards} aria-label="진행 중인 요청">
            <h2>진행 중인 요청 <small>{home.total}건</small></h2>
            {pending.length?<p>{pendingPhotosHint}</p>:null}
            <ul>{home.cards.map(({ticket:t,next})=><li key={t.ticketId} data-home-card={t.ticketId}>
              <div><p className={styles.cardTitle}><span className={styles.ticketTitle}>{ticketName(t)}</span>{isIntakeDraft(t)?<DraftBadge/>:<WorkStatusBadge status={t.workStatus}/>}</p><p className={styles.cardNext}>{next}</p></div>
              <button type="button" aria-label={`${ticketName(t)} 열기`} disabled={busy||pending.length>0} onClick={()=>openTenantTicket(t.ticketId)}>열기</button>
            </li>)}</ul>
            {home.total>HOME_CARD_LIMIT?<a className={styles.moreLink} {...placeLink({tab:"requests",view:null})}>내 요청에서 모두 보기</a>:null}
          </section>:null}
          {unit?<form onSubmit={e=>{e.preventDefault();submit();}}>
            <h2>어떤 문제가 있나요?</h2><fieldset disabled={Boolean(followAttempt)} className={styles.issueChoice}><legend>문제 유형</legend>{(["HEATING","LEAK"] as const).map(value=><label key={value} data-tile><input type="radio" name="issueType" value={value} checked={issue===value} onChange={e=>setIssue(e.target.value as "HEATING"|"LEAK")}/><span>{value==="HEATING"?"난방":"누수"}</span></label>)}</fieldset>
            <label>문제 설명 <textarea aria-label="문제 설명" readOnly={Boolean(followAttempt)} value={text} maxLength={2000} required onChange={e=>setText(e.target.value)} /></label>
            <PhotoPicker files={pending} onChange={setPending} disabled={busy||Boolean(followAttempt)} compact />
            <div className={styles.submitZone}><button className={styles.primary} disabled={busy||!text.trim()}>{followAttempt?"같은 후속 접수 다시 확인·전송":"접수하기"}</button></div>
          </form>:null}
        </div>
        <div className={styles.tenantRequests} hidden={tab!=="requests"}>
          {conversationSummaries.error?<p role="alert">대화 대기 상태를 확인하지 못했어요. 새로고침을 눌러 주세요.</p>:null}
          {pending.length?<p>{pendingPhotosHint}</p>:null}
          {!unit?<p>호실 배정 후 접수 이력을 볼 수 있어요.</p>:requestGroups.map(group=><section key={group.name} aria-label={group.name}>
            <h2>{group.name} <small>{group.list.length}건</small></h2>
            {group.list.length?<ul className={styles.ticketList}>{group.list.map(t=><li key={t.ticketId} data-ticket-id={t.ticketId}><button data-open-ticket className={styles.ticketRow} disabled={busy||pending.length>0} onClick={()=>openTenantTicket(t.ticketId)}><span className={styles.ticketTitle}>{t.detail.issueType==="HEATING"?"난방":"누수"}</span><span> · </span>{isIntakeDraft(t)?<DraftBadge/>:<WorkStatusBadge status={t.workStatus}/>}<CommunicationBadge summary={conversationSummaries.summaries[t.ticketId]} tenant/></button><PhotoGallery compact client={client} ticketId={t.ticketId} revision={revision} /></li>)}</ul>:<p>{group.empty}</p>}
          </section>)}
        </div>
      </>}
      </div>
      {navContext&&!selected&&!view&&tab==="alerts"?<div className={navStyles.pane}><TodoScreen role={session.role} list={todo} ready={conversationSummaries.ready} units={units} disabled={busy||pending.length>0} notice={pending.length?pendingPhotosHint:undefined} onOpen={openFromList} onRetry={()=>void run(refresh)}/></div>:null}
      {navContext&&!selected&&(tenant?tab==="me"&&!view:view==="me")?<div className={navStyles.pane}><MenuList label="내 정보" rows={meRows(navContext)} organization={account?.organization} onOpen={navigate} onLogout={logout}/></div>:null}
      {navContext&&!selected&&!tenant&&tab==="more"&&!view?<div className={navStyles.pane}><MenuList label="더 보기" rows={moreRows(navContext)} onOpen={navigate} onLogout={logout}/></div>:null}
      {!tenant&&!selected&&view==="maintenance"?<ManagerMaintenanceTimeline key={maintenanceUnit} client={client} units={units} revision={revision} disabled={busy} initialUnit={maintenanceUnit} onOpenTicket={openMaintenanceTicket}/>:null}
      {!selected&&view==="units"?<div className={navStyles.pane}><UnitsScreen units={units}/></div>:null}
      {!selected&&view==="licenses"?<div className={navStyles.pane}><OpenSourceNotice/></div>:null}
      {account?.linkPanel?<div hidden={Boolean(selected)||view!==(tenant?"link":"invitations")}>{account.linkPanel}</div>:null}
    </>}
    </Workspace>
    {b1?<footer className="core-environment"><EnvironmentNote>검증용 환경으로 실제 업체 배정이나 알림은 전송되지 않아요.</EnvironmentNote></footer>:null}
    </div>
  </div>;
}
