"use client";
import { useCallback,useEffect,useRef,useState,useSyncExternalStore } from "react";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import type { CoreTicketDto,CoreTicketOutcome } from "@build-manager/api-contracts";
import { clearOutcomeRecovery,readOutcomeRecoveries,saveOutcomeRecovery,outcomeRecoveryEvent,type OutcomeRecovery } from "./outcome-recovery";
import styles from "./ticket-outcome.module.css";

const subscribe=(notify:()=>void)=>{window.addEventListener(outcomeRecoveryEvent,notify);window.addEventListener("storage",notify);return()=>{window.removeEventListener(outcomeRecoveryEvent,notify);window.removeEventListener("storage",notify);};};
const snapshot=()=>JSON.stringify(readOutcomeRecoveries());
export function useOutcomeRecoveries(){return JSON.parse(useSyncExternalStore(subscribe,snapshot,()=>"[]")) as OutcomeRecovery[];}
export const outcomeLabels:Record<CoreTicketOutcome["kind"],string>={
 UNCONFIRMED:"세입자 결과 확인 전",
 RESOLVED:"세입자가 해결됐다고 응답",
 UNRESOLVED:"세입자가 아직 문제가 있다고 알려 후속 접수 생성",
 RECURRENCE_CLAIM:"세입자가 다시 문제가 생겼다고 알려 후속 접수 생성",
};
const tenantLabels:typeof outcomeLabels={UNCONFIRMED:"관리자가 남긴 완료 기록을 확인하고 현재 상태를 알려주세요.",RESOLVED:"해결됐다고 알려주셨어요.",UNRESOLVED:"아직 문제가 있다고 알려 새 접수를 만들었습니다.",RECURRENCE_CLAIM:"다시 문제가 생겼다고 알려 새 접수를 만들었습니다."};
export type FollowUpKind="UNRESOLVED"|"RECURRENCE_CLAIM";
export function freshFollowUp(ticket:CoreTicketDto,claimKind:FollowUpKind){
 return {sourceTicketId:ticket.ticketId,unitId:ticket.unitId,issueType:ticket.detail.issueType,claimKind};
}
export function FollowUpContext({kind}:{kind:FollowUpKind}){
 return <aside className={styles.card} aria-label="후속 접수 안내"><p>이전 완료 접수에서 이어서 새로 접수합니다.</p><strong>{kind==="UNRESOLVED"?"아직 문제가 있어요":"다시 문제가 생겼어요"}</strong><p>지금의 문제를 새로 적어 주세요. 이전 본문·사진·대화·추가 확인 답변은 가져오지 않습니다.</p></aside>;
}
export function OutcomeRecoveryPanel({client,onOpen}:{client:CoreFlowClient;onOpen(id:string):void}){
 const requests=useOutcomeRecoveries(),[busy,setBusy]=useState(false),[error,setError]=useState(""),[missing,setMissing]=useState<string|null>(null);
 const check=async(r:OutcomeRecovery,retryResolved=false)=>{setBusy(true);setError("");setMissing(null);try{
  if(retryResolved)await client.outcome.confirmResolved(r.sourceTicketId,{clientRequestId:r.clientRequestId});
  const receipt=await client.outcome.receipt(r.sourceTicketId,r.clientRequestId);clearOutcomeRecovery(r.sourceTicketId);onOpen(receipt.targetTicketId??r.sourceTicketId);
 }catch(e){
  if(e instanceof ApiClientError&&[401,403].includes(e.status??0))clearOutcomeRecovery();
  else if(e instanceof ApiClientError&&e.status===409){clearOutcomeRecovery(r.sourceTicketId);onOpen(r.sourceTicketId);}
  else if(e instanceof ApiClientError&&e.status===404){setMissing(r.sourceTicketId);setError("저장 기록을 찾지 못했습니다. 성공이나 실패가 확정된 것은 아닙니다. 다시 확인해 주세요. 후속 접수는 이 창에 원래 입력이 남아 있을 때만 같은 요청으로 다시 보낼 수 있습니다.");}
  else setError("저장 여부를 확인하지 못했습니다. 원본의 현재 결과를 확인하거나 다시 눌러 주세요.");
 }finally{setBusy(false);}};
 if(!requests.length)return null;
 return <section className={styles.card} aria-label="처리 결과 저장 확인"><h2>저장 여부를 확인해 주세요</h2><p>응답을 받지 못한 요청이 있습니다. 자동으로 다시 전송하지 않습니다. 새로고침 후에는 입력 본문과 선택 사진을 복원하지 않습니다.</p>
 {error?<p className={styles.error} role="alert">{error}</p>:null}
 {requests.map(r=><div className={styles.actions} key={r.sourceTicketId}><button disabled={busy} onClick={()=>void check(r)}>저장 여부 확인 · {r.claimKind==="RESOLVED"?"해결 응답":"후속 접수"}</button><button disabled={busy} onClick={()=>onOpen(r.sourceTicketId)}>원본 결과 확인</button>{missing===r.sourceTicketId&&r.claimKind==="RESOLVED"?<button disabled={busy} onClick={()=>void check(r,true)}>같은 해결 응답 다시 보내기</button>:null}</div>)}</section>;
}
export function OutcomeSummary({outcome,tenant}:{outcome:CoreTicketOutcome;tenant:boolean}){
 return <><p className={styles.status}>{(tenant?tenantLabels:outcomeLabels)[outcome.kind]}</p>
 {outcome.assertedAt?<div className={styles.meta}><time dateTime={outcome.assertedAt}>{new Date(outcome.assertedAt).toLocaleString()}</time></div>:null}
 <p className={styles.hint}>{tenant?"관리자의 처리 완료 기록과 별도로 남긴 확인입니다.":"관리자의 처리 완료 기록과 별도로 남긴 세입자 응답입니다."} 객관적인 수리 검증이나 재발 확정 판정을 뜻하지 않습니다.</p></>;
}
type OutcomeViewProps={completed:boolean;tenant:boolean;outcome:CoreTicketOutcome|null;source:string|null;loading:boolean;error:string;busy:boolean;uncertain:boolean;onRefresh():void;onConfirm():void;onFollowUp(kind:FollowUpKind):void;onOpen(id:string):void};
export function OutcomeView({completed,tenant,outcome,source,loading,error,busy,uncertain,onRefresh,onConfirm,onFollowUp,onOpen}:OutcomeViewProps){
 if(!completed&&!source&&!error)return null;
 return <section className={styles.card} aria-label="세입자 처리 결과"><h2>{completed?(tenant?"처리 결과는 어땠나요?":"세입자 처리 결과"):"이전 완료 접수에서 이어진 요청"}</h2>
 {source?<div className={styles.actions}><button onClick={()=>onOpen(source)}>이전 완료 접수 보기</button></div>:null}
 {loading?<p role="status">처리 결과 불러오는 중…</p>:null}{error?<p className={styles.error} role="alert">{error}</p>:null}
 {completed||error?<div className={styles.actions}><button disabled={busy||loading} onClick={onRefresh}>결과 새로고침</button></div>:null}
 {!loading&&!error&&outcome?<><OutcomeSummary outcome={outcome} tenant={tenant}/>{outcome.followUpTicketId?<div className={styles.actions}><button onClick={()=>onOpen(outcome.followUpTicketId!)}>후속 접수 보기</button></div>:tenant&&!uncertain?<div className={styles.actions}>
 {outcome.kind==="UNCONFIRMED"?<><button disabled={busy} onClick={onConfirm}>해결됐어요</button><button disabled={busy} onClick={()=>onFollowUp("UNRESOLVED")}>아직 문제가 있어요</button></>:null}
 {outcome.kind==="UNCONFIRMED"||outcome.kind==="RESOLVED"?<button disabled={busy} onClick={()=>onFollowUp("RECURRENCE_CLAIM")}>다시 문제가 생겼어요</button>:null}</div>:null}</>:null}
 </section>;
}
export function TicketOutcome({client,ticket,tenant,revision,onFollowUp,onOpen}:{client:CoreFlowClient;ticket:CoreTicketDto;tenant:boolean;revision:number;onFollowUp(kind:FollowUpKind):void;onOpen(id:string):void}){
 const [outcome,setOutcome]=useState<CoreTicketOutcome|null>(null),[source,setSource]=useState<string|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const current=useRef(0),alive=useRef(false),sending=useRef(false),requests=useOutcomeRecoveries(),uncertain=requests.some(r=>r.sourceTicketId===ticket.ticketId);
 const completed=ticket.workStatus==="COMPLETED";
 const load=useCallback(async()=>{const g=++current.current;setLoading(true);try{const [relation,value]=await Promise.all([client.outcome.source(ticket.ticketId),completed?client.outcome.read(ticket.ticketId):Promise.resolve(null)]);if(alive.current&&g===current.current){setSource(relation.sourceTicketId);setOutcome(value);setError("");}}
 catch(e){if(alive.current&&g===current.current){setSource(null);setOutcome(null);setError("처리 결과를 불러오지 못했습니다. 결과 새로고침을 눌러 주세요.");if(e instanceof ApiClientError&&[401,403].includes(e.status??0))clearOutcomeRecovery();}}finally{if(alive.current&&g===current.current)setLoading(false);}},[client,completed,ticket.ticketId]);
 useEffect(()=>{alive.current=true;let mounted=true;const generation=current;void Promise.resolve().then(()=>{if(mounted)void load();});const focus=()=>{if(!document.hidden)void load();};window.addEventListener("focus",focus);return()=>{mounted=false;alive.current=false;generation.current++;window.removeEventListener("focus",focus);};},[load,revision]);
 const confirm=async()=>{
  if(sending.current||uncertain)return;sending.current=true;
  const r:OutcomeRecovery={sourceTicketId:ticket.ticketId,clientRequestId:crypto.randomUUID(),claimKind:"RESOLVED"};setBusy(true);setError("");saveOutcomeRecovery(r);
  try{await client.outcome.confirmResolved(ticket.ticketId,{clientRequestId:r.clientRequestId});if(alive.current){clearOutcomeRecovery(ticket.ticketId);await load();}}
  catch(e){if(!alive.current)return;if(e instanceof ApiClientError&&[400,401,403,404,409].includes(e.status??0)){clearOutcomeRecovery(ticket.ticketId);setOutcome(null);setSource(null);if(e.status===409)await load();else setError("저장할 수 없습니다. 현재 권한과 처리 결과를 확인해 주세요.");}else setError("저장 응답을 받지 못했습니다. 위의 저장 여부 확인을 눌러 주세요.");}finally{sending.current=false;if(alive.current)setBusy(false);}
 };
 return <OutcomeView {...{completed,tenant,outcome,source,loading,error,busy,uncertain,onFollowUp,onOpen}} onRefresh={()=>void load()} onConfirm={()=>void confirm()}/>;
}
