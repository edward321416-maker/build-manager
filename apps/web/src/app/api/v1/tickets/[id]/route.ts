export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { handleGetTicket } from "@/server/http/handlers/tickets";
import { withRequestContainer } from "@/server/http/request-container";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return handleGetTicket(withRequestContainer, new URL(request.url), id);
}
