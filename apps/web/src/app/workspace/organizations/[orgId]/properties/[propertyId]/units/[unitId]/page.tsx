import { UnitDetail } from '@/components/b3/unit-detail';
import { parseApplicationMode } from '@/runtime/application-mode';
import { notFound } from 'next/navigation';
export const dynamic = "force-dynamic";
export default async function Page({params:pending}:{params:Promise<{orgId:string;propertyId:string;unitId:string}>}){
 if(parseApplicationMode(process.env.BUILD_MANAGER_MODE)!=='B1')notFound();
 const params=await pending;return <UnitDetail key={params.orgId+params.propertyId+params.unitId} orgId={params.orgId} propertyId={params.propertyId} unitId={params.unitId}/>;
}
