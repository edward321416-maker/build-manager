"use client";
import React,{useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import { B1PropertySchema,B1SessionSchema,B3UnitPageSchema,type B1Property,type B3Unit } from '@build-manager/api-contracts';
import type { B3Fetcher } from './property-workspace';
import { SessionControls } from './session-controls';

async function json(response:Response):Promise<unknown>{if(!response.ok)throw new Error(String(response.status));return response.json();}
export type UnitWorkspaceData={csrf:string;property:B1Property;units:B3Unit[];nextCursor:string|null;canCreate:boolean};
export async function loadUnitWorkspace(fetcher:B3Fetcher,orgId:string,propertyId:string,cursor:string|null,signal?:AbortSignal):Promise<UnitWorkspaceData>{
 const session=await fetcher('/api/v2/session',{credentials:'same-origin',cache:'no-store',signal});
 const {csrf}=B1SessionSchema.parse(await json(session));
 const propertyResponse=await fetcher(`/api/v2/organizations/${encodeURIComponent(orgId)}/properties/${encodeURIComponent(propertyId)}`,{credentials:'same-origin',cache:'no-store',signal});
 const property=B1PropertySchema.parse(await json(propertyResponse));
 const query=cursor?'?after='+encodeURIComponent(cursor):'';
 const unitResponse=await fetcher(`/api/v2/organizations/${encodeURIComponent(orgId)}/properties/${encodeURIComponent(propertyId)}/units${query}`,{credentials:'same-origin',cache:'no-store',signal});
 const page=B3UnitPageSchema.parse(await json(unitResponse));
 return {csrf,property,units:page.items,nextCursor:page.nextCursor,canCreate:unitResponse.headers.get('X-B3-Can-Create-Unit')==='true'};
}
type State={phase:'loading'|'ready'|'denied'|'unavailable';data?:UnitWorkspaceData};
export function UnitWorkspace({orgId,propertyId}:{orgId:string;propertyId:string}){
 const [state,setState]=useState<State>({phase:'loading'}),[cursor,setCursor]=useState<string|null>(null),active=useRef<AbortController|null>(null);
 const clear=()=>{active.current?.abort();setState({phase:'loading'});setCursor(null);};
 useEffect(()=>{
  const controller=new AbortController();active.current=controller;
  void loadUnitWorkspace(fetch,orgId,propertyId,cursor,controller.signal).then(data=>{if(!controller.signal.aborted)setState({phase:'ready',data});}).catch(error=>{if(!controller.signal.aborted)setState({phase:error instanceof Error&&['401','403','404'].includes(error.message)?'denied':'unavailable'});});
  return()=>controller.abort();
 },[orgId,propertyId,cursor]);
 const data=state.data;
 return <main className="page-shell">
  <h1>건물 상세</h1>
  <nav><Link href="/workspace">내 조직</Link> · <Link href={`/workspace/organizations/${orgId}`}>건물 목록</Link></nav>
  {state.phase==='loading'&&<p role="status">접근 권한을 확인하고 있습니다.</p>}
  {state.phase==='denied'&&<p role="alert">로그인이 필요하거나 접근 권한이 없습니다.</p>}
  {state.phase==='unavailable'&&<p role="alert">현재 정보를 불러올 수 없습니다.</p>}
  {state.phase==='ready'&&data&&<>
   <SessionControls csrf={data.csrf} onBeginLogout={clear}/>
   <p>{data.property.addressReference??'주소가 등록되지 않았습니다.'}</p>
   {data.canCreate&&<p><Link href={`/workspace/organizations/${orgId}/properties/${propertyId}/units/new`}>호실 등록</Link></p>}
   {data.units.length===0&&<p>조회 가능한 호실이 없습니다.</p>}
   {data.units.length>0&&<ul>{data.units.map(unit=><li key={unit.id}><Link href={`/workspace/organizations/${orgId}/properties/${propertyId}/units/${unit.id}`}>{unit.label}</Link></li>)}</ul>}
   {data.nextCursor&&<button onClick={()=>{active.current?.abort();setState({phase:'loading'});setCursor(data.nextCursor);}}>다음</button>}
  </>}
 </main>;
}
