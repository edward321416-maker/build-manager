import { VendorReassignCommandSchema, type VendorReassignCommand, VendorRequestCorrectionCommandSchema, type VendorRequestCorrectionCommand, VendorRequireFollowUpCommandSchema, type VendorRequireFollowUpCommand, VendorCloseoutCommandSchema, type VendorCloseoutCommand } from "@build-manager/api-contracts";
import { ManagerVendorHandoffDtoSchema, VendorCreateAssignmentCommandSchema, VendorPublishPacketCommandSchema, VendorIssueLinkCommandSchema, VendorReissueLinkCommandSchema, VendorRevokeCommandSchema, VendorLinkIssueDtoSchema, type ManagerVendorHandoffDto,type VendorLinkIssueDto,type VendorCreateAssignmentCommand, type VendorPublishPacketCommand, type VendorIssueLinkCommand, type VendorReissueLinkCommand, type VendorRevokeCommand,
  VendorManagerRescheduleCommandSchema,VendorAvailabilityCommandSchema,VendorEntryAuthorizationCommandSchema,VendorConfirmSlotCommandSchema,VendorTenantRescheduleCommandSchema,VendorTenantSchedulingDtoSchema,
  type VendorManagerRescheduleCommand,type VendorAvailabilityCommand,type VendorEntryAuthorizationCommand,type VendorConfirmSlotCommand,type VendorTenantRescheduleCommand,type TenantVendorSchedulingDto } from "@build-manager/api-contracts";
import { sendRequest, type FetchLike } from "./http";

export function coreVendorHandoff(fetcher:FetchLike,baseUrl:string){
  const ticket=(id:string)=>`/api/v2/core/manager/tickets/${encodeURIComponent(id)}`;
  const assignment=(id:string)=>`/api/v2/core/manager/vendor-assignments/${encodeURIComponent(id)}`;
  const scheduling=(id:string)=>`/api/v2/core/tickets/${encodeURIComponent(id)}/vendor-scheduling`;
  return {
    readHandoff:(id:string)=>sendRequest<ManagerVendorHandoffDto>(fetcher,baseUrl,{method:"GET",path:ticket(id)+"/vendor-handoff",schema:ManagerVendorHandoffDtoSchema}),
    createAssignment:(id:string,input:VendorCreateAssignmentCommand)=>sendRequest<ManagerVendorHandoffDto>(fetcher,baseUrl,{method:"POST",path:ticket(id)+"/vendor-assignment",body:VendorCreateAssignmentCommandSchema.parse(input),schema:ManagerVendorHandoffDtoSchema}),
    publishPacket:(id:string,input:VendorPublishPacketCommand)=>sendRequest<ManagerVendorHandoffDto>(fetcher,baseUrl,{method:"POST",path:assignment(id)+"/packet-revisions",body:VendorPublishPacketCommandSchema.parse(input),schema:ManagerVendorHandoffDtoSchema}),
    issueLink:(id:string,input:VendorIssueLinkCommand)=>sendRequest<VendorLinkIssueDto>(fetcher,baseUrl,{method:"POST",path:assignment(id)+"/link",body:VendorIssueLinkCommandSchema.parse(input),schema:VendorLinkIssueDtoSchema}),
    reissueLink:(id:string,input:VendorReissueLinkCommand)=>sendRequest<VendorLinkIssueDto>(fetcher,baseUrl,{method:"POST",path:assignment(id)+"/link/reissue",body:VendorReissueLinkCommandSchema.parse(input),schema:VendorLinkIssueDtoSchema}),
    reschedule:(id:string,input:VendorManagerRescheduleCommand)=>sendRequest<ManagerVendorHandoffDto>(fetcher,baseUrl,{method:"POST",path:assignment(id)+"/reschedule",body:VendorManagerRescheduleCommandSchema.parse(input),schema:ManagerVendorHandoffDtoSchema}),
    readScheduling:(id:string)=>sendRequest<TenantVendorSchedulingDto>(fetcher,baseUrl,{method:"GET",path:scheduling(id),schema:VendorTenantSchedulingDtoSchema}),
    submitAvailability:(id:string,input:VendorAvailabilityCommand)=>sendRequest<TenantVendorSchedulingDto>(fetcher,baseUrl,{method:"POST",path:scheduling(id)+"/availability",body:VendorAvailabilityCommandSchema.parse(input),schema:VendorTenantSchedulingDtoSchema}),
    authorizeEntry:(id:string,input:VendorEntryAuthorizationCommand)=>sendRequest<TenantVendorSchedulingDto>(fetcher,baseUrl,{method:"POST",path:scheduling(id)+"/entry-authorization",body:VendorEntryAuthorizationCommandSchema.parse(input),schema:VendorTenantSchedulingDtoSchema}),
    confirmSlot:(id:string,input:VendorConfirmSlotCommand)=>sendRequest<TenantVendorSchedulingDto>(fetcher,baseUrl,{method:"POST",path:scheduling(id)+"/confirm",body:VendorConfirmSlotCommandSchema.parse(input),schema:VendorTenantSchedulingDtoSchema}),
    tenantReschedule:(id:string,input:VendorTenantRescheduleCommand)=>sendRequest<TenantVendorSchedulingDto>(fetcher,baseUrl,{method:"POST",path:scheduling(id)+"/reschedule",body:VendorTenantRescheduleCommandSchema.parse(input),schema:VendorTenantSchedulingDtoSchema}),
    reassign:(id:string,input:VendorReassignCommand)=>sendRequest<ManagerVendorHandoffDto>(fetcher,baseUrl,{method:"POST",path:assignment(id)+"/reassign",body:VendorReassignCommandSchema.parse(input),schema:ManagerVendorHandoffDtoSchema}),
    requestCorrection:(id:string,input:VendorRequestCorrectionCommand)=>sendRequest<ManagerVendorHandoffDto>(fetcher,baseUrl,{method:"POST",path:assignment(id)+"/completion-correction",body:VendorRequestCorrectionCommandSchema.parse(input),schema:ManagerVendorHandoffDtoSchema}),
    requireFollowUp:(id:string,input:VendorRequireFollowUpCommand)=>sendRequest<ManagerVendorHandoffDto>(fetcher,baseUrl,{method:"POST",path:assignment(id)+"/follow-up",body:VendorRequireFollowUpCommandSchema.parse(input),schema:ManagerVendorHandoffDtoSchema}),
    closeout:(id:string,input:VendorCloseoutCommand)=>sendRequest<ManagerVendorHandoffDto>(fetcher,baseUrl,{method:"POST",path:assignment(id)+"/closeout",body:VendorCloseoutCommandSchema.parse(input),schema:ManagerVendorHandoffDtoSchema}),
    revoke:(id:string,input:VendorRevokeCommand)=>sendRequest<ManagerVendorHandoffDto>(fetcher,baseUrl,{method:"POST",path:assignment(id)+"/revoke",body:VendorRevokeCommandSchema.parse(input),schema:ManagerVendorHandoffDtoSchema}),
  };
}
export type CoreVendorHandoffClient=ReturnType<typeof coreVendorHandoff>;
