import { CoreFlowError,type CoreScope } from "./core-flow";
export type CoreMaintenanceActionKind="INSPECTION"|"REPAIR"|"PART_REPLACEMENT"|"ADJUSTMENT"|"OTHER";
export type CoreMaintenanceCorrectionReason="ACTION_CLASSIFICATION"|"COMPONENT_LABEL"|"OTHER";
export type CoreMaintenanceFactCreate={clientRequestId:string;actionKind:CoreMaintenanceActionKind;componentLabel:string|null};
export type CoreMaintenanceFactCorrection=CoreMaintenanceFactCreate&{expectedCurrentFactId:string;correctionReason:CoreMaintenanceCorrectionReason};
export type CoreUnitMaintenanceFact={factId:string;unitId:string;buildingId:string;buildingName:string;unitLabel:string;sourceTicketId:string;issueType:"HEATING"|"LEAK";actionKind:CoreMaintenanceActionKind;componentLabel:string|null;sourceCompletedAt:string;recordedAt:string;corrected:boolean;correctionCount:number;tenantOutcome:"UNCONFIRMED"|"RESOLVED"|"UNRESOLVED"|"RECURRENCE_CLAIM";previousTicketId:string|null;followUpTicketId:string|null};
export type CoreMaintenanceFactRevision={factId:string;actionKind:CoreMaintenanceActionKind;componentLabel:string|null;recordedAt:string;correctionReason:CoreMaintenanceCorrectionReason|null;current:boolean};
export type CoreMaintenanceFactDetail={current:CoreUnitMaintenanceFact|null;revisions:CoreMaintenanceFactRevision[]};
export type CoreMaintenanceFactScope={
 listUnit(unitId:string):Promise<CoreUnitMaintenanceFact[]>;
 readForTicket(ticketId:string):Promise<CoreMaintenanceFactDetail>;
 create(ticketId:string,input:CoreMaintenanceFactCreate):Promise<{fact:CoreUnitMaintenanceFact;created:boolean}>;
 correct(factId:string,input:CoreMaintenanceFactCorrection):Promise<{fact:CoreUnitMaintenanceFact;created:boolean}>;
};
export function createCoreMaintenanceFact(scope:CoreScope,id:string,input:CoreMaintenanceFactCreate){
 if(scope.session.role==="TENANT")throw new CoreFlowError("FORBIDDEN");
 return scope.maintenance.create(id,input);
}
export function correctCoreMaintenanceFact(scope:CoreScope,id:string,input:CoreMaintenanceFactCorrection){
 if(scope.session.role==="TENANT")throw new CoreFlowError("FORBIDDEN");
 return scope.maintenance.correct(id,input);
}
