import { UnitRegistration } from '@/components/b3/unit-registration';
import { parseApplicationMode } from '@/runtime/application-mode';
import { notFound } from 'next/navigation';
export const dynamic = "force-dynamic";
export default async function Page({params:pending}:{params:Promise<{orgId:string;propertyId:string}>}){
 if(parseApplicationMode(process.env.BUILD_MANAGER_MODE)!=='B1')notFound();
 const params=await pending;return <UnitRegistration key={params.orgId+params.propertyId} orgId={params.orgId} propertyId={params.propertyId}/>;
}
