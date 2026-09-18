import {
  BuildingPassportDtoSchema,
  BuildingPassportListSchema,
  LandlordTicketDetailDtoSchema,
  LandlordTicketListSchema,
  TenantTicketListSchema,
  TenantTicketStatusDtoSchema,
  type BuildingPassportDto,
  type CreateTicketRequest,
  type DecisionRequest,
  type LandlordTicketDetailDto,
  type OwnerVerificationRequest,
  type SubmitSyntheticEvidenceRequest,
  type SubmitTenantAnswerRequest,
  type TenantTicketStatusDto,
} from "@build-manager/api-contracts";
import {
  buildUrl,
  encodePathSegment,
  sendRequest,
  type FetchLike,
} from "./http";

/**
 * P0/demo response projection selector. Not authentication and not
 * authorization — see Spec 8.1.
 */
export type TicketView = "landlord" | "tenant";

export type ListTicketsOptions<View extends TicketView = TicketView> = {
  view: View;
};

export type TicketListFor<View extends TicketView> = View extends "landlord"
  ? LandlordTicketDetailDto[]
  : TenantTicketStatusDto[];

/** Derived from the committed contract rather than restated here. */
export type OverrideRouteInput = Omit<
  Extract<DecisionRequest, { type: "OVERRIDE" }>,
  "type"
>;

export type RequestMoreInfoInput = Omit<
  Extract<DecisionRequest, { type: "REQUEST_MORE_INFO" }>,
  "type"
>;

export type ApiClientOptions = {
  /** `""` gives browser same-origin paths; mobile injects an absolute URL. */
  baseUrl: string;
  fetchImpl?: FetchLike;
};

export type ApiClient = {
  listDemoBuildings(): Promise<BuildingPassportDto[]>;
  resetDemo(): Promise<BuildingPassportDto[]>;
  getBuilding(buildingId: string): Promise<BuildingPassportDto>;
  verifyBuildingContext(
    buildingId: string,
    request: OwnerVerificationRequest,
  ): Promise<BuildingPassportDto>;
  createTicket(request: CreateTicketRequest): Promise<TenantTicketStatusDto>;
  submitAnswer(
    ticketId: string,
    request: SubmitTenantAnswerRequest,
  ): Promise<TenantTicketStatusDto>;
  submitEvidence(
    ticketId: string,
    request: SubmitSyntheticEvidenceRequest,
  ): Promise<TenantTicketStatusDto>;
  finalizeTicket(ticketId: string): Promise<TenantTicketStatusDto>;
  listTickets<View extends TicketView>(
    options: ListTicketsOptions<View>,
  ): Promise<TicketListFor<View>>;
  getLandlordTicket(ticketId: string): Promise<LandlordTicketDetailDto>;
  getTenantTicketStatus(ticketId: string): Promise<TenantTicketStatusDto>;
  approveRoute(ticketId: string): Promise<LandlordTicketDetailDto>;
  overrideRoute(
    ticketId: string,
    input: OverrideRouteInput,
  ): Promise<LandlordTicketDetailDto>;
  requestMoreInfo(
    ticketId: string,
    input: RequestMoreInfoInput,
  ): Promise<LandlordTicketDetailDto>;
};

/**
 * Called through a wrapper rather than passed by reference, so an unbound
 * `fetch` cannot lose its receiver on either platform.
 */
const defaultFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

/**
 * Builds a client instance. There is no module-level singleton and no
 * environment lookup: the host app supplies `baseUrl` and, if it needs one, a
 * `fetchImpl`.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const { baseUrl } = options;
  const fetchImpl = options.fetchImpl ?? defaultFetch;

  const ticketPath = (ticketId: string, suffix = ""): string =>
    `/api/v1/tickets/${encodePathSegment(ticketId)}${suffix}`;

  const decide = (
    ticketId: string,
    body: DecisionRequest,
  ): Promise<LandlordTicketDetailDto> =>
    sendRequest(fetchImpl, baseUrl, {
      method: "POST",
      path: ticketPath(ticketId, "/decision"),
      body,
      schema: LandlordTicketDetailDtoSchema,
    });

  return {
    listDemoBuildings() {
      return sendRequest(fetchImpl, baseUrl, {
        method: "GET",
        path: "/api/v1/demo/buildings",
        schema: BuildingPassportListSchema,
      });
    },

    resetDemo() {
      return sendRequest(fetchImpl, baseUrl, {
        method: "POST",
        path: "/api/v1/demo/reset",
        schema: BuildingPassportListSchema,
      });
    },

    getBuilding(buildingId) {
      return sendRequest(fetchImpl, baseUrl, {
        method: "GET",
        path: `/api/v1/buildings/${encodePathSegment(buildingId)}`,
        schema: BuildingPassportDtoSchema,
      });
    },

    verifyBuildingContext(buildingId, request) {
      return sendRequest(fetchImpl, baseUrl, {
        method: "PATCH",
        path: `/api/v1/buildings/${encodePathSegment(buildingId)}/context`,
        body: request,
        schema: BuildingPassportDtoSchema,
      });
    },

    createTicket(request) {
      return sendRequest(fetchImpl, baseUrl, {
        method: "POST",
        path: "/api/v1/tickets",
        body: request,
        schema: TenantTicketStatusDtoSchema,
      });
    },

    submitAnswer(ticketId, request) {
      return sendRequest(fetchImpl, baseUrl, {
        method: "POST",
        path: ticketPath(ticketId, "/answers"),
        body: request,
        schema: TenantTicketStatusDtoSchema,
      });
    },

    submitEvidence(ticketId, request) {
      return sendRequest(fetchImpl, baseUrl, {
        method: "POST",
        path: ticketPath(ticketId, "/evidence"),
        body: request,
        schema: TenantTicketStatusDtoSchema,
      });
    },

    finalizeTicket(ticketId) {
      return sendRequest(fetchImpl, baseUrl, {
        method: "POST",
        path: ticketPath(ticketId, "/finalize"),
        body: {},
        schema: TenantTicketStatusDtoSchema,
      });
    },

    listTickets<View extends TicketView>(options: ListTicketsOptions<View>) {
      const schema =
        options.view === "landlord"
          ? LandlordTicketListSchema
          : TenantTicketListSchema;

      return sendRequest(fetchImpl, baseUrl, {
        method: "GET",
        path: "/api/v1/tickets",
        query: { view: options.view },
        schema,
      }) as Promise<TicketListFor<View>>;
    },

    getLandlordTicket(ticketId) {
      return sendRequest(fetchImpl, baseUrl, {
        method: "GET",
        path: ticketPath(ticketId),
        query: { view: "landlord" },
        schema: LandlordTicketDetailDtoSchema,
      });
    },

    getTenantTicketStatus(ticketId) {
      return sendRequest(fetchImpl, baseUrl, {
        method: "GET",
        path: ticketPath(ticketId),
        query: { view: "tenant" },
        schema: TenantTicketStatusDtoSchema,
      });
    },

    approveRoute(ticketId) {
      return decide(ticketId, { type: "APPROVE" });
    },

    overrideRoute(ticketId, input) {
      return decide(ticketId, { type: "OVERRIDE", ...input });
    },

    requestMoreInfo(ticketId, input) {
      return decide(ticketId, { type: "REQUEST_MORE_INFO", ...input });
    },
  };
}

export { buildUrl };
