import type { NextRequest } from 'next/server';
import { handleB1Logout } from '@/server/b1/logout';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request:NextRequest){return handleB1Logout(request);}
