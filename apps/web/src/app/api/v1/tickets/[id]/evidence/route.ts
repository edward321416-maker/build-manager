export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { handleSubmitEvidence } from "@/server/http/handlers/tickets";
import { withRequestContainer } from "@/server/http/request-container";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = await context.params;
  return handleSubmitEvidence(withRequestContainer, request, id);
}
