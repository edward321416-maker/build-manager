"use client";
import { useCallback,useEffect,useState } from "react";
import { ApiClientError,type CoreFlowClient } from "@build-manager/api-client";
import { CoreManagerWorkUpdateSchema,CoreManagerInternalNoteCreateSchema,type CoreManagerWorkItem,type CoreManagerInternalNote,type CoreTicketDto,type CoreUnitDto } from "@build-manager/api-contracts";
import { WorkStatusBadge } from "./ui/work-status-badge";
import { compareManagerWork,isOverdue,priorityLabels } from "./manager-work-order";
import styles from "./manager-work.module.css";

const dateText=(value:string)=>new Date(value).toLocaleString("ko-KR");
function localInput(value:string|null){
  if(!value)return "";const d=new Date(value),pad=(n:number)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function ManagerWorkQueue({client,units,revision,onOpen,disabled}:{client:CoreFlowClient;units:CoreUnitDto[];revision:number;onOpen(id:string):void;disabled:boolean}){
  const [items,setItems]=useState<CoreManagerWorkItem[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false);
  const [status,setStatus]=useState("ALL"),[priority,setPriority]=useState("ALL"),[now,setNow]=useState(()=>Date.now()),[refresh,setRefresh]=useState(0);
  const [unit,setUnit]=useState("");
  useEffect(()=>{let live=true;void client.manager.list().then(rows=>{if(live){setItems(rows);setError(false);setNow(Date.now());}}).catch(()=>{if(live)setError(true);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[client,revision,refresh]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60_000);return()=>clearInterval(timer);},[]);
  const visible=items.filter(x=>(!unit||x.unitId===unit)&&(status==="ALL"||x.workStatus===status)&&(priority==="ALL"||x.priority===priority)).sort((a,b)=>compareManagerWork(a,b,now));
  return <section aria-label="관리 업무함" className={styles.queue}>
    <div className={styles.title}><div><h2>관리 업무함</h2><p>모든 접근 가능한 호실 · 미완료, 기한 지남, 긴급도, 처리 예정 순</p></div><button disabled={loading||disabled} onClick={()=>{setLoading(true);setRefresh(v=>v+1);}}>업무함 새로고침</button></div>
    <div className={styles.filters}>
      <label>건물·호실<select aria-label="건물·호실" value={unit} onChange={e=>setUnit(e.target.value)}><option value="">모든 호실</option>{units.map(u=><option key={u.id} value={u.id}>{u.buildingName} · {u.label}</option>)}</select></label>
      <label>처리 상태<select value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">전체</option><option value="OPEN">접수</option><option value="IN_PROGRESS">처리중</option><option value="COMPLETED">완료</option></select></label>
      <label>긴급도 필터<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="ALL">전체</option><option value="URGENT">긴급</option><option value="HIGH">높음</option><option value="NORMAL">보통</option></select></label>
      <p aria-live="polite">{visible.length}건 표시</p>
    </div>
    {error?<p role="alert">업무함을 불러오지 못했습니다. 연결을 확인하고 업무함 새로고침을 눌러 주세요.</p>:loading?<p role="status">업무함 불러오는 중…</p>:visible.length===0?<p>{items.length?"선택한 조건의 업무가 없습니다. 필터를 전체로 바꿔 주세요.":"접근 가능한 접수 내역이 없습니다. 새 접수가 들어오면 업무함 새로고침으로 확인해 주세요."}</p>:<ul className={styles.items}>{visible.map(item=><li key={item.ticketId} data-ticket-id={item.ticketId} data-work-state={item.workStatus}>
      <button className={styles.row} disabled={disabled} onClick={()=>onOpen(item.ticketId)}>
        <span className={styles.priority} data-priority={item.priority}>긴급도 {priorityLabels[item.priority]}</span>
        <span className={styles.subject}><strong>{item.buildingName} · {item.unitLabel}</strong><span>{item.issueType==="HEATING"?"난방":"누수"}</span></span>
        <span className={styles.workState}><WorkStatusBadge status={item.workStatus}/></span>
        <span><small>담당 표시명</small>{item.assigneeLabel??"미지정"}</span>
        <span><small>처리 예정</small>{item.dueAt?<time dateTime={item.dueAt}>{dateText(item.dueAt)}</time>:"미정"}{isOverdue(item,now)?<strong className={styles.overdue}>기한 지남</strong>:null}</span>
        <span className={styles.identifier}>#{item.ticketId.slice(0,8)}</span>
      </button>
    </li>)}</ul>}
    <p className={styles.help}>담당 표시명과 예정일은 업무 정리용입니다. 권한 부여·업체 배정·자동 출동을 뜻하지 않습니다.</p>
  </section>;
}

export function ManagerWorkDetail({client,ticket,revision}:{client:CoreFlowClient;ticket:CoreTicketDto;revision:number}){
  const [work,setWork]=useState<CoreManagerWorkItem|null>(null),[notes,setNotes]=useState<CoreManagerInternalNote[]>([]);
  const [priority,setPriority]=useState<CoreManagerWorkItem["priority"]>("NORMAL"),[assignee,setAssignee]=useState(""),[due,setDue]=useState(""),[body,setBody]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[uncertain,setUncertain]=useState(false);
  const apply=useCallback((value:CoreManagerWorkItem)=>{setWork(value);setPriority(value.priority);setAssignee(value.assigneeLabel??"");setDue(localInput(value.dueAt));},[]);
  useEffect(()=>{let live=true;void Promise.all([client.manager.read(ticket.ticketId),client.manager.notes(ticket.ticketId)]).then(([value,list])=>{if(live){apply(value);setNotes(list);setError("");setUncertain(false);}}).catch(()=>{if(live)setError("업무 정보를 불러오지 못했습니다. 업무 정보 새로고침을 눌러 주세요.");});return()=>{live=false;};},[client,ticket.ticketId,ticket.version,revision,apply]);
  const refresh=async()=>{setBusy(true);try{const [value,list]=await Promise.all([client.manager.read(ticket.ticketId),client.manager.notes(ticket.ticketId)]);apply(value);setNotes(list);setUncertain(false);setError("");}catch{setError("업무 정보를 불러오지 못했습니다. 전체 새로고침으로 접근 상태를 확인해 주세요.");}finally{setBusy(false);}};
  const completed=ticket.workStatus==="COMPLETED"||work?.workStatus==="COMPLETED",locked=busy||completed||!work||uncertain;
  const fail=async(e:unknown)=>{
    if(e instanceof ApiClientError&&e.status===409){
      try{apply(await client.manager.read(ticket.ticketId));setError("다른 변경이 먼저 저장되었거나 처리가 완료되었습니다. 최신 업무 정보를 불러왔습니다. 확인한 뒤 다시 입력해 주세요.");}catch{setError("최신 상태를 확인하지 못했습니다. 업무 정보 새로고침을 눌러 주세요.");setUncertain(true);}
    }else{setError("저장 결과를 확인하지 못했습니다. 중복 저장하지 말고 업무 정보 새로고침으로 저장된 내용을 먼저 확인해 주세요.");setUncertain(true);}
  };
  return <section aria-label="업무 관리" className={styles.detail}>
    <div className={styles.title}><div><h2>업무 관리</h2><p>관리자 전용 정보입니다. 세입자에게 전달되지 않습니다.</p></div><button disabled={busy} onClick={()=>void refresh()}>업무 정보 새로고침</button></div>
    {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}{!work&&!error?<p role="status">업무 정보 불러오는 중…</p>:null}
    {completed?<p>처리 완료된 업무입니다. 기존 업무 정보와 내부 메모는 조회만 할 수 있습니다.</p>:null}
    <form onSubmit={e=>{e.preventDefault();if(!work)return;const timestamp=due?new Date(due):null;const input=CoreManagerWorkUpdateSchema.safeParse({priority,assigneeLabel:assignee.trim()||null,dueAt:timestamp&&!Number.isNaN(timestamp.valueOf())?timestamp.toISOString():due||null,expectedVersion:work.version});if(!input.success){setError("긴급도·담당 표시명(80자 이하)·처리 예정 날짜와 시간을 확인해 주세요.");return;}setBusy(true);setError("");setNotice("");void client.manager.update(ticket.ticketId,input.data).then(value=>{apply(value);setNotice("업무 정보를 저장했습니다.");}).catch(fail).finally(()=>setBusy(false));}}>
      <fieldset disabled={locked} className={styles.fields}>
        <label>긴급도<select value={priority} onChange={e=>setPriority(e.target.value as CoreManagerWorkItem["priority"])}><option value="NORMAL">보통</option><option value="HIGH">높음</option><option value="URGENT">긴급</option></select></label>
        <label>담당 표시명<input value={assignee} maxLength={80} onChange={e=>setAssignee(e.target.value)} placeholder="미지정" /></label>
        <label>처리 예정<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)} /></label>
        <button type="submit">업무 정보 저장</button>
      </fieldset>
      <p className={styles.help}>예정 시각은 이 브라우저의 시간대 기준입니다. 담당 표시명은 실제 담당자 확인이나 접근 권한을 부여하지 않습니다.</p>
    </form>
    <section aria-label="내부 메모" className={styles.notes}><h3>내부 메모</h3>
      <form onSubmit={e=>{e.preventDefault();const input=CoreManagerInternalNoteCreateSchema.safeParse({body});if(!input.success){setError("내부 메모는 공백을 제외한 1~2000자로 입력해 주세요. 제어 문자는 사용할 수 없습니다.");return;}setBusy(true);setError("");setNotice("");void client.manager.appendNote(ticket.ticketId,input.data.body).then(note=>{setNotes(current=>[note,...current]);setBody("");setNotice("내부 메모를 저장했습니다. 세입자에게 공개되지 않습니다.");}).catch(fail).finally(()=>setBusy(false));}}>
        <label>내부 메모 입력<textarea value={body} maxLength={2000} disabled={locked} onChange={e=>setBody(e.target.value)} /></label><button disabled={locked||!body.trim()}>내부 메모 추가</button>
      </form>
      <p className={styles.help}>개인정보를 적지 마세요. 저장 후 수정·삭제할 수 없으며 처리 상태에는 영향을 주지 않습니다.</p>
      {notes.length?<ol className={styles.noteList}>{notes.map(note=><li key={note.id}><time dateTime={note.createdAt}>{dateText(note.createdAt)}</time><p>{note.body}</p></li>)}</ol>:<p>저장된 내부 메모가 없습니다.</p>}
    </section>
  </section>;
}
