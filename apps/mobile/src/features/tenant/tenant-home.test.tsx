import { ApiClientError, type ApiClient } from "@build-manager/api-client";
import type {
  BuildingPassportDto,
  CreateTicketRequest,
  TenantTicketStatusDto,
} from "@build-manager/api-contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { TenantHome } from "./tenant-home";

const BUILDING_A: BuildingPassportDto = {
  buildingId: "demo-building-a",
  displayName: "DEMO 해솔빌라",
  demo: true,
  primaryUse: "다가구주택",
  approvalYear: "2011",
  managementMode: "OWNER_DIRECT",
  heatingType: "INDIVIDUAL",
  ownerSuppliedBoiler: true,
  contextVerified: true,
  routingEligibleFields: ["managementMode", "heatingType"],
};

const BUILDING_B: BuildingPassportDto = {
  ...BUILDING_A,
  buildingId: "demo-building-b",
  displayName: "DEMO 라온하우징",
  managementMode: "MANAGEMENT_OFFICE",
  heatingType: "CENTRAL_SHARED",
  ownerSuppliedBoiler: false,
};

function createdTicket(ticketId: string): TenantTicketStatusDto {
  return {
    ticketId,
    buildingId: "demo-building-a",
    issueType: "HEATING",
    protocol: "HEATING_V1",
    status: "IN_PROGRESS",
    evidenceStatus: "MISSING_REQUIRED",
    activeQuestion: null,
    evidenceRequirements: [],
    submittedEvidence: [],
    packet: null,
    moreInfoRequest: null,
  };
}

/** Only the two calls this screen is allowed to make are implemented. */
function stubClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    async listDemoBuildings() {
      return [BUILDING_A, BUILDING_B];
    },
    async createTicket() {
      return createdTicket("ticket-created");
    },
    ...overrides,
  } as ApiClient;
}

function isDisabled(testID: string): boolean {
  return screen.getByTestId(testID).props.accessibilityState.disabled === true;
}

describe("tenant home", () => {
  it("shows a loading state while the buildings are still in flight", async () => {
    const client = stubClient({
      listDemoBuildings: () => new Promise<BuildingPassportDto[]>(() => {}),
    });

    await render(<TenantHome client={client} onTicketCreated={jest.fn()} />);

    expect(screen.getByTestId("loading")).toBeTruthy();
    expect(screen.queryByTestId("create-ticket")).toBeNull();
  });

  it("lists the demo buildings the server returned", async () => {
    await render(
      <TenantHome client={stubClient()} onTicketCreated={jest.fn()} />,
    );

    expect(await screen.findByText("DEMO 해솔빌라")).toBeTruthy();
    expect(screen.getByText("DEMO 라온하우징")).toBeTruthy();
    expect(screen.getByTestId("demo-banner")).toBeTruthy();
  });

  it("offers both issue types", async () => {
    await render(
      <TenantHome client={stubClient()} onTicketCreated={jest.fn()} />,
    );
    await screen.findByText("DEMO 해솔빌라");

    expect(screen.getByTestId("issue-HEATING")).toBeTruthy();
    expect(screen.getByTestId("issue-LEAK")).toBeTruthy();
  });

  it("refuses to submit without a building and a report", async () => {
    await render(
      <TenantHome client={stubClient()} onTicketCreated={jest.fn()} />,
    );
    await screen.findByText("DEMO 해솔빌라");

    expect(isDisabled("create-ticket")).toBe(true);

    await fireEvent.press(screen.getByTestId("building-demo-building-a"));
    expect(isDisabled("create-ticket")).toBe(true);

    await fireEvent.changeText(screen.getByTestId("raw-user-text"), "   ");
    expect(isDisabled("create-ticket")).toBe(true);

    await fireEvent.changeText(
      screen.getByTestId("raw-user-text"),
      "난방이 안 돼요",
    );
    expect(isDisabled("create-ticket")).toBe(false);
  });

  it("sends the tenant's own words unchanged", async () => {
    const requests: CreateTicketRequest[] = [];
    const client = stubClient({
      async createTicket(request) {
        requests.push(request);
        return createdTicket("ticket-created");
      },
    });
    await render(<TenantHome client={client} onTicketCreated={jest.fn()} />);
    await screen.findByText("DEMO 라온하우징");

    const report = "  천장에서 물이 떨어집니다. 어제 밤부터요  ";
    await fireEvent.press(screen.getByTestId("building-demo-building-b"));
    await fireEvent.press(screen.getByTestId("issue-LEAK"));
    await fireEvent.changeText(screen.getByTestId("raw-user-text"), report);
    await fireEvent.press(screen.getByTestId("create-ticket"));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toEqual({
      buildingId: "demo-building-b",
      issueType: "LEAK",
      rawUserText: report,
    });
  });

  it("navigates using the ticket id the server returned", async () => {
    const onTicketCreated = jest.fn();
    const client = stubClient({
      async createTicket() {
        return createdTicket("ticket-from-server");
      },
    });
    await render(
      <TenantHome client={client} onTicketCreated={onTicketCreated} />,
    );
    await screen.findByText("DEMO 해솔빌라");

    await fireEvent.press(screen.getByTestId("building-demo-building-a"));
    await fireEvent.changeText(
      screen.getByTestId("raw-user-text"),
      "난방이 안 돼요",
    );
    await fireEvent.press(screen.getByTestId("create-ticket"));

    await waitFor(() =>
      expect(onTicketCreated).toHaveBeenCalledWith("ticket-from-server"),
    );
  });

  it("shows a sanitized error with a retry when the list fails", async () => {
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
        return [BUILDING_A];
      },
    });
    await render(<TenantHome client={client} onTicketCreated={jest.fn()} />);

    expect(
      await screen.findByText("네트워크에 연결할 수 없습니다."),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId("retry"));

    expect(await screen.findByText("DEMO 해솔빌라")).toBeTruthy();
  });

  it("replaces an unrecognised failure with generic copy", async () => {
    const client = stubClient({
      async listDemoBuildings() {
        throw new Error("connect ECONNREFUSED 10.0.2.2:3000");
      },
    });
    await render(<TenantHome client={client} onTicketCreated={jest.fn()} />);

    expect(
      await screen.findByText("오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
    ).toBeTruthy();
    expect(screen.queryByText(/10\.0\.2\.2/)).toBeNull();
  });

  it("reports a failed submission without leaving the screen", async () => {
    const onTicketCreated = jest.fn();
    const client = stubClient({
      async createTicket() {
        throw new ApiClientError("HTTP_ERROR", "요청을 확인해 주세요.", {
          status: 400,
        });
      },
    });
    await render(
      <TenantHome client={client} onTicketCreated={onTicketCreated} />,
    );
    await screen.findByText("DEMO 해솔빌라");

    await fireEvent.press(screen.getByTestId("building-demo-building-a"));
    await fireEvent.changeText(
      screen.getByTestId("raw-user-text"),
      "난방이 안 돼요",
    );
    await fireEvent.press(screen.getByTestId("create-ticket"));

    expect(await screen.findByText("요청을 확인해 주세요.")).toBeTruthy();
    expect(onTicketCreated).not.toHaveBeenCalled();
  });
});
