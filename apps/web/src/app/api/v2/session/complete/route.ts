import type { NextRequest } from 'next/server';
import { handleSessionCompletion } from '@/server/b1/complete-session';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request:NextRequest){return handleSessionCompletion(request);}
