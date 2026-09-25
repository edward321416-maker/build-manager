"use client";
import React from 'react';
export type B3Fetcher=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;
export async function loadPropertyWorkspace(_fetcher:B3Fetcher,_orgId:string,_cursor:string|null,_signal?:AbortSignal):Promise<unknown>{throw new Error('NOT_IMPLEMENTED');}
export function PropertyWorkspace({orgId}:{orgId:string}){return <main className="page-shell"><h1>내 조직의 건물</h1><p role="status">접근 권한을 확인하고 있습니다.</p><span hidden>{orgId}</span></main>;}
