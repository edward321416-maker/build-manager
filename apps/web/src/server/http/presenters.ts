import {
  BuildingPassportDtoSchema,
  LandlordTicketDetailDtoSchema,
  TenantTicketStatusDtoSchema,
  type BuildingPassportDto,
  type LandlordTicketDetailDto,
  type Protocol as PublicProtocol,
  type SyntheticEvidenceRequirementDto,
  type SyntheticEvidenceType,
  type TenantQuestionDto,
  type TenantTicketStatusDto,
} from "@build-manager/api-contracts";
import { assessTicket } from "@build-manager/application";
import {
  getActiveQuestions,
  getBuildingContext,
  routingEligibleContextKeys,
  selectProtocol,
  type Building,
  type EvidenceType,
  type IssueType,
  type ProtocolQuestion,
  type RouteType,
  type RuleValues,
  type Ticket,
} from "@build-manager/domain";

const ROUTE_LABELS: Record<RouteType, string> = {
  LANDLORD_REVIEW: "임대인 검토",
  MANAGEMENT_OFFICE: "관리사무소",
  THIRD_PARTY_MANAGER: "위탁 관리사",
  MANUFACTURER_AS: "제조사 A/S",
  GENERAL_VENDOR: "일반 수리 업체",
};

/** Total by construction: every domain evidence kind has a public name. */
const PUBLIC_EVIDENCE_TYPE: Record<EvidenceType, SyntheticEvidenceType> = {
  CONTROL_PANEL_PHOTO: "BOILER_DISPLAY",
  LEAK_AREA_PHOTO: "LEAK_LOCATION",
  FIXTURE_PHOTO: "FIXTURE_VIEW",
  GENERAL_PHOTO: "GENERAL_VIEW",
};

const DOMAIN_EVIDENCE_TYPE: Record<SyntheticEvidenceType, EvidenceType> = {
  BOILER_DISPLAY: "CONTROL_PANEL_PHOTO",
  LEAK_LOCATION: "LEAK_AREA_PHOTO",
  FIXTURE_VIEW: "FIXTURE_PHOTO",
  GENERAL_VIEW: "GENERAL_PHOTO",
};

const EVIDENCE_LABELS: Record<SyntheticEvidenceType, string> = {
  BOILER_DISPLAY: "DEMO 보일러 표시창 이미지",
  LEAK_LOCATION: "DEMO 누수 위치 이미지",
  FIXTURE_VIEW: "DEMO 세대 설비 화면 이미지",
  GENERAL_VIEW: "DEMO 일반 참고 이미지",
};

/** Public `protocol` names the issue family, not the selected branch. */
function publicProtocol(issueType: IssueType): PublicProtocol {
  return issueType === "HEATING" ? "HEATING_V1" : "LEAK_V1";
}

export function toDomainEvidenceType(
  evidenceType: SyntheticEvidenceType,
): EvidenceType {
  return DOMAIN_EVIDENCE_TYPE[evidenceType];
}

export function presentBuildingPassport(building: Building): BuildingPassportDto {
  const routingEligible = routingEligibleContextKeys(building);

  return BuildingPassportDtoSchema.parse({
    buildingId: building.id,
    displayName: building.displayName,
    demo: building.demo,
    primaryUse: getBuildingContext(building, "primaryUse")?.value,
    approvalYear: getBuildingContext(building, "approvalYear")?.value,
    managementMode: getBuildingContext(building, "managementMode")?.value,
    heatingType: getBuildingContext(building, "heatingType")?.value,
    ownerSuppliedBoiler:
      getBuildingContext(building, "ownerSuppliedBoiler")?.value ?? undefined,
    contextVerified:
      routingEligible.includes("managementMode") &&
      routingEligible.includes("heatingType"),
    routingEligibleFields: routingEligible.filter((key) =>
      ["managementMode", "heatingType", "ownerSuppliedBoiler"].includes(key),
    ),
  });
}

function answerValues(ticket: Ticket): RuleValues {
  const values: RuleValues = {};

  for (const answer of ticket.answers) {
    if (answer.value === null || Array.isArray(answer.value)) {
      continue;
    }
    values[`answer.${answer.questionId}` as keyof RuleValues] = answer.value;
  }

  return values;
}

function evidenceRequirement(
  evidenceType: EvidenceType,
  required: boolean,
): SyntheticEvidenceRequirementDto {
  const publicType = PUBLIC_EVIDENCE_TYPE[evidenceType];
  return {
    evidenceType: publicType,
    label: EVIDENCE_LABELS[publicType],
    required,
  };
}

function presentQuestion(
  question: ProtocolQuestion,
  issueType: IssueType,
  evidenceRequirements: SyntheticEvidenceRequirementDto[],
): TenantQuestionDto | null {
  const base = {
    questionId: question.id,
    protocol: publicProtocol(issueType),
    prompt: question.prompt,
    required: question.required,
    evidenceRequirements,
  };

  if (question.type === "YES_NO") {
    return { ...base, responseType: "YES_NO" };
  }
  if (question.type === "SHORT_TEXT") {
    return { ...base, responseType: "TEXT" };
  }

  const options = (question.choices ?? []).map((choice) => ({
    value: choice.value,
    label: choice.label,
  }));
  if (options.length < 2) {
    return null;
  }
  return { ...base, responseType: "SINGLE_SELECT", options };
}

type TicketView = {
  activeQuestion: TenantQuestionDto | null;
  evidenceRequirements: SyntheticEvidenceRequirementDto[];
  evidenceStatus: ReturnType<typeof assessTicket>["evidenceState"];
};

/**
 * Reads the ticket's current state through the same authoritative composition
 * the use cases run. Nothing here decides safety, protocol, or completeness.
 */
function describeTicket(ticket: Ticket, building: Building): TicketView {
  const assessment = assessTicket(ticket, building);
  const values = answerValues(ticket);
  const answered = new Set(ticket.answers.map((answer) => answer.questionId));

  const nextQuestion =
    getActiveQuestions(assessment.protocol.questions, values).find(
      (question) => question.required && !answered.has(question.id),
    ) ?? null;

  const evidenceRequirements = assessment.protocol.evidence.map((requirement) =>
    evidenceRequirement(requirement.type, requirement.required),
  );

  return {
    activeQuestion:
      nextQuestion === null
        ? null
        : presentQuestion(nextQuestion, ticket.issueType, evidenceRequirements),
    evidenceRequirements,
    evidenceStatus: assessment.evidenceState,
  };
}

export function presentLandlordTicket(
  ticket: Ticket,
  building: Building,
): LandlordTicketDetailDto {
  const view = describeTicket(ticket, building);
  const packet = ticket.repairPacket ?? null;
  const recommendation = packet?.recommendation ?? null;
  const decision = ticket.routeDecision ?? null;

  return LandlordTicketDetailDtoSchema.parse({
    ticketId: ticket.id,
    building: presentBuildingPassport(building),
    issueType: ticket.issueType,
    protocol: publicProtocol(ticket.issueType),
    status: ticket.status,
    evidenceStatus: view.evidenceStatus,
    activeQuestion: view.activeQuestion,
    repairPacket:
      packet === null
        ? null
        : {
            revision: packet.revision,
            summary: packet.generatedSummary.text,
            safetyEscalated: packet.safety.escalated,
            recommendation:
              recommendation === null
                ? null
                : {
                    routeCode: recommendation.primary,
                    label: ROUTE_LABELS[recommendation.primary],
                    reasons: recommendation.rationale.map(
                      (item) => item.explanation,
                    ),
                  },
            routeAlternatives: (recommendation?.alternatives ?? []).map(
              (route) => ({ routeCode: route, label: ROUTE_LABELS[route] }),
            ),
            provenance: packet.contextSnapshot.routingBasis.map(
              (entry) => entry.key,
            ),
            internalNotes: [],
            estimatedCost: null,
            affectedUnits: [],
            hiddenContacts: [],
          },
    decision:
      decision === null
        ? null
        : decision.action === "APPROVE_RECOMMENDATION"
          ? { type: "APPROVE" }
          : {
              type: "OVERRIDE",
              routeCode: decision.selectedRoute,
              reason: decision.reason,
            },
  });
}

/**
 * Builds the tenant object field by field.
 *
 * The domain ticket is never handed to Zod in the hope that stripping removes
 * landlord-only data: nothing landlord-only is ever placed on this object in
 * the first place.
 */
export function presentTenantTicket(
  ticket: Ticket,
  building: Building,
): TenantTicketStatusDto {
  const view = describeTicket(ticket, building);
  const packet = ticket.repairPacket ?? null;

  return TenantTicketStatusDtoSchema.parse({
    ticketId: ticket.id,
    buildingId: ticket.buildingId,
    issueType: ticket.issueType,
    protocol: publicProtocol(ticket.issueType),
    status: ticket.status,
    evidenceStatus: view.evidenceStatus,
    activeQuestion: view.activeQuestion,
    evidenceRequirements: view.evidenceRequirements,
    submittedEvidence: ticket.evidence.map((item) => {
      const publicType = PUBLIC_EVIDENCE_TYPE[item.type];
      return {
        evidenceId: item.id,
        evidenceType: publicType,
        label: EVIDENCE_LABELS[publicType],
      };
    }),
    packet:
      packet === null
        ? null
        : {
            revision: packet.revision,
            summary: packet.generatedSummary.text,
            safetyEscalated: packet.safety.escalated,
          },
  });
}
