import type { NextRequest } from 'next/server';
import { handleB1Read } from '@/server/b1/http';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request:NextRequest){return handleB1Read(request,'session',{});}
