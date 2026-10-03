"use client";

import { createCoreFlowClient,ApiClientError } from "@build-manager/api-client";
import type { CoreSessionDto,CoreTicketDto,CoreUnitDto } from "@build-manager/api-contracts";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import { TicketIntake } from "../../components/tenant/ticket-intake";
import { TicketReview } from "../../components/landlord/ticket-review";
import { PhotoPicker,PhotoGallery,photoError,type PendingPhoto } from "../../components/core-photos";

const statuses={OPEN:"접수",IN_PROGRESS:"처리중",COMPLETED:"처리 완료 (관리자 기록)"};
const eventLabels:Record<string,string>={CREATED:"접수 내용 저장",ANSWERED:"답변 저장",FINALIZED:"수리 요청 제출",MORE_INFO:"추가 확인 요청",DECISION:"추천 경로 결정",HANDLING:"처리 기록"};
const sessionMessage="접속이 만료되었거나 코드가 유효하지 않습니다. 개발 환경에서 새 코드를 발급받아 다시 들어가 주세요.";
const accessMessage="이 계정의 접근 권한을 확인할 수 없습니다. 관리자에게 소속·호실 권한을 확인한 뒤 다시 들어가 주세요.";
function describeError(error:unknown,saving:boolean){
  if(error instanceof ApiClientError){
    if(error.status===401)return sessionMessage;
    if(error.status===403)return accessMessage;
    if(error.status===404)return "접수 내역을 열 수 없습니다. 목록을 새로고침하고 접근 가능한 내역을 선택해 주세요.";
    if(error.status===409)return "다른 변경이 먼저 저장되었습니다. 전체 새로고침으로 최신 상태를 확인한 뒤 다시 진행해 주세요.";
    if(error.status===400)return "입력 내용을 확인해 주세요. 설명이나 처리 기록에 공백만 입력할 수 없습니다.";
  }
  return saving?"저장 결과를 확인하지 못했습니다. 입력은 유지했습니다. 연결을 확인하고 전체 새로고침으로 이력을 먼저 확인해 주세요. 중복 접수를 막기 위해 바로 다시 제출하지 마세요.":"내용을 불러오지 못했습니다. 연결을 확인하고 다시 불러오기를 눌러 주세요.";
}
export default function CoreFlowPage({b1,onDenied,onLogout}:{b1?:{orgId:string;csrf:string};onDenied?:()=>void;onLogout?:()=>void}={}){
  const [session,setSession]=useState<CoreSessionDto|null>(null),[code,setCode]=useState("");
  const [units,setUnits]=useState<CoreUnitDto[]>([]),[unit,setUnit]=useState("");
  const [tickets,setTickets]=useState<CoreTicketDto[]>([]),[selected,setSelected]=useState<CoreTicketDto|null>(null);
  const [issue,setIssue]=useState<"HEATING"|"LEAK">("HEATING"),[text,setText]=useState(""),[message,setMessage]=useState("");
  const [busy,setBusy]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[revision,setRevision]=useState(0);
  const [pending,setPending]=useState<PendingPhoto[]>([]),[photoMessage,setPhotoMessage]=useState("");
  const detailHeading=useRef<HTMLHeadingElement>(null),errorPanel=useRef<HTMLDivElement>(null);
  const clearAccess=useCallback(()=>{setSession(null);setSelected(null);setTickets([]);setUnits([]);setUnit("");setText("");setMessage("");setCode("");setNotice("");setPending([]);setPhotoMessage("");},[]);
  // The embedded intake/review also uses this client: a denied nested request
  // must clear the parent screen, not leave old protected content visible.
  const client=useMemo(()=>{const guarded:typeof fetch=async(input,init)=>{
    const headers=new Headers(init?.headers);if(b1){headers.set("x-core-organization",b1.orgId);headers.set("x-b1-csrf",b1.csrf);}
    const response=await fetch(input,{...init,headers});
    if(b1&&(response.status===401||response.status===403))onDenied?.();
    if((response.status===401||response.status===403)&&!String(input).endsWith("/session")){
      clearAccess();setError(response.status===401?sessionMessage:accessMessage);
    }
    return response;
  };return createCoreFlowClient({baseUrl:"",fetchImpl:guarded,photoFetchImpl:guarded});},[clearAccess,b1,onDenied]);
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
  const restore=async()=>{
    try{const s=await client.session(),u=await client.units(),t=await client.tickets();setSession(s);setUnits(u);setUnit(u[0]?.id??"");setTickets(t);}
    catch(e){if(e instanceof ApiClientError&&e.status===401)clearAccess();else throw e;}
  };
  const refresh=async()=>{const u=await client.units();setUnits(u);setUnit(current=>u.some(item=>item.id===current)?current:(u[0]?.id??""));setTickets(await client.tickets());if(selected){setSelected(await client.read(selected.ticketId));setRevision(r=>r+1);}};
  const login=()=>run(async()=>{const s=await client.login(code),u=await client.units(),t=await client.tickets();setSession(s);setCode("");setUnits(u);setUnit(u[0]?.id??"");setTickets(t);});
  const selectedUnit=units.find(u=>u.id===selected?.unitId);
  const upload=async(ticketId:string,files:PendingPhoto[])=>{
    setPhotoMessage("");
    try{const stored=await client.photos(ticketId);setPending(current=>current.filter(f=>!stored.some(p=>p.uploadId===f.uploadId)));for(const file of files.filter(f=>!stored.some(p=>p.uploadId===f.uploadId))){await client.uploadPhoto(ticketId,file.uploadId,file.file);setPending(current=>current.filter(f=>f.uploadId!==file.uploadId));setRevision(r=>r+1);}setRevision(r=>r+1);if(files.length)setPhotoMessage("사진을 저장했습니다. 관리자도 같은 사진을 확인할 수 있습니다.");}
    catch(e){if(e instanceof ApiClientError&&(e.status===401||e.status===403))throw e;setPhotoMessage(photoError(e));}
  };
  const checkPhotos=async()=>{if(!selected)return;const ticket=await client.read(selected.ticketId),photos=await client.photos(selected.ticketId);setSelected(ticket);setPending(current=>current.filter(f=>!photos.some(p=>p.uploadId===f.uploadId)));setRevision(r=>r+1);setPhotoMessage(`저장된 사진 ${photos.length}장을 확인했습니다. ${ticket.workStatus==="COMPLETED"?"처리 완료된 접수에는 사진을 추가할 수 없습니다.":"남은 미전송 사진만 다시 전송할 수 있습니다."}`);};
  const Workspace=b1?"section":"main";
  return <Workspace className="page-shell core-flow" aria-label="수리 접수 작업">
    <h1>우리 집 수리 접수</h1>
    <p>{b1?"B1 로그인 세션 · RC1 합성 주거 데이터 · 참고 사진 첨부 지원 · 업체 출동·알림은 지원하지 않습니다.":"RC1 합성 개발 계정 전용 · 참고 사진 첨부 지원 · 실제 로그인·업체 출동·알림은 지원하지 않습니다."}</p>
    {error?<div className="state-error" role="alert" tabIndex={-1} ref={errorPanel}><p>{error}</p><button disabled={busy} onClick={()=>void run(session?refresh:restore)}>다시 불러오기</button></div>:null}
    {busy?<p role="status">불러오는 중…</p>:notice?<p className="save-ok" role="status">{notice}</p>:null}
    {!session?(b1?<p>내 소속·호실을 확인하고 있습니다.</p>:<form onSubmit={e=>{e.preventDefault();void login();}}>
      <label>개발 접근 코드 <input aria-label="개발 접근 코드" type="password" disabled={busy} value={code} onChange={e=>setCode(e.target.value)} autoComplete="off" /></label>
      <button disabled={busy||!/^[a-f0-9]{64}$/.test(code)}>들어가기</button>
      <p>개발 환경에서 발급한 계정별 코드를 사용하세요. 코드가 만료되면 새 코드를 발급받아 다시 들어오세요. 역할과 호실은 서버에서 확인합니다.</p>
    </form>):<>
      <p>{session.role==="TENANT"?"세입자":"관리자"} 접속</p>
      <nav className="core-actions" aria-label="접속 및 새로고침">
        <button disabled={busy} onClick={()=>void run(refresh)}>전체 새로고침</button>
        <button disabled={busy} onClick={()=>{if(onLogout){clearAccess();onLogout();}else void run(async()=>{await client.logout();clearAccess();});}}>로그아웃</button>
      </nav>
      {selected?<>
        <button disabled={busy||pending.length>0} onClick={()=>void run(async()=>{setSelected(null);setPhotoMessage("");setTickets(await client.tickets());})}>← 목록으로</button>
        {pending.length?<p>목록으로 돌아가기 전에 미전송 사진을 저장하거나 선택 취소해 주세요.</p>:null}
        <section className="core-result" aria-label="접수 요약">
          <h2 ref={detailHeading} tabIndex={-1}>접수 상세</h2>
          <p>{selectedUnit?`${selectedUnit.buildingName} · ${selectedUnit.label} · `:""}{selected.detail.issueType==="HEATING"?"난방":"누수"} · {selected.ticketId.slice(0,8)}</p>
          <p className="core-work-status" data-testid="work-status">{statuses[selected.workStatus]}</p>
          <p>{selected.workStatus==="COMPLETED"?"관리자가 남긴 완료 기록입니다. 아래 처리 이력에서 결과를 확인해 주세요.":selected.workStatus==="IN_PROGRESS"?"관리자가 처리 시작을 기록했습니다. 아래에서 질문과 처리 이력을 확인해 주세요.":"입력 내용은 저장됩니다. 아래 질문과 제출 상태를 확인해 주세요. 추천 경로 결정과 수리 완료는 별개입니다."}</p>
        </section>
        <PhotoGallery client={client} ticketId={selected.ticketId} revision={revision} />
        {session.role==="TENANT"?<>
          {selected.workStatus!=="COMPLETED"||pending.length?<PhotoPicker files={pending} onChange={setPending} disabled={busy||selected.workStatus==="COMPLETED"} />:null}
          {selected.workStatus==="COMPLETED"&&pending.length?<button disabled={busy} onClick={()=>setPending([])}>미전송 사진 선택 취소</button>:null}
          {photoMessage?<p role="status">{photoMessage}</p>:null}
          {selected.workStatus!=="COMPLETED"?<div className="core-actions"><button disabled={busy||!pending.length} onClick={()=>void run(()=>upload(selected.ticketId,pending),true)}>사진만 전송</button><button disabled={busy} onClick={()=>void run(checkPhotos)}>사진 저장 상태 확인</button></div>:null}
        </>:null}
        {session.role!=="TENANT"&&selected.workStatus!=="COMPLETED"?<form onSubmit={e=>{e.preventDefault();void run(async()=>{const starting=selected.workStatus==="OPEN";setSelected(await client.handling(selected.ticketId,{status:starting?"IN_PROGRESS":"COMPLETED",message}));setMessage("");setNotice(starting?"처리 시작 기록을 저장했습니다. 세입자도 새로고침하면 확인할 수 있습니다.":"처리 완료 기록을 저장했습니다. 세입자도 새로고침하면 확인할 수 있습니다.");detailHeading.current?.focus();},true);}}>
          <label>처리 기록 <textarea aria-label="처리 기록" maxLength={2000} required value={message} onChange={e=>setMessage(e.target.value)} /></label>
          <button disabled={busy||!message.trim()}>{selected.workStatus==="OPEN"?"처리 시작 기록":"처리 완료 기록"}</button>
          <p>담당자가 확인한 사실을 기록하세요. 자동 출동이나 수리 검증을 뜻하지 않습니다.</p>
        </form>:null}
        <section aria-label="접수 및 처리 이력"><h2>접수 및 처리 이력</h2>{selected.events.map(event=><p key={event.id}><time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time> · {event.actorRole==="TENANT"?"세입자":"관리자"} · {eventLabels[event.kind]??"접수 정보 변경"}{event.message?` · ${event.message}`:""}</p>)}</section>
        {selected.workStatus==="COMPLETED"?<p>관리자의 완료 기록을 확인했습니다. 목록에서 이력을 다시 볼 수 있습니다.</p>:session.role==="TENANT"?<TicketIntake key={`${selected.ticketId}-${revision}`} ticketId={selected.ticketId} client={client.protocol} coreFlow />:<TicketReview key={`${selected.ticketId}-${revision}`} ticketId={selected.ticketId} client={client.protocol} coreFlow />}
      </>:<>
        <label>건물·호실 <select aria-label="건물·호실" disabled={!units.length} value={unit} onChange={e=>setUnit(e.target.value)}>{units.map(u=><option key={u.id} value={u.id}>{u.buildingName} · {u.label}</option>)}</select></label>
        {!units.length?<p>접근 가능한 호실이 없습니다. 관리자에게 소속·호실 배정을 확인한 뒤 전체 새로고침을 눌러 주세요.</p>:null}
        {session.role==="TENANT"&&unit?<form onSubmit={e=>{e.preventDefault();void run(async()=>{const ticket=await client.create({unitId:unit,issueType:issue,rawUserText:text});setSelected(ticket);setText("");setNotice("접수 내용이 저장되었습니다. 아래 질문과 제출 상태를 확인해 주세요.");await upload(ticket.ticketId,pending);},true);}}>
          <h2>문제 접수</h2><label>문제 유형 <select aria-label="문제 유형" value={issue} onChange={e=>setIssue(e.target.value as "HEATING"|"LEAK")}><option value="HEATING">난방</option><option value="LEAK">누수</option></select></label>
          <label>문제 설명 <textarea aria-label="문제 설명" value={text} maxLength={2000} required onChange={e=>setText(e.target.value)} /></label>
          <PhotoPicker files={pending} onChange={setPending} disabled={busy} />
          <button disabled={busy||!text.trim()}>접수하기</button>
        </form>:null}
        <h2>호실별 접수 이력</h2>
        {tickets.filter(t=>t.unitId===unit).length===0?<p>{!unit?"호실 배정 후 접수 이력을 볼 수 있습니다.":session.role==="TENANT"?"선택한 호실의 접수 내역이 없습니다. 위의 문제 접수에서 첫 내용을 남겨 주세요.":"선택한 호실의 접수 내역이 없습니다. 다른 호실을 선택하거나 전체 새로고침으로 새 접수를 확인해 주세요."}</p>:<ul>{tickets.filter(t=>t.unitId===unit).map(t=><li key={t.ticketId}><button disabled={busy||pending.length>0} onClick={()=>void run(async()=>{setSelected(await client.read(t.ticketId));setMessage("");})}>{t.detail.issueType==="HEATING"?"난방":"누수"} · {statuses[t.workStatus]} · {t.ticketId.slice(0,8)}</button><PhotoGallery compact client={client} ticketId={t.ticketId} revision={revision} /></li>)}</ul>}
      </>}
    </>}
  </Workspace>;
}
