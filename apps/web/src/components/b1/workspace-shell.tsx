"use client";
import React,{useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import { B1OrganizationPageSchema,B1PropertyPageSchema,B1PropertySchema,B1SessionSchema,type B1Organization,type B1Property } from '@build-manager/api-contracts';
type State={phase:'loading'|'ready'|'denied'|'unavailable';csrf?:string;organizations?:B1Organization[];properties?:B1Property[];property?:B1Property;nextCursor?:string|null};
export function WorkspaceShell({orgId,propertyId}:{orgId?:string;propertyId?:string}){
 const [state,setState]=useState<State>({phase:'loading'}),[cursor,setCursor]=useState<string|null>(null),active=useRef<AbortController|null>(null);
 useEffect(()=>{
  const abort=new AbortController();active.current=abort;
  async function load(){
   try{
    const sessionResponse=await fetch('/api/v2/session',{credentials:'same-origin',cache:'no-store',signal:abort.signal});
    if(!sessionResponse.ok)throw new Error(String(sessionResponse.status));
    const {csrf}=B1SessionSchema.parse(await sessionResponse.json());
    const path=orgId?`/api/v2/organizations/${encodeURIComponent(orgId)}/properties${propertyId?'/'+encodeURIComponent(propertyId):''}`:'/api/v2/me/organizations';
    const response=await fetch(path+(cursor?'?after='+encodeURIComponent(cursor):''),{credentials:'same-origin',cache:'no-store',signal:abort.signal});
    if(!response.ok)throw new Error(String(response.status));
    const json:unknown=await response.json();let result:State;
    if(propertyId)result={phase:'ready',csrf,property:B1PropertySchema.parse(json)};
    else if(orgId){const data=B1PropertyPageSchema.parse(json);result={phase:'ready',csrf,properties:data.items,nextCursor:data.nextCursor};}
    else {const data=B1OrganizationPageSchema.parse(json);result={phase:'ready',csrf,organizations:data.items,nextCursor:data.nextCursor};}
    if(!abort.signal.aborted)setState(result);
   }catch(error){if(!abort.signal.aborted)setState({phase:error instanceof Error && ['401','403','404'].includes(error.message)?'denied':'unavailable'});}
  }
  void load();return ()=>abort.abort();
 },[orgId,propertyId,cursor]);
 return <main className="page-shell">
  <h1>{propertyId?'건물 상세':orgId?'내 조직의 건물':'내 조직'}</h1>
  <nav><Link href="/workspace">내 조직</Link>{orgId && <> · <Link href={`/workspace/organizations/${orgId}`}>건물 목록</Link></>}</nav>
  {state.phase==='loading'&&<p role="status">접근 권한을 확인하고 있습니다.</p>}
  {state.phase==='denied'&&<p role="alert">로그인이 필요하거나 접근 권한이 없습니다. <a href="/auth/login">다시 로그인</a></p>}
  {state.phase==='unavailable'&&<p role="alert">현재 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.</p>}
  {state.phase==='ready'&&<>
   <form action="/api/v2/session/logout" method="post" onSubmit={event=>{event.preventDefault();active.current?.abort();event.currentTarget.submit();setState({phase:'loading'});}}><input type="hidden" name="csrf" value={state.csrf}/><button type="submit">로그아웃</button></form>
   {state.organizations?.length===0&&<p>접근 가능한 조직이 없습니다.</p>}
   {state.organizations&&<ul>{state.organizations.map(org=><li key={org.id}><Link href={`/workspace/organizations/${org.id}`}>{org.displayName}</Link></li>)}</ul>}
   {state.properties?.length===0&&<p>등록된 건물이 없습니다.</p>}
   {state.properties&&<ul>{state.properties.map(p=><li key={p.id}><Link href={`/workspace/organizations/${p.orgId}/properties/${p.id}`}>{p.addressReference??'주소 미등록 건물'}</Link></li>)}</ul>}
   {state.property&&<p>{state.property.addressReference??'주소가 등록되지 않았습니다.'}</p>}
   {state.nextCursor&&<button onClick={()=>{active.current?.abort();setState({phase:'loading'});setCursor(state.nextCursor??null);}}>다음</button>}
  </>}
 </main>;
}
