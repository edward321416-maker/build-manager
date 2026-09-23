import { WorkspaceShell } from '@/components/b1/workspace-shell';
import { parseApplicationMode } from '@/runtime/application-mode';
import { notFound } from 'next/navigation';
export const dynamic = "force-dynamic";
export default async function Page(){
 if(parseApplicationMode(process.env.BUILD_MANAGER_MODE)!=='B1')notFound();
 return <WorkspaceShell/>;
}
