"use client";
import { useCallback,useEffect,useMemo,useState,type ReactNode } from "react";
import { ApiClientError,createCoreOnboardingClient } from "@build-manager/api-client";
import type { InvitationDto,InvitationPage,InviteUnitsPage } from "@build-manager/api-contracts";
import styles from "./core-design.module.css";
import { InvitationMetadata } from "./ui/core-display";

export const invitationLabels:Record<InvitationDto["state"],string>={OPEN:"신청 대기",REQUESTED:"관리자 확인 대기",APPROVED:"연결 승인",REJECTED:"연결 거절",REVOKED:"초대 취소",EXPIRED:"초대 만료"};
export function onboardingMessage(error:unknown){
 if(error instanceof ApiClientError){
  if(error.status===401)return "세션이 만료되었습니다. 다시 로그인한 뒤 상태를 확인해 주세요.";
  if(error.status===429)return "시도가 많습니다. 60초 뒤 상태를 확인해 주세요.";
  if(error.status===403||error.status===404)return "현재 계정으로 이 초대를 이용할 수 없습니다. 관리자에게 원래 초대와 권한을 확인해 주세요.";
  if(error.status===409)return "초대 또는 호실 상태가 변경되었습니다. 현재 상태를 확인한 뒤 관리자에게 문의해 주세요.";
 }
 return "응답을 확인하지 못했습니다. 같은 작업을 다시 보내기 전에 현재 상태를 확인해 주세요.";
}
export function InvitationSummary({invite,children}:{invite:InvitationDto;children?:ReactNode}){
 return <><h3>{invite.buildingName} · {invite.unitLabel}</h3><p><strong className={styles.badge} data-invitation-state={invite.state}>{invitationLabels[invite.state]}</strong></p>
  {children}
  <InvitationMetadata invite={invite}/>
 </>;
}
export function OnboardingPanel({csrf,orgId,manager,onRefreshAccess,onDenied}:{csrf:string;orgId?:string;manager:boolean;onRefreshAccess:()=>void;onDenied:()=>void}){
 const client=useMemo(()=>createCoreOnboardingClient({csrf,orgId}),[csrf,orgId]);
 const empty:InvitationPage={items:[],nextCursor:null};
 const [mine,setMine]=useState<InvitationPage>(empty),[list,setList]=useState<InvitationPage>(empty),[units,setUnits]=useState<InviteUnitsPage>({items:[],nextCursor:null});
 const [unit,setUnit]=useState(""),[link,setLink]=useState(""),[checked,setChecked]=useState<Record<string,boolean>>({});
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  const own=await client.mine();setMine(own);
  if(manager&&orgId){const [requests,vacant]=await Promise.all([client.list(),client.units()]);setList(requests);setUnits(vacant);setUnit(vacant.items[0]?.id??"");}
  setChecked({});setUncertain(false);
 },[client,manager,orgId]);
 const run=useCallback(async(work:()=>Promise<void>,mutation=false)=>{
  setBusy(true);setError("");setNotice("");if(mutation)setUncertain(true);
  try{await work();}catch(e){setError(onboardingMessage(e));if(e instanceof ApiClientError&&e.status===401)onDenied();}finally{setBusy(false);}
 },[onDenied]);
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)return run(load);});return()=>{active=false;};},[run,load]);
 const renderInvitation=(i:InvitationDto)=><article className="core-result invitation-card" key={i.invitationId} aria-label={`${i.unitLabel} 초대`}>
     <InvitationSummary invite={i}/>
     {i.state==="REQUESTED"?<><label className="invitation-confirm"><input type="checkbox" checked={checked[i.invitationId]??false} onChange={e=>setChecked({...checked,[i.invitationId]:e.target.checked})}/>이 호실과 확인 번호를 신청자에게 직접 확인했습니다.</label>
      <div className="core-actions">{(["approve","reject"] as const).map(action=><button key={action} className={action==="approve"?styles.primary:undefined} disabled={busy||uncertain||!checked[i.invitationId]} onClick={()=>void run(async()=>{await client.decide(action,i.invitationId,i.requestNumber??undefined);await load();setNotice(action==="approve"?"호실 연결을 승인했습니다. 세입자는 내 소속·호실을 새로고침해 주세요.":"연결 요청을 거절했습니다. 입주 연결은 생성되지 않았습니다.");},true)}>{action==="approve"?"승인":"거절"}</button>)}</div></>:null}
     {i.state==="OPEN"||i.state==="REQUESTED"?<button className={styles.dangerAction} disabled={busy||uncertain} onClick={()=>void run(async()=>{await client.decide("revoke",i.invitationId);setLink("");await load();setNotice("초대를 취소했습니다. 이 링크로 새 연결을 만들 수 없습니다.");},true)}>초대 취소</button>:null}
    </article>;
 return <section className="page-shell core-flow core-onboarding" aria-label="호실 연결">
  <details id="core-invitations" open={!orgId}><summary>{manager?"입주 연결":"내 호실 연결 요청"}</summary>
   <p>초대는 24시간 동안 유효합니다. 로그인 후 신청하고 관리자가 확인 번호와 호실을 확인해야 연결됩니다.</p>
   {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}{busy?<p role="status">연결 상태를 확인하는 중…</p>:null}
   <button disabled={busy} onClick={()=>void run(load)}>연결 상태 새로고침</button>
   {uncertain?<p>현재 상태를 먼저 확인해 주세요. 생성된 링크를 받지 못했다면 목록에서 취소한 뒤 새로 만드세요.</p>:null}
   {manager&&orgId?<>
    {list.items.some(i=>i.state==="REQUESTED")?<section className={styles.pendingRequests} aria-label="확인할 요청"><h2>확인할 요청 {list.items.filter(i=>i.state==="REQUESTED").length}</h2>{list.items.filter(i=>i.state==="REQUESTED").map(renderInvitation)}</section>:null}
    <h2 className={styles.secondaryHeading}>새 초대</h2>
    {units.items.length?<form onSubmit={e=>{e.preventDefault();void run(async()=>{setLink("");const created=await client.create(unit);setLink(created.link);await load();setNotice("초대를 만들었습니다. 링크를 복사해 입주 예정자에게 직접 전달해 주세요.");},true);}}>
     <label>호실 <select value={unit} onChange={e=>setUnit(e.target.value)}>{units.items.map(u=><option key={u.id} value={u.id}>{u.buildingName} · {u.label}</option>)}</select></label>
     <button disabled={busy||uncertain||!unit}>초대 링크 만들기</button>
    </form>:<p>호실이 없습니다. 이미 입주자가 있는 호실은 이 화면에서 교체할 수 없습니다.</p>}
    {units.nextCursor?<button disabled={busy} onClick={()=>void run(async()=>{const page=await client.units(units.nextCursor!);setUnits({items:[...units.items,...page.items],nextCursor:page.nextCursor});})}>빈 호실 더 보기</button>:null}
    {link?<div className="core-result"><p>링크는 이 화면에서만 한 번 제공됩니다. 원문을 다시 조회할 수 없습니다.</p><button disabled={busy} onClick={()=>void run(async()=>{try{await navigator.clipboard.writeText(link);setNotice("초대 링크를 복사했습니다. 입주 예정자에게 직접 전달해 주세요.");}catch{setError("브라우저가 복사를 허용하지 않았습니다. 이 창을 선택하고 클립보드 쓰기를 허용한 뒤 다시 복사해 주세요. 초대를 다시 만들 필요는 없습니다.");}})}>초대 링크 복사</button><button onClick={()=>setLink("")}>링크 숨기기</button></div>:null}
    <h2>초대 및 연결 요청</h2>
    {!list.items.length?<p>아직 생성한 초대가 없습니다. 빈 호실을 선택해 초대를 만드세요.</p>:null}
    {list.items.filter(i=>i.state!=="REQUESTED").map(renderInvitation)}
    {list.nextCursor?<button disabled={busy} onClick={()=>void run(async()=>{const page=await client.list(list.nextCursor!);setList({items:[...list.items,...page.items],nextCursor:page.nextCursor});})}>초대 더 보기</button>:null}
   </>:null}
   <h2>내 연결 요청</h2>
   {!mine.items.length?<p>아직 신청한 연결이 없습니다. 관리자에게 받은 원래 초대 링크를 열어 직접 신청해 주세요.</p>:null}
   {mine.items.map(i=><article className="core-result invitation-card" key={i.invitationId}><InvitationSummary invite={i}/>
    <p>{i.state==="APPROVED"?"연결이 승인되었습니다. 내 소속·호실을 새로고침하면 접수할 수 있습니다.":i.state==="REQUESTED"?"위 확인 번호를 관리자에게 전달해 주세요. 승인 전에는 이 호실의 접수·사진을 이용할 수 없습니다.":"입주 연결은 생성되지 않았습니다. 관리자에게 새 초대를 문의해 주세요."}</p>
   </article>)}
   {mine.nextCursor?<button disabled={busy} onClick={()=>void run(async()=>{const page=await client.mine(mine.nextCursor!);setMine({items:[...mine.items,...page.items],nextCursor:page.nextCursor});})}>내 요청 더 보기</button>:null}
   <button disabled={busy} onClick={onRefreshAccess}>내 소속·호실 새로고침</button>
  </details>
 </section>;
}
