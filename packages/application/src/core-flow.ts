import type { Building, Ticket, AnswerValue, IssueType, RouteType } from "@build-manager/domain";
import type { ApplicationDependencies, Clock, IdGenerator } from "./ports";
import { stateConflict } from "./errors";
import { createTicket } from "./use-cases/create-ticket";
import { submitTicketAnswer } from "./use-cases/submit-ticket-answer";
import { finalizeTicket } from "./use-cases/finalize-ticket";
import { requestMoreInfo } from "./use-cases/request-more-info";
import { approveRecommendation } from "./use-cases/approve-recommendation";
import { overrideRoute } from "./use-cases/override-route";

export type CoreSession = { actorId: string; orgId: string; role: "TENANT" | "ORG_ADMIN" | "PROPERTY_STAFF" };
export type CoreUnit = { id: string; buildingId: string; buildingName: string; label: string };
export type CoreWorkStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED";
export type CoreEvent = { id: string; kind: string; actorRole: CoreSession["role"]; message: string; at: string };
export type CoreRecord = { ticket: Ticket; building: Building; workStatus: CoreWorkStatus; version: number; events: CoreEvent[] };
export type CoreScope = {
  session: CoreSession;
  units(): Promise<CoreUnit[]>;
  building(unitId: string): Promise<Building>;
  read(id: string, lock?: boolean): Promise<CoreRecord>;
  list(unitId?: string): Promise<CoreRecord[]>;
  store(ticket: Ticket, kind: string, message: string, work?: CoreWorkStatus): Promise<void>;
};
export type CoreFlowPort = { run<T>(digest: string, operation: (scope: CoreScope) => Promise<T>): Promise<T> };
export type CoreAction =
 | { type: "CREATE"; unitId: string; issueType: IssueType; rawUserText: string }
 | { type: "ANSWER"; ticketId: string; questionId: string; value: AnswerValue }
 | { type: "FINALIZE"; ticketId: string }
 | { type: "MORE_INFO"; ticketId: string; reason: string; requestedQuestionIds: string[] }
 | { type: "APPROVE"; ticketId: string }
 | { type: "OVERRIDE"; ticketId: string; route: RouteType; reason?: string }
 | { type: "HANDLING"; ticketId: string; status: "IN_PROGRESS" | "COMPLETED"; message: string };

export class CoreFlowError extends Error {
  readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT" | "DEPENDENCY_UNAVAILABLE";
  constructor(code: CoreFlowError["code"]) { super(code); this.code=code; }
}

/** Scoped repositories reuse the existing protocol and safety use cases unchanged. */
export async function performCoreAction(scope: CoreScope, action: CoreAction, clock: Clock, ids: IdGenerator): Promise<CoreRecord> {
  const tenantAction=["CREATE","ANSWER","FINALIZE"].includes(action.type);
  if (tenantAction !== (scope.session.role === "TENANT")) throw new CoreFlowError("FORBIDDEN");
  const before=action.type === "CREATE" ? null : await scope.read(action.ticketId,true);
  const building=before?.building ?? await scope.building((action as Extract<CoreAction,{ type:"CREATE" }>).unitId);
  let saved: Ticket | undefined;
  const unsupported=async (): Promise<never>=>{ throw new CoreFlowError("FORBIDDEN"); };
  const deps: ApplicationDependencies={
    clock,ids,
    buildings:{ save:unsupported,list:async()=>[building],findById:async id=>id===building.id?building:null },
    tickets:{ save:async t=>{ saved=t; },findById:async id=>before?.ticket.id===id?before.ticket:null,list:async()=>[] },
    demoState:{ reset:unsupported },addresses:{ lookup:unsupported },buildingRegistry:{ fetchContext:unsupported },kapt:{ fetchContext:unsupported },
  };
  let kind:string=action.type, message="";
  if (before?.workStatus === "COMPLETED") throw stateConflict("Completed handling is immutable in RC1");
  switch(action.type) {
    case "CREATE": await createTicket(deps,{ buildingId:building.id,unitId:action.unitId,issueType:action.issueType,rawUserText:action.rawUserText }); kind="CREATED"; break;
    case "ANSWER": await submitTicketAnswer(deps,{ticketId:action.ticketId,questionId:action.questionId,value:action.value});kind="ANSWERED";break;
    case "FINALIZE": await finalizeTicket(deps,{ticketId:action.ticketId});kind="FINALIZED";break;
    case "MORE_INFO": await requestMoreInfo(deps,{ticketId:action.ticketId,reason:action.reason,requestedQuestionIds:action.requestedQuestionIds});message=action.reason;break;
    case "APPROVE": {
      const selectedRoute=before?.ticket.repairPacket?.recommendation?.primary;
      if (!selectedRoute) throw stateConflict("A recommendation is required");
      await approveRecommendation(deps,{ticketId:action.ticketId,selectedRoute});kind="DECISION";break;
    }
    case "OVERRIDE": await overrideRoute(deps,{ticketId:action.ticketId,selectedRoute:action.route,reason:action.reason});kind="DECISION";break;
    case "HANDLING":
      if (!action.message.trim() || (action.status === "COMPLETED" && before!.workStatus !== "IN_PROGRESS")) throw stateConflict("Record handling before completion");
      // Separate from route approval: this records a human's report, not dispatch or proof of repair.
      saved=before!.ticket;message=action.message;break;
  }
  if (!saved) throw new CoreFlowError("DEPENDENCY_UNAVAILABLE");
  await scope.store(saved,kind,message,action.type === "HANDLING" ? action.status : undefined);
  return scope.read(saved.id);
}
