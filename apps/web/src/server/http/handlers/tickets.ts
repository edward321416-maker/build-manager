import {
  CreateTicketRequestSchema,
  DecisionRequestSchema,
  FinalizeTicketRequestSchema,
  LandlordTicketDetailDtoSchema,
  LandlordTicketListSchema,
  SubmitSyntheticEvidenceRequestSchema,
  SubmitTenantAnswerRequestSchema,
  TenantTicketListSchema,
  TenantTicketStatusDtoSchema,
} from "@build-manager/api-contracts";
import type { Building, Ticket } from "@build-manager/domain";
import { invalidRequest, notFound } from "../errors";
import {
  jsonResponse,
  parseRequest,
  readJsonBody,
  validateResponse,
} from "../json";
import {
  presentLandlordTicket,
  presentTenantTicket,
  toDomainEvidenceType,
} from "../presenters";
import type { ContainerProvider } from "../request-container";
import { parseRouteCode } from "../route-code";
import type { ServerContainer } from "../../container";
import { requireTicketView, respond, type TicketView } from "./respond";

/**
 * P0's public create contract carries no unit, and the demo has exactly one
 * unit per synthetic building, so the id is derived deterministically. It is
 * clearly synthetic and never claims to identify a real dwelling.
 */
function demoUnitId(buildingId: string): string {
  return `demo-unit:${buildingId}`;
}

async function buildingFor(
  container: ServerContainer,
  ticket: Ticket,
): Promise<Building> {
  const building = await container.useCases.getBuilding({
    buildingId: ticket.buildingId,
  });
  if (building === null) {
    throw notFound();
  }
  return building;
}

/** Projects a ticket for one role only; no response carries both shapes. */
async function projectTicket(
  container: ServerContainer,
  ticket: Ticket,
  view: TicketView,
): Promise<unknown> {
  const building = await buildingFor(container, ticket);
  return view === "landlord"
    ? presentLandlordTicket(ticket, building)
    : presentTenantTicket(ticket, building);
}

async function tenantStatus(
  container: ServerContainer,
  ticket: Ticket,
): Promise<unknown> {
  return presentTenantTicket(ticket, await buildingFor(container, ticket));
}

export function handleListTickets(
  withContainer: ContainerProvider,
  url: URL,
): Promise<Response> {
  return respond(async () => {
    const view = requireTicketView(url);

    const projected = await withContainer(async (container) => {
      const tickets = await container.useCases.listTickets({});
      return Promise.all(
        tickets.map((ticket) => projectTicket(container, ticket, view)),
      );
    });

    return jsonResponse(
      view === "landlord"
        ? validateResponse(LandlordTicketListSchema, projected)
        : validateResponse(TenantTicketListSchema, projected),
    );
  });
}

export function handleCreateTicket(
  withContainer: ContainerProvider,
  request: Request,
): Promise<Response> {
  return respond(async () => {
    const body = parseRequest(
      CreateTicketRequestSchema,
      await readJsonBody(request),
    );

    const created = await withContainer(async (container) => {
      const ticket = await container.useCases.createTicket({
        buildingId: body.buildingId,
        unitId: demoUnitId(body.buildingId),
        issueType: body.issueType,
        // Untrusted tenant text, passed through unchanged so the deterministic
        // safety gate can evaluate it. It is never logged and never echoed.
        rawUserText: body.rawUserText,
      });
      return tenantStatus(container, ticket);
    });

    return jsonResponse(
      validateResponse(TenantTicketStatusDtoSchema, created),
      201,
    );
  });
}

export function handleGetTicket(
  withContainer: ContainerProvider,
  url: URL,
  ticketId: string,
): Promise<Response> {
  return respond(async () => {
    const view = requireTicketView(url);

    const projected = await withContainer(async (container) => {
      const ticket = await container.useCases.getTicket({ ticketId });
      if (ticket === null) {
        throw notFound();
      }
      return projectTicket(container, ticket, view);
    });

    return jsonResponse(
      view === "landlord"
        ? validateResponse(LandlordTicketDetailDtoSchema, projected)
        : validateResponse(TenantTicketStatusDtoSchema, projected),
    );
  });
}

export function handleSubmitAnswer(
  withContainer: ContainerProvider,
  request: Request,
  ticketId: string,
): Promise<Response> {
  return respond(async () => {
    const body = parseRequest(
      SubmitTenantAnswerRequestSchema,
      await readJsonBody(request),
    );

    const updated = await withContainer(async (container) => {
      const ticket = await container.useCases.submitTicketAnswer({
        ticketId,
        questionId: body.questionId,
        value: body.answer,
      });
      return tenantStatus(container, ticket);
    });

    return jsonResponse(validateResponse(TenantTicketStatusDtoSchema, updated));
  });
}

export function handleSubmitEvidence(
  withContainer: ContainerProvider,
  request: Request,
  ticketId: string,
): Promise<Response> {
  return respond(async () => {
    const body = parseRequest(
      SubmitSyntheticEvidenceRequestSchema,
      await readJsonBody(request),
    );

    const updated = await withContainer(async (container) => {
      const ticket = await container.useCases.submitTicketEvidence({
        ticketId,
        evidenceType: toDomainEvidenceType(body.evidenceType),
        fixtureId: body.fixtureId,
      });
      return tenantStatus(container, ticket);
    });

    return jsonResponse(validateResponse(TenantTicketStatusDtoSchema, updated));
  });
}

export function handleFinalizeTicket(
  withContainer: ContainerProvider,
  request: Request,
  ticketId: string,
): Promise<Response> {
  return respond(async () => {
    parseRequest(FinalizeTicketRequestSchema, await readJsonBody(request));

    const finalized = await withContainer(async (container) => {
      const ticket = await container.useCases.finalizeTicket({ ticketId });
      return tenantStatus(container, ticket);
    });

    return jsonResponse(
      validateResponse(TenantTicketStatusDtoSchema, finalized),
    );
  });
}

/**
 * The transport discriminant and the domain action are different vocabularies.
 * APPROVE and OVERRIDE produce a RouteDecision; REQUEST_MORE_INFO is a review
 * state change and deliberately produces none.
 */
export function handleTicketDecision(
  withContainer: ContainerProvider,
  request: Request,
  ticketId: string,
): Promise<Response> {
  return respond(async () => {
    const decision = parseRequest(
      DecisionRequestSchema,
      await readJsonBody(request),
    );

    const projected = await withContainer(async (container) => {
      let ticket: Ticket;

      if (decision.type === "APPROVE") {
        const current = await container.useCases.getTicket({ ticketId });
        if (current === null) {
          throw notFound();
        }
        // APPROVE carries no route: it means "approve what is recommended".
        // When nothing is recommended the domain refuses the approval, so the
        // placeholder below never becomes a decision.
        ticket = await container.useCases.approveRecommendation({
          ticketId,
          selectedRoute:
            current.repairPacket?.recommendation?.primary ?? "LANDLORD_REVIEW",
        });
      } else if (decision.type === "OVERRIDE") {
        const selectedRoute = parseRouteCode(decision.routeCode);
        if (selectedRoute === null) {
          throw invalidRequest();
        }
        ticket = await container.useCases.overrideRoute({
          ticketId,
          selectedRoute,
          reason: decision.reason,
        });
      } else {
        ticket = await container.useCases.requestMoreInfo({
          ticketId,
          reason: decision.reason,
          requestedQuestionIds: decision.requestedQuestionIds,
          // Evidence keeps its own identity: it is mapped through the
          // public->domain evidence vocabulary, never folded into question ids.
          requestedEvidenceTypes: decision.requestedEvidenceTypes?.map(
            toDomainEvidenceType,
          ),
        });
      }

      return presentLandlordTicket(ticket, await buildingFor(container, ticket));
    });

    return jsonResponse(
      validateResponse(LandlordTicketDetailDtoSchema, projected),
    );
  });
}
