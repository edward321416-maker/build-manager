"use client";
import React,{useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import { B1PropertyPageSchema,B1SessionSchema,type B1Property } from '@build-manager/api-contracts';
import { SessionControls } from './session-controls';

export type B3Fetcher=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;
export type PropertyWorkspaceData={csrf:string;properties:B1Property[];nextCursor:string|null;canCreate:boolean};

function exactCapability(response:Response,name:string):boolean{return response.headers.get(name)==='true';}
async function requireJson(response:Response):Promise<unknown>{if(!response.ok)throw new Error(String(response.status));return response.json();}
function phase(error:unknown):'denied'|'unavailable'{return error instanceof Error&&['401','403','404'].includes(error.message)?'denied':'unavailable';}

export async function loadPropertyWorkspace(fetcher:B3Fetcher,orgId:string,cursor:string|null,signal?:AbortSignal):Promise<PropertyWorkspaceData>{
 const sessionResponse=await fetcher('/api/v2/session',{credentials:'same-origin',cache:'no-store',signal});
 const {csrf}=B1SessionSchema.parse(await requireJson(sessionResponse));
 const query=cursor?'?after='+encodeURIComponent(cursor):'';
 const response=await fetcher(`/api/v2/organizations/${encodeURIComponent(orgId)}/properties${query}`,{credentials:'same-origin',cache:'no-store',signal});
 const data=B1PropertyPageSchema.parse(await requireJson(response));
 return {csrf,properties:data.items,nextCursor:data.nextCursor,canCreate:exactCapability(response,'X-B3-Can-Create-Property')};
}

type State={phase:'loading'|'ready'|'denied'|'unavailable';data?:PropertyWorkspaceData};
export function PropertyWorkspace({orgId}:{orgId:string}){
 const [state,setState]=useState<State>({phase:'loading'});
 const [cursor,setCursor]=useState<string|null>(null);
 const active=useRef<AbortController|null>(null);
 const clear=()=>{active.current?.abort();setState({phase:'loading'});setCursor(null);};
 useEffect(()=>{
  const controller=new AbortController();active.current=controller;
  void loadPropertyWorkspace(fetch,orgId,cursor,controller.signal)
   .then(data=>{if(!controller.signal.aborted)setState({phase:'ready',data});})
   .catch(error=>{if(!controller.signal.aborted)setState({phase:phase(error)});});
  return()=>controller.abort();
 },[orgId,cursor]);
 const data=state.data;
 return <main className="page-shell">
  <h1>내 조직의 건물</h1>
  <nav><Link href="/workspace">내 조직</Link></nav>
  {state.phase==='loading'&&<p role="status">접근 권한을 확인하고 있습니다.</p>}
  {state.phase==='denied'&&<p role="alert">로그인이 필요하거나 접근 권한이 없습니다. <a href="/auth/login">다시 로그인</a></p>}
  {state.phase==='unavailable'&&<p role="alert">현재 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.</p>}
  {state.phase==='ready'&&data&&<>
   <SessionControls csrf={data.csrf} onBeginLogout={clear}/>
   {data.canCreate&&<p><Link href={`/workspace/organizations/${orgId}/properties/new`}>건물 등록</Link></p>}
   {data.properties.length===0&&<p>조회 가능한 건물이 없습니다.</p>}
   {data.properties.length>0&&<ul>{data.properties.map(property=><li key={property.id}><Link href={`/workspace/organizations/${property.orgId}/properties/${property.id}`}>{property.addressReference??'주소 미등록 건물'}</Link></li>)}</ul>}
   {data.nextCursor&&<button onClick={()=>{active.current?.abort();setState({phase:'loading'});setCursor(data.nextCursor);}}>다음</button>}
  </>}
 </main>;
}
