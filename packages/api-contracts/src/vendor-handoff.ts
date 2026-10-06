import { z } from "zod";
import { CoreCommunicationBodySchema } from "./core-ticket-communication";

const uuid=z.string().uuid();
const version=z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const instant=z.string().datetime({offset:true});
const plainSingle=(max:number)=>z.string().trim().min(1).max(max).refine(v=>!/[\p{Cc}\p{Cf}]/u.test(v));
const plainMulti=(max:number)=>z.string().trim().min(1).max(max).refine(v=>!/[\p{Cc}\p{Cf}]/u.test(v.replace(/[\r\n]/g,"")));
const vendorLabel=plainSingle(80);
const shortNote=plainMulti(500);
const workSummary=plainMulti(1000);
const safeKey=z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_.:-]+$/);

export const VendorAssignmentStatusSchema=z.enum(["PREPARING","OFFERED","ACTIVE","ENDED"]);
export const VendorAssignmentEndReasonSchema=z.enum(["DECLINED","WITHDRAWN","REVOKED","SUPERSEDED","CLOSED"]);
export const VendorAccessPolicySchema=z.enum(["TENANT_PRESENT_REQUIRED","TENANT_PREAUTHORIZATION_ALLOWED"]);
export const VendorSchedulingModeSchema=z.enum(["RESIDENT_CONFIRMATION_REQUIRED","PREAUTHORIZED_ENTRY_WINDOW"]);
export const VendorSchedulingPurposeSchema=z.enum(["INITIAL","RESCHEDULE","FOLLOW_UP"]);
export const VendorSchedulingRoundStatusSchema=z.enum(["OPEN","CONFIRMED","SUPERSEDED","CANCELLED"]);
export const VendorAppointmentStatusSchema=z.enum(["SCHEDULED","OCCURRED","SUPERSEDED","CANCELLED"]);
export const VendorDeclineReasonSchema=z.enum(["NO_CAPACITY","OUT_OF_SERVICE_AREA","SKILL_MISMATCH","CANNOT_MEET_TIMING","OTHER"]);
export const VendorBlockerCodeSchema=z.enum(["PARTS_REQUIRED","ACCESS_BLOCKED","SCOPE_REVIEW_REQUIRED","FOLLOW_UP_VISIT_REQUIRED","OTHER"]);
export const VendorSharedDetailSourceTypeSchema=z.enum(["TENANT_REPORTED","BUILDING_VERIFIED","MANAGER_REVIEWED"]);
export const VendorPhotoOmissionReasonSchema=z.enum(["NOT_APPLICABLE","SAFETY_OR_PRIVACY","TECHNICAL_FAILURE"]);
export const VendorAppointmentConfirmationModeSchema=z.enum(["TENANT_CONFIRMED","PREAUTHORIZED_ENTRY"]);
export const VendorManagerDispositionSchema=z.enum(["CLOSEOUT","REQUEST_CORRECTION","MORE_WORK"]);
export const VendorCompletionPhotoDispositionSchema=z.enum(["PENDING","ATTACHED","UNATTACHED_RETAINED"]);
export const VendorPhaseSchema=z.enum(["OFFERED","SCHEDULING","SCHEDULED","IN_PROGRESS","COMPLETION_REPORTED","ENDED"]);
export const VendorWaitingOnSchema=z.enum(["NONE","TENANT","VENDOR","MANAGER","PARTS"]);

export const VendorSharedDetailSchema=z.object({
  key:safeKey,label:plainSingle(120),value:plainMulti(500),sourceType:VendorSharedDetailSourceTypeSchema,
}).strict();

const WindowInputSchema=z.object({startAt:instant,endAt:instant}).strict().refine(v=>Date.parse(v.startAt)<Date.parse(v.endAt),{message:"startAt must precede endAt"});
const ProposalSlotInputSchema=WindowInputSchema;
const clientRequest={clientRequestId:uuid};
const assignmentGuard={expectedAssignmentVersion:version};
const packetGuard={expectedPacketRevisionId:uuid};
const roundGuard={expectedRoundVersion:version};

export const VendorCreateAssignmentCommandSchema=z.object({
  ...clientRequest,expectedTicketVersion:version,vendorLabel,
}).strict();

export const VendorPublishPacketCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,expectedPacketRevisionId:uuid.nullable(),
  workSummary,sharedDetailKeys:z.array(safeKey).max(50),allowedPhotoIds:z.array(uuid).max(20),
  accessPolicy:VendorAccessPolicySchema,accessInstruction:shortNote.nullable(),
}).strict();

export const VendorIssueLinkCommandSchema=z.object({...clientRequest,...assignmentGuard,...packetGuard}).strict();
export const VendorReissueLinkCommandSchema=z.object({...clientRequest,...assignmentGuard,...packetGuard}).strict();
export const VendorRevokeCommandSchema=z.object({...clientRequest,...assignmentGuard}).strict();
export const VendorReassignCommandSchema=z.object({...clientRequest,...assignmentGuard,vendorLabel}).strict();
export const VendorRequestCorrectionCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,expectedCompletionReportId:uuid,reason:shortNote,
}).strict();
export const VendorRequireFollowUpCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,expectedCompletionReportId:uuid,
}).strict();
export const VendorManagerRescheduleCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...roundGuard,expectedAppointmentId:uuid,...packetGuard,
}).strict();
export const VendorCloseoutCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,expectedCompletionReportId:uuid,expectedCommunicationVersion:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  message:CoreCommunicationBodySchema,
}).strict();

export const VendorAvailabilityCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...roundGuard,...packetGuard,
  windows:z.array(WindowInputSchema).min(1).max(5),
}).strict().superRefine((v,ctx)=>{
  const sorted=[...v.windows].sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
  for(let i=1;i<sorted.length;i++)if(Date.parse(sorted[i-1].endAt)>Date.parse(sorted[i].startAt))ctx.addIssue({code:"custom",message:"availability windows overlap",path:["windows",i]});
});

export const VendorEntryAuthorizationCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...roundGuard,...packetGuard,availabilitySubmissionId:uuid,
  selectedWindowIds:z.array(uuid).min(1).max(5).refine(v=>new Set(v).size===v.length),
}).strict();

export const VendorConfirmSlotCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...roundGuard,...packetGuard,proposalId:uuid,selectedSlotId:uuid,
}).strict();

export const VendorTenantRescheduleCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...roundGuard,expectedAppointmentId:uuid,...packetGuard,
}).strict();

export const VendorRedeemCommandSchema=z.object({...clientRequest}).strict();
export const VendorLogoutCommandSchema=z.object({...clientRequest}).strict();
export const VendorAcceptCommandSchema=z.object({...clientRequest,...assignmentGuard,...packetGuard}).strict();
export const VendorDeclineCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...packetGuard,reason:VendorDeclineReasonSchema,operationalNote:shortNote.nullable(),
}).strict();
export const VendorWithdrawCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...packetGuard,operationalNote:shortNote.nullable(),
}).strict();
export const VendorProposalCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...roundGuard,...packetGuard,slots:z.array(ProposalSlotInputSchema).min(1).max(5),
}).strict();
export const VendorPreauthorizedAppointmentCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...roundGuard,...packetGuard,availabilitySubmissionId:uuid,selectedWindowId:uuid,startAt:instant,endAt:instant,
}).strict().refine(v=>Date.parse(v.startAt)<Date.parse(v.endAt),{message:"startAt must precede endAt"});
export const VendorRescheduleCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...roundGuard,expectedAppointmentId:uuid,...packetGuard,
}).strict();
export const VendorVisitStartCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...roundGuard,...packetGuard,
}).strict();
export const VendorBlockerCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...packetGuard,blockerCode:VendorBlockerCodeSchema,operationalNote:shortNote.nullable(),
}).strict();
export const VendorClearBlockerCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...packetGuard,operationalNote:shortNote.nullable(),
}).strict();
export const VendorCompletionPhotoUploadCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...packetGuard,expectedAppointmentId:uuid,expectedCorrectionRequestId:uuid.nullable(),
}).strict();
export const VendorCompletionReportCommandSchema=z.object({
  ...clientRequest,...assignmentGuard,...packetGuard,expectedAppointmentId:uuid,expectedCorrectionRequestId:uuid.nullable(),
  supersedesReportId:uuid.nullable(),workSummary,componentOrPartNote:shortNote.nullable(),
  completionPhotoIds:z.array(uuid).max(5).refine(v=>new Set(v).size===v.length),
  photoOmissionReason:VendorPhotoOmissionReasonSchema.nullable(),
}).strict().superRefine((v,ctx)=>{
  const hasPhotos=v.completionPhotoIds.length>=1&&v.completionPhotoIds.length<=5;
  const hasOmission=v.photoOmissionReason!==null;
  if(hasPhotos===hasOmission)ctx.addIssue({code:"custom",message:"provide photos xor omission reason",path:["completionPhotoIds"]});
});

export const VendorCommandSchemas={
  VendorCreateAssignmentCommand:VendorCreateAssignmentCommandSchema,
  VendorPublishPacketCommand:VendorPublishPacketCommandSchema,
  VendorIssueLinkCommand:VendorIssueLinkCommandSchema,
  VendorReissueLinkCommand:VendorReissueLinkCommandSchema,
  VendorRevokeCommand:VendorRevokeCommandSchema,
  VendorReassignCommand:VendorReassignCommandSchema,
  VendorRequestCorrectionCommand:VendorRequestCorrectionCommandSchema,
  VendorRequireFollowUpCommand:VendorRequireFollowUpCommandSchema,
  VendorManagerRescheduleCommand:VendorManagerRescheduleCommandSchema,
  VendorCloseoutCommand:VendorCloseoutCommandSchema,
  VendorAvailabilityCommand:VendorAvailabilityCommandSchema,
  VendorEntryAuthorizationCommand:VendorEntryAuthorizationCommandSchema,
  VendorConfirmSlotCommand:VendorConfirmSlotCommandSchema,
  VendorTenantRescheduleCommand:VendorTenantRescheduleCommandSchema,
  VendorRedeemCommand:VendorRedeemCommandSchema,
  VendorLogoutCommand:VendorLogoutCommandSchema,
  VendorAcceptCommand:VendorAcceptCommandSchema,
  VendorDeclineCommand:VendorDeclineCommandSchema,
  VendorWithdrawCommand:VendorWithdrawCommandSchema,
  VendorProposalCommand:VendorProposalCommandSchema,
  VendorPreauthorizedAppointmentCommand:VendorPreauthorizedAppointmentCommandSchema,
  VendorRescheduleCommand:VendorRescheduleCommandSchema,
  VendorVisitStartCommand:VendorVisitStartCommandSchema,
  VendorBlockerCommand:VendorBlockerCommandSchema,
  VendorClearBlockerCommand:VendorClearBlockerCommandSchema,
  VendorCompletionPhotoUploadCommand:VendorCompletionPhotoUploadCommandSchema,
  VendorCompletionReportCommand:VendorCompletionReportCommandSchema,
} as const;

type MatrixSchema=keyof typeof VendorCommandSchemas;
type MatrixRow={schema:MatrixSchema;actor:"Manager"|"Tenant"|"Vendor";method:string;route:string;staleStateFields:readonly string[];durableResult:string};
const row=(schema:MatrixSchema,actor:MatrixRow["actor"],method:string,route:string,staleStateFields:string[],durableResult:string):MatrixRow=>({
  schema,actor,method,route,staleStateFields:["clientRequestId",...staleStateFields],durableResult,
});
export const VendorCommandMatrix:readonly MatrixRow[]=[
  row("VendorCreateAssignmentCommand","Manager","manager.createAssignment","POST /api/v2/core/manager/tickets/:ticketId/vendor-assignment",["expectedTicketVersion"],"PREPARING assignment"),
  row("VendorPublishPacketCommand","Manager","manager.publishPacket","POST /api/v2/core/manager/vendor-assignments/:assignmentId/packet-revisions",["expectedAssignmentVersion","expectedPacketRevisionId"],"immutable current packet revision"),
  row("VendorIssueLinkCommand","Manager","manager.issueLink","POST /api/v2/core/manager/vendor-assignments/:assignmentId/link",["expectedAssignmentVersion","expectedPacketRevisionId"],"OFFERED capability"),
  row("VendorReissueLinkCommand","Manager","manager.reissueLink","POST /api/v2/core/manager/vendor-assignments/:assignmentId/link/reissue",["expectedAssignmentVersion","expectedPacketRevisionId"],"replacement capability"),
  row("VendorRevokeCommand","Manager","manager.revoke","POST /api/v2/core/manager/vendor-assignments/:assignmentId/revoke",["expectedAssignmentVersion"],"ENDED/REVOKED"),
  row("VendorReassignCommand","Manager","manager.reassign","POST /api/v2/core/manager/vendor-assignments/:assignmentId/reassign",["expectedAssignmentVersion"],"ENDED/SUPERSEDED + PREPARING"),
  row("VendorRequestCorrectionCommand","Manager","manager.requestCorrection","POST /api/v2/core/manager/vendor-assignments/:assignmentId/completion-correction",["expectedAssignmentVersion","expectedCompletionReportId"],"durable correction request"),
  row("VendorRequireFollowUpCommand","Manager","manager.requireFollowUp","POST /api/v2/core/manager/vendor-assignments/:assignmentId/follow-up",["expectedAssignmentVersion","expectedCompletionReportId"],"FOLLOW_UP round"),
  row("VendorManagerRescheduleCommand","Manager","manager.reschedule","POST /api/v2/core/manager/vendor-assignments/:assignmentId/reschedule",["expectedAssignmentVersion","expectedRoundVersion","expectedAppointmentId","expectedPacketRevisionId"],"RESCHEDULE round"),
  row("VendorCloseoutCommand","Manager","manager.closeout","POST /api/v2/core/manager/vendor-assignments/:assignmentId/closeout",["expectedAssignmentVersion","expectedCompletionReportId","expectedCommunicationVersion"],"ticket COMPLETED + assignment ENDED/CLOSED"),
  row("VendorAvailabilityCommand","Tenant","tenant.submitAvailability","POST /api/v2/core/tickets/:ticketId/vendor-scheduling/availability",["expectedAssignmentVersion","expectedRoundVersion","expectedPacketRevisionId"],"availability submission"),
  row("VendorEntryAuthorizationCommand","Tenant","tenant.authorizeEntry","POST /api/v2/core/tickets/:ticketId/vendor-scheduling/entry-authorization",["expectedAssignmentVersion","expectedRoundVersion","expectedPacketRevisionId","availabilitySubmissionId"],"selected-window authorization"),
  row("VendorConfirmSlotCommand","Tenant","tenant.confirmSlot","POST /api/v2/core/tickets/:ticketId/vendor-scheduling/confirm",["expectedAssignmentVersion","expectedRoundVersion","expectedPacketRevisionId","proposalId"],"TENANT_CONFIRMED Appointment"),
  row("VendorTenantRescheduleCommand","Tenant","tenant.reschedule","POST /api/v2/core/tickets/:ticketId/vendor-scheduling/reschedule",["expectedAssignmentVersion","expectedRoundVersion","expectedAppointmentId","expectedPacketRevisionId"],"RESCHEDULE round"),
  row("VendorRedeemCommand","Vendor","external.redeem","POST /api/v2/vendor/session/redeem",[],"vendor session / exact-replay replacement"),
  row("VendorLogoutCommand","Vendor","external.logout","POST /api/v2/vendor/session/logout",[],"idempotent session revocation"),
  row("VendorAcceptCommand","Vendor","external.accept","POST /api/v2/vendor/job/accept",["expectedAssignmentVersion","expectedPacketRevisionId"],"ACTIVE + INITIAL round"),
  row("VendorDeclineCommand","Vendor","external.decline","POST /api/v2/vendor/job/decline",["expectedAssignmentVersion","expectedPacketRevisionId"],"ENDED/DECLINED"),
  row("VendorWithdrawCommand","Vendor","external.withdraw","POST /api/v2/vendor/job/withdraw",["expectedAssignmentVersion","expectedPacketRevisionId"],"ENDED/WITHDRAWN"),
  row("VendorProposalCommand","Vendor","external.proposeSlots","POST /api/v2/vendor/scheduling/proposals",["expectedAssignmentVersion","expectedRoundVersion","expectedPacketRevisionId"],"1-5 proposal slots"),
  row("VendorPreauthorizedAppointmentCommand","Vendor","external.selectPreauthorizedSlot","POST /api/v2/vendor/scheduling/preauthorized-appointment",["expectedAssignmentVersion","expectedRoundVersion","expectedPacketRevisionId","availabilitySubmissionId","selectedWindowId"],"PREAUTHORIZED_ENTRY Appointment"),
  row("VendorRescheduleCommand","Vendor","external.reschedule","POST /api/v2/vendor/scheduling/reschedule",["expectedAssignmentVersion","expectedRoundVersion","expectedAppointmentId","expectedPacketRevisionId"],"RESCHEDULE round"),
  row("VendorVisitStartCommand","Vendor","external.startVisit","POST /api/v2/vendor/appointments/:appointmentId/visit-start",["expectedAssignmentVersion","expectedRoundVersion","expectedPacketRevisionId"],"Appointment OCCURRED + VISIT_STARTED"),
  row("VendorBlockerCommand","Vendor","external.recordBlocker","POST /api/v2/vendor/blockers",["expectedAssignmentVersion","expectedPacketRevisionId"],"append-only blocker evidence"),
  row("VendorClearBlockerCommand","Vendor","external.clearBlocker","POST /api/v2/vendor/blockers/:blockerId/clear",["expectedAssignmentVersion","expectedPacketRevisionId"],"append-only clear evidence"),
  row("VendorCompletionPhotoUploadCommand","Vendor","external.uploadCompletionPhoto","POST /api/v2/vendor/job/completion-photos",["expectedAssignmentVersion","expectedPacketRevisionId","expectedAppointmentId","expectedCorrectionRequestId"],"sanitized durable photo + safe receipt"),
  row("VendorCompletionReportCommand","Vendor","external.submitCompletionReport","POST /api/v2/vendor/completion-reports",["expectedAssignmentVersion","expectedPacketRevisionId","expectedAppointmentId","expectedCorrectionRequestId"],"append-only current report revision"),
];

export const VendorWorkPacketRevisionDtoSchema=z.object({
  id:uuid,assignmentId:uuid,jobReference:plainSingle(80),vendorLabel,
  revision:version,publishedAt:instant,buildingName:plainSingle(200),serviceAddress:plainMulti(500),unitLabel:plainSingle(80),
  issueType:z.enum(["HEATING","LEAK"]),workSummary,sharedDetails:z.array(VendorSharedDetailSchema),
  allowedPhotoIds:z.array(uuid),accessPolicy:VendorAccessPolicySchema,accessInstruction:shortNote.nullable(),
}).strict();
export const VendorSchedulingRoundDtoSchema=z.object({
  id:uuid,openedPacketRevisionId:uuid,purpose:VendorSchedulingPurposeSchema,status:VendorSchedulingRoundStatusSchema,version,createdAt:instant,
}).strict();
export const VendorAppointmentDtoSchema=z.object({
  id:uuid,schedulingRoundId:uuid,packetRevisionId:uuid,proposalId:uuid.nullable(),availabilitySubmissionId:uuid.nullable(),selectedWindowId:uuid.nullable(),
  startAt:instant,endAt:instant,confirmationMode:VendorAppointmentConfirmationModeSchema,status:VendorAppointmentStatusSchema,createdAt:instant,
}).strict().refine(v=>Date.parse(v.startAt)<Date.parse(v.endAt));
export const VendorBlockerDtoSchema=z.object({
  id:uuid,code:VendorBlockerCodeSchema,note:shortNote.nullable(),active:z.boolean(),createdAt:instant,clearedAt:instant.nullable(),
}).strict();
export const VendorCompletionPhotoDtoSchema=z.object({
  photoId:uuid,mime:z.enum(["image/jpeg","image/png"]),byteSize:z.number().int().positive(),width:z.number().int().positive(),height:z.number().int().positive(),createdAt:instant,
}).strict();
export const VendorCompletionReportDtoSchema=z.object({
  id:uuid,assignmentId:uuid,appointmentId:uuid,packetRevisionId:uuid,revision:version,supersedesReportId:uuid.nullable(),
  workSummary,componentOrPartNote:shortNote.nullable(),completionPhotoIds:z.array(uuid).max(5),
  photoOmissionReason:VendorPhotoOmissionReasonSchema.nullable(),submittedAt:instant,
}).strict();
export const VendorSessionDtoSchema=z.object({assignmentId:uuid,expiresAt:instant}).strict();
export const VendorLinkIssueDtoSchema=z.object({assignmentId:uuid,assignmentVersion:version,link:z.string().trim().min(1),expiresAt:instant}).strict();

const ManagerAssignmentDtoSchema=z.object({
  id:uuid,status:VendorAssignmentStatusSchema,endReason:VendorAssignmentEndReasonSchema.nullable(),vendorLabel,version,
}).strict();
export const ManagerVendorHandoffDtoSchema=z.object({
  ticketId:uuid,assignment:ManagerAssignmentDtoSchema.nullable(),currentPacket:VendorWorkPacketRevisionDtoSchema.nullable(),
  currentRound:VendorSchedulingRoundDtoSchema.nullable(),appointment:VendorAppointmentDtoSchema.nullable(),activeBlocker:VendorBlockerDtoSchema.nullable(),
  currentReport:VendorCompletionReportDtoSchema.nullable(),reportHistory:z.array(VendorCompletionReportDtoSchema),
  phase:VendorPhaseSchema,waitingOn:VendorWaitingOnSchema,
}).strict();
export const VendorTenantSchedulingDtoSchema=z.object({
  ticketId:uuid,assignmentVersion:version,packetRevisionId:uuid,effectiveMode:VendorSchedulingModeSchema,
  phase:VendorPhaseSchema,waitingOn:VendorWaitingOnSchema,currentRound:VendorSchedulingRoundDtoSchema.nullable(),appointment:VendorAppointmentDtoSchema.nullable(),
}).strict();
export const VendorJobDtoSchema=z.object({
  assignmentId:uuid,status:VendorAssignmentStatusSchema,endReason:VendorAssignmentEndReasonSchema.nullable(),
  phase:VendorPhaseSchema,waitingOn:VendorWaitingOnSchema,currentPacket:VendorWorkPacketRevisionDtoSchema.nullable(),
  currentRound:VendorSchedulingRoundDtoSchema.nullable(),appointment:VendorAppointmentDtoSchema.nullable(),activeBlocker:VendorBlockerDtoSchema.nullable(),
  currentReport:VendorCompletionReportDtoSchema.nullable(),
}).strict();

export type VendorAssignmentStatus=z.infer<typeof VendorAssignmentStatusSchema>;
export type VendorAssignmentEndReason=z.infer<typeof VendorAssignmentEndReasonSchema>;
export type VendorAccessPolicy=z.infer<typeof VendorAccessPolicySchema>;
export type VendorSchedulingMode=z.infer<typeof VendorSchedulingModeSchema>;
export type VendorSchedulingPurpose=z.infer<typeof VendorSchedulingPurposeSchema>;
export type VendorSchedulingRoundStatus=z.infer<typeof VendorSchedulingRoundStatusSchema>;
export type VendorAppointmentStatus=z.infer<typeof VendorAppointmentStatusSchema>;
export type VendorDeclineReason=z.infer<typeof VendorDeclineReasonSchema>;
export type VendorBlockerCode=z.infer<typeof VendorBlockerCodeSchema>;
export type VendorSharedDetailSourceType=z.infer<typeof VendorSharedDetailSourceTypeSchema>;
export type VendorPhotoOmissionReason=z.infer<typeof VendorPhotoOmissionReasonSchema>;
export type VendorAppointmentConfirmationMode=z.infer<typeof VendorAppointmentConfirmationModeSchema>;
export type VendorManagerDisposition=z.infer<typeof VendorManagerDispositionSchema>;

export type VendorCreateAssignmentCommand=z.infer<typeof VendorCreateAssignmentCommandSchema>;
export type VendorPublishPacketCommand=z.infer<typeof VendorPublishPacketCommandSchema>;
export type VendorIssueLinkCommand=z.infer<typeof VendorIssueLinkCommandSchema>;
export type VendorReissueLinkCommand=z.infer<typeof VendorReissueLinkCommandSchema>;
export type VendorRevokeCommand=z.infer<typeof VendorRevokeCommandSchema>;
export type VendorReassignCommand=z.infer<typeof VendorReassignCommandSchema>;
export type VendorRequestCorrectionCommand=z.infer<typeof VendorRequestCorrectionCommandSchema>;
export type VendorRequireFollowUpCommand=z.infer<typeof VendorRequireFollowUpCommandSchema>;
export type VendorManagerRescheduleCommand=z.infer<typeof VendorManagerRescheduleCommandSchema>;
export type VendorCloseoutCommand=z.infer<typeof VendorCloseoutCommandSchema>;
export type VendorAvailabilityCommand=z.infer<typeof VendorAvailabilityCommandSchema>;
export type VendorEntryAuthorizationCommand=z.infer<typeof VendorEntryAuthorizationCommandSchema>;
export type VendorConfirmSlotCommand=z.infer<typeof VendorConfirmSlotCommandSchema>;
export type VendorTenantRescheduleCommand=z.infer<typeof VendorTenantRescheduleCommandSchema>;
export type VendorRedeemCommand=z.infer<typeof VendorRedeemCommandSchema>;
export type VendorLogoutCommand=z.infer<typeof VendorLogoutCommandSchema>;
export type VendorAcceptCommand=z.infer<typeof VendorAcceptCommandSchema>;
export type VendorDeclineCommand=z.infer<typeof VendorDeclineCommandSchema>;
export type VendorWithdrawCommand=z.infer<typeof VendorWithdrawCommandSchema>;
export type VendorProposalCommand=z.infer<typeof VendorProposalCommandSchema>;
export type VendorPreauthorizedAppointmentCommand=z.infer<typeof VendorPreauthorizedAppointmentCommandSchema>;
export type VendorRescheduleCommand=z.infer<typeof VendorRescheduleCommandSchema>;
export type VendorVisitStartCommand=z.infer<typeof VendorVisitStartCommandSchema>;
export type VendorBlockerCommand=z.infer<typeof VendorBlockerCommandSchema>;
export type VendorClearBlockerCommand=z.infer<typeof VendorClearBlockerCommandSchema>;
export type VendorCompletionPhotoUploadCommand=z.infer<typeof VendorCompletionPhotoUploadCommandSchema>;
export type VendorCompletionReportCommand=z.infer<typeof VendorCompletionReportCommandSchema>;

export type ManagerVendorHandoffDto=z.infer<typeof ManagerVendorHandoffDtoSchema>;
export type TenantVendorSchedulingDto=z.infer<typeof VendorTenantSchedulingDtoSchema>;
export type VendorJobDto=z.infer<typeof VendorJobDtoSchema>;
export type VendorSessionDto=z.infer<typeof VendorSessionDtoSchema>;
export type VendorLinkIssueDto=z.infer<typeof VendorLinkIssueDtoSchema>;
export type VendorCompletionReportDto=z.infer<typeof VendorCompletionReportDtoSchema>;
export type VendorCompletionPhotoDto=z.infer<typeof VendorCompletionPhotoDtoSchema>;
