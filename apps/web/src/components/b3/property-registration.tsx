"use client";
import React from 'react';
import type { B3Fetcher } from './property-workspace';
export async function loadPropertyRegistrationAccess(_fetcher:B3Fetcher,_orgId:string,_signal?:AbortSignal):Promise<unknown>{throw new Error('NOT_IMPLEMENTED');}
export async function submitPropertyRegistration(_fetcher:B3Fetcher,_orgId:string,_csrf:string,_addressReference:string,_signal?:AbortSignal):Promise<unknown>{throw new Error('NOT_IMPLEMENTED');}
export function PropertyRegistration({orgId}:{orgId:string}){return <main className="page-shell"><h1>건물 등록</h1><p role="status">등록 권한을 확인하고 있습니다.</p><span hidden>{orgId}</span></main>;}
