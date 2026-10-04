import { CoreFlowError,type CoreScope } from "./core-flow";

export type CoreCommunicationWaitingFor="NONE"|"TENANT"|"MANAGER";
export type CoreCommunicationIntent="REQUEST_REPLY"|"TENANT_MESSAGE"|"MANAGER_REPLY"|"MANAGER_UPDATE";
export type CorePublicMessage={id:string;sequence:number;intent:CoreCommunicationIntent;authorRole:"TENANT"|"MANAGER";body:string;replyToMessageId:string|null;createdAt:string};
export type CoreCommunicationPage={version:number;waitingFor:CoreCommunicationWaitingFor;readOnly:boolean;messages:CorePublicMessage[];nextBeforeSequence:number|null};
export type CoreCommunicationSend={clientRequestId:string;expectedVersion:number;intent:CoreCommunicationIntent;body:string};
export type CoreCommunicationSummary={ticketId:string;version:number;waitingFor:CoreCommunicationWaitingFor;readOnly:boolean};
export type CoreTicketCommunicationScope={
  read(id:string,beforeSequence?:number,limit?:number):Promise<CoreCommunicationPage>;
  send(id:string,input:CoreCommunicationSend):Promise<{message:CorePublicMessage;created:boolean}>;
  receipt(id:string,clientRequestId:string):Promise<CorePublicMessage>;
  summaries(ticketIds:string[]):Promise<CoreCommunicationSummary[]>;
  guardCompletion(id:string,expectedVersion?:number):Promise<void>;
};
export function sendCoreCommunication(scope:CoreScope,id:string,input:CoreCommunicationSend){
  if((scope.session.role==="TENANT")!==(input.intent==="TENANT_MESSAGE"))throw new CoreFlowError("FORBIDDEN");
  return scope.communication.send(id,input);
}
