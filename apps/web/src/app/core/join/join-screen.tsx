"use client";
import { useEffect,useMemo,useRef,useState } from "react";
import { CoreAccessSchema,type InvitationDto } from "@build-manager/api-contracts";
import { ApiClientError,createCoreOnboardingClient } from "@build-manager/api-client";
import { InvitationSummary,onboardingMessage } from "../onboarding-panel";
import styles from "../core-design.module.css";

export function JoinScreen(){
 const token=useRef<string|null>(null),[hasToken,setHasToken]=useState(false),[csrf,setCsrf]=useState("");
 const [phase,setPhase]=useState<"loading"|"login"|"ready"|"error">("loading"),[invite,setInvite]=useState<InvitationDto|null>(null);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[inviteClosed,setInviteClosed]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{
  // Fragment never enters a server URL, Auth0 returnTo, storage, request logs or referrer.
  if(token.current===null){const raw=window.location.hash.slice(1);window.history.replaceState(null,"",window.location.pathname);token.current=/^[a-f0-9]{64}$/.test(raw)?raw:"";}
  // Reopening an original link in this same tab is a new document lifetime:
  // discard the prior request/async state before consuming the new fragment.
  const reopen=()=>{if(window.location.hash)window.location.reload();};
  window.addEventListener("hashchange",reopen);
  let active=true;
  void Promise.resolve().then(async()=>{if(!active)return;setHasToken(Boolean(token.current));try{const r=await fetch("/api/v2/core/access",{cache:"no-store",credentials:"same-origin"});if(!active)return;if(r.status===401){token.current="";setHasToken(false);setPhase("login");return;}if(!r.ok)throw new Error();const a=CoreAccessSchema.parse(await r.json());if(active){setCsrf(a.csrf);setPhase("ready");}}catch{if(active){setPhase("error");setMessage("연결 상태를 확인하지 못했어요. 내 소속·호실로 돌아가 로그인 상태를 확인해 주세요.");}}});
  return()=>{active=false;window.removeEventListener("hashchange",reopen);};
 },[]);
 const run=async(work:()=>Promise<void>,mutation=false)=>{setBusy(true);setMessage("");if(mutation)setUncertain(true);try{await work();}catch(e){setMessage(onboardingMessage(e));if(e instanceof ApiClientError&&e.status===401){token.current="";setHasToken(false);setCsrf("");setInvite(null);setPhase("login");}}finally{setBusy(false);}};
 const client=useMemo(()=>createCoreOnboardingClient({csrf}),[csrf]);
 // The saved state of the inspected invite. While this tab still holds the link, one inspect answers OPEN (nothing saved),
 // REQUESTED or APPROVED. An invite that closed (409) or that this account can no longer open (404, e.g. its manager left)
 // is then searched among the person's own requests page by page, which still list it if it was claimed.
 const savedState=async(id:string)=>{
  let closed=false;
  if(token.current){try{return {found:await client.inspect(token.current),closed};}catch(e){if(!(e instanceof ApiClientError&&(e.status===404||e.status===409)))throw e;closed=true;}}
  let cursor:string|undefined;
  do{const page=await client.mine(cursor);const found=page.items.find(i=>i.invitationId===id);if(found)return {found,closed};cursor=page.nextCursor??undefined;}while(cursor);
  return {found:null,closed};
 };
 const checkSaved=(id:string)=>run(async()=>{
  const {found,closed}=await savedState(id);setUncertain(false);
  if(found&&found.state!=="OPEN"){setInvite(found);token.current="";setHasToken(false);setMessage("저장된 연결 상태를 확인했어요.");return;}
  // Nothing saved on a closed invite: claiming again would only fail again, so the link is dropped with it.
  if(closed){setInvite(null);token.current="";setHasToken(false);setInviteClosed(true);setMessage("이 초대는 더 이상 쓸 수 없어요. 관리자에게 새 초대 링크를 요청해 주세요.");return;}
  if(found)setInvite(found);
  setMessage("이 초대에 저장된 요청이 없어요. 원래 링크의 호실을 다시 확인한 뒤 신청해 주세요.");
 });
 // Saved requests live under '내 연결 요청' on /core; while an organisation is selected (a single one is selected automatically)
 // that section sits behind the '입주 연결' menu.
 const statusHint=<p>{"이미 신청했다면 내 호실로 돌아가 '내 연결 요청'에서 상태를 확인할 수 있어요. 소속이 선택돼 있다면 '입주 연결' 메뉴 안에 있어요."}</p>;
 return <main className="page-shell core-flow core-join"><header className={styles.heading}>{invite?.state==="REQUESTED"?<div className={styles.confirmationMark} aria-hidden="true">✓</div>:null}<h1>{invite?.state==="REQUESTED"?"연결 요청을 보냈어요":"내 호실 연결"}</h1>
  <p>{invite?.state==="REQUESTED"?`관리자 확인 후 ${invite.unitLabel}가 내 호실에 추가돼요.`:"호실을 확인하고 연결을 요청하세요. 관리자 승인 후 연결돼요."}</p>
  </header>
  {phase==="loading"?<p role="status">로그인 상태를 확인하는 중…</p>:null}
  {phase==="login"?<><p>기존 계정으로 로그인한 뒤, 관리자에게 받은 원래 초대 링크를 다시 열어 주세요. 초대 정보는 로그인 제공자에게 전달하지 않아요.</p><a className="primary-button" href="/auth/login">기존 계정으로 로그인</a></>:null}
  {message?<p role="alert">{message}</p>:null}{busy?<p role="status">연결 상태를 확인하는 중…</p>:null}
  {phase==="ready"?<>
   {!hasToken&&!invite&&!inviteClosed?<><p>초대 링크 정보가 없어요. 관리자에게 받은 원래 링크를 다시 열어 주세요.</p>{statusHint}</>:null}
   {hasToken&&!invite?<><button className={styles.primary} disabled={busy||uncertain} onClick={()=>void run(async()=>setInvite(await client.inspect(token.current!)))}>초대 내용 확인</button>{statusHint}</>:null}
   {invite?<section className="core-result" aria-label="초대 확인"><InvitationSummary invite={invite}>
    {invite.state==="OPEN"?<p>위 호실이 본인의 입주 예정 호실인지 확인한 뒤 신청하세요.</p>:null}
     {invite.state==="REQUESTED"?<p>확인 번호를 관리자에게 전달해 주세요. 승인 전에는 이 호실의 접수·사진에 접근할 수 없어요.</p>:null}
    {invite.state==="APPROVED"?<p>연결이 승인됐어요. 내 소속·호실에서 새 호실을 확인하고 글·사진을 접수하세요.</p>:null}
    </InvitationSummary>
    {invite.state==="OPEN"?<button className={styles.primary} disabled={busy||uncertain||!hasToken} onClick={()=>void run(async()=>{setInvite(await client.claim(token.current!));setUncertain(false);token.current="";setHasToken(false);},true)}>연결 요청 보내기</button>:null}
   </section>:null}
   {uncertain?<p>응답이 확인되지 않았어요. 요청을 다시 보내기 전에 저장 상태를 확인해 주세요.</p>:null}
   {/* Only an inspected invite names the request to look for, and an unclaimed one has nothing saved unless a claim's answer was lost. */}
   {invite&&(uncertain||invite.state!=="OPEN")?<button className={invite.state==="REQUESTED"?styles.primary:undefined} disabled={busy} onClick={()=>void checkSaved(invite.invitationId)}>요청 상태 확인</button>:null}
  </>:null}
  <p><a href="/core">내 호실로 돌아가기</a></p>
 </main>;
}
