import { handleVendorHandoff } from "../../../../../server/vendor-handoff/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context={params:Promise<{path:string[]}>};
const handle=async(request:Request,context:Context)=>handleVendorHandoff(request,(await context.params).path);
// OPTIONS/HEAD are answered here (405 with Vendor headers) instead of by Next's implicit handlers.
export { handle as GET,handle as POST,handle as PUT,handle as PATCH,handle as DELETE,handle as OPTIONS,handle as HEAD };
