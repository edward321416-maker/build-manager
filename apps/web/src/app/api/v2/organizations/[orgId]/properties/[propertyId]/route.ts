import type { NextRequest } from 'next/server';
import { handleB1Read } from '@/server/b1/http';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request:NextRequest,context:{params:Promise<{orgId:string;propertyId:string}>}){return handleB1Read(request,'property',await context.params);}
