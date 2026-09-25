"use client";
import React from 'react';
import type { B3Fetcher } from './property-workspace';
export async function loadUnitDetail(_fetcher:B3Fetcher,_orgId:string,_propertyId:string,_unitId:string,_signal?:AbortSignal):Promise<unknown>{throw new Error('NOT_IMPLEMENTED');}
export function UnitDetail({orgId,propertyId,unitId}:{orgId:string;propertyId:string;unitId:string}){return <main className="page-shell"><h1>호실 상세</h1><p role="status">호실 정보를 확인하고 있습니다.</p><span hidden>{orgId+propertyId+unitId}</span></main>;}
