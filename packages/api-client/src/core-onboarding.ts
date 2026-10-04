import { InvitationSchema,InvitationPageSchema,InviteUnitsPageSchema,CreatedInvitationSchema,type InvitationDto,type InvitationPage,type InviteUnitsPage } from "@build-manager/api-contracts";
import { sendRequest,type FetchLike } from "./http";

export function createCoreOnboardingClient(options:{csrf:string;orgId?:string;fetchImpl?:FetchLike}){
 const fetcher:FetchLike=(path,init)=>{const request={...init,cache:"no-store" as const,credentials:"same-origin" as const,headers:{...init?.headers,"x-b1-csrf":options.csrf,...(options.orgId?{"x-core-organization":options.orgId}:{})}};return (options.fetchImpl??globalThis.fetch)(path,request);};
 const path=(name:string)=>"/api/v2/core/onboarding/"+name;
 return {
  mine:(cursor?:string)=>sendRequest<InvitationPage>(fetcher,"",{method:"GET",path:path("mine"),query:cursor?{cursor}:undefined,schema:InvitationPageSchema}),
  list:(cursor?:string)=>sendRequest<InvitationPage>(fetcher,"",{method:"GET",path:path("invitations"),query:cursor?{cursor}:undefined,schema:InvitationPageSchema}),
  units:(cursor?:string)=>sendRequest<InviteUnitsPage>(fetcher,"",{method:"GET",path:path("units"),query:cursor?{cursor}:undefined,schema:InviteUnitsPageSchema}),
  create:(unitId:string)=>sendRequest<{invitation:InvitationDto;link:string}>(fetcher,"",{method:"POST",path:path("create"),body:{unitId},schema:CreatedInvitationSchema}),
  inspect:(token:string)=>sendRequest<InvitationDto>(fetcher,"",{method:"POST",path:path("inspect"),body:{token},schema:InvitationSchema}),
  claim:(token:string)=>sendRequest<InvitationDto>(fetcher,"",{method:"POST",path:path("claim"),body:{token},schema:InvitationSchema}),
  decide:(action:"approve"|"reject"|"revoke",invitationId:string,requestNumber?:string)=>sendRequest<InvitationDto>(fetcher,"",{method:"POST",path:path(action),body:{invitationId,...(requestNumber?{requestNumber}:{})},schema:InvitationSchema}),
 };
}
