import { ManagerVendorHandoffDtoSchema, VendorCreateAssignmentCommandSchema, VendorPublishPacketCommandSchema, VendorIssueLinkCommandSchema, VendorReissueLinkCommandSchema, VendorRevokeCommandSchema, VendorLinkIssueDtoSchema, type ManagerVendorHandoffDto,type VendorLinkIssueDto,type VendorCreateAssignmentCommand, type VendorPublishPacketCommand, type VendorIssueLinkCommand, type VendorReissueLinkCommand, type VendorRevokeCommand } from "@build-manager/api-contracts";
import { sendRequest, type FetchLike } from "./http";

export function coreVendorHandoff(fetcher:FetchLike,baseUrl:string){
  const ticket=(id:string)=>`/api/v2/core/manager/tickets/${encodeURIComponent(id)}`;
  const assignment=(id:string)=>`/api/v2/core/manager/vendor-assignments/${encodeURIComponent(id)}`;
  return {
    readHandoff:(id:string)=>sendRequest<ManagerVendorHandoffDto>(fetcher,baseUrl,{method:"GET",path:ticket(id)+"/vendor-handoff",schema:ManagerVendorHandoffDtoSchema}),
    createAssignment:(id:string,input:VendorCreateAssignmentCommand)=>sendRequest<ManagerVendorHandoffDto>(fetcher,baseUrl,{method:"POST",path:ticket(id)+"/vendor-assignment",body:VendorCreateAssignmentCommandSchema.parse(input),schema:ManagerVendorHandoffDtoSchema}),
    publishPacket:(id:string,input:VendorPublishPacketCommand)=>sendRequest<ManagerVendorHandoffDto>(fetcher,baseUrl,{method:"POST",path:assignment(id)+"/packet-revisions",body:VendorPublishPacketCommandSchema.parse(input),schema:ManagerVendorHandoffDtoSchema}),
    issueLink:(id:string,input:VendorIssueLinkCommand)=>sendRequest<VendorLinkIssueDto>(fetcher,baseUrl,{method:"POST",path:assignment(id)+"/link",body:VendorIssueLinkCommandSchema.parse(input),schema:VendorLinkIssueDtoSchema}),
    reissueLink:(id:string,input:VendorReissueLinkCommand)=>sendRequest<VendorLinkIssueDto>(fetcher,baseUrl,{method:"POST",path:assignment(id)+"/link/reissue",body:VendorReissueLinkCommandSchema.parse(input),schema:VendorLinkIssueDtoSchema}),
    revoke:(id:string,input:VendorRevokeCommand)=>sendRequest<ManagerVendorHandoffDto>(fetcher,baseUrl,{method:"POST",path:assignment(id)+"/revoke",body:VendorRevokeCommandSchema.parse(input),schema:ManagerVendorHandoffDtoSchema}),
  };
}
export type CoreVendorHandoffClient=ReturnType<typeof coreVendorHandoff>;
