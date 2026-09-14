export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  handleCreateTicket,
  handleListTickets,
} from "@/server/http/handlers/tickets";
import { withRequestContainer } from "@/server/http/request-container";

export function GET(request: Request): Promise<Response> {
  return handleListTickets(withRequestContainer, new URL(request.url));
}

export function POST(request: Request): Promise<Response> {
  return handleCreateTicket(withRequestContainer, request);
}
