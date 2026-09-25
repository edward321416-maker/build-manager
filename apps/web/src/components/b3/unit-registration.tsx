"use client";
import React from 'react';
import type { B3Fetcher } from './property-workspace';
export async function loadUnitRegistrationAccess(_fetcher:B3Fetcher,_orgId:string,_propertyId:string,_signal?:AbortSignal):Promise<unknown>{throw new Error('NOT_IMPLEMENTED');}
export async function submitUnitRegistration(_fetcher:B3Fetcher,_orgId:string,_propertyId:string,_csrf:string,_label:string,_signal?:AbortSignal):Promise<unknown>{throw new Error('NOT_IMPLEMENTED');}
export function UnitRegistration({orgId,propertyId}:{orgId:string;propertyId:string}){return <main className="page-shell"><h1>호실 등록</h1><p role="status">등록 권한을 확인하고 있습니다.</p><span hidden>{orgId+propertyId}</span></main>;}
