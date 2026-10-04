"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { CoreAccessSchema,type CoreAccessDto } from "@build-manager/api-contracts";
import CoreFlowPage from "./core-screen";
import { OnboardingPanel } from "./onboarding-panel";
import { clearCommunicationRecovery } from "./communication-recovery";
import { clearOutcomeRecovery } from "./outcome-recovery";
import { EnvironmentNote } from "./ui/core-display";

export function CoreLoginScreen(){
 const [access,setAccess]=useState<CoreAccessDto|null>(null),[scope,setScope]=useState<{orgId:string;csrf:string;generation:number}|undefined>();
 const [phase,setPhase]=useState<"loading"|"login"|"ready"|"unavailable"|"logout">("loading"),[error,setError]=useState("");
 const generation=useRef(0),logoutForm=useRef<HTMLFormElement>(null);
 const [logoutCsrf,setLogoutCsrf]=useState("");
 const [view,setView]=useState<"tickets"|"invitations">("tickets");
 const denied=useCallback(()=>{clearCommunicationRecovery();clearOutcomeRecovery();generation.current++;setScope(undefined);setAccess(null);setPhase("login");setError("세션이 만료되었거나 접근 권한이 변경되었습니다. 다시 로그인하거나 소속을 확인해 주세요.");},[]);
 const scopedDenied=useCallback(()=>{if(scope?.generation===generation.current)denied();},[scope,denied]);
 const load=useCallback(async()=>{
  const g=++generation.current;setScope(undefined);setAccess(null);setPhase("loading");setError("");
  try{
   const r=await fetch("/api/v2/core/access",{cache:"no-store",credentials:"same-origin"});
   if(g!==generation.current)return;
   if(r.status===401||r.status===403){clearCommunicationRecovery();clearOutcomeRecovery();setPhase("login");return;}if(!r.ok)throw new Error();
   const a=CoreAccessSchema.parse(await r.json());if(g!==generation.current)return;
   setLogoutCsrf(a.csrf);setAccess(a);setPhase("ready");
   if(a.organizations.length===1){
    const selected={orgId:a.organizations[0].id,csrf:a.csrf,generation:g};
    const response=await fetch("/api/v2/core/organization",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","x-core-organization":selected.orgId,"x-b1-csrf":selected.csrf},body:"{}"});
    if(g!==generation.current)return;if(!response.ok){denied();return;}setScope(selected);
   }
  }catch{if(g===generation.current){setPhase("unavailable");setError("로그인 연결 설정 또는 서비스 상태를 확인해 주세요. 개발 접근 코드로 대체하지 않습니다.");}}
 },[denied]);
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)return load();});return()=>{active=false;};},[load]);
 useEffect(()=>{
  const recheck=async()=>{if(document.hidden||!access)return;const g=generation.current;try{const r=await fetch("/api/v2/core/access",{cache:"no-store",credentials:"same-origin"});if(g!==generation.current)return;if(!r.ok){denied();return;}const current=CoreAccessSchema.parse(await r.json());if(g!==generation.current)return;if(current.csrf!==access.csrf || (scope&&!current.organizations.some(o=>o.id===scope.orgId)))denied();}catch{if(g===generation.current)denied();}};
  document.addEventListener("visibilitychange",recheck);return()=>document.removeEventListener("visibilitychange",recheck);
 },[access,scope,denied]);
 const select=async(orgId:string)=>{
  clearCommunicationRecovery();clearOutcomeRecovery();
  const g=++generation.current;setScope(undefined);setError("");if(!orgId||!access)return;
  try{const r=await fetch("/api/v2/core/organization",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","x-core-organization":orgId,"x-b1-csrf":access.csrf},body:"{}"});
   if(g!==generation.current)return;if(r.status===401||r.status===403){denied();return;}if(!r.ok)throw new Error();setScope({orgId,csrf:access.csrf,generation:g});
  }catch{if(g===generation.current)setError("소속을 선택하지 못했습니다. 다시 선택해 주세요.");}
 };
 const logout=()=>{clearCommunicationRecovery();clearOutcomeRecovery();generation.current++;setScope(undefined);setAccess(null);setError("");setPhase("logout");logoutForm.current?.submit();};
 return <div className="core-b1-shell">
  <section className="page-shell core-flow core-account" aria-label="로그인과 내 소속">
   <h1>내 소속·호실</h1>
   {error?<p role="alert">{error}</p>:null}
   {phase==="loading"?<p role="status">로그인과 소속을 확인하는 중…</p>:null}
   {phase==="login"?<><p>기존 계정으로 로그인하면 내 호실의 접수·사진·처리 이력을 이용할 수 있습니다.</p><a className="primary-button" href="/auth/login">계정으로 로그인</a></>:null}
   {phase==="unavailable"?<button onClick={()=>void load()}>연결 다시 확인</button>:null}
   {phase==="logout"?<p role="status">화면의 접수·사진을 비웠습니다. 기존 세션 종료 후 로그인 제공자로 이동합니다. 제공자 오류가 표시되면 이 앱으로 돌아와 로그인 상태를 다시 확인해 주세요.</p>:null}
   {phase==="ready"&&access?<>
    {!access.organizations.length?<p>연결된 소속·호실이 없습니다. 관리자에게 기존 계정의 소속·입주 연결을 확인해 주세요.</p>:<label><span className="core-org-label">내 소속</span><select aria-label="내 소속" value={scope?.orgId??""} onChange={e=>void select(e.target.value)}><option value="">소속을 선택해 주세요</option>{access.organizations.map(o=><option key={o.id} value={o.id}>{o.name} · {o.role==="TENANT"?"세입자":o.role==="ORG_ADMIN"?"조직 관리자":"건물 담당자"}</option>)}</select></label>}
    {access.organizations.length>1?<p>소속을 바꾸면 저장하지 않은 입력과 사진 선택은 초기화됩니다. 저장된 접수·사진은 해당 소속의 이력에 남습니다.</p>:null}
    <button className="core-logout" onClick={logout}>로그아웃</button>
   </>:null}
   {scope?<nav aria-label="작업 이동"><a href="#core-tickets" aria-current={view==="tickets"?"page":undefined} onClick={e=>{e.preventDefault();setView("tickets");}}>{access?.organizations.find(o=>o.id===scope.orgId)?.role==="TENANT"?"접수":"업무함"}</a><a href="#core-invitations" aria-current={view==="invitations"?"page":undefined} onClick={e=>{e.preventDefault();setView("invitations");}}>입주 연결</a></nav>:null}
   <form ref={logoutForm} action="/api/v2/session/logout" method="post"><input type="hidden" name="csrf" value={logoutCsrf}/></form>
  </section>
  <div className="core-workspace">
   <div hidden={view!=="tickets"}>{scope?<CoreFlowPage key={scope.orgId+scope.csrf} b1={scope} onDenied={scopedDenied} onLogout={logout}/>:null}</div>
   <div hidden={Boolean(scope)&&view!=="invitations"}>{phase==="ready"&&access?<OnboardingPanel key={"onboarding-"+(scope?.orgId??"none")+access.csrf} csrf={access.csrf} orgId={scope?.orgId} manager={access.organizations.some(o=>o.id===scope?.orgId&&o.role==="ORG_ADMIN")} onRefreshAccess={()=>void load()} onDenied={denied}/>:null}</div>
   <footer className="core-environment"><EnvironmentNote>검증용 환경으로 실제 업체 배정이나 알림은 전송되지 않습니다.</EnvironmentNote></footer>
  </div>
 </div>;
}
