"use client";
import Image from "next/image";
import { useCallback,useEffect,useRef,useState } from "react";
import { ApiClientError,createVendorJobClient,type VendorJobClient } from "@build-manager/api-client";
import { VendorBlockerCommandSchema,VendorCompletionReportCommandSchema,VendorDeclineCommandSchema,type VendorBlockerCode,type VendorBlockerCommand,type VendorClearBlockerCommand,type VendorCompletionPhotoUploadCommand,type VendorCompletionReportCommand,type VendorDeclineReason,type VendorJobDto,type VendorPhotoOmissionReason,type VendorPreauthorizedAppointmentCommand,type VendorProposalCommand,type VendorRescheduleCommand,type VendorSharedDetailSourceType,type VendorVisitStartCommand } from "@build-manager/api-contracts";
import { IntervalFields,draftsToIntervals,emptyIntervalDraft,type IntervalDraft } from "../../../components/vendor-interval-fields";
import { formatVendorInterval,intervalWithin } from "../../../lib/vendor-time";
import { BLOCKER_LABELS,OMISSION_LABELS } from "../../../lib/vendor-blocker";
import styles from "./vendor-job.module.css";

const RAW=/^[A-Za-z0-9_-]{43}$/;
const REDEEM_KEY="bm.vendor.redeem";
const ISSUE:Record<"HEATING"|"LEAK",string>={HEATING:"난방",LEAK:"누수"};
const SOURCE:Record<VendorSharedDetailSourceType,string>={TENANT_REPORTED:"세입자 입력",BUILDING_VERIFIED:"건물 확인",MANAGER_REVIEWED:"관리자 확인"};
const ACCESS={TENANT_PRESENT_REQUIRED:"세입자 입회 필요",TENANT_PREAUTHORIZATION_ALLOWED:"세입자가 따로 동의한 시간에만 부재 중 출입 가능"} as const;
export const DECLINE_REASONS:readonly {value:VendorDeclineReason;label:string}[]=[
  {value:"NO_CAPACITY",label:"일정·인력 여유가 없음"},
  {value:"OUT_OF_SERVICE_AREA",label:"서비스 지역이 아님"},
  {value:"SKILL_MISMATCH",label:"맡을 수 없는 작업 분야"},
  {value:"CANNOT_MEET_TIMING",label:"요청 시기에 대응하기 어려움"},
  {value:"OTHER",label:"기타"},
];

type Phase=
  |{kind:"loading"}
  |{kind:"redeeming"}
  |{kind:"redeemUncertain"}
  |{kind:"unavailable"}
  |{kind:"loadFailed"}
  |{kind:"ready";job:VendorJobDto}
  |{kind:"declined";job:VendorJobDto}
  |{kind:"withdrawn";job:VendorJobDto}
  |{kind:"loggedOut"};
/** A decline draft/request belongs to exactly the assignment it was opened for and is never sent for another. */
type Decline={assignmentId:string|null;open:boolean;reason:VendorDeclineReason|null;note:string;confirming:boolean;requestId:string|null;status:"idle"|"submitting"|"uncertain";notice:string};
const closedDecline:Decline={assignmentId:null,open:false,reason:null,note:"",confirming:false,requestId:null,status:"idle",notice:""};
/** Accept/Withdraw intent, owned by one assignment; the same request identity is reused only for that assignment. */
type Lifecycle={kind:"accept"|"withdraw"|null;assignmentId:string|null;open:boolean;note:string;confirming:boolean;requestId:string|null;status:"idle"|"submitting"|"uncertain"};
const idleLifecycle:Lifecycle={kind:null,assignmentId:null,open:false,note:"",confirming:false,requestId:null,status:"idle"};
const STALE_NOTICE="작업 요청 내용이 바뀌었습니다. 최신 내용을 확인해 주세요.";
type ScheduleSend=
  |{kind:"propose";input:VendorProposalCommand}
  |{kind:"preauthorized";input:VendorPreauthorizedAppointmentCommand}
  |{kind:"reschedule";input:VendorRescheduleCommand}
  |{kind:"visit";appointmentId:string;input:VendorVisitStartCommand}
  |{kind:"record";input:VendorBlockerCommand}
  |{kind:"clear";blockerId:string;input:VendorClearBlockerCommand};
/**
 * Visit-scheduling and work-evidence drafts plus the one sent command, owned by one assignment;
 * an unknown outcome resends the identical command.
 */
type Schedule={assignmentId:string|null;drafts:IntervalDraft[];windowId:string|null;slot:IntervalDraft;rescheduling:boolean;
  work:"visit"|"record"|"clear"|null;blockerCode:VendorBlockerCode|null;followUpAck:boolean;note:string;sent:ScheduleSend|null;status:"idle"|"submitting"|"uncertain";notice:string};
const idleSchedule:Schedule={assignmentId:null,drafts:[emptyIntervalDraft()],windowId:null,slot:emptyIntervalDraft(),rescheduling:false,
  work:null,blockerCode:null,followUpAck:false,note:"",sent:null,status:"idle",notice:""};
const UNCERTAIN_SCHEDULE:Record<ScheduleSend["kind"],string>={
  propose:"제안 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.",
  preauthorized:"방문 확정 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.",
  reschedule:"일정 변경 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.",
  visit:"방문 시작 기록 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.",
  record:"막힘 기록 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.",
  clear:"막힘 해제 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.",
};
const NOTE_INVALID="메모에 사용할 수 없는 문자가 있습니다. 내용을 고친 뒤 다시 확인해 주세요.";
/** Initial completion report draft, photo staging and the one sent command, owned by one assignment. */
type Completion={assignmentId:string|null;appointmentId:string|null;uploads:{photoId:string;selected:boolean}[];pending:{file:Blob;input:VendorCompletionPhotoUploadCommand}|null;
  uploadStatus:"idle"|"uploading"|"uncertain";omission:VendorPhotoOmissionReason|null;summary:string;note:string;
  /** The exact packet revision the Vendor acknowledged; a republished packet needs a fresh acknowledgment (review M3). */
  ackPacketId:string|null;confirming:boolean;sent:VendorCompletionReportCommand|null;status:"idle"|"submitting"|"uncertain";notice:string};
const idleCompletion:Completion={assignmentId:null,appointmentId:null,uploads:[],pending:null,uploadStatus:"idle",omission:null,summary:"",note:"",ackPacketId:null,
  confirming:false,sent:null,status:"idle",notice:""};
const VISIT_PHOTO_LIMIT=10;
/** Staged photos and the report draft belong to exactly one assignment and visit (review L2). */
const ownsCompletion=(job:VendorJobDto,state:Completion)=>state.assignmentId===job.assignmentId&&state.appointmentId===(job.appointment?.id??null);
const freshCompletion=(job:VendorJobDto):Completion=>({...idleCompletion,assignmentId:job.assignmentId,appointmentId:job.appointment?.id??null});
const VISIT_LIMIT="사진은 한 방문에 10장까지 올릴 수 있습니다. 남은 장수만큼만 올렸습니다.";
const VISIT_FULL="이 방문에는 사진을 더 올릴 수 없습니다. 사진은 한 방문에 10장까지 올릴 수 있습니다.";
const PHOTO_REJECTED="사진을 확인해 주세요. JPEG 또는 PNG, 5MB 이하만 올릴 수 있습니다.";
const PREAUTH_VISIT_DENIED="세입자가 출입에 동의한 시간이 아니거나 동의가 더 이상 유효하지 않아 방문을 시작할 수 없습니다. 관리자에게 문의해 주세요.";
const VISIT_DENIED="지금은 방문을 시작할 수 없습니다. 관리자에게 문의해 주세요.";
/** A form intent is shown only while its target still exists; stale intent never hides other actions (Task7 review L2). */
function effectiveWork(job:VendorJobDto,schedule:Schedule):Schedule["work"]{
  if(schedule.work==="record"&&job.activeBlocker)return null;
  if(schedule.work==="clear"&&!job.activeBlocker)return null;
  if(schedule.work==="visit"&&!(job.phase==="SCHEDULED"&&job.appointment?.status==="SCHEDULED"))return null;
  return schedule.work;
}
const systemNow=()=>new Date();

/** A 4xx answer is authoritative; transport loss, 5xx and malformed replies leave the outcome unknown. */
function definitive(error:unknown):boolean{
  return error instanceof ApiClientError&&typeof error.status==="number"&&error.status>=400&&error.status<500;
}
const statusOf=(error:unknown)=>error instanceof ApiClientError?error.status:undefined;
/** Non-reversible short fingerprint so storage never holds the raw capability. */
function fingerprint(fragment:string):string{
  let hash=0x811c9dc5;
  for(const char of `vendor-redeem:${fragment}`){hash^=char.charCodeAt(0);hash=Math.imul(hash,0x01000193)>>>0;}
  return hash.toString(16).padStart(8,"0");
}
function storage():Storage|null{try{return window.sessionStorage;}catch{return null;}}
function redeemIdentity(fragment:string):string{
  const key=fingerprint(fragment),store=storage();
  try{
    const saved:unknown=JSON.parse(store?.getItem(REDEEM_KEY)??"null");
    if(saved&&typeof saved==="object"&&"key" in saved&&"id" in saved&&saved.key===key&&typeof saved.id==="string")return saved.id;
  }catch{ /* unreadable entry is replaced below */ }
  const id=crypto.randomUUID();
  try{store?.setItem(REDEEM_KEY,JSON.stringify({key,id}));}catch{ /* identity still held in memory for this page */ }
  return id;
}
function forgetRedeem(){try{storage()?.removeItem(REDEEM_KEY);}catch{ /* nothing to forget */ }}
function clearFragment(){window.history.replaceState(window.history.state,"",window.location.pathname+window.location.search);}
function browserClient():VendorJobClient{
  return createVendorJobClient(async(input,init)=>fetch(input,{...init,cache:"no-store",credentials:"same-origin"}));
}

export function VendorJobScreen({client:injected,now=systemNow}:{client?:VendorJobClient;now?:()=>Date}){
  const [client]=useState(()=>injected??browserClient());
  const [phase,setPhase]=useState<Phase>({kind:"loading"});
  const [decline,setDecline]=useState<Decline>(closedDecline);
  const [lifecycle,setLifecycle]=useState<Lifecycle>(idleLifecycle);
  const [schedule,setSchedule]=useState<Schedule>(idleSchedule);
  const [completion,setCompletion]=useState<Completion>(idleCompletion);
  const [taskNotice,setTaskNotice]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const token=useRef<string|null>(null),requestId=useRef<string|null>(null),csrf=useRef<string|null>(null),logoutId=useRef<string|null>(null);
  // Bumped whenever a new redemption/load may switch assignment; results from an older generation are ignored.
  const generation=useRef(0);

  const redeem=useCallback(async()=>{
    const raw=token.current,id=requestId.current,gen=generation.current;
    if(!raw||!id)return;
    setPhase({kind:"redeeming"});
    try{
      const result=await client.redeem(raw,{clientRequestId:id});
      if(gen!==generation.current)return;
      csrf.current=result.session.csrf;token.current=null;requestId.current=null;
      clearFragment();forgetRedeem();
      setPhase({kind:"ready",job:result.job});
    }catch(error){
      if(gen!==generation.current)return;
      if(definitive(error)){token.current=null;requestId.current=null;clearFragment();forgetRedeem();setPhase({kind:"unavailable"});}
      // Another assignment's session is never proof that this redemption committed: keep this exact request.
      else setPhase({kind:"redeemUncertain"});
    }
  },[client]);

  const loadSession=useCallback(async()=>{
    const gen=generation.current;
    try{
      const session=await client.session();
      if(gen!==generation.current)return;
      csrf.current=session.csrf;
      const job=await client.job();
      if(gen!==generation.current)return;
      setPhase({kind:"ready",job});
    }catch(error){if(gen===generation.current)setPhase({kind:definitive(error)?"unavailable":"loadFailed"});}
  },[client]);

  const begin=useCallback(async()=>{
    // A new redemption/load may switch assignment: drop every pending per-assignment intent first.
    generation.current+=1;
    setDecline(closedDecline);setLifecycle(idleLifecycle);setSchedule(idleSchedule);setCompletion(idleCompletion);setTaskNotice("");setNotice("");logoutId.current=null;
    const fragment=window.location.hash.slice(1);
    if(!fragment)return loadSession();
    if(!RAW.test(fragment)){clearFragment();setPhase({kind:"unavailable"});return;}
    token.current=fragment;requestId.current=redeemIdentity(fragment);
    return redeem();
  },[redeem,loadSession]);
  // Deferred like the Manager surface; the liveness guard also keeps a dev double-mount from redeeming twice.
  useEffect(()=>{let live=true;void Promise.resolve().then(()=>{if(live)void begin();});return()=>{live=false;};},[begin]);
  // A reissued link pasted into an already open job tab only changes the fragment; redeem it the same way.
  useEffect(()=>{const onHash=()=>{void begin();};window.addEventListener("hashchange",onHash);return()=>window.removeEventListener("hashchange",onHash);},[begin]);
  /**
   * A 403 means the CSRF went stale (another tab rotated it) while the session lives: refresh once, same request.
   * Never refresh or retry once a same-tab switch started a newer generation; that CSRF belongs to another session.
   */
  const withFreshCsrf=async<T,>(gen:number,send:(value:string)=>Promise<T>):Promise<T>=>{
    try{return await send(csrf.current!);}
    catch(error){
      if(statusOf(error)!==403||gen!==generation.current)throw error;
      const fresh=(await client.session()).csrf;
      if(gen!==generation.current)throw error;
      csrf.current=fresh;
      return send(fresh);
    }
  };

  const refresh=async(gen:number):Promise<VendorJobDto|null>=>{
    try{const job=await client.job();if(gen!==generation.current)return null;setPhase({kind:"ready",job});return job;}
    catch(error){if(gen===generation.current)setPhase({kind:definitive(error)?"unavailable":"loadFailed"});return null;}
  };
  // Local input problems stay editable; they are never reported as an unknown server outcome.
  const confirmDecline=()=>{
    if(!decline.reason)return;
    const note=decline.note.trim();
    if(!VendorDeclineCommandSchema.shape.operationalNote.safeParse(note===""?null:note).success){
      setDecline({...decline,confirming:false,notice:"메모에 사용할 수 없는 문자가 있습니다. 내용을 고친 뒤 다시 확인해 주세요."});return;
    }
    setDecline({...decline,confirming:true,notice:""});
  };
  const submitDecline=async(state:Decline)=>{
    if(phase.kind!=="ready"||!state.reason||!csrf.current)return;
    const job=phase.job,gen=generation.current;
    if(state.assignmentId!==job.assignmentId){setDecline(closedDecline);return;}
    const id=state.requestId??crypto.randomUUID(),note=state.note.trim();
    setDecline({...state,requestId:id,status:"submitting",notice:""});
    try{
      const reason=state.reason;
      const result=await withFreshCsrf(gen,value=>client.decline(value,{clientRequestId:id,expectedAssignmentVersion:job.assignmentVersion,
        expectedPacketRevisionId:job.currentPacket?.id??"",reason,operationalNote:note===""?null:note}));
      if(gen!==generation.current)return;
      setDecline(closedDecline);setPhase({kind:"declined",job:result});
    }catch(error){
      if(gen!==generation.current)return;
      if(statusOf(error)===409){setDecline({...closedDecline,notice:STALE_NOTICE});await refresh(gen);}
      else if(statusOf(error)===403)setDecline({...closedDecline,notice:"보안 확인을 마치지 못했습니다. 화면을 다시 불러온 뒤 시도해 주세요."});
      else if(definitive(error)){setDecline(closedDecline);setPhase({kind:"unavailable"});}
      else setDecline({...state,requestId:id,status:"uncertain",notice:""});
    }
  };
  /** Accept/Withdraw: same request identity across an unknown outcome; authoritative refresh on a stale conflict. */
  const submitLifecycle=async(kind:"accept"|"withdraw",state:Lifecycle)=>{
    if(phase.kind!=="ready"||!csrf.current)return;
    const job=phase.job,gen=generation.current;
    if(state.kind!==kind||state.assignmentId!==job.assignmentId){setLifecycle(idleLifecycle);return;}
    const id=state.requestId??crypto.randomUUID(),note=state.note.trim();
    setLifecycle({...state,requestId:id,status:"submitting"});setTaskNotice("");
    try{
      const guards={clientRequestId:id,expectedAssignmentVersion:job.assignmentVersion,expectedPacketRevisionId:job.currentPacket?.id??""};
      const result=await withFreshCsrf(gen,value=>kind==="accept"?client.accept(value,guards):client.withdraw(value,{...guards,operationalNote:note===""?null:note}));
      if(gen!==generation.current)return;
      setLifecycle(idleLifecycle);
      setPhase(kind==="withdraw"?{kind:"withdrawn",job:result}:{kind:"ready",job:result});
    }catch(error){
      if(gen!==generation.current)return;
      // A rejected (not committed) Withdraw keeps its safe local draft; the next attempt is a new request.
      if(statusOf(error)===409){setLifecycle(kind==="withdraw"?{...state,requestId:null,status:"idle",confirming:false}:idleLifecycle);setTaskNotice(STALE_NOTICE);await refresh(gen);}
      else if(statusOf(error)===403){setLifecycle(idleLifecycle);setTaskNotice("보안 확인을 마치지 못했습니다. 화면을 다시 불러온 뒤 시도해 주세요.");}
      else if(definitive(error)){setLifecycle(idleLifecycle);setPhase({kind:"unavailable"});}
      else setLifecycle({...state,requestId:id,status:"uncertain"});
    }
  };
  /** Scheduling commands: identical resend on an unknown outcome; authoritative refresh (draft kept) on a stale conflict. */
  const sendSchedule=async(send:ScheduleSend,state:Schedule)=>{
    if(phase.kind!=="ready"||!csrf.current)return;
    const job=phase.job,gen=generation.current;
    if(state.assignmentId!==job.assignmentId){setSchedule(idleSchedule);return;}
    setSchedule({...state,sent:send,status:"submitting",notice:""});setTaskNotice("");
    try{
      const result=await withFreshCsrf(gen,value=>{
        switch(send.kind){
          case "propose":return client.proposeSlots(value,send.input);
          case "preauthorized":return client.selectPreauthorizedSlot(value,send.input);
          case "reschedule":return client.reschedule(value,send.input);
          case "visit":return client.startVisit(value,send.appointmentId,send.input);
          case "record":return client.recordBlocker(value,send.input);
          case "clear":return client.clearBlocker(value,send.blockerId,send.input);
        }
      });
      if(gen!==generation.current)return;
      setSchedule({...idleSchedule,assignmentId:job.assignmentId});setPhase({kind:"ready",job:result});
    }catch(error){
      if(gen!==generation.current)return;
      const idle={...state,sent:null,status:"idle" as const};
      // A stale blocker draft stays editable; visit/clear confirmations close because their target may have changed.
      if(statusOf(error)===409){
        setSchedule({...idle,rescheduling:false,work:send.kind==="record"?"record":null});
        const fresh=await refresh(gen);
        if(!fresh)return;
        // Nothing changed for this visit: the server refused the start itself (e.g. outside the consented window).
        const refused=send.kind==="visit"&&fresh.assignmentVersion===send.input.expectedAssignmentVersion&&fresh.appointment?.id===send.appointmentId&&fresh.appointment.status==="SCHEDULED";
        setTaskNotice(refused?(fresh.appointment!.confirmationMode==="PREAUTHORIZED_ENTRY"?PREAUTH_VISIT_DENIED:VISIT_DENIED):STALE_NOTICE);
      }
      else if(statusOf(error)===403){setSchedule(idle);setTaskNotice("보안 확인을 마치지 못했습니다. 화면을 다시 불러온 뒤 시도해 주세요.");}
      else if(statusOf(error)===400)setSchedule({...idle,notice:["visit","record","clear"].includes(send.kind)?"입력한 내용을 다시 확인해 주세요.":"입력한 시간을 다시 확인해 주세요. 지난 시간은 선택할 수 없습니다."});
      else if(definitive(error)){setSchedule(idleSchedule);setPhase({kind:"unavailable"});}
      else setSchedule({...state,sent:send,status:"uncertain"});
    }
  };
  const ownedSchedule=(job:VendorJobDto)=>schedule.assignmentId===job.assignmentId?schedule:{...idleSchedule,assignmentId:job.assignmentId};
  const proposeSlots=()=>{
    if(phase.kind!=="ready")return;
    const job=phase.job,state=ownedSchedule(job);
    if(!job.currentRound||!job.currentPacket)return;
    const result=draftsToIntervals(state.drafts,now());
    if(!result.ok){setSchedule({...state,notice:result.message});return;}
    void sendSchedule({kind:"propose",input:{clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:job.assignmentVersion,expectedRoundVersion:job.currentRound.version,
      expectedPacketRevisionId:job.currentPacket.id,slots:result.intervals}},state);
  };
  const selectPreauthorized=()=>{
    if(phase.kind!=="ready")return;
    const job=phase.job,state=ownedSchedule(job),availability=job.availability;
    if(!job.currentRound||!job.currentPacket||!availability)return;
    const chosen=availability.windows.find(item=>item.id===state.windowId&&availability.authorizedWindowIds.includes(item.id));
    if(!chosen){setSchedule({...state,notice:"세입자가 동의한 시간을 먼저 골라 주세요."});return;}
    const result=draftsToIntervals([state.slot],now());
    if(!result.ok){setSchedule({...state,notice:result.message});return;}
    const slot=result.intervals[0];
    // Containment is checked by absolute instant; the server re-checks the same rule under lock.
    if(!intervalWithin(slot,chosen)){setSchedule({...state,notice:"동의된 시간 안에서만 방문 시간을 정할 수 있습니다."});return;}
    void sendSchedule({kind:"preauthorized",input:{clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:job.assignmentVersion,expectedRoundVersion:job.currentRound.version,
      expectedPacketRevisionId:job.currentPacket.id,availabilitySubmissionId:availability.id,selectedWindowId:chosen.id,startAt:slot.startAt,endAt:slot.endAt}},state);
  };
  const rescheduleVisit=()=>{
    if(phase.kind!=="ready")return;
    const job=phase.job,state=ownedSchedule(job);
    if(!job.currentRound||!job.currentPacket||job.appointment?.status!=="SCHEDULED")return;
    void sendSchedule({kind:"reschedule",input:{clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:job.assignmentVersion,expectedRoundVersion:job.currentRound.version,
      expectedAppointmentId:job.appointment.id,expectedPacketRevisionId:job.currentPacket.id}},state);
  };
  /** Work evidence: VISIT_STARTED for the current SCHEDULED Appointment and blocker record/clear, all append-only. */
  const startVisit=()=>{
    if(phase.kind!=="ready")return;
    const job=phase.job,state=ownedSchedule(job);
    if(!job.currentRound||!job.currentPacket||job.appointment?.status!=="SCHEDULED")return;
    void sendSchedule({kind:"visit",appointmentId:job.appointment.id,input:{clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:job.assignmentVersion,
      expectedRoundVersion:job.currentRound.version,expectedPacketRevisionId:job.currentPacket.id}},state);
  };
  const workNote=(state:Schedule)=>{const note=state.note.trim();return VendorBlockerCommandSchema.shape.operationalNote.safeParse(note===""?null:note).success?(note===""?null:note):undefined;};
  const recordBlocker=()=>{
    if(phase.kind!=="ready")return;
    const job=phase.job,state=ownedSchedule(job),note=workNote(state);
    if(!job.currentPacket||!state.blockerCode||(state.blockerCode==="FOLLOW_UP_VISIT_REQUIRED"&&(!state.followUpAck||!followUpAllowed(job))))return;
    if(note===undefined){setSchedule({...state,notice:NOTE_INVALID});return;}
    void sendSchedule({kind:"record",input:{clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:job.assignmentVersion,
      expectedPacketRevisionId:job.currentPacket.id,blockerCode:state.blockerCode,operationalNote:note}},state);
  };
  const clearBlocker=()=>{
    if(phase.kind!=="ready")return;
    const job=phase.job,state=ownedSchedule(job),note=workNote(state);
    if(!job.currentPacket||!job.activeBlocker)return;
    if(note===undefined){setSchedule({...state,notice:NOTE_INVALID});return;}
    void sendSchedule({kind:"clear",blockerId:job.activeBlocker.id,input:{clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:job.assignmentVersion,
      expectedPacketRevisionId:job.currentPacket.id,operationalNote:note}},state);
  };
  /** Completion evidence: one upload at a time; an unknown outcome resends the identical file and command. */
  const ownedCompletion=(job:VendorJobDto,state:Completion=completion)=>ownsCompletion(job,state)?state:freshCompletion(job);
  const uploadOne=async(file:Blob,input:VendorCompletionPhotoUploadCommand,gen:number):Promise<boolean>=>{
    setCompletion(current=>({...current,uploadStatus:"uploading",notice:""}));setTaskNotice("");
    try{
      const photo=await withFreshCsrf(gen,value=>client.uploadCompletionPhoto(value,input,file));
      if(gen!==generation.current)return false;
      setCompletion(current=>({...current,pending:null,uploadStatus:"idle",
        uploads:current.uploads.some(item=>item.photoId===photo.photoId)?current.uploads:[...current.uploads,{photoId:photo.photoId,selected:false}]}));
      return true;
    }catch(error){
      if(gen!==generation.current)return false;
      const idle={pending:null,uploadStatus:"idle" as const};
      if(statusOf(error)===409){
        setCompletion(current=>({...current,...idle}));
        const fresh=await refresh(gen);
        if(!fresh)return false;
        // Nothing changed for this visit: the per-visit capacity is used up, not a stale request (review L3).
        const full=fresh.assignmentVersion===input.expectedAssignmentVersion&&fresh.appointment?.id===input.expectedAppointmentId
          &&fresh.appointment.status==="OCCURRED"&&!fresh.currentReport;
        if(full)setCompletion(current=>({...current,notice:VISIT_FULL}));else setTaskNotice(STALE_NOTICE);
      }
      else if(statusOf(error)===403){setCompletion(current=>({...current,...idle}));setTaskNotice("보안 확인을 마치지 못했습니다. 화면을 다시 불러온 뒤 시도해 주세요.");}
      else if(statusOf(error)===401){setCompletion(idleCompletion);setPhase({kind:"unavailable"});}
      else if(definitive(error))setCompletion(current=>({...current,...idle,notice:PHOTO_REJECTED}));
      else setCompletion(current=>({...current,pending:{file,input},uploadStatus:"uncertain"}));
      return false;
    }
  };
  const pickPhotos=async(files:File[])=>{
    if(phase.kind!=="ready"||!csrf.current)return;
    const job=phase.job,gen=generation.current;
    if(!job.currentPacket||job.appointment?.status!=="OCCURRED")return;
    const owned=ownedCompletion(job,completion);
    const remaining=Math.max(0,VISIT_PHOTO_LIMIT-owned.uploads.length),chosen=files.slice(0,remaining);
    setCompletion(owned);
    let completed=true;
    for(const file of chosen){
      const input={clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:job.assignmentVersion,expectedPacketRevisionId:job.currentPacket.id,
        expectedAppointmentId:job.appointment.id,expectedCorrectionRequestId:null};
      if(!await uploadOne(file,input,gen)){completed=false;break;}
    }
    if(completed&&chosen.length<files.length&&gen===generation.current)setCompletion(current=>({...current,notice:VISIT_LIMIT}));
  };
  const retryUpload=()=>{if(completion.pending)void uploadOne(completion.pending.file,completion.pending.input,generation.current);};
  const sendReport=async(input:VendorCompletionReportCommand,state:Completion)=>{
    if(phase.kind!=="ready"||!csrf.current)return;
    const job=phase.job,gen=generation.current;
    if(state.assignmentId!==job.assignmentId){setCompletion(idleCompletion);return;}
    setCompletion({...state,sent:input,status:"submitting",notice:""});setTaskNotice("");
    try{
      await withFreshCsrf(gen,value=>client.submitCompletionReport(value,input));
      if(gen!==generation.current)return;
      setCompletion({...idleCompletion,assignmentId:job.assignmentId});
      await refresh(gen);
    }catch(error){
      if(gen!==generation.current)return;
      const idle={...state,sent:null,status:"idle" as const,confirming:false};
      if(statusOf(error)===409){setCompletion({...idle,ackPacketId:null});setTaskNotice(STALE_NOTICE);await refresh(gen);}
      else if(statusOf(error)===403){setCompletion(idle);setTaskNotice("보안 확인을 마치지 못했습니다. 화면을 다시 불러온 뒤 시도해 주세요.");}
      else if(statusOf(error)===400)setCompletion({...idle,notice:"입력한 내용을 다시 확인해 주세요."});
      else if(definitive(error)){setCompletion(idleCompletion);setPhase({kind:"unavailable"});}
      else setCompletion({...state,sent:input,status:"uncertain"});
    }
  };
  const submitReport=()=>{
    if(phase.kind!=="ready")return;
    const job=phase.job,state=ownedCompletion(job);
    if(!job.currentPacket||job.appointment?.status!=="OCCURRED"||state.ackPacketId!==job.currentPacket.id)return;
    const note=state.note.trim();
    const parsed=VendorCompletionReportCommandSchema.safeParse({clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:job.assignmentVersion,
      expectedPacketRevisionId:job.currentPacket.id,expectedAppointmentId:job.appointment.id,expectedCorrectionRequestId:null,supersedesReportId:null,
      workSummary:state.summary.trim(),componentOrPartNote:note===""?null:note,completionPhotoIds:state.uploads.filter(item=>item.selected).map(item=>item.photoId),
      photoOmissionReason:state.omission});
    if(!parsed.success){setCompletion({...state,confirming:false,notice:"입력한 내용을 다시 확인해 주세요."});return;}
    void sendReport(parsed.data,state);
  };
  const startAccept=()=>{
    if(phase.kind!=="ready")return;
    const held=lifecycle.kind==="accept"&&lifecycle.assignmentId===phase.job.assignmentId?lifecycle:{...idleLifecycle,kind:"accept" as const,assignmentId:phase.job.assignmentId};
    void submitLifecycle("accept",held);
  };
  const confirmWithdraw=()=>{
    const note=lifecycle.note.trim();
    if(!VendorDeclineCommandSchema.shape.operationalNote.safeParse(note===""?null:note).success){
      setTaskNotice("메모에 사용할 수 없는 문자가 있습니다. 내용을 고친 뒤 다시 확인해 주세요.");return;
    }
    setTaskNotice("");setLifecycle({...lifecycle,confirming:true});
  };
  const logout=async()=>{
    if(!csrf.current)return;
    const gen=generation.current;
    const id=logoutId.current??crypto.randomUUID();logoutId.current=id;setBusy(true);setNotice("");
    const done=()=>{generation.current+=1;csrf.current=null;logoutId.current=null;setPhase({kind:"loggedOut"});};
    try{
      await withFreshCsrf(gen,value=>client.logout(value,{clientRequestId:id}));
      if(gen===generation.current)done();
    }catch(error){
      if(gen!==generation.current)return;
      if(statusOf(error)===401){
        // Only an authoritative dead session confirms logout; a live session must never show a false logout.
        try{const live=await client.session();if(gen!==generation.current)return;csrf.current=live.csrf;setNotice("나가기를 완료하지 못했습니다. 다시 시도해 주세요.");}
        catch(check){if(gen!==generation.current)return;if(definitive(check))done();else setNotice("나가기 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.");}
      }
      else if(definitive(error))setNotice("나가기를 완료하지 못했습니다. 다시 시도해 주세요.");
      else setNotice("나가기 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.");
    }finally{setBusy(false);}
  };

  return <VendorJobView phase={phase} decline={decline} lifecycle={lifecycle} schedule={schedule} now={now} taskNotice={taskNotice} notice={notice} busy={busy} photoPath={client.sourcePhotoPath}
    onRetryRedeem={()=>void redeem()} onRetryLoad={()=>{setPhase({kind:"loading"});void loadSession();}} onDecline={change=>setDecline(current=>({...current,...change}))}
    onConfirmDecline={confirmDecline} onSubmitDecline={()=>void submitDecline(decline)}
    onAccept={startAccept} onLifecycle={change=>setLifecycle(current=>({...current,...change}))} onConfirmWithdraw={confirmWithdraw}
    onSubmitWithdraw={()=>void submitLifecycle("withdraw",lifecycle)} onLogout={()=>void logout()}
    onSchedule={change=>setSchedule(current=>({...(phase.kind==="ready"&&current.assignmentId!==phase.job.assignmentId?{...idleSchedule,assignmentId:phase.job.assignmentId}:current),...change,notice:""}))}
    onProposeSlots={proposeSlots} onSelectPreauthorized={selectPreauthorized} onReschedule={rescheduleVisit}
    onStartVisit={startVisit} onRecordBlocker={recordBlocker} onClearBlocker={clearBlocker}
    completion={completion} completionPhotoPath={client.completionPhotoPath}
    onCompletion={change=>setCompletion(current=>({...(phase.kind==="ready"&&!ownsCompletion(phase.job,current)?freshCompletion(phase.job):current),...change,notice:""}))}
    onPickPhotos={files=>void pickPhotos(files)} onRetryUpload={retryUpload} onSubmitReport={submitReport}
    onRetryReport={()=>{if(completion.sent)void sendReport(completion.sent,completion);}}
    onRetrySchedule={()=>{if(schedule.sent)void sendSchedule(schedule.sent,schedule);}}/>;
}

type ViewProps={
  phase:Phase;decline:Decline;lifecycle:Lifecycle;schedule:Schedule;now:()=>Date;taskNotice:string;notice:string;busy:boolean;photoPath:(id:string)=>string;
  onRetryRedeem():void;onRetryLoad():void;onDecline(change:Partial<Decline>):void;onConfirmDecline():void;onSubmitDecline():void;
  onAccept():void;onLifecycle(change:Partial<Lifecycle>):void;onConfirmWithdraw():void;onSubmitWithdraw():void;onLogout():void;
  onSchedule(change:Partial<Schedule>):void;onProposeSlots():void;onSelectPreauthorized():void;onReschedule():void;onRetrySchedule():void;
  onStartVisit():void;onRecordBlocker():void;onClearBlocker():void;
  completion:Completion;completionPhotoPath:(id:string)=>string;onCompletion(change:Partial<Completion>):void;onPickPhotos(files:File[]):void;
  onRetryUpload():void;onSubmitReport():void;onRetryReport():void;
};
export function VendorJobView(props:ViewProps){
  const {phase,notice,busy,photoPath,onRetryRedeem,onRetryLoad,onLogout}=props;
  return <main className={styles.page}>
    <header className={styles.header}><h1>작업 요청</h1></header>
    {phase.kind==="loading"||phase.kind==="redeeming"?<p role="status" className={styles.card}>보안 링크를 확인하고 있습니다.</p>:null}
    {phase.kind==="redeemUncertain"?<section className={styles.card} aria-labelledby="vendor-redeem-uncertain">
      <h2 id="vendor-redeem-uncertain">연결 결과를 확인하지 못했습니다</h2>
      <p>새 요청을 만들지 않고 같은 링크 요청으로 결과를 다시 확인합니다.</p>
      <button type="button" onClick={onRetryRedeem}>같은 링크 요청으로 다시 확인</button>
    </section>:null}
    {phase.kind==="loadFailed"?<section className={styles.card} aria-labelledby="vendor-load-failed">
      <h2 id="vendor-load-failed">작업 화면을 불러오지 못했습니다</h2>
      <p>연결이 잠시 불안정할 수 있습니다. 같은 기기에서 다시 불러와 주세요.</p>
      <button type="button" onClick={onRetryLoad}>다시 불러오기</button>
    </section>:null}
    {phase.kind==="unavailable"?<section className={styles.card} aria-labelledby="vendor-unavailable">
      <h2 id="vendor-unavailable">작업 화면을 열 수 없습니다</h2>
      <p>링크가 이미 사용되었거나 만료되었을 수 있습니다. 관리자에게 새 링크를 요청해 주세요.</p>
    </section>:null}
    {phase.kind==="loggedOut"?<section className={styles.card} aria-labelledby="vendor-logged-out">
      <h2 id="vendor-logged-out">이 기기에서 작업 화면을 닫았습니다</h2>
      <p>다시 열려면 관리자에게 새 링크를 요청해 주세요.</p>
    </section>:null}
    {phase.kind==="declined"?<section className={styles.card} aria-labelledby="vendor-declined">
      <h2 id="vendor-declined">작업 요청을 거절했습니다</h2>
      <p>거절 내용이 기록되었습니다. 이 작업 화면은 더 이상 사용할 수 없습니다.</p>
    </section>:null}
    {phase.kind==="withdrawn"?<section className={styles.card} aria-labelledby="vendor-withdrawn">
      <h2 id="vendor-withdrawn">작업을 철회했습니다</h2>
      <p>철회 내용이 기록되었습니다. 이 작업 화면은 더 이상 사용할 수 없습니다. 접수 건 자체는 관리자가 계속 처리합니다.</p>
    </section>:null}
    {phase.kind==="ready"?<>
      <CurrentTask {...props} job={phase.job}/>
      <Packet job={phase.job} photoPath={photoPath}/>
      <footer className={styles.footer}>
        {notice?<p role="alert">{notice}</p>:null}
        <button type="button" disabled={busy} onClick={onLogout}>이 기기에서 나가기</button>
      </footer>
    </>:null}
  </main>;
}

/** The server's scheduling turn before any blocker overlay (proposal → Tenant; preauthorized or availability → Vendor). */
function schedulingTurn(job:VendorJobDto):"TENANT"|"VENDOR"{
  if(job.proposal)return "TENANT";
  return job.effectiveMode==="PREAUTHORIZED_ENTRY_WINDOW"||job.availability?"VENDOR":"TENANT";
}
/** A follow-up visit can only be required after a visit actually occurred and nothing else is scheduled. */
function followUpAllowed(job:VendorJobDto):boolean{return job.appointment?.status==="OCCURRED"&&job.currentRound?.status!=="OPEN";}
function schedulingStatus(job:VendorJobDto,at:Date):string{
  if(job.phase==="SCHEDULED")return "방문 일정이 확정되었습니다.";
  if(job.phase!=="SCHEDULING")return "방문 작업이 진행 중입니다.";
  if(job.proposal&&!job.proposal.slots.some(slot=>Date.parse(slot.startAt)>at.getTime()))
    return "제안한 시간이 모두 지났습니다. 세입자가 새로 가능한 시간을 보내거나, 새 방문 시간을 다시 제안할 수 있습니다.";
  if(schedulingTurn(job)==="TENANT")return job.proposal?"제안한 시간 중 하나를 세입자가 고르기를 기다리고 있습니다.":"세입자가 가능한 시간을 알려 주기를 기다리고 있습니다. 먼저 방문 시간을 제안할 수도 있습니다.";
  const authorized=job.availability?.windows.filter(window=>job.availability!.authorizedWindowIds.includes(window.id))??[];
  if(job.effectiveMode==="PREAUTHORIZED_ENTRY_WINDOW"&&!authorized.some(window=>Date.parse(window.endAt)>at.getTime()))
    return "세입자가 동의한 시간이 모두 지났습니다. 세입자가 새로 가능한 시간을 보내기를 기다리거나, 방문 시간을 제안할 수 있습니다.";
  return job.effectiveMode==="PREAUTHORIZED_ENTRY_WINDOW"?"세입자가 동의한 시간 안에서 방문 시간을 정할 차례입니다.":"세입자가 가능한 시간을 알려 주었습니다. 방문 시간을 제안할 차례입니다.";
}

function CurrentTask(props:ViewProps&{job:VendorJobDto}){
  const {job,decline:heldDecline,lifecycle:heldLifecycle,schedule:heldSchedule,taskNotice,onDecline,onConfirmDecline,onSubmitDecline,onAccept,onLifecycle,onConfirmWithdraw,onSubmitWithdraw}=props;
  // Intents held for another assignment are never rendered or sent for this one.
  const decline=heldDecline.open&&heldDecline.assignmentId!==job.assignmentId?closedDecline:heldDecline;
  const lifecycle=heldLifecycle.assignmentId!==null&&heldLifecycle.assignmentId!==job.assignmentId?idleLifecycle:heldLifecycle;
  const schedule=heldSchedule.assignmentId!==null&&heldSchedule.assignmentId!==job.assignmentId?idleSchedule:heldSchedule;
  const offered=job.status==="OFFERED"&&job.currentPacket!==null;
  const active=job.status==="ACTIVE"&&job.currentPacket!==null;
  const submitting=decline.status==="submitting"||lifecycle.status==="submitting"||schedule.status==="submitting";
  const accepting=lifecycle.kind==="accept";
  const withdrawing=lifecycle.kind==="withdraw"&&lifecycle.open;
  const notice=decline.notice||taskNotice;
  return <section className={styles.card} aria-labelledby="vendor-current-task">
    <h2 id="vendor-current-task">지금 할 일</h2>
    {notice?<p role="alert">{notice}</p>:null}
    {offered?<>
      <p>작업 요청을 확인해 주세요. 링크를 연 것만으로 작업을 수락한 것은 아닙니다.</p>
      {accepting&&lifecycle.status==="uncertain"?<div className={styles.confirm} role="group" aria-label="수락 결과 확인">
        <p role="alert">수락 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.</p>
        <button type="button" onClick={onAccept}>같은 요청으로 수락 결과 확인</button>
      </div>:null}
      {!decline.open&&!(accepting&&lifecycle.status==="uncertain")?<>
        <button type="submit" disabled={submitting} onClick={onAccept}>작업 수락</button>
        <button type="button" disabled={submitting} onClick={()=>onDecline({...closedDecline,open:true,assignmentId:job.assignmentId})}>작업 거절</button>
      </>:null}
      {decline.open&&!decline.confirming&&decline.status==="idle"?<form className={styles.form} onSubmit={event=>{event.preventDefault();onConfirmDecline();}}>
        <fieldset>
          <legend>거절 사유</legend>
          {DECLINE_REASONS.map(item=><label key={item.value} className={styles.choice}>
            <input type="radio" name="vendor-decline-reason" value={item.value} checked={decline.reason===item.value} onChange={()=>onDecline({reason:item.value})}/>
            <span>{item.label}</span>
          </label>)}
        </fieldset>
        <label>메모 (선택, 500자 이내)
          <textarea maxLength={500} value={decline.note} onChange={event=>onDecline({note:event.target.value})}/>
        </label>
        <button type="submit" disabled={!decline.reason}>거절 내용 확인</button>
        <button type="button" onClick={()=>onDecline({open:false,confirming:false,reason:null,note:""})}>취소</button>
      </form>:null}
      {decline.open&&(decline.confirming||decline.status!=="idle")?<div className={styles.confirm} role="group" aria-labelledby="vendor-decline-confirm">
        <h3 id="vendor-decline-confirm">이 작업 요청을 거절할까요?</h3>
        <p>거절하면 이 링크로 더 이상 작업 화면을 열 수 없습니다. 접수 건 자체는 관리자가 계속 처리합니다.</p>
        {decline.status==="uncertain"?<>
          <p role="alert">거절 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.</p>
          <button type="button" onClick={onSubmitDecline}>같은 요청으로 결과 확인</button>
        </>:<>
          <button type="button" disabled={submitting} onClick={onSubmitDecline}>거절하기</button>
          <button type="button" disabled={submitting} onClick={()=>onDecline({confirming:false})}>돌아가기</button>
        </>}
      </div>:null}
    </>:active&&job.phase==="COMPLETION_REPORTED"?<ReportedView job={job}/>:active?<>
      <h3>방문 일정 조율</h3>
      <p>{schedulingStatus(job,props.now())}</p>
      {!withdrawing?<VisitScheduling {...props} schedule={schedule} submitting={submitting}/>:null}
      {!withdrawing?<WorkEvidence {...props} schedule={schedule} submitting={submitting}/>:null}
      {!withdrawing&&schedule.status==="idle"&&!effectiveWork(job,schedule)?<CompletionForm {...props} job={job}/>:null}
      {!withdrawing&&schedule.status==="idle"&&!schedule.rescheduling&&!effectiveWork(job,schedule)?<button type="button" disabled={submitting} onClick={()=>onLifecycle({...idleLifecycle,kind:"withdraw",open:true,assignmentId:job.assignmentId})}>작업 철회</button>:null}
      {withdrawing&&!lifecycle.confirming&&lifecycle.status==="idle"?<form className={styles.form} onSubmit={event=>{event.preventDefault();onConfirmWithdraw();}}>
        <label>철회 메모 (선택, 500자 이내)
          <textarea maxLength={500} value={lifecycle.note} onChange={event=>onLifecycle({note:event.target.value})}/>
        </label>
        <button type="submit">철회 내용 확인</button>
        <button type="button" onClick={()=>onLifecycle(idleLifecycle)}>취소</button>
      </form>:null}
      {withdrawing&&(lifecycle.confirming||lifecycle.status!=="idle")?<div className={styles.confirm} role="group" aria-labelledby="vendor-withdraw-confirm">
        <h3 id="vendor-withdraw-confirm">이 작업을 철회할까요?</h3>
        <p>철회하면 이 작업 화면을 더 이상 사용할 수 없고, 아직 진행하지 않은 방문 일정은 취소됩니다. 접수 건 자체는 관리자가 계속 처리합니다.</p>
        {lifecycle.status==="uncertain"?<>
          <p role="alert">철회 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.</p>
          <button type="button" onClick={onSubmitWithdraw}>같은 요청으로 결과 확인</button>
        </>:<>
          <button type="button" disabled={submitting} onClick={onSubmitWithdraw}>철회하기</button>
          <button type="button" disabled={submitting} onClick={()=>onLifecycle({confirming:false})}>돌아가기</button>
        </>}
      </div>:null}
    </>:<p>지금 진행할 수 있는 작업이 없습니다.</p>}
  </section>;
}

function VisitScheduling({job,schedule,now,submitting,onSchedule,onProposeSlots,onSelectPreauthorized,onReschedule,onRetrySchedule}:ViewProps&{job:VendorJobDto;submitting:boolean}){
  const at=now(),future=(instant:string)=>Date.parse(instant)>at.getTime(),label=(startAt:string,endAt:string)=>formatVendorInterval(startAt,endAt,at);
  const round=job.currentRound,open=job.phase==="SCHEDULING"&&round?.status==="OPEN";
  const appointment=job.appointment?.status==="SCHEDULED"?job.appointment:null;
  const availability=open?job.availability:null;
  const windows=availability?.windows.filter(item=>future(item.endAt))??[];
  const authorized=job.effectiveMode==="PREAUTHORIZED_ENTRY_WINDOW"?windows.filter(item=>availability!.authorizedWindowIds.includes(item.id)):[];
  const liveSlots=open?job.proposal?.slots.filter(slot=>future(slot.startAt))??[]:[];
  if(schedule.status==="uncertain"&&schedule.sent)return <div className={styles.confirm} role="group" aria-label="방문 일정 결과 확인">
    <p role="alert">{UNCERTAIN_SCHEDULE[schedule.sent.kind]}</p>
    <button type="button" onClick={onRetrySchedule}>같은 요청으로 결과 확인</button>
  </div>;
  return <>
    {schedule.notice?<p role="alert">{schedule.notice}</p>:null}
    {appointment?<div aria-label="확정된 방문 일정" role="group">
      <h3>확정된 방문 일정</h3>
      <p>{label(appointment.startAt,appointment.endAt)}</p>
      <p>{appointment.confirmationMode==="PREAUTHORIZED_ENTRY"?"세입자가 부재 중 출입에 동의한 시간 안에서 정한 방문입니다.":"세입자가 확정한 방문 시간입니다."}</p>
      {future(appointment.startAt)&&round?.status==="CONFIRMED"?(schedule.rescheduling?<div className={styles.confirm} role="group" aria-labelledby="vendor-reschedule-confirm">
        <h3 id="vendor-reschedule-confirm">방문 일정을 바꿀까요?</h3>
        <p>방문 일정을 바꾸면 기존 방문 일정은 취소되고, 세입자와 새로 일정을 조율해야 합니다.</p>
        <button type="button" disabled={submitting} onClick={onReschedule}>일정 변경하기</button>
        <button type="button" disabled={submitting} onClick={()=>onSchedule({rescheduling:false})}>돌아가기</button>
      </div>:<button type="button" disabled={submitting} onClick={()=>onSchedule({rescheduling:true})}>방문 일정 변경</button>):null}
    </div>:null}
    {windows.length?<div>
      <h3>세입자가 알려 준 가능한 시간</h3>
      <ul>{windows.map(item=><li key={item.id}>{label(item.startAt,item.endAt)}{availability!.authorizedWindowIds.includes(item.id)?" · 부재 중 출입 동의":""}</li>)}</ul>
    </div>:null}
    {authorized.length?<form className={styles.form} onSubmit={event=>{event.preventDefault();onSelectPreauthorized();}}>
      <fieldset disabled={submitting}>
        <legend>세입자가 동의한 시간</legend>
        {authorized.map(item=><label key={item.id} className={styles.choice}>
          <input type="radio" name="vendor-authorized-window" checked={schedule.windowId===item.id} onChange={()=>onSchedule({windowId:item.id})}/>{label(item.startAt,item.endAt)}
        </label>)}
      </fieldset>
      <IntervalFields legend="동의된 시간 안의 방문 시간" drafts={[schedule.slot]} max={1} disabled={submitting} onChange={([slot])=>onSchedule({slot:slot??emptyIntervalDraft()})}/>
      <button type="submit" disabled={submitting}>동의된 시간 안에서 방문 확정</button>
    </form>:null}
    {liveSlots.length?<div>
      <h3>제안한 방문 시간</h3>
      <ul>{liveSlots.map(slot=><li key={slot.id}>{label(slot.startAt,slot.endAt)}</li>)}</ul>
    </div>:null}
    {open&&!liveSlots.length?<form className={styles.form} onSubmit={event=>{event.preventDefault();onProposeSlots();}}>
      <IntervalFields legend="세입자에게 제안할 방문 시간 (최대 5개)" drafts={schedule.drafts} disabled={submitting} onChange={drafts=>onSchedule({drafts})}/>
      <button type="submit" disabled={submitting}>방문 시간 제안하기</button>
    </form>:null}
  </>;
}

function WorkEvidence({job,schedule,submitting,onSchedule,onStartVisit,onRecordBlocker,onClearBlocker}:ViewProps&{job:VendorJobDto;submitting:boolean}){
  if(schedule.status==="uncertain")return null;
  const blocker=job.activeBlocker,follow=blocker?.code==="FOLLOW_UP_VISIT_REQUIRED",work=effectiveWork(job,schedule);
  const appointment=job.phase==="SCHEDULED"&&job.appointment?.status==="SCHEDULED"?job.appointment:null;
  const codes=(Object.keys(BLOCKER_LABELS) as VendorBlockerCode[]).filter(code=>code!=="FOLLOW_UP_VISIT_REQUIRED"||followUpAllowed(job));
  const chosen=schedule.blockerCode!==null&&codes.includes(schedule.blockerCode)?schedule.blockerCode:null;
  const followUpChosen=chosen==="FOLLOW_UP_VISIT_REQUIRED";
  const noteField=<label>메모 (선택, 500자 이내)<textarea maxLength={500} value={schedule.note} onChange={event=>onSchedule({note:event.target.value})}/></label>;
  return <>
    {blocker?<div className={styles.notice} role="group" aria-labelledby="vendor-current-blocker">
      <h3 id="vendor-current-blocker">현재 막힘</h3>
      <p>{BLOCKER_LABELS[blocker.code]}</p>
      {blocker.note?<p>{blocker.note}</p>:null}
      {work==="clear"?<form className={styles.form} onSubmit={event=>{event.preventDefault();onClearBlocker();}}>
        {follow?<p>추가 방문 일정 조율을 시작합니다. 이 막힘은 해제된 것으로 기록되고, 이전 방문 기록은 그대로 남습니다.</p>:null}
        {noteField}
        <button type="submit" disabled={submitting}>{follow?"추가 방문 일정 조율 시작":"막힘 해제 기록"}</button>
        <button type="button" disabled={submitting} onClick={()=>onSchedule({work:null})}>돌아가기</button>
      </form>:<button type="button" disabled={submitting} onClick={()=>onSchedule({work:"clear",note:""})}>{follow?"추가 방문 일정 잡기":"막힘 해제"}</button>}
    </div>:null}
    {appointment&&!blocker&&!schedule.rescheduling?(work==="visit"?<div className={styles.confirm} role="group" aria-labelledby="vendor-visit-confirm">
      <h3 id="vendor-visit-confirm">방문을 시작할까요?</h3>
      <p>방문을 시작하면 이 방문 일정은 진행된 것으로 기록되며 되돌릴 수 없습니다.</p>
      {appointment.confirmationMode==="PREAUTHORIZED_ENTRY"?<p>세입자가 출입에 동의한 시간 안에서만 시작할 수 있습니다. 동의한 시간이 지나면 방문을 시작할 수 없습니다. 이 경우 관리자에게 문의해 주세요.</p>:null}
      <button type="button" disabled={submitting} onClick={onStartVisit}>방문 시작 기록</button>
      <button type="button" disabled={submitting} onClick={()=>onSchedule({work:null})}>돌아가기</button>
    </div>:work===null?<button type="button" disabled={submitting} onClick={()=>onSchedule({work:"visit"})}>방문 시작</button>:null):null}
    {!blocker&&!schedule.rescheduling?(work==="record"?<form className={styles.form} onSubmit={event=>{event.preventDefault();onRecordBlocker();}}>
      <fieldset>
        <legend>막힘 사유</legend>
        {codes.map(code=><label key={code} className={styles.choice}>
          <input type="radio" name="vendor-blocker-code" value={code} checked={chosen===code} onChange={()=>onSchedule({blockerCode:code,followUpAck:false})}/>
          <span>{BLOCKER_LABELS[code]}</span>
        </label>)}
      </fieldset>
      {noteField}
      {followUpChosen?<div className={styles.confirm} role="group" aria-label="추가 방문 필요 확인">
        <p>추가 방문 필요를 기록하면, 이 막힘을 해제할 때 추가 방문 일정 조율이 시작되고 추가 방문을 마치기 전에는 작업 보고를 할 수 없습니다.</p>
        <label className={styles.choice}><input type="checkbox" checked={schedule.followUpAck} onChange={event=>onSchedule({followUpAck:event.target.checked})}/><span>추가 방문이 필요함을 확인했습니다</span></label>
      </div>:<p>막힘은 현재 진행 상태 위에 표시되며, 방문 일정과 기록은 바뀌지 않습니다.</p>}
      <button type="submit" disabled={submitting||!chosen||(followUpChosen&&!schedule.followUpAck)}>막힘 기록하기</button>
      <button type="button" disabled={submitting} onClick={()=>onSchedule({work:null,blockerCode:null,note:""})}>돌아가기</button>
    </form>:work===null?<button type="button" disabled={submitting} onClick={()=>onSchedule({work:"record",blockerCode:null,followUpAck:false,note:""})}>막힘 기록</button>:null):null}
  </>;
}

/** COMPLETION_REPORTED is read-only: no scheduling, visit, blocker, withdraw or further report actions. */
function ReportedView({job}:{job:VendorJobDto}){
  const report=job.currentReport;
  return <div role="group" aria-labelledby="vendor-reported">
    <h3 id="vendor-reported">작업 보고를 제출했습니다</h3>
    <p>관리자가 확인하고 있습니다. 확인이 끝날 때까지 보고 내용을 바꿀 수 없습니다.</p>
    {report?<dl className={styles.facts}>
      <dt>작업 내용 요약</dt><dd>{report.workSummary}</dd>
      {report.componentOrPartNote?<><dt>사용한 부품·자재</dt><dd>{report.componentOrPartNote}</dd></>:null}
      <dt>작업 사진</dt><dd>{report.photoOmissionReason?`사진 없음 · ${OMISSION_LABELS[report.photoOmissionReason]}`:`${report.completionPhotoIds.length}장`}</dd>
    </dl>:null}
  </div>;
}

/** Initial completion report: only after the latest visit occurred, with no current blocker, no OPEN round and no report yet. */
function CompletionForm({job,completion:held,completionPhotoPath,onCompletion,onPickPhotos,onRetryUpload,onSubmitReport,onRetryReport}:ViewProps&{job:VendorJobDto}){
  const completion=ownsCompletion(job,held)?held:idleCompletion;
  if(job.phase!=="IN_PROGRESS"||job.appointment?.status!=="OCCURRED"||job.activeBlocker||job.currentRound?.status==="OPEN"||job.currentReport||!job.currentPacket)return null;
  const selected=completion.uploads.filter(item=>item.selected).length;
  const busy=completion.uploadStatus==="uploading"||completion.status==="submitting";
  const acknowledged=completion.ackPacketId===job.currentPacket.id;
  const ready=acknowledged&&completion.summary.trim().length>0&&((selected>=1&&selected<=5)!==(completion.omission!==null));
  if(completion.status==="uncertain"&&completion.sent)return <div className={styles.confirm} role="group" aria-label="작업 보고 결과 확인">
    <p role="alert">작업 보고 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.</p>
    <button type="button" onClick={onRetryReport}>같은 요청으로 결과 확인</button>
  </div>;
  return <form className={styles.form} aria-labelledby="vendor-completion" onSubmit={event=>{event.preventDefault();onCompletion({confirming:true});}}>
    <h3 id="vendor-completion">작업 보고</h3>
    <p>작업 보고는 맡은 작업을 마쳤다는 업체의 보고입니다. 관리자가 내용을 확인합니다.</p>
    {completion.notice?<p role="alert">{completion.notice}</p>:null}
    <fieldset disabled={busy}>
      <legend>작업 사진 (선택, 최대 5장 포함)</legend>
      <label>사진 올리기 (JPEG 또는 PNG)
        <input type="file" accept="image/jpeg,image/png" multiple disabled={completion.uploads.length>=VISIT_PHOTO_LIMIT||completion.uploadStatus!=="idle"}
          onChange={event=>{const files=Array.from(event.target.files??[]);event.target.value="";if(files.length)onPickPhotos(files);}}/>
      </label>
      {completion.uploadStatus==="uncertain"?<div role="group" aria-label="사진 업로드 결과 확인">
        <p role="alert">사진 업로드 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.</p>
        <button type="button" onClick={onRetryUpload}>같은 요청으로 사진 업로드 다시 확인</button>
      </div>:null}
      {completion.uploads.map((item,index)=><div key={item.photoId}>
        <Image unoptimized src={completionPhotoPath(item.photoId)} width={320} height={240} alt={`업로드한 작업 사진 ${index+1}`}/>
        <label className={styles.choice}><input type="checkbox" checked={item.selected} disabled={!item.selected&&(selected>=5||completion.omission!==null)}
          onChange={event=>onCompletion({uploads:completion.uploads.map(other=>other.photoId===item.photoId?{...other,selected:event.target.checked}:other)})}/><span>작업 사진 {index+1} 보고에 포함</span></label>
      </div>)}
    </fieldset>
    <fieldset disabled={busy||selected>0}>
      <legend>사진 없이 보고하는 이유</legend>
      {(Object.keys(OMISSION_LABELS) as VendorPhotoOmissionReason[]).map(reason=><label key={reason} className={styles.choice}>
        <input type="radio" name="vendor-photo-omission" checked={completion.omission===reason} onChange={()=>onCompletion({omission:reason})}/><span>{OMISSION_LABELS[reason]}</span>
      </label>)}
      {completion.omission?<button type="button" onClick={()=>onCompletion({omission:null})}>사진 없이 보고 취소</button>:null}
    </fieldset>
    <label>작업 내용 요약 (필수, 1000자 이내)
      <textarea aria-label="작업 내용 요약" maxLength={1000} value={completion.summary} disabled={busy} onChange={event=>onCompletion({summary:event.target.value})}/>
    </label>
    <label>사용한 부품·자재 (선택, 500자 이내)
      <textarea aria-label="사용한 부품·자재" maxLength={500} value={completion.note} disabled={busy} onChange={event=>onCompletion({note:event.target.value})}/>
    </label>
    <label className={styles.choice}><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event=>onCompletion({ackPacketId:event.target.checked?job.currentPacket!.id:null})}/>
      <span>현재 작업 요청 내용({job.currentPacket.revision}번째 게시본)을 확인했습니다</span></label>
    {completion.confirming?<div className={styles.confirm} role="group" aria-labelledby="vendor-completion-confirm">
      <h3 id="vendor-completion-confirm">작업 보고를 제출할까요?</h3>
      <p>작업 보고를 제출하면 관리자가 확인할 때까지 수정할 수 없습니다.</p>
      <button type="button" disabled={busy||!ready} onClick={onSubmitReport}>작업 보고 제출하기</button>
      <button type="button" disabled={busy} onClick={()=>onCompletion({confirming:false})}>돌아가기</button>
    </div>:<button type="submit" disabled={busy||!ready}>작업 보고 제출</button>}
  </form>;
}

function Packet({job,photoPath}:{job:VendorJobDto;photoPath:(id:string)=>string}){
  const packet=job.currentPacket;
  if(!packet)return <section className={styles.card} aria-labelledby="vendor-packet"><h2 id="vendor-packet">업체 전달 내용</h2><p>아직 게시된 업체 전달 내용이 없습니다.</p></section>;
  return <section className={styles.card} aria-labelledby="vendor-packet">
    <h2 id="vendor-packet">업체 전달 내용</h2>
    <dl className={styles.facts}>
      <dt>작업 번호</dt><dd>{packet.jobReference}</dd>
      <dt>업체</dt><dd>{packet.vendorLabel}</dd>
      <dt>건물</dt><dd>{packet.buildingName}</dd>
      <dt>주소</dt><dd>{packet.serviceAddress}</dd>
      <dt>호실</dt><dd>{packet.unitLabel}</dd>
      <dt>문제 유형</dt><dd>{ISSUE[packet.issueType]}</dd>
      <dt>작업 내용</dt><dd>{packet.workSummary}</dd>
      <dt>출입 방식</dt><dd>{ACCESS[packet.accessPolicy]}</dd>
      {packet.accessInstruction?<><dt>출입 안내</dt><dd>{packet.accessInstruction}</dd></>:null}
    </dl>
    {packet.safetyNotice.length?<div className={styles.notice} role="note"><h3>안전 안내</h3><ul>{packet.safetyNotice.map((line,index)=><li key={index}>{line}</li>)}</ul></div>:null}
    {packet.sharedDetails.length?<div><h3>공유된 정보</h3><ul className={styles.details}>{packet.sharedDetails.map(detail=><li key={detail.key}>
      <span>{detail.label}: {detail.value}</span> <span className={styles.source}>{SOURCE[detail.sourceType]}</span>
    </li>)}</ul></div>:null}
    {packet.allowedPhotoIds.length?<div><h3>공유된 원본 사진</h3><div className={styles.photos}>{packet.allowedPhotoIds.map((id,index)=>
      <Image key={id} unoptimized src={photoPath(id)} width={640} height={480} alt={`공유된 원본 사진 ${index+1}`}/>)}</div></div>:null}
    <p className={styles.meta}>업체 전달 내용 {packet.revision}번째 게시본</p>
  </section>;
}
