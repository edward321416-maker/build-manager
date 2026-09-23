import type { SessionData } from '@auth0/nextjs-auth0/types';
import { B1Error,listMyOrganizations,listOrganizationProperties,getOrganizationProperty,type B1ReadDependencies } from '@build-manager/application';
import { B1PageQuerySchema } from '@build-manager/api-contracts';
import { NextRequest,NextResponse } from 'next/server';
import { getB1Container } from './container';
import { requireCurrentSession } from './session';
import { privateHeaders,toB1ErrorResponse } from './errors';
export type B1HTTPDependencies=B1ReadDependencies & {readSession(request:NextRequest):Promise<SessionData|null>};
export async function handleB1Read(request:NextRequest,kind:'session'|'organizations'|'properties'|'property',params:Record<string,string>,dependencies:()=>B1HTTPDependencies=getB1Container){
 try{
  if(request.method!=='GET')return NextResponse.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers:privateHeaders});
  const query=request.nextUrl.searchParams;
  if([...query.keys()].some(k=>query.getAll(k).length!==1) || (kind==='session'||kind==='property')&&query.size)throw new B1Error('INVALID_INPUT');
  const page=B1PageQuerySchema.safeParse(Object.fromEntries(query));
  if(!page.success)throw new B1Error('INVALID_INPUT');
  if((kind==='property'||kind==='properties')&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(params.orgId??''))throw new B1Error('INVALID_INPUT');
  const d=dependencies(),session=await requireCurrentSession(await d.readSession(request),d.sessions);
  const data=kind==='session'?{csrf:session.csrf}:kind==='organizations'?await listMyOrganizations(d,session.digest,page.data):kind==='properties'?await listOrganizationProperties(d,session.digest,params.orgId,page.data):await getOrganizationProperty(d,session.digest,params.orgId,params.propertyId);
  return NextResponse.json(data,{headers:privateHeaders});
 }catch(error){return toB1ErrorResponse(error);}
}
