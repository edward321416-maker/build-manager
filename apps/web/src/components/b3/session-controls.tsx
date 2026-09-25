"use client";
import React from 'react';
export function prepareB3Logout(_abort:()=>void,_clear:()=>void):void{throw new Error('NOT_IMPLEMENTED');}
export function SessionControls({csrf,onBeginLogout}:{csrf:string;onBeginLogout:()=>void}){
 return <form action="/api/v2/session/logout" method="post" onSubmit={event=>{event.preventDefault();onBeginLogout();event.currentTarget.submit();}}>
  <input type="hidden" name="csrf" value={csrf}/><button type="submit">로그아웃</button>
 </form>;
}
