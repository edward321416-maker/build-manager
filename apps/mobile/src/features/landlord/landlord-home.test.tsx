import { ApiClientError, type ApiClient } from "@build-manager/api-client";
import type {
  BuildingPassportDto,
  LandlordTicketDetailDto,
} from "@build-manager/api-contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { LandlordHome } from "./landlord-home";

const BUILDING: BuildingPassportDto = {
  buildingId: "building-server-id",
  displayName: "DEMO 건물",
  demo: true,
  primaryUse: "공동주택",
  approvalYear: "2018",
  managementMode: "MANAGEMENT_OFFICE",
  heatingType: "CENTRAL_SHARED",
  contextVerified: true,
  routingEligibleFields: ["managementMode", "heatingType"],
};

const TICKET: LandlordTicketDetailDto = {
  ticketId: "ticket-server-id",
  building: BUILDING,
  issueType: "LEAK",
  protocol: "LEAK_V1",
  status: "READY_FOR_REVIEW",
  evidenceStatus: "COMPLETE",
  activeQuestion: null,
  repairPacket: {
    revision: 1,
    summary: "합성 누수 요청",
    safetyEscalated: false,
    recommendation: {
      routeCode: "MANAGEMENT_OFFICE",
      label: "관리사무소",
      reasons: ["관리 방식이 관리사무소입니다."],
    },
    routeAlternatives: [],
    provenance: ["managementMode"],
    internalNotes: [],
    estimatedCost: null,
    affectedUnits: [],
    hiddenContacts: [],
  },
  decision: null,
  followUpOptions: { questions: [], evidence: [] },
};

function stubClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    async listDemoBuildings() {
      return [BUILDING];
    },
    async listTickets() {
      return [TICKET];
    },
    ...overrides,
  } as ApiClient;
}

function renderHome(client: ApiClient, callbacks: Partial<{
  onBuildingOpen: (id: string) => void;
  onTicketOpen: (id: string) => void;
  onBackToRoles: () => void;
}> = {}) {
  return render(
    <LandlordHome
      client={client}
      onBackToRoles={callbacks.onBackToRoles ?? jest.fn()}
      onBuildingOpen={callbacks.onBuildingOpen ?? jest.fn()}
      onTicketOpen={callbacks.onTicketOpen ?? jest.fn()}
    />,
  );
}

describe("landlord home", () => {
  it("shows loading until home reads settle", async () => {
    const client = stubClient({
      listDemoBuildings: () => new Promise<BuildingPassportDto[]>(() => {}),
    });

    await renderHome(client);

    expect(screen.getByTestId("loading")).toBeTruthy();
  });

  it("reads the landlord projection exactly once", async () => {
    const listTickets = jest.fn(
      async ({ view }: { view: "landlord" | "tenant" }) => {
        if (view !== "landlord") {
          throw new Error("wrong projection");
        }
        return [TICKET];
      },
    );

    await renderHome(stubClient({ listTickets } as Partial<ApiClient>));

    await screen.findByText("DEMO 건물");
    expect(listTickets).toHaveBeenCalledWith({ view: "landlord" });
    expect(listTickets).toHaveBeenCalledTimes(1);
  });

  it("renders the identities the server returned", async () => {
    await renderHome(stubClient());

    expect(await screen.findByText("DEMO 건물")).toBeTruthy();
    expect(screen.getByTestId("building-building-server-id")).toBeTruthy();
    expect(screen.getByTestId("ticket-ticket-server-id")).toBeTruthy();
    expect(screen.getByTestId("demo-banner")).toBeTruthy();
  });

  it("passes server identities to navigation callbacks", async () => {
    const onBuildingOpen = jest.fn();
    const onTicketOpen = jest.fn();

    await renderHome(stubClient(), { onBuildingOpen, onTicketOpen });

    await fireEvent.press(
      await screen.findByTestId("building-building-server-id"),
    );
    await fireEvent.press(screen.getByTestId("ticket-ticket-server-id"));

    expect(onBuildingOpen).toHaveBeenCalledWith("building-server-id");
    expect(onTicketOpen).toHaveBeenCalledWith("ticket-server-id");
  });

  it("returns to role selection on request", async () => {
    const onBackToRoles = jest.fn();

    await renderHome(stubClient(), { onBackToRoles });

    await fireEvent.press(await screen.findByTestId("back-to-roles"));

    expect(onBackToRoles).toHaveBeenCalledTimes(1);
  });

  it("states plainly when no repair request exists yet", async () => {
    await renderHome(stubClient({ listTickets: async () => [] } as Partial<ApiClient>));

    expect(
      await screen.findByText("접수된 수리 요청이 없습니다."),
    ).toBeTruthy();
  });

  it("shows a sanitized error with a retry", async () => {
    let attempts = 0;
    const client = stubClient({
      async listDemoBuildings() {
        attempts += 1;
        if (attempts === 1) {
          throw new ApiClientError(
            "NETWORK_ERROR",
            "네트워크에 연결할 수 없습니다.",
          );
        }
        return [BUILDING];
      },
    });

    await renderHome(client);

    expect(
      await screen.findByText("네트워크에 연결할 수 없습니다."),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId("retry"));

    expect(await screen.findByText("DEMO 건물")).toBeTruthy();
  });

  it("never shows the host from an unrecognised failure", async () => {
    const client = stubClient({
      async listDemoBuildings() {
        throw new Error("connect ECONNREFUSED 10.0.2.2:3000");
      },
    });

    await renderHome(client);

    expect(
      await screen.findByText("오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
    ).toBeTruthy();
    expect(screen.queryByText(/10\.0\.2\.2/)).toBeNull();
  });
});
