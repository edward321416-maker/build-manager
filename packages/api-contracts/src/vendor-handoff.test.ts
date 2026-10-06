import { describe,expect,it } from "vitest";
import {
  VendorAccessPolicySchema,
  VendorAppointmentConfirmationModeSchema,
  VendorAppointmentStatusSchema,
  VendorAssignmentEndReasonSchema,
  VendorAssignmentStatusSchema,
  VendorBlockerCodeSchema,
  VendorCommandMatrix,
  VendorCommandSchemas,
  VendorCompletionPhotoUploadCommandSchema,
  VendorCompletionReportCommandSchema,
  VendorCreateAssignmentCommandSchema,
  VendorDeclineReasonSchema,
  VendorManagerDispositionSchema,
  VendorPhotoOmissionReasonSchema,
  VendorProposalCommandSchema,
  VendorPublishPacketCommandSchema,
  VendorRequestCorrectionCommandSchema,
  VendorSchedulingModeSchema,
  VendorSchedulingPurposeSchema,
  VendorSchedulingRoundStatusSchema,
  VendorSharedDetailSourceTypeSchema,
  VendorTenantSchedulingDtoSchema,
  VendorJobDtoSchema,
  VendorLinkIssueDtoSchema,
} from "./vendor-handoff";

const id="11111111-1111-4111-8111-111111111111";
const id2="22222222-2222-4222-8222-222222222222";
const id3="33333333-3333-4333-8333-333333333333";
const id4="44444444-4444-4444-8444-444444444444";
const at="2026-10-10T09:00:00+09:00";
const later="2026-10-10T10:00:00+09:00";

it("distinguishes first issue from metadata-only exact replay without reconstructing raw link bytes",()=>{
  const metadata={assignmentId:id,assignmentVersion:3,expiresAt:at};
  expect(VendorLinkIssueDtoSchema.safeParse({...metadata,created:false}).success).toBe(true);
  expect(VendorLinkIssueDtoSchema.safeParse({...metadata,created:true,link:"/vendor/job#synthetic-example"}).success).toBe(true);
  expect(VendorLinkIssueDtoSchema.safeParse({...metadata,created:false,link:"/vendor/job#synthetic-example"}).success).toBe(false);
  expect(VendorLinkIssueDtoSchema.safeParse({...metadata,created:true}).success).toBe(false);
});

describe("Vendor Secure Handoff enums",()=>{
  it("freezes the exact closed vocabularies",()=>{
    expect(VendorAssignmentStatusSchema.options).toEqual(["PREPARING","OFFERED","ACTIVE","ENDED"]);
    expect(VendorAssignmentEndReasonSchema.options).toEqual(["DECLINED","WITHDRAWN","REVOKED","SUPERSEDED","CLOSED"]);
    expect(VendorAccessPolicySchema.options).toEqual(["TENANT_PRESENT_REQUIRED","TENANT_PREAUTHORIZATION_ALLOWED"]);
    expect(VendorSchedulingModeSchema.options).toEqual(["RESIDENT_CONFIRMATION_REQUIRED","PREAUTHORIZED_ENTRY_WINDOW"]);
    expect(VendorSchedulingPurposeSchema.options).toEqual(["INITIAL","RESCHEDULE","FOLLOW_UP"]);
    expect(VendorSchedulingRoundStatusSchema.options).toEqual(["OPEN","CONFIRMED","SUPERSEDED","CANCELLED"]);
    expect(VendorAppointmentStatusSchema.options).toEqual(["SCHEDULED","OCCURRED","SUPERSEDED","CANCELLED"]);
    expect(VendorDeclineReasonSchema.options).toEqual(["NO_CAPACITY","OUT_OF_SERVICE_AREA","SKILL_MISMATCH","CANNOT_MEET_TIMING","OTHER"]);
    expect(VendorBlockerCodeSchema.options).toEqual(["PARTS_REQUIRED","ACCESS_BLOCKED","SCOPE_REVIEW_REQUIRED","FOLLOW_UP_VISIT_REQUIRED","OTHER"]);
    expect(VendorSharedDetailSourceTypeSchema.options).toEqual(["TENANT_REPORTED","BUILDING_VERIFIED","MANAGER_REVIEWED"]);
    expect(VendorPhotoOmissionReasonSchema.options).toEqual(["NOT_APPLICABLE","SAFETY_OR_PRIVACY","TECHNICAL_FAILURE"]);
    expect(VendorAppointmentConfirmationModeSchema.options).toEqual(["TENANT_CONFIRMED","PREAUTHORIZED_ENTRY"]);
    expect(VendorManagerDispositionSchema.options).toEqual(["CLOSEOUT","REQUEST_CORRECTION","MORE_WORK"]);
  });
});

describe("strict Manager/Vendor command contracts",()=>{
  it("uses expectedTicketVersion and rejects server-owned authority injection",()=>{
    const value={clientRequestId:id,expectedTicketVersion:1,vendorLabel:" 합성 설비 "};
    expect(VendorCreateAssignmentCommandSchema.parse(value)).toEqual({...value,vendorLabel:"합성 설비"});
    for(const field of ["orgId","propertyId","unitId","ticketId","tenantId"]){
      expect(VendorCreateAssignmentCommandSchema.safeParse({...value,[field]:id2}).success).toBe(false);
    }
    expect(VendorCreateAssignmentCommandSchema.safeParse({clientRequestId:id,expectedVersion:1,vendorLabel:"합성"}).success).toBe(false);
  });

  it("bounds reviewed packet text and never accepts Tenant consent fields",()=>{
    const base={
      clientRequestId:id,expectedAssignmentVersion:1,expectedPacketRevisionId:null,
      workSummary:" 합성 점검 요청 ",sharedDetailKeys:["heating_state"],allowedPhotoIds:[id2],
      accessPolicy:"TENANT_PREAUTHORIZATION_ALLOWED",accessInstruction:" 초인종을 눌러 주세요 ",
    };
    const parsed=VendorPublishPacketCommandSchema.parse(base);
    expect(parsed.workSummary).toBe("합성 점검 요청");
    expect(parsed.accessInstruction).toBe("초인종을 눌러 주세요");
    for(const workSummary of [" ","x".repeat(1001),"a\u0001b","a\u202Eb"])
      expect(VendorPublishPacketCommandSchema.safeParse({...base,workSummary}).success).toBe(false);
    for(const accessInstruction of [" ","x".repeat(501),"a\u0007b","a\u202Eb"])
      expect(VendorPublishPacketCommandSchema.safeParse({...base,accessInstruction}).success).toBe(false);
    for(const field of ["tenantConsent","preauthorized","availabilitySubmissionId","orgId","ticketId"])
      expect(VendorPublishPacketCommandSchema.safeParse({...base,[field]:field==="tenantConsent"?true:id3}).success).toBe(false);
  });

  it("accepts only one to five ordered proposal slots",()=>{
    const base={clientRequestId:id,expectedAssignmentVersion:2,expectedRoundVersion:3,expectedPacketRevisionId:id2};
    expect(VendorProposalCommandSchema.safeParse({...base,slots:[{startAt:at,endAt:later}]}).success).toBe(true);
    expect(VendorProposalCommandSchema.safeParse({...base,slots:[]}).success).toBe(false);
    expect(VendorProposalCommandSchema.safeParse({...base,slots:Array.from({length:6},()=>({startAt:at,endAt:later}))}).success).toBe(false);
    expect(VendorProposalCommandSchema.safeParse({...base,slots:[{startAt:later,endAt:at}]}).success).toBe(false);
  });

  it("requires completion photos xor an approved omission reason",()=>{
    const base={
      clientRequestId:id,expectedAssignmentVersion:2,expectedPacketRevisionId:id2,
      expectedAppointmentId:id3,expectedCorrectionRequestId:null,supersedesReportId:null,
      workSummary:"합성 작업 보고",componentOrPartNote:null,
    };
    expect(VendorCompletionReportCommandSchema.safeParse({...base,completionPhotoIds:[id4],photoOmissionReason:null}).success).toBe(true);
    expect(VendorCompletionReportCommandSchema.safeParse({...base,completionPhotoIds:[],photoOmissionReason:"NOT_APPLICABLE"}).success).toBe(true);
    expect(VendorCompletionReportCommandSchema.safeParse({...base,completionPhotoIds:[],photoOmissionReason:null}).success).toBe(false);
    expect(VendorCompletionReportCommandSchema.safeParse({...base,completionPhotoIds:[id4],photoOmissionReason:"TECHNICAL_FAILURE"}).success).toBe(false);
    expect(VendorCompletionReportCommandSchema.safeParse({...base,completionPhotoIds:Array(6).fill(id4),photoOmissionReason:null}).success).toBe(false);
    for(const componentOrPartNote of ["x".repeat(501),"a\u0001b","a\u202Eb"])
      expect(VendorCompletionReportCommandSchema.safeParse({...base,componentOrPartNote,completionPhotoIds:[id4],photoOmissionReason:null}).success).toBe(false);
  });

  it("pins correction reason and photo-upload intent",()=>{
    const correction={clientRequestId:id,expectedAssignmentVersion:2,expectedCompletionReportId:id2,reason:" 증거를 다시 확인해 주세요 "};
    expect(VendorRequestCorrectionCommandSchema.parse(correction).reason).toBe("증거를 다시 확인해 주세요");
    for(const reason of [" ","x".repeat(501),"a\u0001b","a\u202Eb"])
      expect(VendorRequestCorrectionCommandSchema.safeParse({...correction,reason}).success).toBe(false);

    const upload={clientRequestId:id,expectedAssignmentVersion:2,expectedPacketRevisionId:id2,expectedAppointmentId:id3,expectedCorrectionRequestId:null};
    expect(VendorCompletionPhotoUploadCommandSchema.parse(upload)).toEqual(upload);
    for(const field of ["clientRequestId","expectedAssignmentVersion","expectedPacketRevisionId","expectedAppointmentId","expectedCorrectionRequestId"]){
      const copy={...upload} as Record<string,unknown>; delete copy[field];
      expect(VendorCompletionPhotoUploadCommandSchema.safeParse(copy).success).toBe(false);
    }
    expect(VendorCompletionPhotoUploadCommandSchema.safeParse({...upload,clientRequestId:"not-a-uuid"}).success).toBe(false);
    expect(VendorCompletionPhotoUploadCommandSchema.safeParse({...upload,rawExif:"gps"}).success).toBe(false);
  });
});

describe("command matrix and role projections",()=>{
  it("freezes all 27 consequential commands, routes, methods and request identity",()=>{
    expect(Object.keys(VendorCommandSchemas)).toHaveLength(27);
    expect(VendorCommandMatrix).toHaveLength(27);
    expect(new Set(VendorCommandMatrix.map(x=>x.schema))).toEqual(new Set(Object.keys(VendorCommandSchemas)));
    for(const row of VendorCommandMatrix){
      expect(row.route).toMatch(/^POST \/api\/v2\/(?:core|vendor)\//);
      expect(row.method).toMatch(/^(?:manager|tenant|external)\./);
      const schema=VendorCommandSchemas[row.schema as keyof typeof VendorCommandSchemas];
      const result=schema.safeParse({});
      expect(result.success,row.schema).toBe(false);
      expect(row.staleStateFields).toContain("clientRequestId");
    }
    expect(VendorCommandMatrix.find(x=>x.schema==="VendorCreateAssignmentCommand")?.staleStateFields).toContain("expectedTicketVersion");
    expect(VendorCommandMatrix.find(x=>x.schema==="VendorCompletionPhotoUploadCommand")?.staleStateFields).toEqual([
      "clientRequestId","expectedAssignmentVersion","expectedPacketRevisionId","expectedAppointmentId","expectedCorrectionRequestId",
    ]);
  });

  it("keeps Tenant and Vendor DTOs role-specific and private-by-construction",()=>{
    const tenant={
      ticketId:id,assignmentVersion:2,packetRevisionId:id2,effectiveMode:"RESIDENT_CONFIRMATION_REQUIRED",
      phase:"SCHEDULING",waitingOn:"TENANT",currentRound:null,appointment:null,
    };
    expect(VendorTenantSchedulingDtoSchema.safeParse(tenant).success).toBe(true);
    for(const field of ["vendorLabel","completionPhotoIds","managerNotes","rawUserText","tenantEmail"])
      expect(VendorTenantSchedulingDtoSchema.safeParse({...tenant,[field]:"private"}).success).toBe(false);

    const vendor={
      assignmentId:id,status:"ACTIVE",endReason:null,phase:"SCHEDULING",waitingOn:"TENANT",
      currentPacket:null,currentRound:null,appointment:null,activeBlocker:null,currentReport:null,
    };
    expect(VendorJobDtoSchema.safeParse(vendor).success).toBe(true);
    for(const field of ["tenantId","tenantName","tenantPhone","tenantEmail","rawUserText","managerNotes","priority","assigneeLabel","dueAt","orgId"])
      expect(VendorJobDtoSchema.safeParse({...vendor,[field]:"private"}).success).toBe(false);
  });
});
