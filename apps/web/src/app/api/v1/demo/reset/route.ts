export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { handleResetDemo } from "@/server/http/handlers/demo";
import { withRequestContainer } from "@/server/http/request-container";

export function POST(): Promise<Response> {
  return handleResetDemo(withRequestContainer);
}
