import { handleDemoEntry } from '@/server/b1/demo-entry';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request:Request){return handleDemoEntry(request);}
export async function GET(request:Request){return handleDemoEntry(request);}
