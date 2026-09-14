export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { handleSearchAddress } from "@/server/http/handlers/address";
import { withRequestContainer } from "@/server/http/request-container";

export function GET(request: Request): Promise<Response> {
  return handleSearchAddress(withRequestContainer, new URL(request.url));
}
