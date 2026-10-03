import { CoreFlowError, type CoreFlowPort, type CoreScope } from "@build-manager/application";
import type { PostgresDatabase } from "./database";
import { withTransaction } from "./transaction";

export function createCoreFlowPort(database: PostgresDatabase): CoreFlowPort {
  return { async run(digest,operation) {
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new CoreFlowError("UNAUTHENTICATED");
    try {
      return await withTransaction(database,async client=>{
        await client.query("SET LOCAL lock_timeout='2000ms'");
        await client.query("SET LOCAL statement_timeout='5000ms'");
        const hash=Buffer.from(digest,"hex");
        const call=async <T>(query:string,values:unknown[]):Promise<T> => (await client.query<{value:T}>(query,values)).rows[0].value;
        const session=await call<CoreScope["session"]>("SELECT core_flow.session($1) AS value",[hash]);
        return operation({
          session,
          units:()=>call("SELECT core_flow.units($1) AS value",[hash]),
          building:unit=>call("SELECT core_flow.building($1,$2) AS value",[hash,unit]),
          read:(id,lock=false)=>call("SELECT core_flow.read_ticket($1,$2,$3) AS value",[hash,id,lock]),
          list:unit=>call("SELECT core_flow.list_tickets($1,$2) AS value",[hash,unit??null]),
          store:async (ticket,kind,message,work)=>{ await client.query("SELECT core_flow.store_ticket($1,$2,$3,$4,$5)",[hash,JSON.stringify(ticket),kind,message,work??null]); },
          checkPhotoWrite:async id=>{await client.query("SELECT core_flow.check_photo_write($1,$2)",[hash,id]);},
          photos:id=>call("SELECT core_flow.list_photos($1,$2) AS value",[hash,id]),
          photo:async(id,photoId)=>{
            const row=(await client.query<{metadata:Awaited<ReturnType<CoreScope["photo"]>>["photo"];content:Buffer}>("SELECT * FROM core_flow.read_photo($1,$2,$3)",[hash,id,photoId])).rows[0];
            return {photo:row.metadata,bytes:row.content};
          },
          savePhoto:(id,input)=>call("SELECT core_flow.save_photo($1,$2,$3,$4,$5,$6,$7) AS value",[hash,id,input.uploadId,input.mime,input.width,input.height,Buffer.from(input.bytes)]),
        });
      });
    } catch(error) {
      const code=typeof error === "object" && error !== null && "code" in error ? error.code : null;
      if(code === "28000") throw new CoreFlowError("UNAUTHENTICATED");
      if(code === "42501") throw new CoreFlowError("FORBIDDEN");
      if(code === "P0002") throw new CoreFlowError("NOT_FOUND");
      if(code === "22P02" || code === "22023") throw new CoreFlowError("INVALID_INPUT");
      if(code === "P0001") throw new CoreFlowError("STATE_CONFLICT");
      throw error; // HTTP boundary sanitizes infrastructure details; no retry/unknown-commit replay.
    }
  } };
}
