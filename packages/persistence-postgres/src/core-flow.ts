import { CoreFlowError,buildCoreFollowUpTicket,type CoreFollowUpResult,type CoreRecord, type CoreFlowPort, type CoreScope,type CoreAccessPort,type CoreOrganization } from "@build-manager/application";
import { randomUUID } from "node:crypto";
import type { PostgresDatabase } from "./database";
import { withTransaction } from "./transaction";

export function createCoreAccessPort(database:PostgresDatabase):CoreAccessPort {
  return {organizations:async digest=>{
    if(!/^[a-f0-9]{64}$/.test(digest))throw new CoreFlowError("UNAUTHENTICATED");
    try{return await withTransaction(database,async client=>(await client.query<{value:CoreOrganization[]}>("SELECT core_flow.access_organizations($1) AS value",[Buffer.from(digest,"hex")])).rows[0].value);}
    catch(error){if(typeof error==="object"&&error&&"code" in error&&error.code==="28000")throw new CoreFlowError("UNAUTHENTICATED");throw error;}
  },inOrganization:org=>createCoreFlowPort(database,org)};
}

export function createCoreFlowPort(database: PostgresDatabase,orgId?:string): CoreFlowPort {
  return { async run(digest,operation) {
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new CoreFlowError("UNAUTHENTICATED");
    try {
      return await withTransaction(database,async client=>{
        await client.query("SET LOCAL lock_timeout='2000ms'");
        await client.query("SET LOCAL statement_timeout='5000ms'");
        const hash=Buffer.from(digest,"hex");
        // Binding and every read/write share one transaction and digest lock.
        // The selected org belongs to this request, never a mutable browser cookie.
        if(orgId!==undefined)await client.query("SELECT core_flow.bind_organization($1,$2)",[hash,orgId]);
        const call=async <T>(query:string,values:unknown[]):Promise<T> => (await client.query<{value:T}>(query,values)).rows[0].value;
        const session=await call<CoreScope["session"]>("SELECT core_flow.session($1) AS value",[hash]);
        return operation({
          session,
          maintenance:{
            listUnit:id=>call("SELECT core_flow.read_unit_maintenance_facts($1,$2) AS value",[hash,id]),
            readForTicket:id=>call("SELECT core_flow.read_ticket_maintenance_fact($1,$2) AS value",[hash,id]),
            create:(id,input)=>call("SELECT core_flow.create_unit_maintenance_fact($1,$2,$3,$4,$5) AS value",[hash,id,input.clientRequestId,input.actionKind,input.componentLabel]),
            correct:(id,input)=>call("SELECT core_flow.correct_unit_maintenance_fact($1,$2,$3,$4,$5,$6,$7) AS value",[hash,id,input.clientRequestId,input.expectedCurrentFactId,input.actionKind,input.componentLabel,input.correctionReason]),
          },
          outcome:{
            read:id=>call("SELECT core_flow.read_ticket_outcome($1,$2) AS value",[hash,id]),
            confirmResolved:(id,input)=>call("SELECT core_flow.confirm_ticket_resolved($1,$2,$3) AS value",[hash,id,input.clientRequestId]),
            createFollowUp:async(id,input)=>{
              const sql="SELECT core_flow.create_ticket_follow_up($1,$2,$3,$4,$5,$6,$7) AS value";
              const args=[hash,id,input.clientRequestId,input.claimKind,input.issueType,input.rawUserText];
              // NULL-body preparation authorizes, locks and recovers a saved request before building anything.
              // Both calls and normal domain intake remain inside this one transaction; no intermediate COMMIT.
              const prior=await call<CoreFollowUpResult|null>(sql,[...args,null]);if(prior)return prior;
              const source=await call<CoreRecord>("SELECT core_flow.read_ticket($1,$2,false) AS value",[hash,id]);
              const ticket=await buildCoreFollowUpTicket(source,input,{now:()=>new Date().toISOString()},{next:()=>randomUUID()});
              return call<CoreFollowUpResult>(sql,[...args,JSON.stringify(ticket)]);
            },
            receipt:(id,key)=>call("SELECT core_flow.outcome_receipt($1,$2,$3) AS value",[hash,id,key]),
            source:id=>call("SELECT core_flow.read_follow_up_source($1,$2) AS value",[hash,id]),
          },
          communication:{
            read:(id,before,limit=50)=>call("SELECT core_flow.read_communication($1,$2,$3,$4) AS value",[hash,id,before??null,limit]),
            send:(id,input)=>call("SELECT core_flow.send_communication($1,$2,$3,$4,$5,$6) AS value",[hash,id,input.clientRequestId,input.expectedVersion,input.intent,input.body]),
            receipt:(id,key)=>call("SELECT core_flow.communication_receipt($1,$2,$3) AS value",[hash,id,key]),
            summaries:ids=>call("SELECT core_flow.communication_summaries($1,$2) AS value",[hash,ids]),
            guardCompletion:async(id,version)=>{await client.query("SELECT core_flow.guard_communication_completion($1,$2,$3)",[hash,id,version??null]);await client.query("SELECT vendor_handoff.guard_direct_completion($1,$2)",[hash,id]);},
          },
          manager:{
            list:()=>call("SELECT core_flow.list_manager_work($1) AS value",[hash]),
            read:id=>call("SELECT core_flow.read_manager_work($1,$2) AS value",[hash,id]),
            update:(id,input)=>call("SELECT core_flow.update_manager_work($1,$2,$3,$4,$5,$6) AS value",[hash,id,input.priority,input.assigneeLabel,input.dueAt,input.expectedVersion]),
            notes:id=>call("SELECT core_flow.list_internal_notes($1,$2) AS value",[hash,id]),
            appendNote:(id,body)=>call("SELECT core_flow.append_internal_note($1,$2,$3) AS value",[hash,id,body]),
          },
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
