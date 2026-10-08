"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import { VendorAvailabilityCommandSchema,type TenantVendorSchedulingDto } from "@build-manager/api-contracts";
import { formatVendorInterval } from "../../lib/vendor-time";
import { IntervalFields,draftsToIntervals,emptyIntervalDraft,type IntervalDraft } from "../../components/vendor-interval-fields";
import styles from "./vendor-handoff.module.css";

type Props={client:CoreFlowClient;ticketId:string;revision:number;now?:()=>Date};
type Kind="AVAILABILITY"|"AUTHORIZE"|"CONFIRM"|"RESCHEDULE";
/** A sent command keeps its exact input so an unknown outcome is reconciled with the same clientRequestId. */
type Pending={kind:Kind;context:string;run:()=>Promise<TenantVendorSchedulingDto>};
const SUCCESS:Record<Kind,string>={
  AVAILABILITY:"가능한 시간을 저장했습니다. 업체가 이 시간을 참고해 방문 시간을 제안합니다.",
  AUTHORIZE:"선택한 시간에 대한 출입 동의를 저장했습니다.",
  CONFIRM:"방문 시간을 확정했습니다.",
  RESCHEDULE:"방문 일정 변경을 기록했습니다. 새로 가능한 시간을 보내 주세요.",
};
const systemNow=()=>new Date();

export function VendorHandoffTenant(props:Props){return <LoadedVendorHandoffTenant key={`${props.ticketId}-${props.revision}`} {...props}/>;}
function LoadedVendorHandoffTenant({client,ticketId,now=systemNow}:Props){
  const [scheduling,setScheduling]=useState<TenantVendorSchedulingDto|null>(null),[absent,setAbsent]=useState(false),[loadError,setLoadError]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[pending,setPending]=useState<Pending|null>(null);
  const [drafts,setDrafts]=useState<IntervalDraft[]>(()=>[emptyIntervalDraft()]),[editingAvailability,setEditingAvailability]=useState(false);
  const [consentIds,setConsentIds]=useState<string[]>([]),[consentReview,setConsentReview]=useState(false);
  const [slotId,setSlotId]=useState<string|null>(null),[rescheduleFor,setRescheduleFor]=useState<string|null>(null);
  const generation=useRef(0),sending=useRef(false);
  const load=useCallback(async(current:number)=>{
    try{const value=await client.vendorHandoff.readScheduling(ticketId);if(current===generation.current){setScheduling(value);setPending(held=>held&&held.context!==JSON.stringify(value)?null:held);setAbsent(false);setLoadError("");}}
    catch(cause){
      if(current!==generation.current)return;
      const status=cause instanceof ApiClientError?cause.status:undefined;
      if(status===404||status===403){setScheduling(null);setAbsent(true);}else setLoadError("방문 일정을 확인하지 못했습니다. 다시 불러오세요.");
    }
  },[client,ticketId]);
  const refresh=useCallback(()=>{setError("");setNotice("");void load(++generation.current);},[load]);
  const invalidate=useCallback(()=>{generation.current++;},[]);
  useEffect(()=>{let live=true;void Promise.resolve().then(()=>{if(live)void load(++generation.current);});return()=>{live=false;invalidate();};},[load,invalidate]);

  const execute=async(request:Pending,replay=false)=>{
    if(sending.current)return;sending.current=true;const current=++generation.current;setBusy(true);setError("");setNotice("");
    try{
      if(replay){
        const fresh=await client.vendorHandoff.readScheduling(ticketId);
        if(current!==generation.current)return;
        setScheduling(fresh);
        if(JSON.stringify(fresh)!==request.context){
          setPending(null);setConsentIds([]);setConsentReview(false);setSlotId(null);setRescheduleFor(null);
          setNotice("방문 일정이 바뀌었습니다. 최신 일정을 확인해 주세요. 이전 요청의 성공 여부는 확정하지 않습니다.");return;
        }
      }
      const receipt=await request.run();
      if(current!==generation.current)return;
      // A receipt proves the original request; only readback represents current state after replay.
      const value=replay?await client.vendorHandoff.readScheduling(ticketId):receipt;
      if(current!==generation.current)return;
      setScheduling(value);setPending(null);setNotice(SUCCESS[request.kind]);
      if(request.kind==="AVAILABILITY"){setDrafts([emptyIntervalDraft()]);setEditingAvailability(false);}
      setConsentIds([]);setConsentReview(false);setSlotId(null);setRescheduleFor(null);
    }catch(cause){
      if(current!==generation.current)return;
      const status=cause instanceof ApiClientError?cause.status:undefined;
      if(status===409){
        // Stale guards: reload authoritative state and keep the Tenant's typed draft for an explicit retry.
        setPending(null);setConsentIds([]);setConsentReview(false);setSlotId(null);setRescheduleFor(null);setNotice("방문 일정이 바뀌었습니다. 최신 일정을 확인해 주세요.");
        await load(current);
      }else if(status===404){
        setPending(null);setError("요청을 처리하지 못했습니다. 최신 일정을 확인해 주세요.");
        await load(current);
      }else if(status!==undefined&&status>=400&&status<500&&status!==408&&status!==429){
        setPending(null);setError("요청을 처리하지 못했습니다. 입력한 내용과 최신 일정을 확인해 주세요.");
      }else{setPending(request);setError("결과를 확인하지 못했습니다. 새 요청을 만들지 않고 같은 요청으로 결과를 확인합니다.");}
    }finally{if(current===generation.current)setBusy(false);sending.current=false;}
  };

  if(absent)return null;
  if(!scheduling)return loadError?<section className={styles.panel} aria-label="방문 일정"><p role="alert">{loadError}</p><button type="button" onClick={refresh}>다시 불러오기</button></section>:null;
  const at=now(),future=(startAt:string)=>Date.parse(startAt)>at.getTime();
  const round=scheduling.currentRound,open=round?.status==="OPEN";
  const guards=round?{expectedAssignmentVersion:scheduling.assignmentVersion,expectedRoundVersion:round.version,expectedPacketRevisionId:scheduling.packetRevisionId}:null;
  const appointment=scheduling.appointment?.status==="SCHEDULED"?scheduling.appointment:null;
  const availability=scheduling.availability,proposal=open?scheduling.proposal:null;
  const liveSlots=proposal?.slots.filter(slot=>future(slot.startAt))??[];
  const expiredProposal=Boolean(proposal)&&liveSlots.length===0;
  // Every submitted window already ended and no proposal is pending: the Tenant must send new availability.
  const expiredWindows=open&&Boolean(availability)&&!proposal&&!availability!.windows.some(window=>future(window.endAt));
  const showAvailabilityForm=open&&(!availability||expiredProposal||expiredWindows||editingAvailability);
  const consentWindows=availability?.windows.filter(window=>future(window.startAt))??[];
  const offerConsent=open&&!proposal&&!editingAvailability&&scheduling.accessPolicy==="TENANT_PREAUTHORIZATION_ALLOWED"&&Boolean(availability)&&availability!.authorizedWindowIds.length===0&&consentWindows.length>0;
  // Review, send and enablement all use the same selection, limited to windows that are still offered.
  const selectedConsent=consentWindows.filter(window=>consentIds.includes(window.id));
  const selectedSlot=liveSlots.find(slot=>slot.id===slotId)??null;
  const locked=busy||pending!==null;
  const label=(startAt:string,endAt:string)=>formatVendorInterval(startAt,endAt,at);

  const submitAvailability=()=>{
    if(!guards)return;
    const result=draftsToIntervals(drafts,now());
    if(!result.ok){setError(result.message);setNotice("");return;}
    const parsed=VendorAvailabilityCommandSchema.safeParse({clientRequestId:crypto.randomUUID(),...guards,windows:result.intervals});
    if(!parsed.success){setError("입력한 시간을 다시 확인해 주세요.");setNotice("");return;}
    void execute({context:JSON.stringify(scheduling),kind:"AVAILABILITY",run:()=>client.vendorHandoff.submitAvailability(ticketId,parsed.data)});
  };
  const authorize=()=>{
    if(!guards||!availability||selectedConsent.length===0)return;
    const input={clientRequestId:crypto.randomUUID(),...guards,availabilitySubmissionId:availability.id,selectedWindowIds:selectedConsent.map(window=>window.id)};
    void execute({context:JSON.stringify(scheduling),kind:"AUTHORIZE",run:()=>client.vendorHandoff.authorizeEntry(ticketId,input)});
  };
  const confirm=()=>{
    if(!guards||!proposal||!selectedSlot)return;
    const slot=selectedSlot;
    if(!future(slot.startAt)){setError("지난 시간은 선택할 수 없습니다.");return;}
    const input={clientRequestId:crypto.randomUUID(),...guards,proposalId:proposal.id,selectedSlotId:slot.id};
    void execute({context:JSON.stringify(scheduling),kind:"CONFIRM",run:()=>client.vendorHandoff.confirmSlot(ticketId,input)});
  };
  const reschedule=()=>{
    if(!round||!appointment)return;
    const input={clientRequestId:crypto.randomUUID(),expectedAssignmentVersion:scheduling.assignmentVersion,expectedRoundVersion:round.version,expectedAppointmentId:appointment.id,expectedPacketRevisionId:scheduling.packetRevisionId};
    void execute({context:JSON.stringify(scheduling),kind:"RESCHEDULE",run:()=>client.vendorHandoff.tenantReschedule(ticketId,input)});
  };

  const hasTask=showAvailabilityForm||offerConsent||liveSlots.length>0;
  if(!appointment&&!hasTask&&!(open&&availability)&&!notice&&!error&&!pending)return null;
  return <section className={styles.panel} aria-label="방문 일정">
    {appointment?<section data-current-appointment aria-label="확정된 방문 일정">
      <h3>확정된 방문 일정</h3>
      <p>{label(appointment.startAt,appointment.endAt)}</p>
      <p>{appointment.confirmationMode==="PREAUTHORIZED_ENTRY"?"출입에 동의한 시간 안에서 정해진 방문 시간입니다.":"직접 확정한 방문 시간입니다."}</p>
      {future(appointment.startAt)&&round?.status==="CONFIRMED"?(rescheduleFor===appointment.id?<div role="group" aria-label="방문 일정 변경 확인">
        <p>방문 일정을 바꾸면 기존 방문 일정은 취소되고, 새로 가능한 시간을 다시 보내야 합니다.</p>
        <button type="button" disabled={locked} onClick={reschedule}>일정 변경하기</button>
        <button type="button" disabled={locked} onClick={()=>setRescheduleFor(null)}>돌아가기</button>
      </div>:<button type="button" disabled={locked} onClick={()=>setRescheduleFor(appointment.id)}>방문 일정 변경</button>):null}
    </section>:null}
    {notice?<p role="status">{notice}</p>:null}
    {error?<p role="alert">{error}</p>:null}
    {pending?<div role="group" aria-label="요청 결과 확인">
      <button type="button" disabled={busy} onClick={()=>void execute(pending,true)}>같은 요청으로 결과 확인</button>
      <button type="button" disabled={busy} onClick={refresh}>최신 일정 다시 불러오기</button>
    </div>:null}
    {hasTask?<section data-task-zone aria-label="방문 일정 조율">
      <h3>방문 일정 조율</h3>
      {liveSlots.length>0?<fieldset disabled={locked}>
        <legend>업체가 제안한 방문 시간</legend>
        <p>한 가지 시간을 골라 확정해 주세요.</p>
        {liveSlots.map(slot=><label key={slot.id}><input type="radio" name="vendor-slot" checked={slotId===slot.id} onChange={()=>setSlotId(slot.id)}/>{label(slot.startAt,slot.endAt)}</label>)}
        <button type="button" disabled={!selectedSlot} onClick={confirm}>이 시간으로 확정</button>
      </fieldset>:null}
      {expiredProposal?<p>제안된 시간이 모두 지났습니다. 새로 가능한 시간을 보내 주세요.</p>:null}
      {expiredWindows?<p>보낸 가능한 시간이 모두 지났습니다. 새로 가능한 시간을 보내 주세요.</p>:null}
      {offerConsent?<fieldset disabled={locked}>
        <legend>세입자 없이 출입 동의 (선택)</legend>
        <p>원하시는 경우에만 아래 시간 중 업체가 세입자 없이 출입해도 되는 시간을 고르세요. 동의하지 않아도 일정 조율은 계속됩니다.</p>
        {consentReview&&selectedConsent.length>0?<div role="group" aria-label="출입 동의 확인">
          <p>선택한 시간에만 세입자 없이 출입할 수 있습니다. 다른 시간에는 동의가 적용되지 않습니다.</p>
          <p>업체가 이 시간 안에서 방문 시간을 정하며, 따로 다시 확인을 요청하지 않습니다. 새로 가능한 시간을 보내면 이 동의는 더 이상 쓰이지 않습니다.</p>
          <ul>{selectedConsent.map(window=><li key={window.id}>{label(window.startAt,window.endAt)}</li>)}</ul>
          <button type="button" onClick={authorize}>동의하기</button>
          <button type="button" onClick={()=>setConsentReview(false)}>다시 고르기</button>
        </div>:<>
          {consentWindows.map(window=><label key={window.id}><input type="checkbox" checked={consentIds.includes(window.id)} onChange={event=>setConsentIds(ids=>event.target.checked?[...ids,window.id]:ids.filter(id=>id!==window.id))}/>{label(window.startAt,window.endAt)}</label>)}
          <button type="button" disabled={selectedConsent.length===0} onClick={()=>setConsentReview(true)}>선택한 시간 동의 확인</button>
        </>}
      </fieldset>:null}
      {showAvailabilityForm?<div>
        {availability?<p>새 시간을 보내면 이전에 보낸 시간과 출입 동의, 업체가 제안한 시간은 더 이상 쓰이지 않습니다.</p>:null}
        <IntervalFields legend="방문 가능한 시간" drafts={drafts} disabled={locked} onChange={value=>{setDrafts(value);setError("");}}/>
        <button type="button" disabled={locked} onClick={submitAvailability}>가능한 시간 보내기</button>
        {editingAvailability?<button type="button" disabled={locked} onClick={()=>setEditingAvailability(false)}>돌아가기</button>:null}
      </div>:null}
    </section>:null}
    {open&&availability&&!showAvailabilityForm?<section aria-label="보낸 가능한 시간">
      <h4>보낸 가능한 시간</h4>
      <ul>{availability.windows.map(window=><li key={window.id}>{label(window.startAt,window.endAt)}{availability.authorizedWindowIds.includes(window.id)?" · 세입자 없이 출입 동의":""}</li>)}</ul>
      {!proposal?<p>{availability.authorizedWindowIds.length?"출입에 동의하신 시간 안에서 업체가 방문 시간을 정하거나 방문 시간을 제안하기를 기다리고 있습니다.":"업체가 방문 시간을 제안하기를 기다리고 있습니다."}</p>:null}
      <button type="button" disabled={locked} onClick={()=>{setEditingAvailability(true);setConsentReview(false);}}>가능한 시간 바꾸기</button>
    </section>:null}
  </section>;
}
