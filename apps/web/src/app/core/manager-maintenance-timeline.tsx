"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import { CoreMaintenanceFactCreateSchema,CoreMaintenanceFactCorrectionSchema,type CoreMaintenanceFactCreate,type CoreMaintenanceFactCorrection,type CoreTicketDto,type CoreMaintenanceActionKind,type CoreMaintenanceCorrectionReason,type CoreMaintenanceFactDetail,type CoreUnitMaintenanceFact,type CoreUnitDto } from "@build-manager/api-contracts";
import styles from "./manager-maintenance-timeline.module.css";
const actionLabels:Record<CoreMaintenanceActionKind,string>={INSPECTION:"점검",REPAIR:"수리",PART_REPLACEMENT:"부품 교체",ADJUSTMENT:"조정",OTHER:"기타"};
const reasonLabels:Record<CoreMaintenanceCorrectionReason,string>={ACTION_CLASSIFICATION:"작업 분류 정정",COMPONENT_LABEL:"부품·위치 명칭 정정",OTHER:"기타 정정"};
const outcomeLabels:Record<CoreUnitMaintenanceFact["tenantOutcome"],string>={UNCONFIRMED:"세입자 응답 미확인",RESOLVED:"세입자가 해결됐다고 응답",UNRESOLVED:"세입자가 아직 문제가 있다고 응답",RECURRENCE_CLAIM:"세입자가 다시 문제가 생겼다고 응답"};
const dateText=(value:string)=>new Date(value).toLocaleString("ko-KR");
export type EditorViewProps={completed:boolean;detail:CoreMaintenanceFactDetail|null;loading:boolean;error:string;notice:string;busy:boolean;editing:boolean;uncertain:boolean;reviewRequired:boolean;action:CoreMaintenanceActionKind;label:string;reason:CoreMaintenanceCorrectionReason;onAction(v:CoreMaintenanceActionKind):void;onLabel(v:string):void;onReason(v:CoreMaintenanceCorrectionReason):void;onSubmit():void;onEdit():void;onRefresh():void;onRetry():void;onReview():void;onOpenTicket(id:string):void;onViewUnit(id:string):void};
export function MaintenanceEditorView(p:EditorViewProps){
 if(!p.completed)return null;
 const current=p.detail?.current,form=Boolean(p.detail)&&(!current||p.editing||p.uncertain);
 return <section className={styles.editor} aria-label="호실 정비 사실 기록"><h2>호실 정비 사실 기록</h2>
  <p className={styles.hint}>관리자가 완료 접수에서 확인한 작업 사실을 따로 남깁니다. 객관적인 수리 검증을 뜻하지 않습니다.</p>
  {p.loading?<p role="status">정비 사실 불러오는 중…</p>:null}{p.error?<p role="alert">{p.error}</p>:null}{p.notice?<p role="status">{p.notice}</p>:null}
  <button disabled={p.busy||p.loading} onClick={p.onRefresh}>정비 사실 다시 불러오기</button>
  {!p.loading&&current?<><MaintenanceFactCard fact={current} onOpenTicket={p.onOpenTicket}/><div className={styles.actions}><button onClick={()=>p.onViewUnit(current.unitId)}>호실 이력에서 보기</button>{!p.editing&&!p.uncertain?<button onClick={p.onEdit}>정정 기록 추가</button>:null}</div>
   <details><summary>정정 이력 · {current.correctionCount}회</summary><ol className={styles.revisions}>{p.detail!.revisions.map(r=><li key={r.factId}>{r.current?"현재 기록":"이전 기록"} · {actionLabels[r.actionKind]} · {r.componentLabel??"명칭 미기록"}<p><time dateTime={r.recordedAt}>{dateText(r.recordedAt)}</time>{r.correctionReason?` · ${reasonLabels[r.correctionReason]}`:" · 최초 기록"}</p></li>)}</ol></details>
  </>:null}
  {p.uncertain?<div role="status"><p>서버에 표시된 값만으로 이 요청의 성공을 확정하지 않습니다. 입력은 이 화면에만 보관됩니다.</p><button disabled={p.busy||p.loading} onClick={p.onRetry}>같은 요청으로 저장 확인</button></div>:null}
  {!p.loading&&form?<form onSubmit={e=>{e.preventDefault();p.onSubmit();}}>
   <fieldset disabled={p.busy||p.uncertain||p.reviewRequired} className={styles.fields}>
    <label>작업 종류<select aria-label="정비 작업 종류" value={p.action} onChange={e=>p.onAction(e.target.value as CoreMaintenanceActionKind)}>{Object.entries(actionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>부품·위치 명칭 (선택)<input aria-label="정비 부품·위치 명칭" maxLength={80} value={p.label} onChange={e=>p.onLabel(e.target.value)} /></label>
    <p className={styles.hint}>개인 이름·연락처·출입정보는 적지 마세요.</p>
    {current?<label>정정 이유<select value={p.reason} onChange={e=>p.onReason(e.target.value as CoreMaintenanceCorrectionReason)}>{Object.entries(reasonLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>:null}
    <button type="submit" disabled={Boolean(current&&current.actionKind===p.action&&current.componentLabel===(p.label.trim()||null))}>{current?"정정 기록 저장":"정비 사실 저장"}</button>
   </fieldset>
  </form>:null}
  {p.reviewRequired?<button disabled={p.busy||p.loading||!p.detail} onClick={p.onReview}>최신 기록을 확인했습니다</button>:null}
 </section>;
}
export function MaintenanceFactCard({fact,onOpenTicket}:{fact:CoreUnitMaintenanceFact;onOpenTicket(id:string):void}){
 return <article className={styles.fact} data-fact-id={fact.factId}>
  <h3>{fact.issueType==="HEATING"?"난방":"누수"} · {actionLabels[fact.actionKind]}</h3><p className={styles.component}>{fact.componentLabel??"부품·위치 명칭 미기록"}</p>
  <p>{fact.buildingName} · {fact.unitLabel}</p><dl><div><dt>원본 접수 완료</dt><dd><time dateTime={fact.sourceCompletedAt}>{dateText(fact.sourceCompletedAt)}</time></dd></div><div><dt>사실 기록</dt><dd><time dateTime={fact.recordedAt}>{dateText(fact.recordedAt)}</time></dd></div></dl>
  {fact.corrected?<p>정정 {fact.correctionCount}회 · 현재 기록</p>:null}<p>{outcomeLabels[fact.tenantOutcome]}</p>
  <div className={styles.actions}><button onClick={()=>onOpenTicket(fact.sourceTicketId)}>근거 접수 보기</button>
   {fact.previousTicketId?<button onClick={()=>onOpenTicket(fact.previousTicketId!)}>이전 완료 접수에서 이어진 건</button>:null}
   {fact.followUpTicketId?<button onClick={()=>onOpenTicket(fact.followUpTicketId!)}>후속 접수 있음</button>:null}</div>
 </article>;
}
export function MaintenanceTimelineView({units,unitId,items,loading,error,disabled,onUnit,onRefresh,onOpenTicket}:{units:CoreUnitDto[];unitId:string;items:CoreUnitMaintenanceFact[];loading:boolean;error:string;disabled:boolean;onUnit(id:string):void;onRefresh():void;onOpenTicket(id:string):void}){
 return <section className={styles.timeline} aria-label="호실 정비 이력"><div className={styles.heading}><div><h2>호실 정비 이력</h2><p>완료 접수에서 관리자가 따로 기록한 사실입니다. 원본 완료 시각 순으로 최근 100건까지 표시합니다.</p></div><button disabled={disabled||loading||!unitId} onClick={onRefresh}>이력 다시 불러오기</button></div>
  <label>건물·호실<select aria-label="정비 이력 건물·호실" disabled={disabled||!units.length} value={unitId} onChange={e=>onUnit(e.target.value)}>{units.map(u=><option key={u.id} value={u.id}>{u.buildingName} · {u.label}</option>)}</select></label>
  {!units.length?<p>접근 가능한 호실이 없습니다. 배정 상태를 확인하고 새로고침해 주세요.</p>:loading?<p role="status">호실 정비 이력 불러오는 중…</p>:error?<p role="alert">{error}</p>:items.length===0?<div className={styles.empty}><h3>아직 기록된 정비 사실이 없습니다.</h3><p>완료된 접수에서 관리자가 정비 사실을 남기면 이곳에 표시됩니다. 완료 접수만으로 자동 기록되지 않습니다.</p></div>:<div className={styles.cards}>{items.map(f=><MaintenanceFactCard key={f.factId} fact={f} onOpenTicket={onOpenTicket}/>)}</div>}
 </section>;
}
type EditorProps={client:CoreFlowClient;ticket:CoreTicketDto;revision:number;onOpenTicket(id:string):void;onChanged():void;onViewUnit?(id:string):void};
type Attempt={kind:"CREATE";id:string;input:CoreMaintenanceFactCreate}|{kind:"CORRECT";id:string;input:CoreMaintenanceFactCorrection};
export function ManagerMaintenanceFactEditor(props:EditorProps){return props.ticket.workStatus==="COMPLETED"?<CompletedFactEditor key={props.ticket.ticketId} {...props}/>:null;}
function CompletedFactEditor({client,ticket,revision,onOpenTicket,onChanged,onViewUnit}:EditorProps){
 const [detail,setDetail]=useState<CoreMaintenanceFactDetail|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [action,setAction]=useState<CoreMaintenanceActionKind>("INSPECTION"),[label,setLabel]=useState(""),[reason,setReason]=useState<CoreMaintenanceCorrectionReason>("ACTION_CLASSIFICATION"),[editing,setEditing]=useState(false),[reviewRequired,setReviewRequired]=useState(false),[uncertain,setUncertain]=useState(false);
 const alive=useRef(false),generation=useRef(0),sending=useRef(false),attempt=useRef<Attempt|null>(null);
 const load=useCallback(async()=>{
  const g=++generation.current;setLoading(true);
  try{const value=await client.maintenance.readForTicket(ticket.ticketId);if(alive.current&&g===generation.current){setDetail(value);return value;}}
  catch{if(alive.current&&g===generation.current){setDetail(null);setError("정비 사실을 불러오지 못했습니다. 현재 접근 권한과 연결을 확인해 주세요.");}}
  finally{if(alive.current&&g===generation.current)setLoading(false);}
 },[client,ticket.ticketId]);
 useEffect(()=>{alive.current=true;let live=true;const fence=generation;void Promise.resolve().then(()=>{if(live)void load();});return()=>{live=false;alive.current=false;fence.current++;};},[load,revision]);
 const send=async(request:Attempt)=>{
  if(sending.current)return;sending.current=true;attempt.current=request;setBusy(true);setError("");setNotice("");
  try{if(request.kind==="CREATE")await client.maintenance.create(request.id,request.input);else await client.maintenance.correct(request.id,request.input);
   if(!alive.current)return;attempt.current=null;setUncertain(false);setReviewRequired(false);setEditing(false);await load();if(alive.current){setNotice("정비 사실 요청의 저장을 확인했습니다.");onChanged();}
  }catch(e){if(!alive.current)return;const status=e instanceof ApiClientError?e.status:undefined;
   if(status===409){attempt.current=null;setUncertain(false);setEditing(true);setReviewRequired(true);await load();if(alive.current)setError("다른 기록이 먼저 저장되었습니다. 입력은 유지했습니다. 최신 기록을 확인한 뒤 다시 제출해 주세요.");}
   else if(status&&[400,401,403,404].includes(status)){attempt.current=null;setUncertain(false);if(status!==400)setDetail(null);setError("저장할 수 없습니다. 입력과 현재 접근 권한을 확인해 주세요.");}
   else{setUncertain(true);await load();if(alive.current)setError("저장 응답을 받지 못했습니다. 서버 기록을 확인하고 같은 요청으로 저장 확인을 눌러 주세요.");}
  }finally{sending.current=false;if(alive.current)setBusy(false);}
 };
 const submit=()=>{
  if(!detail||busy||uncertain||reviewRequired)return;
  const current=detail.current,base={clientRequestId:crypto.randomUUID(),actionKind:action,componentLabel:label===""?null:label};
  if(current){const parsed=CoreMaintenanceFactCorrectionSchema.safeParse({...base,expectedCurrentFactId:current.factId,correctionReason:reason});if(!parsed.success){setError("명칭은 80자 이하로 입력하고 공백·제어 문자를 확인해 주세요.");return;}void send({kind:"CORRECT",id:current.factId,input:parsed.data});}
  else{const parsed=CoreMaintenanceFactCreateSchema.safeParse(base);if(!parsed.success){setError("명칭은 80자 이하로 입력하고 공백·제어 문자를 확인해 주세요.");return;}void send({kind:"CREATE",id:ticket.ticketId,input:parsed.data});}
 };
 return <MaintenanceEditorView completed detail={detail} loading={loading} error={error} notice={notice} busy={busy} editing={editing} uncertain={uncertain} reviewRequired={reviewRequired} action={action} label={label} reason={reason}
 onAction={setAction} onLabel={setLabel} onReason={setReason} onSubmit={submit} onOpenTicket={onOpenTicket} onViewUnit={id=>onViewUnit?.(id)}
 onEdit={()=>{if(detail?.current){setAction(detail.current.actionKind);setLabel(detail.current.componentLabel??"");setEditing(true);setNotice("");}}}
 onRefresh={()=>{setError("");void load();}} onRetry={()=>{if(attempt.current)void send(attempt.current);}} onReview={()=>{if(detail){setReviewRequired(false);setError("");}}}/>;
}
export function ManagerMaintenanceTimeline({client,units,revision,disabled,onOpenTicket,initialUnit}:{client:CoreFlowClient;units:CoreUnitDto[];revision:number;disabled:boolean;onOpenTicket(id:string):void;initialUnit?:string}){
 const [selected,setSelected]=useState(initialUnit??units[0]?.id??""),[items,setItems]=useState<CoreUnitMaintenanceFact[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
 const unitId=units.some(u=>u.id===selected)?selected:(units[0]?.id??"");
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live)return;setLoading(true);setItems([]);setError("");try{const rows=unitId?await client.maintenance.listUnit(unitId):[];if(live)setItems(rows);}catch{if(live){setItems([]);setError("이력을 불러오지 못했습니다. 현재 배정과 연결을 확인하고 다시 불러와 주세요.");}}finally{if(live)setLoading(false);}});return()=>{live=false;};},[client,unitId,revision,refresh]);
 return <MaintenanceTimelineView units={units} unitId={unitId} items={items} loading={loading} error={error} disabled={disabled} onUnit={id=>{setLoading(true);setItems([]);setSelected(id);}} onRefresh={()=>{setLoading(true);setItems([]);setRefresh(v=>v+1);}} onOpenTicket={onOpenTicket}/>;
}
