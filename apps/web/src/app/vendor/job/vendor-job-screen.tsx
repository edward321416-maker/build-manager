"use client";
import Image from "next/image";
import { useCallback,useEffect,useRef,useState } from "react";
import { ApiClientError,createVendorJobClient,type VendorJobClient } from "@build-manager/api-client";
import { VendorDeclineCommandSchema,type VendorDeclineReason,type VendorJobDto,type VendorSharedDetailSourceType } from "@build-manager/api-contracts";
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
  |{kind:"loggedOut"};
type Decline={open:boolean;reason:VendorDeclineReason|null;note:string;confirming:boolean;requestId:string|null;status:"idle"|"submitting"|"uncertain";notice:string};
const closedDecline:Decline={open:false,reason:null,note:"",confirming:false,requestId:null,status:"idle",notice:""};

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

export function VendorJobScreen({client:injected}:{client?:VendorJobClient}){
  const [client]=useState(()=>injected??browserClient());
  const [phase,setPhase]=useState<Phase>({kind:"loading"});
  const [decline,setDecline]=useState<Decline>(closedDecline);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const token=useRef<string|null>(null),requestId=useRef<string|null>(null),csrf=useRef<string|null>(null),logoutId=useRef<string|null>(null);

  const redeem=useCallback(async()=>{
    const raw=token.current,id=requestId.current;
    if(!raw||!id)return;
    setPhase({kind:"redeeming"});
    try{
      const result=await client.redeem(raw,{clientRequestId:id});
      csrf.current=result.session.csrf;token.current=null;requestId.current=null;
      clearFragment();forgetRedeem();
      setPhase({kind:"ready",job:result.job});
    }catch(error){
      if(definitive(error)){token.current=null;requestId.current=null;clearFragment();forgetRedeem();setPhase({kind:"unavailable"});}
      // Another assignment's session is never proof that this redemption committed: keep this exact request.
      else setPhase({kind:"redeemUncertain"});
    }
  },[client]);

  const loadSession=useCallback(async()=>{
    try{
      const session=await client.session();csrf.current=session.csrf;
      setPhase({kind:"ready",job:await client.job()});
    }catch(error){setPhase({kind:definitive(error)?"unavailable":"loadFailed"});}
  },[client]);

  const begin=useCallback(async()=>{
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
  /** A 403 means the CSRF went stale (another tab rotated it) while the session lives: refresh once, same request. */
  const withFreshCsrf=async<T,>(send:(value:string)=>Promise<T>):Promise<T>=>{
    try{return await send(csrf.current!);}
    catch(error){
      if(statusOf(error)!==403)throw error;
      csrf.current=(await client.session()).csrf;
      return send(csrf.current);
    }
  };

  const refresh=async()=>{
    try{setPhase({kind:"ready",job:await client.job()});}catch(error){setPhase({kind:definitive(error)?"unavailable":"loadFailed"});}
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
    const job=phase.job,id=state.requestId??crypto.randomUUID(),note=state.note.trim();
    setDecline({...state,requestId:id,status:"submitting",notice:""});
    try{
      const reason=state.reason;
      const result=await withFreshCsrf(value=>client.decline(value,{clientRequestId:id,expectedAssignmentVersion:job.assignmentVersion,
        expectedPacketRevisionId:job.currentPacket?.id??"",reason,operationalNote:note===""?null:note}));
      setDecline(closedDecline);setPhase({kind:"declined",job:result});
    }catch(error){
      if(error instanceof ApiClientError&&error.status===409){setDecline({...closedDecline,notice:"작업 요청 내용이 바뀌었습니다. 최신 내용을 확인해 주세요."});await refresh();}
      else if(statusOf(error)===403)setDecline({...closedDecline,notice:"보안 확인을 마치지 못했습니다. 화면을 다시 불러온 뒤 시도해 주세요."});
      else if(definitive(error)){setDecline(closedDecline);setPhase({kind:"unavailable"});}
      else setDecline({...state,requestId:id,status:"uncertain",notice:""});
    }
  };
  const logout=async()=>{
    if(!csrf.current)return;
    const id=logoutId.current??crypto.randomUUID();logoutId.current=id;setBusy(true);setNotice("");
    const done=()=>{csrf.current=null;logoutId.current=null;setPhase({kind:"loggedOut"});};
    try{await withFreshCsrf(value=>client.logout(value,{clientRequestId:id}));done();}
    catch(error){
      if(statusOf(error)===401){
        // Only an authoritative dead session confirms logout; a live session must never show a false logout.
        try{csrf.current=(await client.session()).csrf;setNotice("나가기를 완료하지 못했습니다. 다시 시도해 주세요.");}
        catch(check){if(definitive(check))done();else setNotice("나가기 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.");}
      }
      else if(definitive(error))setNotice("나가기를 완료하지 못했습니다. 다시 시도해 주세요.");
      else setNotice("나가기 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.");
    }finally{setBusy(false);}
  };

  return <VendorJobView phase={phase} decline={decline} notice={notice} busy={busy} photoPath={client.sourcePhotoPath}
    onRetryRedeem={()=>void redeem()} onRetryLoad={()=>{setPhase({kind:"loading"});void loadSession();}} onDecline={change=>setDecline(current=>({...current,...change}))}
    onConfirmDecline={confirmDecline} onSubmitDecline={()=>void submitDecline(decline)} onLogout={()=>void logout()}/>;
}

type ViewProps={
  phase:Phase;decline:Decline;notice:string;busy:boolean;photoPath:(id:string)=>string;
  onRetryRedeem():void;onRetryLoad():void;onDecline(change:Partial<Decline>):void;onConfirmDecline():void;onSubmitDecline():void;onLogout():void;
};
export function VendorJobView({phase,decline,notice,busy,photoPath,onRetryRedeem,onRetryLoad,onDecline,onConfirmDecline,onSubmitDecline,onLogout}:ViewProps){
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
    {phase.kind==="ready"?<>
      <CurrentTask job={phase.job} decline={decline} onDecline={onDecline} onConfirmDecline={onConfirmDecline} onSubmitDecline={onSubmitDecline}/>
      <Packet job={phase.job} photoPath={photoPath}/>
      <footer className={styles.footer}>
        {notice?<p role="alert">{notice}</p>:null}
        <button type="button" disabled={busy} onClick={onLogout}>이 기기에서 나가기</button>
      </footer>
    </>:null}
  </main>;
}

function CurrentTask({job,decline,onDecline,onConfirmDecline,onSubmitDecline}:{job:VendorJobDto;decline:Decline;onDecline(change:Partial<Decline>):void;onConfirmDecline():void;onSubmitDecline():void}){
  const offered=job.status==="OFFERED"&&job.currentPacket!==null;
  const submitting=decline.status==="submitting";
  return <section className={styles.card} aria-labelledby="vendor-current-task">
    <h2 id="vendor-current-task">지금 할 일</h2>
    {decline.notice?<p role="alert">{decline.notice}</p>:null}
    {offered?<>
      <p>작업 요청을 확인해 주세요. 링크를 연 것만으로 작업을 수락한 것은 아닙니다.</p>
      {!decline.open?<button type="button" onClick={()=>onDecline({open:true,notice:""})}>작업 거절</button>:null}
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
    </>:<p>지금 진행할 수 있는 작업이 없습니다.</p>}
  </section>;
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
