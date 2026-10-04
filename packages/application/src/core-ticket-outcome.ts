import type { Ticket } from "@build-manager/domain";
import type { CoreRecord,CoreScope } from "./core-flow";
import { CoreFlowError } from "./core-flow";
import type { ApplicationDependencies,Clock,IdGenerator } from "./ports";
import { createTicket } from "./use-cases/create-ticket";

export type CoreTicketOutcome={ticketId:string;kind:"UNCONFIRMED"|"RESOLVED"|"UNRESOLVED"|"RECURRENCE_CLAIM";assertedAt:string|null;followUpTicketId:string|null};
export type CoreConfirmResolved={clientRequestId:string};
export type CoreCreateFollowUp={clientRequestId:string;claimKind:"UNRESOLVED"|"RECURRENCE_CLAIM";issueType:"HEATING"|"LEAK";rawUserText:string};
export type CoreFollowUpResult={sourceOutcome:CoreTicketOutcome;ticket:CoreRecord;created:boolean};
export type CoreOutcomeScope={
 read(id:string):Promise<CoreTicketOutcome>;
 confirmResolved(id:string,input:CoreConfirmResolved):Promise<{outcome:CoreTicketOutcome;created:boolean}>;
 createFollowUp(id:string,input:CoreCreateFollowUp):Promise<CoreFollowUpResult>;
 receipt(id:string,key:string):Promise<{outcome:CoreTicketOutcome;targetTicketId:string|null}>;
 source(id:string):Promise<{sourceTicketId:string|null}>;
};
export function confirmCoreResolved(scope:CoreScope,id:string,input:CoreConfirmResolved){
 if(scope.session.role!=="TENANT")throw new CoreFlowError("FORBIDDEN");
 return scope.outcome.confirmResolved(id,input);
}
export function createCoreFollowUp(scope:CoreScope,id:string,input:CoreCreateFollowUp){
 if(scope.session.role!=="TENANT")throw new CoreFlowError("FORBIDDEN");
 return scope.outcome.createFollowUp(id,input);
}
/** Reuse normal safety/protocol intake; only location context comes from the source. */
export async function buildCoreFollowUpTicket(source:CoreRecord,input:CoreCreateFollowUp,clock:Clock,ids:IdGenerator):Promise<Ticket>{
 const unsupported=async():Promise<never>=>{throw new CoreFlowError("FORBIDDEN");};
 const deps:ApplicationDependencies={clock,ids,
  buildings:{save:unsupported,list:async()=>[source.building],findById:async id=>id===source.building.id?source.building:null},
  tickets:{save:async()=>{},findById:async()=>null,list:async()=>[]},
  demoState:{reset:unsupported},addresses:{lookup:unsupported},buildingRegistry:{fetchContext:unsupported},kapt:{fetchContext:unsupported}};
 return createTicket(deps,{buildingId:source.building.id,unitId:source.ticket.unitId,issueType:input.issueType,rawUserText:input.rawUserText});
}
