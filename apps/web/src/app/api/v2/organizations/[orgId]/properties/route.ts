import type { NextRequest } from 'next/server';
import { getB1Container } from '@/server/b1/container';
import { handleB3Http } from '@/server/b3/http';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context={params:Promise<{orgId:string}>};
async function dispatch(request:NextRequest,context:Context){
 const response=await handleB3Http(request,'properties',await context.params,getB1Container);
 if(response.status===405)response.headers.set('Allow','GET, POST');
 return response;
}
export async function GET(request:NextRequest,context:Context){return dispatch(request,context);}
export async function POST(request:NextRequest,context:Context){return dispatch(request,context);}
export async function PUT(request:NextRequest,context:Context){return dispatch(request,context);}
export async function PATCH(request:NextRequest,context:Context){return dispatch(request,context);}
export async function DELETE(request:NextRequest,context:Context){return dispatch(request,context);}
