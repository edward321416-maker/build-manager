"use client";
import { useEffect,useRef,useState } from "react";
import { CoreAccessSchema,type InvitationDto } from "@build-manager/api-contracts";
import { ApiClientError,createCoreOnboardingClient } from "@build-manager/api-client";
import { InvitationSummary,onboardingMessage } from "../onboarding-panel";
import styles from "../core-design.module.css";

export function JoinScreen(){
 const token=useRef<string|null>(null),[hasToken,setHasToken]=useState(false),[csrf,setCsrf]=useState("");
 const [phase,setPhase]=useState<"loading"|"login"|"ready"|"error">("loading"),[invite,setInvite]=useState<InvitationDto|null>(null);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{
  // Fragment never enters a server URL, Auth0 returnTo, storage, request logs or referrer.
  if(token.current===null){const raw=window.location.hash.slice(1);window.history.replaceState(null,"",window.location.pathname);token.current=/^[a-f0-9]{64}$/.test(raw)?raw:"";}
  // Reopening an original link in this same tab is a new document lifetime:
  // discard the prior request/async state before consuming the new fragment.
  const reopen=()=>{if(window.location.hash)window.location.reload();};
  window.addEventListener("hashchange",reopen);
  let active=true;
  void Promise.resolve().then(async()=>{if(!active)return;setHasToken(Boolean(token.current));try{const r=await fetch("/api/v2/core/access",{cache:"no-store",credentials:"same-origin"});if(!active)return;if(r.status===401){token.current="";setHasToken(false);setPhase("login");return;}if(!r.ok)throw new Error();const a=CoreAccessSchema.parse(await r.json());if(active){setCsrf(a.csrf);setPhase("ready");}}catch{if(active){setPhase("error");setMessage("연결 상태를 확인하지 못했습니다. 내 소속·호실로 돌아가 로그인 상태를 확인해 주세요.");}}});
  return()=>{active=false;window.removeEventListener("hashchange",reopen);};
 },[]);
 const run=async(work:()=>Promise<void>,mutation=false)=>{setBusy(true);setMessage("");if(mutation)setUncertain(true);try{await work();}catch(e){setMessage(onboardingMessage(e));if(e instanceof ApiClientError&&e.status===401){token.current="";setHasToken(false);setCsrf("");setInvite(null);setPhase("login");}}finally{setBusy(false);}};
 const client=createCoreOnboardingClient({csrf});
 return <main className="page-shell core-flow core-join"><header className={styles.heading}><h1>내 호실 연결</h1>
  <p>관리자가 보낸 초대입니다. 직접 요청한 뒤 관리자 승인을 받아야 입주 연결이 완료됩니다.</p>
  </header>
  {phase==="loading"?<p role="status">로그인 상태를 확인하는 중…</p>:null}
  {phase==="login"?<><p>기존 계정으로 로그인한 뒤, 관리자에게 받은 원래 초대 링크를 다시 열어 주세요. 초대 정보는 로그인 제공자에게 전달하지 않습니다.</p><a className="primary-button" href="/auth/login">기존 계정으로 로그인</a></>:null}
  {message?<p role="alert">{message}</p>:null}{busy?<p role="status">연결 상태를 확인하는 중…</p>:null}
  {phase==="ready"?<>
   {!hasToken&&!invite?<p>초대 링크 정보가 없습니다. 관리자에게 받은 원래 링크를 다시 열어 주세요. 이미 신청했다면 내 연결 요청에서 상태를 확인할 수 있습니다.</p>:null}
   {hasToken&&!invite?<button className={styles.primary} disabled={busy||uncertain} onClick={()=>void run(async()=>setInvite(await client.inspect(token.current!)))}>초대 내용 확인</button>:null}
   {invite?<section className="core-result" aria-label="초대 확인"><InvitationSummary invite={invite}>
    {invite.state==="OPEN"?<p>위 호실이 본인의 입주 예정 호실인지 확인한 뒤 신청하세요.</p>:null}
     {invite.state==="REQUESTED"?<p>연결 요청을 저장했습니다. 요청번호를 관리자에게 전달해 주세요. 승인 전에는 이 호실의 접수·사진에 접근할 수 없습니다.</p>:null}
    {invite.state==="APPROVED"?<p>연결이 승인되었습니다. 내 소속·호실에서 새 호실을 확인하고 글·사진을 접수하세요.</p>:null}
    </InvitationSummary>
    {invite.state==="OPEN"?<button className={styles.primary} disabled={busy||uncertain||!hasToken} onClick={()=>void run(async()=>{setInvite(await client.claim(token.current!));setUncertain(false);token.current="";setHasToken(false);},true)}>연결 요청 보내기</button>:null}
   </section>:null}
   {uncertain?<p>응답이 확인되지 않았습니다. 요청을 다시 보내기 전에 저장 상태를 확인해 주세요.</p>:null}
   <button disabled={busy} onClick={()=>void run(async()=>{let page=await client.mine();let found=page.items.find(i=>i.invitationId===invite?.invitationId);while(!found&&page.nextCursor){page=await client.mine(page.nextCursor);found=page.items.find(i=>i.invitationId===invite?.invitationId);}if(found){setInvite(found);token.current="";setHasToken(false);}setUncertain(false);setMessage(found?"저장된 연결 상태를 확인했습니다.":"이 초대에 저장된 요청이 없습니다. 원래 링크의 호실을 다시 확인한 뒤 신청해 주세요.");})}>요청 저장 상태 확인</button>
  </>:null}
  <p><a href="/core">내 소속·호실과 연결 요청으로 돌아가기</a></p>
 </main>;
}
