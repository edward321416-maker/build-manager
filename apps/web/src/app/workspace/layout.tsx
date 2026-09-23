import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { parseApplicationMode } from '@/runtime/application-mode';
export const dynamic = "force-dynamic";
/** Presentation boundary only; protected API requests perform authorization. */
export default function WorkspaceLayout({children}:{children:ReactNode}){
 if(parseApplicationMode(process.env.BUILD_MANAGER_MODE)!=='B1')notFound();
 return children;
}
