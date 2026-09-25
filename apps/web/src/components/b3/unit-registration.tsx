"use client";
import React,{useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import { B1SessionSchema,B3UnitPageSchema,B3UnitSchema,type B3Unit } from '@build-manager/api-contracts';
import type { B3Fetcher } from './property-workspace';
import { SessionControls } from './session-controls';

async function json(response:Response):Promise<unknown>{if(!response.ok)throw new Error(String(response.status));return response.json();}
export async function loadUnitRegistrationAccess(fetcher:B3Fetcher,orgId:string,propertyId:string,signal?:AbortSignal):Promise<{csrf:string;canCreate:boolean}>{
 const session=await fetcher('/api/v2/session',{credentials:'same-origin',cache:'no-store',signal});
 const {csrf}=B1SessionSchema.parse(await json(session));
 const response=await fetcher(`/api/v2/organizations/${encodeURIComponent(orgId)}/properties/${encodeURIComponent(propertyId)}/units`,{credentials:'same-origin',cache:'no-store',signal});
 B3UnitPageSchema.parse(await json(response));
 return {csrf,canCreate:response.headers.get('X-B3-Can-Create-Unit')==='true'};
}
export type UnitSubmitResult=
 |{kind:'created';path:string;unit:B3Unit}
 |{kind:'invalid'|'denied'|'conflict'|'uncertain'};
export async function submitUnitRegistration(fetcher:B3Fetcher,orgId:string,propertyId:string,csrf:string,label:string,signal?:AbortSignal):Promise<UnitSubmitResult>{
 try{
  const response=await fetcher(`/api/v2/organizations/${encodeURIComponent(orgId)}/properties/${encodeURIComponent(propertyId)}/units`,{
   method:'POST',credentials:'same-origin',cache:'no-store',signal,
   headers:{'content-type':'application/json','x-b1-csrf':csrf},
   body:JSON.stringify({label:label.trim()}),
  });
  if(response.status===201){
   const unit=B3UnitSchema.parse(await response.json());
   if(unit.orgId!==orgId||unit.propertyId!==propertyId)return {kind:'uncertain'};
   return {kind:'created',unit,path:`/workspace/organizations/${unit.orgId}/properties/${unit.propertyId}/units/${unit.id}`};
  }
  if(response.status===409)return {kind:'conflict'};
  if([400,413].includes(response.status))return {kind:'invalid'};
  if([401,403,404].includes(response.status))return {kind:'denied'};
  return {kind:'uncertain'};
 }catch{return {kind:'uncertain'};}
}

type Access={phase:'loading'|'ready'|'denied'|'unavailable';csrf?:string};
export function UnitRegistration({orgId,propertyId}:{orgId:string;propertyId:string}){
 const [access,setAccess]=useState<Access>({phase:'loading'}),[label,setLabel]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),active=useRef<AbortController|null>(null);
 const pending=useRef<AbortController|null>(null);
 const clear=()=>{active.current?.abort();pending.current?.abort();pending.current=null;setAccess({phase:'loading'});setLabel('');setBusy(false);setMessage('');};
 useEffect(()=>{
  const controller=new AbortController();active.current=controller;
  void loadUnitRegistrationAccess(fetch,orgId,propertyId,controller.signal).then(result=>{if(!controller.signal.aborted)setAccess(result.canCreate?{phase:'ready',csrf:result.csrf}:{phase:'denied'});}).catch(error=>{if(!controller.signal.aborted)setAccess({phase:error instanceof Error&&['401','403','404'].includes(error.message)?'denied':'unavailable'});});
  return()=>{controller.abort();pending.current?.abort();pending.current=null;};
 },[orgId,propertyId]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  const scope=active.current;
  if(access.phase!=='ready'||!access.csrf||busy||pending.current||!scope||scope.signal.aborted)return;
  const submission=new AbortController();pending.current=submission;
  setBusy(true);setMessage('');
  const result=await submitUnitRegistration(fetch,orgId,propertyId,access.csrf,label,submission.signal);
  // A buffered response can resolve after abort; never revive a departed view.
  if(submission.signal.aborted||scope.signal.aborted||active.current!==scope||pending.current!==submission)return;
  pending.current=null;setBusy(false);
  if(result.kind==='created'){window.location.assign(result.path);return;}
  if(result.kind==='conflict')setMessage('이미 사용 중인 호실 이름입니다.');
  else if(result.kind==='invalid')setMessage('호실 이름을 확인해 주세요.');
  else if(result.kind==='denied'){setAccess({phase:'denied'});setMessage('등록 권한을 다시 확인해 주세요.');}
  else setMessage('등록 결과를 확인할 수 없습니다. 호실 목록을 다시 확인한 뒤 명시적으로 다시 제출해 주세요.');
 }
 return <main className="page-shell">
  <h1>호실 등록</h1>
  <nav><Link href={`/workspace/organizations/${orgId}/properties/${propertyId}`} onNavigate={clear}>건물 상세</Link></nav>
  {access.phase==='loading'&&<p role="status">등록 권한을 확인하고 있습니다.</p>}
  {access.phase==='denied'&&<p role="alert">호실을 등록할 권한이 없습니다.</p>}
  {access.phase==='unavailable'&&<p role="alert">현재 등록 권한을 확인할 수 없습니다.</p>}
  {access.phase==='ready'&&access.csrf&&<>
   <SessionControls csrf={access.csrf} onBeginLogout={clear}/>
   <form onSubmit={submit}><label>호실 이름 <input value={label} onChange={event=>setLabel(event.target.value)} placeholder="101"/></label><button type="submit" disabled={busy}>{busy?'등록 중':'등록'}</button></form>
   {message&&<p role="alert">{message}</p>}
  </>}
 </main>;
}
