export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { handleListDemoBuildings } from "@/server/http/handlers/demo";
import { withRequestContainer } from "@/server/http/request-container";

export function GET(): Promise<Response> {
  return handleListDemoBuildings(withRequestContainer);
}
