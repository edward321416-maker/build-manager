"use client";
import React from 'react';
import type { B3Fetcher } from './property-workspace';
export async function loadUnitWorkspace(_fetcher:B3Fetcher,_orgId:string,_propertyId:string,_cursor:string|null,_signal?:AbortSignal):Promise<unknown>{throw new Error('NOT_IMPLEMENTED');}
export function UnitWorkspace({orgId,propertyId}:{orgId:string;propertyId:string}){return <main className="page-shell"><h1>건물 상세</h1><p role="status">접근 권한을 확인하고 있습니다.</p><span hidden>{orgId+propertyId}</span></main>;}
