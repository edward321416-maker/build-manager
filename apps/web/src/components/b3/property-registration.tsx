"use client";
import React,{useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import { B1PropertyPageSchema,B1PropertySchema,B1SessionSchema,type B1Property } from '@build-manager/api-contracts';
import type { B3Fetcher } from './property-workspace';
import { SessionControls } from './session-controls';

async function json(response:Response):Promise<unknown>{if(!response.ok)throw new Error(String(response.status));return response.json();}
export async function loadPropertyRegistrationAccess(fetcher:B3Fetcher,orgId:string,signal?:AbortSignal):Promise<{csrf:string;canCreate:boolean}>{
 const session=await fetcher('/api/v2/session',{credentials:'same-origin',cache:'no-store',signal});
 const {csrf}=B1SessionSchema.parse(await json(session));
 const response=await fetcher(`/api/v2/organizations/${encodeURIComponent(orgId)}/properties`,{credentials:'same-origin',cache:'no-store',signal});
 B1PropertyPageSchema.parse(await json(response));
 return {csrf,canCreate:response.headers.get('X-B3-Can-Create-Property')==='true'};
}
export type PropertySubmitResult=
 |{kind:'created';path:string;property:B1Property}
 |{kind:'invalid'|'denied'|'uncertain'};
export async function submitPropertyRegistration(fetcher:B3Fetcher,orgId:string,csrf:string,addressReference:string,signal?:AbortSignal):Promise<PropertySubmitResult>{
 try{
  const response=await fetcher(`/api/v2/organizations/${encodeURIComponent(orgId)}/properties`,{
   method:'POST',credentials:'same-origin',cache:'no-store',signal,
   headers:{'content-type':'application/json','x-b1-csrf':csrf},
   body:JSON.stringify({addressReference:addressReference.trim()}),
  });
  if(response.status===201){
   const property=B1PropertySchema.parse(await response.json());
   if(property.orgId!==orgId)return {kind:'uncertain'};
   return {kind:'created',property,path:`/workspace/organizations/${property.orgId}/properties/${property.id}`};
  }
  if([400,413].includes(response.status))return {kind:'invalid'};
  if([401,403,404].includes(response.status))return {kind:'denied'};
  return {kind:'uncertain'};
 }catch{return {kind:'uncertain'};}
}

type Access={phase:'loading'|'ready'|'denied'|'unavailable';csrf?:string};
export function PropertyRegistration({orgId}:{orgId:string}){
 const [access,setAccess]=useState<Access>({phase:'loading'});
 const [value,setValue]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const active=useRef<AbortController|null>(null);
 const pending=useRef<AbortController|null>(null);
 const clear=()=>{active.current?.abort();pending.current?.abort();pending.current=null;setAccess({phase:'loading'});setValue('');setBusy(false);setMessage('');};
 useEffect(()=>{
  const controller=new AbortController();active.current=controller;
  void loadPropertyRegistrationAccess(fetch,orgId,controller.signal).then(result=>{
   if(!controller.signal.aborted)setAccess(result.canCreate?{phase:'ready',csrf:result.csrf}:{phase:'denied'});
  }).catch(error=>{if(!controller.signal.aborted)setAccess({phase:error instanceof Error&&['401','403','404'].includes(error.message)?'denied':'unavailable'});});
  return()=>{controller.abort();pending.current?.abort();pending.current=null;};
 },[orgId]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  const scope=active.current;
  if(access.phase!=='ready'||!access.csrf||busy||pending.current||!scope||scope.signal.aborted)return;
  const submission=new AbortController();pending.current=submission;
  setBusy(true);setMessage('');
  const result=await submitPropertyRegistration(fetch,orgId,access.csrf,value,submission.signal);
  // A buffered response can resolve after abort; never revive a departed view.
  if(submission.signal.aborted||scope.signal.aborted||active.current!==scope||pending.current!==submission)return;
  pending.current=null;
  setBusy(false);
  if(result.kind==='created'){window.location.assign(result.path);return;}
  if(result.kind==='invalid')setMessage('건물 참조값을 확인해 주세요.');
  else if(result.kind==='denied'){setAccess({phase:'denied'});setMessage('등록 권한을 다시 확인해 주세요.');}
  else setMessage('등록 결과를 확인할 수 없습니다. 건물 목록을 다시 확인한 뒤 명시적으로 다시 제출해 주세요.');
 }
 return <main className="page-shell">
  <h1>건물 등록</h1>
  <nav><Link href={`/workspace/organizations/${orgId}`} onNavigate={clear}>건물 목록</Link></nav>
  {access.phase==='loading'&&<p role="status">등록 권한을 확인하고 있습니다.</p>}
  {access.phase==='denied'&&<p role="alert">건물을 등록할 권한이 없습니다.</p>}
  {access.phase==='unavailable'&&<p role="alert">현재 등록 권한을 확인할 수 없습니다.</p>}
  {access.phase==='ready'&&access.csrf&&<>
   <SessionControls csrf={access.csrf} onBeginLogout={clear}/>
   <form onSubmit={submit}>
    <label>확인되지 않은 수동 건물 참조 <input value={value} onChange={event=>setValue(event.target.value)} placeholder="SYNTHETIC-BUILDING-001"/></label>
    <button type="submit" disabled={busy}>{busy?'등록 중':'등록'}</button>
   </form>
   {message&&<p role="alert">{message}</p>}
  </>}
 </main>;
}
