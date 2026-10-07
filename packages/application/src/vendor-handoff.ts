export type VendorAssignmentStatus="PREPARING"|"OFFERED"|"ACTIVE"|"ENDED";
export type VendorAssignmentEndReason="DECLINED"|"WITHDRAWN"|"REVOKED"|"SUPERSEDED"|"CLOSED";
export type VendorAccessPolicy="TENANT_PRESENT_REQUIRED"|"TENANT_PREAUTHORIZATION_ALLOWED";
export type VendorSchedulingMode="RESIDENT_CONFIRMATION_REQUIRED"|"PREAUTHORIZED_ENTRY_WINDOW";
export type VendorSchedulingPurpose="INITIAL"|"RESCHEDULE"|"FOLLOW_UP";
export type VendorSchedulingRoundStatus="OPEN"|"CONFIRMED"|"SUPERSEDED"|"CANCELLED";
export type VendorAppointmentStatus="SCHEDULED"|"OCCURRED"|"SUPERSEDED"|"CANCELLED";
export type VendorDeclineReason="NO_CAPACITY"|"OUT_OF_SERVICE_AREA"|"SKILL_MISMATCH"|"CANNOT_MEET_TIMING"|"OTHER";
export type VendorBlockerCode="PARTS_REQUIRED"|"ACCESS_BLOCKED"|"SCOPE_REVIEW_REQUIRED"|"FOLLOW_UP_VISIT_REQUIRED"|"OTHER";
export type VendorPhotoOmissionReason="NOT_APPLICABLE"|"SAFETY_OR_PRIVACY"|"TECHNICAL_FAILURE";
export type VendorManagerDisposition="CLOSEOUT"|"REQUEST_CORRECTION"|"MORE_WORK";

type RequestIdentity={clientRequestId:string};
type AssignmentGuard={expectedAssignmentVersion:number};
type PacketGuard={expectedPacketRevisionId:string};
type RoundGuard={expectedRoundVersion:number};

export type VendorCreateAssignmentCommand=RequestIdentity&{expectedTicketVersion:number;vendorLabel:string};
export type VendorPublishPacketCommand=RequestIdentity&AssignmentGuard&{
  expectedPacketRevisionId:string|null;workSummary:string;sharedDetailKeys:string[];allowedPhotoIds:string[];
  accessPolicy:VendorAccessPolicy;accessInstruction:string|null;
};
export type VendorIssueLinkCommand=RequestIdentity&AssignmentGuard&PacketGuard;
export type VendorReissueLinkCommand=VendorIssueLinkCommand;
export type VendorRevokeCommand=RequestIdentity&AssignmentGuard;
export type VendorReassignCommand=RequestIdentity&AssignmentGuard&{vendorLabel:string};
export type VendorRequestCorrectionCommand=RequestIdentity&AssignmentGuard&{expectedCompletionReportId:string;reason:string};
export type VendorRequireFollowUpCommand=RequestIdentity&AssignmentGuard&{expectedCompletionReportId:string};
export type VendorManagerRescheduleCommand=RequestIdentity&AssignmentGuard&RoundGuard&PacketGuard&{expectedAppointmentId:string};
export type VendorCloseoutCommand=RequestIdentity&AssignmentGuard&{expectedCompletionReportId:string;expectedCommunicationVersion:number;message:string};

export type VendorAvailabilityWindowInput={startAt:string;endAt:string};
export type VendorAvailabilityCommand=RequestIdentity&AssignmentGuard&RoundGuard&PacketGuard&{windows:VendorAvailabilityWindowInput[]};
export type VendorEntryAuthorizationCommand=RequestIdentity&AssignmentGuard&RoundGuard&PacketGuard&{availabilitySubmissionId:string;selectedWindowIds:string[]};
export type VendorConfirmSlotCommand=RequestIdentity&AssignmentGuard&RoundGuard&PacketGuard&{proposalId:string;selectedSlotId:string};
export type VendorTenantRescheduleCommand=RequestIdentity&AssignmentGuard&RoundGuard&PacketGuard&{expectedAppointmentId:string};

export type VendorRedeemCommand=RequestIdentity;
export type VendorLogoutCommand=RequestIdentity;
export type VendorAcceptCommand=RequestIdentity&AssignmentGuard&PacketGuard;
export type VendorDeclineCommand=RequestIdentity&AssignmentGuard&PacketGuard&{reason:VendorDeclineReason;operationalNote:string|null};
export type VendorWithdrawCommand=RequestIdentity&AssignmentGuard&PacketGuard&{operationalNote:string|null};
export type VendorProposalCommand=RequestIdentity&AssignmentGuard&RoundGuard&PacketGuard&{slots:VendorAvailabilityWindowInput[]};
export type VendorPreauthorizedAppointmentCommand=RequestIdentity&AssignmentGuard&RoundGuard&PacketGuard&{
  availabilitySubmissionId:string;selectedWindowId:string;startAt:string;endAt:string;
};
export type VendorRescheduleCommand=RequestIdentity&AssignmentGuard&RoundGuard&PacketGuard&{expectedAppointmentId:string};
export type VendorVisitStartCommand=RequestIdentity&AssignmentGuard&RoundGuard&PacketGuard;
export type VendorBlockerCommand=RequestIdentity&AssignmentGuard&PacketGuard&{blockerCode:VendorBlockerCode;operationalNote:string|null};
export type VendorClearBlockerCommand=RequestIdentity&AssignmentGuard&PacketGuard&{operationalNote:string|null};
export type VendorCompletionPhotoUploadCommand=RequestIdentity&AssignmentGuard&PacketGuard&{
  expectedAppointmentId:string;expectedCorrectionRequestId:string|null;
};
export type VendorCompletionReportCommand=RequestIdentity&AssignmentGuard&PacketGuard&{
  expectedAppointmentId:string;expectedCorrectionRequestId:string|null;supersedesReportId:string|null;
  workSummary:string;componentOrPartNote:string|null;completionPhotoIds:string[];photoOmissionReason:VendorPhotoOmissionReason|null;
};

export type VendorSharedDetail={key:string;label:string;value:string;sourceType:"TENANT_REPORTED"|"BUILDING_VERIFIED"|"MANAGER_REVIEWED"};
export type VendorWorkPacketRevisionDto={
  id:string;assignmentId:string;jobReference:string;vendorLabel:string;revision:number;publishedAt:string;
  buildingName:string;serviceAddress:string;unitLabel:string;issueType:"HEATING"|"LEAK";workSummary:string;
  sharedDetails:VendorSharedDetail[];allowedPhotoIds:string[];safetyNotice:string[];accessPolicy:VendorAccessPolicy;accessInstruction:string|null;
};
export type VendorSchedulingRoundDto={id:string;openedPacketRevisionId:string;purpose:VendorSchedulingPurpose;status:VendorSchedulingRoundStatus;version:number;createdAt:string};
export type VendorAppointmentDto={
  id:string;schedulingRoundId:string;packetRevisionId:string;proposalId:string|null;availabilitySubmissionId:string|null;selectedWindowId:string|null;
  startAt:string;endAt:string;confirmationMode:"TENANT_CONFIRMED"|"PREAUTHORIZED_ENTRY";status:VendorAppointmentStatus;createdAt:string;
};
export type VendorBlockerDto={id:string;code:VendorBlockerCode;note:string|null;active:boolean;createdAt:string;clearedAt:string|null};
export type VendorCompletionPhotoDto={photoId:string;mime:"image/jpeg"|"image/png";byteSize:number;width:number;height:number;createdAt:string};
export type VendorCompletionReportDto={
  id:string;assignmentId:string;appointmentId:string;packetRevisionId:string;revision:number;supersedesReportId:string|null;
  workSummary:string;componentOrPartNote:string|null;completionPhotoIds:string[];photoOmissionReason:VendorPhotoOmissionReason|null;submittedAt:string;
};
export type VendorPhase="OFFERED"|"SCHEDULING"|"SCHEDULED"|"IN_PROGRESS"|"COMPLETION_REPORTED"|"ENDED";
export type VendorWaitingOn="NONE"|"TENANT"|"VENDOR"|"MANAGER"|"PARTS";
/** Authenticated Manager candidates only; never included in the external Vendor DTO. */
export type VendorManagerPacketSource={jobReference:string;buildingName:string;serviceAddress:string|null;unitLabel:string|null;issueType:"HEATING"|"LEAK";sharedDetails:VendorSharedDetail[];sourcePhotoIds:string[];safetyNotice:string[]};
export type ManagerVendorHandoffDto={
  ticketId:string;assignment:{id:string;status:VendorAssignmentStatus;endReason:VendorAssignmentEndReason|null;vendorLabel:string;version:number}|null;
  currentPacket:VendorWorkPacketRevisionDto|null;currentRound:VendorSchedulingRoundDto|null;appointment:VendorAppointmentDto|null;
  activeBlocker:VendorBlockerDto|null;currentReport:VendorCompletionReportDto|null;reportHistory:VendorCompletionReportDto[];phase:VendorPhase;waitingOn:VendorWaitingOn;
  packetSource?:VendorManagerPacketSource;
};
export type VendorScheduledWindowDto={id:string;startAt:string;endAt:string};
export type VendorAvailabilityDto={id:string;windows:VendorScheduledWindowDto[];authorizedWindowIds:string[];createdAt:string};
export type VendorProposalDto={id:string;slots:VendorScheduledWindowDto[];createdAt:string};
export type TenantVendorSchedulingDto={
  ticketId:string;assignmentVersion:number;packetRevisionId:string;effectiveMode:VendorSchedulingMode;phase:VendorPhase;waitingOn:VendorWaitingOn;
  currentRound:VendorSchedulingRoundDto|null;appointment:VendorAppointmentDto|null;
  accessPolicy:VendorAccessPolicy;availability:VendorAvailabilityDto|null;proposal:VendorProposalDto|null;
};
export type VendorJobDto={
  assignmentId:string;assignmentVersion:number;status:VendorAssignmentStatus;endReason:VendorAssignmentEndReason|null;phase:VendorPhase;waitingOn:VendorWaitingOn;
  currentPacket:VendorWorkPacketRevisionDto|null;currentRound:VendorSchedulingRoundDto|null;appointment:VendorAppointmentDto|null;
  activeBlocker:VendorBlockerDto|null;currentReport:VendorCompletionReportDto|null;
  effectiveMode:VendorSchedulingMode|null;availability:VendorAvailabilityDto|null;proposal:VendorProposalDto|null;
};
export type VendorSessionDto={assignmentId:string;expiresAt:string};
export type VendorSourcePhotoDto={photoId:string;mime:"image/jpeg"|"image/png";byteSize:number;width:number;height:number};
export type VendorLinkIssueDto={assignmentId:string;assignmentVersion:number;expiresAt:string}&(
  {created:true;link:string}|{created:false;link?:never}
);
export type SanitizedVendorPhoto={
  bytes:Uint8Array;mime:"image/jpeg"|"image/png";byteSize:number;width:number;height:number;sha256:string;
};

export type VendorHandoffErrorCode="UNAUTHENTICATED"|"FORBIDDEN"|"NOT_FOUND"|"INVALID_INPUT"|"STATE_CONFLICT"|"DEPENDENCY_UNAVAILABLE";
export class VendorHandoffError extends Error{
  readonly code:VendorHandoffErrorCode;
  constructor(code:VendorHandoffErrorCode,message:string=code){super(message);this.name="VendorHandoffError";this.code=code;}
}

export function reconcileVendorRequestFingerprint(existing:string,incoming:string):string{
  if(existing!==incoming)throw new VendorHandoffError("STATE_CONFLICT","Request key was replayed with a different fingerprint");
  return existing;
}
export function redeemVendorSessionState(status:VendorAssignmentStatus):VendorAssignmentStatus{
  if(status!=="OFFERED"&&status!=="ACTIVE")throw new VendorHandoffError("STATE_CONFLICT","Assignment cannot redeem vendor access");
  return status;
}
export function vendorDispositionEffect(kind:VendorManagerDisposition):"CLOSEOUT"|"REPORT_CORRECTION"|"FOLLOW_UP_WORK"{
  if(kind==="REQUEST_CORRECTION")return "REPORT_CORRECTION";
  if(kind==="MORE_WORK")return "FOLLOW_UP_WORK";
  return "CLOSEOUT";
}
export function assertVendorAssignmentTransition(from:VendorAssignmentStatus,to:VendorAssignmentStatus,endReason:VendorAssignmentEndReason|null):void{
  if(to!=="ENDED"&&endReason!==null)throw new VendorHandoffError("STATE_CONFLICT","Only ENDED assignments carry an end reason");
  if(to==="ENDED"&&endReason===null)throw new VendorHandoffError("STATE_CONFLICT","ENDED assignment requires an end reason");
  if(from==="PREPARING"&&to==="OFFERED"&&endReason===null)return;
  if(from==="OFFERED"&&to==="ACTIVE"&&endReason===null)return;
  const ended:Record<Exclude<VendorAssignmentStatus,"ENDED">,readonly VendorAssignmentEndReason[]>={
    PREPARING:["REVOKED","SUPERSEDED"],
    OFFERED:["DECLINED","REVOKED","SUPERSEDED"],
    ACTIVE:["WITHDRAWN","REVOKED","SUPERSEDED","CLOSED"],
  };
  if(from!=="ENDED"&&to==="ENDED"&&endReason!==null&&ended[from].includes(endReason))return;
  throw new VendorHandoffError("STATE_CONFLICT",`Invalid VendorAssignment transition ${from} -> ${to}`);
}

export type VendorHandoffManagerPort={
  readHandoff(digest:string,ticketId:string):Promise<ManagerVendorHandoffDto>;
  createAssignment(digest:string,ticketId:string,input:VendorCreateAssignmentCommand):Promise<ManagerVendorHandoffDto>;
  publishPacket(digest:string,assignmentId:string,input:VendorPublishPacketCommand):Promise<ManagerVendorHandoffDto>;
  issueLink(digest:string,assignmentId:string,input:VendorIssueLinkCommand):Promise<VendorLinkIssueDto>;
  reissueLink(digest:string,assignmentId:string,input:VendorReissueLinkCommand):Promise<VendorLinkIssueDto>;
  revoke(digest:string,assignmentId:string,input:VendorRevokeCommand):Promise<ManagerVendorHandoffDto>;
  reassign(digest:string,assignmentId:string,input:VendorReassignCommand):Promise<ManagerVendorHandoffDto>;
  requestCorrection(digest:string,assignmentId:string,input:VendorRequestCorrectionCommand):Promise<ManagerVendorHandoffDto>;
  requireFollowUp(digest:string,assignmentId:string,input:VendorRequireFollowUpCommand):Promise<ManagerVendorHandoffDto>;
  reschedule(digest:string,assignmentId:string,input:VendorManagerRescheduleCommand):Promise<ManagerVendorHandoffDto>;
  closeout(digest:string,assignmentId:string,input:VendorCloseoutCommand):Promise<ManagerVendorHandoffDto>;
  completionPhoto(digest:string,ticketId:string,photoId:string):Promise<{photo:VendorCompletionPhotoDto;bytes:Uint8Array}>;
};
export type VendorHandoffTenantPort={
  readScheduling(digest:string,ticketId:string):Promise<TenantVendorSchedulingDto>;
  submitAvailability(digest:string,ticketId:string,input:VendorAvailabilityCommand):Promise<TenantVendorSchedulingDto>;
  authorizeEntry(digest:string,ticketId:string,input:VendorEntryAuthorizationCommand):Promise<TenantVendorSchedulingDto>;
  confirmSlot(digest:string,ticketId:string,input:VendorConfirmSlotCommand):Promise<TenantVendorSchedulingDto>;
  reschedule(digest:string,ticketId:string,input:VendorTenantRescheduleCommand):Promise<TenantVendorSchedulingDto>;
};
export type VendorHandoffExternalPort={
  redeem(tokenDigest:string,clientRequestId:string,sessionDigest:string,csrfDigest:string):Promise<VendorSessionDto>;
  logout(sessionDigest:string,clientRequestId:string):Promise<{revoked:boolean}>;
  session(sessionDigest:string):Promise<VendorSessionDto>;
  /** Rotates the stored CSRF digest to a fresh server-issued value; never extends the absolute session expiry. */
  refreshSession(sessionDigest:string,csrfDigest:string):Promise<VendorSessionDto>;
  readJob(sessionDigest:string):Promise<VendorJobDto>;
  /** Current published packet allowlist only; every other photo ID is the same hidden NOT_FOUND. */
  readSourcePhoto(sessionDigest:string,photoId:string):Promise<{photo:VendorSourcePhotoDto;bytes:Uint8Array}>;
  accept(sessionDigest:string,input:VendorAcceptCommand):Promise<VendorJobDto>;
  decline(sessionDigest:string,input:VendorDeclineCommand):Promise<VendorJobDto>;
  withdraw(sessionDigest:string,input:VendorWithdrawCommand):Promise<VendorJobDto>;
  proposeSlots(sessionDigest:string,input:VendorProposalCommand):Promise<VendorJobDto>;
  selectPreauthorizedSlot(sessionDigest:string,input:VendorPreauthorizedAppointmentCommand):Promise<VendorJobDto>;
  reschedule(sessionDigest:string,input:VendorRescheduleCommand):Promise<VendorJobDto>;
  startVisit(sessionDigest:string,appointmentId:string,input:VendorVisitStartCommand):Promise<VendorJobDto>;
  recordBlocker(sessionDigest:string,input:VendorBlockerCommand):Promise<VendorJobDto>;
  clearBlocker(sessionDigest:string,blockerId:string,input:VendorClearBlockerCommand):Promise<VendorJobDto>;
  uploadCompletionPhoto(sessionDigest:string,input:VendorCompletionPhotoUploadCommand,sanitized:SanitizedVendorPhoto):Promise<VendorCompletionPhotoDto>;
  submitCompletionReport(sessionDigest:string,input:VendorCompletionReportCommand):Promise<VendorCompletionReportDto>;
};
