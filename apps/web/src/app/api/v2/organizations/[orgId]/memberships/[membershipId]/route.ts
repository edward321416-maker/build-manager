import type { NextRequest } from "next/server";
import { getB1Container } from "@/server/b1/container";
import { handleB5Http } from "@/server/b5/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ orgId: string; membershipId: string }> };
async function dispatch(request: NextRequest, context: Context) {
  return handleB5Http(request, await context.params, getB1Container);
}
export async function DELETE(request: NextRequest, context: Context) { return dispatch(request, context); }
export async function GET(request: NextRequest, context: Context) { return dispatch(request, context); }
export async function POST(request: NextRequest, context: Context) { return dispatch(request, context); }
export async function PUT(request: NextRequest, context: Context) { return dispatch(request, context); }
export async function PATCH(request: NextRequest, context: Context) { return dispatch(request, context); }
export async function HEAD(request: NextRequest, context: Context) { return dispatch(request, context); }
export async function OPTIONS(request: NextRequest, context: Context) { return dispatch(request, context); }
