import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { parseApplicationMode } from '@/runtime/application-mode';
export const dynamic = "force-dynamic";
export default function DemoLayout({children}:{children:ReactNode}){
 if(parseApplicationMode(process.env.BUILD_MANAGER_MODE)!=='DEMO')notFound();
 return children;
}
