"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { CoreAccessSchema,type CoreAccessDto } from "@build-manager/api-contracts";
import CoreFlowPage from "./core-screen";
import { OnboardingPanel } from "./onboarding-panel";
import { clearCommunicationRecovery } from "./communication-recovery";
import { clearOutcomeRecovery } from "./outcome-recovery";
import { EnvironmentNote } from "./ui/core-display";
import { roleName } from "./nav/nav-config";

export function CoreLoginScreen({demoEntry=false}:{demoEntry?:boolean}={}){
 const [access,setAccess]=useState<CoreAccessDto|null>(null),[scope,setScope]=useState<{orgId:string;csrf:string;generation:number}|undefined>();
 const [phase,setPhase]=useState<"loading"|"login"|"ready"|"unavailable"|"logout">("loading"),[error,setError]=useState("");
 const generation=useRef(0),logoutForm=useRef<HTMLFormElement>(null);
 const [logoutCsrf,setLogoutCsrf]=useState("");
 // Set only by a manual 내 소속 choice (select), never by load()'s auto-select of a single organisation, so a plain
 // sign-in never steals focus from the page body onto the new screen's title (final review of PR 139).
 const [chosen,setChosen]=useState(false);
 const denied=useCallback(()=>{clearCommunicationRecovery();clearOutcomeRecovery();generation.current++;setScope(undefined);setAccess(null);setPhase("login");setError("세션이 만료되었거나 접근 권한이 변경됐어요. 다시 로그인하거나 소속을 확인해 주세요.");},[]);
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
  }catch{if(g===generation.current){setPhase("unavailable");setError("로그인 연결 설정 또는 서비스 상태를 확인해 주세요. 개발 접근 코드로 대체하지 않아요.");}}
 },[denied]);
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)return load();});return()=>{active=false;};},[load]);
 useEffect(()=>{
  const recheck=async()=>{if(document.hidden||!access)return;const g=generation.current;try{const r=await fetch("/api/v2/core/access",{cache:"no-store",credentials:"same-origin"});if(g!==generation.current)return;if(!r.ok){denied();return;}const current=CoreAccessSchema.parse(await r.json());if(g!==generation.current)return;if(current.csrf!==access.csrf || (scope&&!current.organizations.some(o=>o.id===scope.orgId)))denied();}catch{if(g===generation.current)denied();}};
  document.addEventListener("visibilitychange",recheck);return()=>document.removeEventListener("visibilitychange",recheck);
 },[access,scope,denied]);
 const select=async(orgId:string)=>{
  setChosen(true);
  clearCommunicationRecovery();clearOutcomeRecovery();
  // Another organisation may mean another role: start on that role's first tab, in place of this entry (rules 8.16).
  window.history.replaceState(null,"","/core");
  const g=++generation.current;setScope(undefined);setError("");if(!orgId||!access)return;
  try{const r=await fetch("/api/v2/core/organization",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","x-core-organization":orgId,"x-b1-csrf":access.csrf},body:"{}"});
   if(g!==generation.current)return;if(r.status===401||r.status===403){denied();return;}if(!r.ok)throw new Error();setScope({orgId,csrf:access.csrf,generation:g});
  }catch{if(g===generation.current)setError("소속을 선택하지 못했어요. 다시 선택해 주세요.");}
 };
 const logout=()=>{clearCommunicationRecovery();clearOutcomeRecovery();generation.current++;setScope(undefined);setAccess(null);setError("");setPhase("logout");logoutForm.current?.submit();};
 const current=access?.organizations.find(o=>o.id===scope?.orgId);
 // One 내 소속 field: in the sign-in column before an organisation is chosen, and in MY after (rules 8.16). One
 // organisation leaves nothing to choose, so it is its name as text (P5 spec §1, PR 1b).
 const only=access?.organizations.length===1?access.organizations[0]:null;
 const organizationField=only?<><span className="core-org-label">내 소속</span><strong className="core-org-name">{only.name} · {roleName(only.role)}</strong></>:access?.organizations.length?<><label><span className="core-org-label">내 소속</span><span className="core-org-field"><select aria-label="내 소속" value={scope?.orgId??""} onChange={e=>void select(e.target.value)}><option value="">소속을 선택해 주세요</option>{access.organizations.map(o=><option key={o.id} value={o.id}>{o.name} · {roleName(o.role)}</option>)}</select>{/* The current choice wraps in a select-like box, so a long organisation name is never cut. */}<span className="core-org-current" aria-hidden="true">{current?`${current.name} · ${roleName(current.role)}`:"소속을 선택해 주세요"}</span></span></label>
  {access.organizations.length>1?<p>소속을 바꾸면 저장하지 않은 입력과 사진 선택은 초기화돼요. 저장된 접수·사진은 해당 소속의 이력에 남아요.</p>:null}</>:null;
 return <div className="core-b1-shell" data-phase={phase} data-scoped={scope?"true":undefined}>
  {scope?null:<section className="page-shell core-flow core-account" aria-label="로그인과 내 소속">
   <h1>{phase==="login"?"자취사무소":"내 소속·호실"}</h1>
   {error?<p role="alert">{error}</p>:null}
   {phase==="loading"?<p role="status">로그인과 소속을 확인하는 중…</p>:null}
   {phase==="login"&&demoEntry?<><p>로그인 없이 체험용 가짜 데이터로 들어가요. 역할을 골라 주세요.</p>
    <form className="core-demo-entry" action="/api/v2/session/demo" method="post"><input type="hidden" name="role" value="manager"/><button className="primary-button" type="submit">관리자로 체험하기</button></form>
    <form className="core-demo-entry" action="/api/v2/session/demo" method="post"><input type="hidden" name="role" value="tenant"/><button type="submit">세입자로 체험하기</button></form></>:null}
   {phase==="login"&&!demoEntry?<><p>기존 계정으로 로그인하면 내 호실의 접수·사진·처리 이력을 이용할 수 있어요.</p><a className="primary-button" href="/auth/login">계정으로 로그인</a></>:null}
   {phase==="unavailable"?<button onClick={()=>void load()}>연결 다시 확인</button>:null}
   {phase==="logout"?<p role="status">{demoEntry?"화면의 접수·사진을 비웠어요. 체험을 끝내고 역할 선택 화면으로 돌아가요.":"화면의 접수·사진을 비웠어요. 기존 세션 종료 후 로그인 제공자로 이동해요. 제공자 오류가 표시되면 이 앱으로 돌아와 로그인 상태를 다시 확인해 주세요."}</p>:null}
   {phase==="ready"&&access?<>
    {!access.organizations.length?<p>연결된 소속·호실이 없어요. 관리자에게 기존 계정의 소속·입주 연결을 확인해 주세요.</p>:organizationField}
    <button className="core-logout" onClick={logout}>로그아웃</button>
   </>:null}
  </section>}
  <form ref={logoutForm} action="/api/v2/session/logout" method="post" hidden><input type="hidden" name="csrf" value={logoutCsrf}/></form>
  <div className="core-workspace">
   {scope&&access&&current?<CoreFlowPage key={scope.orgId+scope.csrf} b1={scope} onDenied={scopedDenied} onLogout={logout} focusTitle={chosen} account={{caption:`${current.name} · ${roleName(current.role)}`,organization:organizationField,logout,
    // Building staff have no move-in screen (spec D10); the tenant's 호실 연결 and the admin's 입주 연결 share the panel.
    linkPanel:current.role==="PROPERTY_STAFF"?undefined:<OnboardingPanel key={"onboarding-"+scope.orgId+access.csrf} embedded csrf={access.csrf} orgId={scope.orgId} manager={current.role==="ORG_ADMIN"} onRefreshAccess={()=>void load()} onDenied={denied}/>}}/>:null}
   {!scope&&phase==="ready"&&access?<OnboardingPanel key={"onboarding-none"+access.csrf} csrf={access.csrf} manager={false} onRefreshAccess={()=>void load()} onDenied={denied}/>:null}
   {scope?null:<footer className="core-environment"><EnvironmentNote>검증용 환경으로 실제 업체 배정이나 알림은 전송되지 않아요.</EnvironmentNote></footer>}
  </div>
 </div>;
}
