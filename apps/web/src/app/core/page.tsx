"use client";

import { createCoreFlowClient,ApiClientError } from "@build-manager/api-client";
import type { CoreSessionDto,CoreTicketDto,CoreUnitDto } from "@build-manager/api-contracts";
import { useEffect,useMemo,useState } from "react";
import { TicketIntake } from "../../components/tenant/ticket-intake";
import { TicketReview } from "../../components/landlord/ticket-review";

const statuses={OPEN:"접수",IN_PROGRESS:"처리중",COMPLETED:"처리 완료 (관리자 기록)"};
export default function CoreFlowPage(){
  const client=useMemo(()=>createCoreFlowClient({baseUrl:""}),[]);
  const [session,setSession]=useState<CoreSessionDto|null>(null),[code,setCode]=useState("");
  const [units,setUnits]=useState<CoreUnitDto[]>([]),[unit,setUnit]=useState("");
  const [tickets,setTickets]=useState<CoreTicketDto[]>([]),[selected,setSelected]=useState<CoreTicketDto|null>(null);
  const [issue,setIssue]=useState<"HEATING"|"LEAK">("HEATING"),[text,setText]=useState(""),[message,setMessage]=useState("");
  const [busy,setBusy]=useState(true),[error,setError]=useState(""),[revision,setRevision]=useState(0);
  const run=async (action:()=>Promise<void>)=>{setBusy(true);setError("");try{await action();}catch(e){if(e instanceof ApiClientError && (e.status===401||e.status===403)){setSession(null);setSelected(null);setTickets([]);setUnits([]);}else if(e instanceof ApiClientError && e.status===404)setSelected(null);setError("처리하지 못했습니다. 입력·접근 권한·연결을 확인하고 다시 시도해 주세요.");}finally{setBusy(false);}};
  useEffect(()=>{let live=true;void (async()=>{try{const s=await client.session(),u=await client.units(),t=await client.tickets();if(live){setSession(s);setUnits(u);setUnit(u[0]?.id??"");setTickets(t);}}catch{/* No cookie: show the synthetic sign-in form. */}finally{if(live)setBusy(false);}})();return()=>{live=false;};},[client]);
  const refresh=async()=>{setTickets(await client.tickets());if(selected){setSelected(await client.read(selected.ticketId));setRevision(r=>r+1);}};
  const login=()=>run(async()=>{const s=await client.login(code),u=await client.units(),t=await client.tickets();setSession(s);setCode("");setUnits(u);setUnit(u[0]?.id??"");setTickets(t);});
  return <main className="page-shell core-flow">
    <h1>우리 집 수리 접수</h1>
    <p>RC1 합성 개발 계정 전용 · 사진 업로드·실제 로그인·업체 출동·알림은 지원하지 않습니다.</p>
    {error?<p role="alert">{error}</p>:null}
    {busy?<p role="status">불러오는 중…</p>:null}
    {!session?<form onSubmit={e=>{e.preventDefault();void login();}}>
      <label>개발 접근 코드 <input aria-label="개발 접근 코드" type="password" value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" /></label>
      <button disabled={busy||!/^[a-f0-9]{64}$/.test(code)}>들어가기</button>
      <p>개발 환경에서 발급한 계정별 코드를 사용하세요. 역할과 호실은 서버에서 확인합니다.</p>
    </form>:<>
      <p>{session.role==="TENANT"?"세입자":"관리자"} 접속</p>
      <button disabled={busy} onClick={()=>void run(async()=>{await client.logout();setSession(null);setSelected(null);setTickets([]);setUnits([]);})}>로그아웃</button>
      <button disabled={busy} onClick={()=>void run(refresh)}>전체 새로고침</button>
      {selected?<>
        <button onClick={()=>void run(async()=>{setSelected(null);setTickets(await client.tickets());})}>← 목록으로</button>
        <h2>접수 상세</h2><p data-testid="work-status">{statuses[selected.workStatus]}</p>
        {session.role!=="TENANT"&&selected.workStatus!=="COMPLETED"?<form onSubmit={e=>{e.preventDefault();void run(async()=>{setSelected(await client.handling(selected.ticketId,{status:selected.workStatus==="OPEN"?"IN_PROGRESS":"COMPLETED",message}));setMessage("");});}}>
          <label>처리 기록 <textarea aria-label="처리 기록" maxLength={2000} required value={message} onChange={e=>setMessage(e.target.value)} /></label>
          <button disabled={busy||!message.trim()}>{selected.workStatus==="OPEN"?"처리 시작 기록":"처리 완료 기록"}</button>
          <p>담당자가 확인한 사실을 기록하세요. 자동 출동이나 수리 검증을 뜻하지 않습니다.</p>
        </form>:null}
        <section aria-label="접수 및 처리 이력"><h2>접수 및 처리 이력</h2>{selected.events.map(event=><p key={event.id}><time>{new Date(event.at).toLocaleString()}</time> · {event.actorRole==="TENANT"?"세입자":"관리자"} · {event.message||event.kind}</p>)}</section>
        {selected.workStatus==="COMPLETED"?<p>관리자의 완료 기록을 확인했습니다. 목록에서 이력을 다시 볼 수 있습니다.</p>:session.role==="TENANT"?<TicketIntake key={`${selected.ticketId}-${revision}`} ticketId={selected.ticketId} client={client.protocol} coreFlow />:<TicketReview key={`${selected.ticketId}-${revision}`} ticketId={selected.ticketId} client={client.protocol} coreFlow />}
      </>:<>
        <label>건물·호실 <select aria-label="건물·호실" value={unit} onChange={e=>setUnit(e.target.value)}>{units.map(u=><option key={u.id} value={u.id}>{u.buildingName} · {u.label}</option>)}</select></label>
        {!units.length?<p>접근 가능한 호실이 없습니다.</p>:null}
        {session.role==="TENANT"&&unit?<form onSubmit={e=>{e.preventDefault();void run(async()=>{const ticket=await client.create({unitId:unit,issueType:issue,rawUserText:text});setSelected(ticket);setText("");});}}>
          <h2>문제 접수</h2><label>문제 유형 <select aria-label="문제 유형" value={issue} onChange={e=>setIssue(e.target.value as "HEATING"|"LEAK")}><option value="HEATING">난방</option><option value="LEAK">누수</option></select></label>
          <label>문제 설명 <textarea aria-label="문제 설명" value={text} maxLength={2000} required onChange={e=>setText(e.target.value)} /></label>
          <button disabled={busy||!text.trim()}>접수하기</button>
        </form>:null}
        <h2>호실별 접수 이력</h2>
        {tickets.filter(t=>t.unitId===unit).length===0?<p>아직 접수 내역이 없습니다.</p>:<ul>{tickets.filter(t=>t.unitId===unit).map(t=><li key={t.ticketId}><button disabled={busy} onClick={()=>void run(async()=>{setSelected(await client.read(t.ticketId));setMessage("");})}>{t.detail.issueType==="HEATING"?"난방":"누수"} · {statuses[t.workStatus]} · {t.ticketId.slice(0,8)}</button></li>)}</ul>}
      </>}
    </>}
  </main>;
}
