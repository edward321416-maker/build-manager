import type { IssueType, Ticket } from "@build-manager/domain";
import type { ApplicationDependencies } from "../ports";
import { assessTicket, intakeStatus, loadBuilding } from "./ticket-assessment";

export type CreateTicketInput = {
  buildingId: string;
  unitId: string;
  issueType: IssueType;
  rawUserText: string;
};

/**
 * Opens a ticket on the protocol branch the building's verified context
 * selects. The reported text is untrusted data: it is fed to the safety gate,
 * never followed as an instruction.
 */
export async function createTicket(
  deps: ApplicationDependencies,
  input: CreateTicketInput,
): Promise<Ticket> {
  const building = await loadBuilding(deps, input.buildingId);
  const createdAt = deps.clock.now();

  const draft: Ticket = {
    id: deps.ids.next("ticket"),
    buildingId: building.id,
    unitId: input.unitId,
    issueType: input.issueType,
    rawUserText: input.rawUserText,
    status: "IN_PROGRESS",
    protocolId: null,
    answers: [],
    evidence: [],
    safetyFlags: [],
    repairPacket: null,
    routeDecision: null,
    moreInfoRequest: null,
    createdAt,
    updatedAt: createdAt,
  };

  const assessment = assessTicket(draft, building);
  const ticket: Ticket = {
    ...draft,
    protocolId: assessment.protocol.id,
    status: intakeStatus(assessment),
    safetyFlags: assessment.safety.flags,
  };

  await deps.tickets.save(ticket);
  return ticket;
}
