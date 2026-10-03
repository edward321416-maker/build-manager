import { handleCoreFlow } from "@/server/core-flow/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context={params:Promise<{path:string[]}>};
const handle=async(request:Request,context:Context)=>handleCoreFlow(request,(await context.params).path);
export { handle as GET,handle as POST,handle as OPTIONS,handle as PUT,handle as PATCH,handle as DELETE };
