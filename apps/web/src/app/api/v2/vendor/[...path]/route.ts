import { handleVendorHandoff } from "@/server/vendor-handoff/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context={params:Promise<{path:string[]}>};
const handle=async(request:Request,context:Context)=>handleVendorHandoff(request,(await context.params).path);
export { handle as GET,handle as POST,handle as PUT,handle as PATCH,handle as DELETE };
