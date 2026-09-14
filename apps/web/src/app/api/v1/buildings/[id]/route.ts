export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { handleGetBuilding } from "@/server/http/handlers/buildings";
import { withRequestContainer } from "@/server/http/request-container";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return handleGetBuilding(withRequestContainer, id);
}
