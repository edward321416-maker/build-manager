"use client";
import Image from "next/image";
import { useCallback,useEffect,useRef,useState } from "react";
import { ApiClientError,createVendorJobClient,type VendorJobClient } from "@build-manager/api-client";
import { VendorDeclineCommandSchema,type VendorDeclineReason,type VendorJobDto,type VendorPreauthorizedAppointmentCommand,type VendorProposalCommand,type VendorRescheduleCommand,type VendorSharedDetailSourceType } from "@build-manager/api-contracts";
import { IntervalFields,draftsToIntervals,emptyIntervalDraft,type IntervalDraft } from "../../../components/vendor-interval-fields";
import { formatVendorInterval,intervalWithin } from "../../../lib/vendor-time";
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
  |{kind:"reschedule";input:VendorRescheduleCommand};
/** Visit-scheduling drafts plus the one sent command, owned by one assignment; an unknown outcome resends the identical command. */
type Schedule={assignmentId:string|null;drafts:IntervalDraft[];windowId:string|null;slot:IntervalDraft;rescheduling:boolean;sent:ScheduleSend|null;status:"idle"|"submitting"|"uncertain";notice:string};
const idleSchedule:Schedule={assignmentId:null,drafts:[emptyIntervalDraft()],windowId:null,slot:emptyIntervalDraft(),rescheduling:false,sent:null,status:"idle",notice:""};
const UNCERTAIN_SCHEDULE:Record<ScheduleSend["kind"],string>={
  propose:"제안 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.",
  preauthorized:"방문 확정 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.",
  reschedule:"일정 변경 결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.",
};
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
    setDecline(closedDecline);setLifecycle(idleLifecycle);setSchedule(idleSchedule);setTaskNotice("");setNotice("");logoutId.current=null;
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

  const refresh=async(gen:number)=>{
    try{const job=await client.job();if(gen===generation.current)setPhase({kind:"ready",job});}
    catch(error){if(gen===generation.current)setPhase({kind:definitive(error)?"unavailable":"loadFailed"});}
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
      const result=await withFreshCsrf(gen,value=>send.kind==="propose"?client.proposeSlots(value,send.input)
        :send.kind==="preauthorized"?client.selectPreauthorizedSlot(value,send.input):client.reschedule(value,send.input));
      if(gen!==generation.current)return;
      setSchedule({...idleSchedule,assignmentId:job.assignmentId});setPhase({kind:"ready",job:result});
    }catch(error){
      if(gen!==generation.current)return;
      const idle={...state,sent:null,status:"idle" as const};
      if(statusOf(error)===409){setSchedule({...idle,rescheduling:false});setTaskNotice(STALE_NOTICE);await refresh(gen);}
      else if(statusOf(error)===403){setSchedule(idle);setTaskNotice("보안 확인을 마치지 못했습니다. 화면을 다시 불러온 뒤 시도해 주세요.");}
      else if(statusOf(error)===400)setSchedule({...idle,notice:"입력한 시간을 다시 확인해 주세요. 지난 시간은 선택할 수 없습니다."});
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
    onRetrySchedule={()=>{if(schedule.sent)void sendSchedule(schedule.sent,schedule);}}/>;
}

type ViewProps={
  phase:Phase;decline:Decline;lifecycle:Lifecycle;schedule:Schedule;now:()=>Date;taskNotice:string;notice:string;busy:boolean;photoPath:(id:string)=>string;
  onRetryRedeem():void;onRetryLoad():void;onDecline(change:Partial<Decline>):void;onConfirmDecline():void;onSubmitDecline():void;
  onAccept():void;onLifecycle(change:Partial<Lifecycle>):void;onConfirmWithdraw():void;onSubmitWithdraw():void;onLogout():void;
  onSchedule(change:Partial<Schedule>):void;onProposeSlots():void;onSelectPreauthorized():void;onReschedule():void;onRetrySchedule():void;
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

function schedulingStatus(job:VendorJobDto,at:Date):string{
  if(job.phase==="SCHEDULED")return "방문 일정이 확정되었습니다.";
  if(job.phase!=="SCHEDULING")return "방문 작업이 진행 중입니다.";
  if(job.proposal&&!job.proposal.slots.some(slot=>Date.parse(slot.startAt)>at.getTime()))
    return "제안한 시간이 모두 지났습니다. 세입자가 새로 가능한 시간을 보내거나, 새 방문 시간을 다시 제안할 수 있습니다.";
  if(job.waitingOn==="TENANT")return job.proposal?"제안한 시간 중 하나를 세입자가 고르기를 기다리고 있습니다.":"세입자가 가능한 시간을 알려 주기를 기다리고 있습니다. 먼저 방문 시간을 제안할 수도 있습니다.";
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
    </>:active?<>
      <h3>방문 일정 조율</h3>
      <p>{schedulingStatus(job,props.now())}</p>
      {!withdrawing?<VisitScheduling {...props} schedule={schedule} submitting={submitting}/>:null}
      {!withdrawing&&schedule.status==="idle"&&!schedule.rescheduling?<button type="button" disabled={submitting} onClick={()=>onLifecycle({...idleLifecycle,kind:"withdraw",open:true,assignmentId:job.assignmentId})}>작업 철회</button>:null}
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
