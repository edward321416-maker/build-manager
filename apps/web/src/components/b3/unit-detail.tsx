"use client";
import React,{useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import { B1SessionSchema,B3UnitSchema,type B3Unit } from '@build-manager/api-contracts';
import type { B3Fetcher } from './property-workspace';
import { SessionControls } from './session-controls';

export async function loadUnitDetail(fetcher:B3Fetcher,orgId:string,propertyId:string,unitId:string,signal?:AbortSignal):Promise<B3Unit>{
 const response=await fetcher(`/api/v2/organizations/${encodeURIComponent(orgId)}/properties/${encodeURIComponent(propertyId)}/units/${encodeURIComponent(unitId)}`,{credentials:'same-origin',cache:'no-store',signal});
 if(!response.ok)throw new Error(String(response.status));
 return B3UnitSchema.parse(await response.json());
}
type State={phase:'loading'|'ready'|'denied'|'unavailable';csrf?:string;unit?:B3Unit};
export function UnitDetail({orgId,propertyId,unitId}:{orgId:string;propertyId:string;unitId:string}){
 const [state,setState]=useState<State>({phase:'loading'}),active=useRef<AbortController|null>(null);
 const clear=()=>{active.current?.abort();setState({phase:'loading'});};
 useEffect(()=>{
  const controller=new AbortController();active.current=controller;
  async function load(){
   try{
    const session=await fetch('/api/v2/session',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    if(!session.ok)throw new Error(String(session.status));
    const {csrf}=B1SessionSchema.parse(await session.json());
    const unit=await loadUnitDetail(fetch,orgId,propertyId,unitId,controller.signal);
    if(!controller.signal.aborted)setState({phase:'ready',csrf,unit});
   }catch(error){if(!controller.signal.aborted)setState({phase:error instanceof Error&&['401','403','404'].includes(error.message)?'denied':'unavailable'});}
  }
  void load();return()=>controller.abort();
 },[orgId,propertyId,unitId]);
 return <main className="page-shell">
  <h1>호실 상세</h1>
  <nav><Link href={`/workspace/organizations/${orgId}/properties/${propertyId}`}>건물 상세</Link></nav>
  {state.phase==='loading'&&<p role="status">호실 정보를 확인하고 있습니다.</p>}
  {state.phase==='denied'&&<p role="alert">로그인이 필요하거나 접근 권한이 없습니다.</p>}
  {state.phase==='unavailable'&&<p role="alert">현재 호실 정보를 불러올 수 없습니다.</p>}
  {state.phase==='ready'&&state.csrf&&state.unit&&<><SessionControls csrf={state.csrf} onBeginLogout={clear}/><p>{state.unit.label}</p></>}
 </main>;
}
