import { ApiClientError, type ApiClient } from "@build-manager/api-client";
import type {
  BuildingPassportDto,
  LandlordTicketDetailDto,
  RouteCode,
  SyntheticEvidenceType,
} from "@build-manager/api-contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ALL_ROUTE_CODES } from "./logic";
import { TicketReview } from "./ticket-review";

const TICKET_ID = "ticket-server-id";

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

function ticket(
  overrides: Partial<LandlordTicketDetailDto> = {},
): LandlordTicketDetailDto {
  return {
    ticketId: TICKET_ID,
    building: BUILDING,
    issueType: "LEAK",
    protocol: "LEAK_V1",
    status: "READY_FOR_REVIEW",
    evidenceStatus: "COMPLETE",
    activeQuestion: null,
    repairPacket: {
      revision: 2,
      summary: "합성 누수 요청",
      safetyEscalated: false,
      recommendation: {
        routeCode: "MANAGEMENT_OFFICE",
        label: "관리사무소",
        reasons: ["관리 방식이 관리사무소입니다."],
      },
      routeAlternatives: [],
      provenance: ["managementMode"],
      internalNotes: ["내부 메모 비공개"],
      estimatedCost: { currency: "KRW", minimum: 10000, maximum: 20000 },
      affectedUnits: ["101호"],
      hiddenContacts: ["비공개 연락처"],
    },
    decision: null,
    followUpOptions: {
      questions: [
        {
          questionId: "q-server",
          protocol: "LEAK_V1",
          prompt: "누수 위치를 다시 확인해 주세요.",
          responseType: "YES_NO",
          required: true,
          evidenceRequirements: [],
        },
      ],
      evidence: [
        {
          evidenceType: "LEAK_LOCATION",
          label: "DEMO 누수 위치 이미지",
          required: true,
          demoFixtureId: "fixture-server-id",
        },
      ],
    },
    ...overrides,
  };
}

function stubClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    async getLandlordTicket() {
      return ticket();
    },
    async approveRoute() {
      return ticket({ status: "APPROVED" });
    },
    async overrideRoute() {
      return ticket({ status: "OVERRIDDEN" });
    },
    async requestMoreInfo() {
      return ticket({ status: "NEEDS_MORE_INFO" });
    },
    ...overrides,
  } as ApiClient;
}

function renderReview(client: ApiClient, onBack = jest.fn()) {
  return render(
    <TicketReview client={client} onBack={onBack} ticketId={TICKET_ID} />,
  );
}

function isDisabled(testID: string): boolean {
  return screen.getByTestId(testID).props.accessibilityState.disabled === true;
}

describe("landlord ticket review — packet", () => {
  it("shows loading until the ticket arrives", async () => {
    await renderReview(
      stubClient({
        getLandlordTicket: () =>
          new Promise<LandlordTicketDetailDto>(() => {}),
      }),
    );

    expect(screen.getByTestId("loading")).toBeTruthy();
  });

  it("reads the ticket named by the route", async () => {
    const seen: string[] = [];
    const client = stubClient({
      async getLandlordTicket(ticketId) {
        seen.push(ticketId);
        return ticket();
      },
    });

    await renderReview(client);

    await waitFor(() => expect(seen).toEqual([TICKET_ID]));
  });

  it("renders the compact packet the server returned", async () => {
    await renderReview(stubClient());

    expect(await screen.findByText("합성 누수 요청")).toBeTruthy();
    expect(screen.getByText("관리사무소")).toBeTruthy();
    expect(screen.getByText("관리 방식이 관리사무소입니다.")).toBeTruthy();
    expect(screen.getByText("managementMode")).toBeTruthy();
    expect(screen.getByText(/제출 회차 2/)).toBeTruthy();
  });

  it("never surfaces the fields excluded from the compact packet", async () => {
    await renderReview(stubClient());
    await screen.findByText("합성 누수 요청");

    for (const hidden of [
      "내부 메모 비공개",
      "비공개 연락처",
      "101호",
      "10000",
      "20000",
    ]) {
      expect(screen.queryByText(new RegExp(hidden))).toBeNull();
    }
  });

  it("returns to the landlord home on request", async () => {
    const onBack = jest.fn();

    await renderReview(stubClient(), onBack);

    await fireEvent.press(await screen.findByTestId("back-to-landlord"));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe("landlord ticket review — approve", () => {
  it("approves and renders the returned decision state", async () => {
    let calls = 0;
    const client = stubClient({
      async approveRoute() {
        calls += 1;
        return ticket({ status: "APPROVED", decision: { type: "APPROVE" } });
      },
    });

    await renderReview(client);

    await fireEvent.press(await screen.findByTestId("approve"));

    await waitFor(() => expect(calls).toBe(1));
    expect(await screen.findByText("상태: 승인됨")).toBeTruthy();
  });

  it("does not offer approve without a recommendation", async () => {
    const client = stubClient({
      getLandlordTicket: async () =>
        ticket({
          status: "PARTIAL",
          evidenceStatus: "MISSING_REQUIRED",
          repairPacket: { ...ticket().repairPacket!, recommendation: null },
        }),
    });

    await renderReview(client);
    await screen.findByText("합성 누수 요청");

    expect(isDisabled("approve")).toBe(true);
  });
});

describe("landlord ticket review — override", () => {
  it("sends the selected route and the entered reason unchanged", async () => {
    const calls: { routeCode: RouteCode; reason: string }[] = [];
    const client = stubClient({
      async overrideRoute(_ticketId, input) {
        calls.push(input);
        return ticket({ status: "OVERRIDDEN" });
      },
    });

    await renderReview(client);
    await screen.findByText("합성 누수 요청");

    await fireEvent.press(screen.getByTestId("route-LANDLORD_REVIEW"));
    const reason = "  현장 확인 후 임대인이 직접 검토  ";
    await fireEvent.changeText(screen.getByTestId("override-reason"), reason);
    await fireEvent.press(screen.getByTestId("override-submit"));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ routeCode: "LANDLORD_REVIEW", reason });
  });

  it("excludes the recommended route from manual choices", async () => {
    await renderReview(stubClient());
    await screen.findByText("합성 누수 요청");

    expect(screen.queryByTestId("route-MANAGEMENT_OFFICE")).toBeNull();
    expect(screen.getByTestId("route-LANDLORD_REVIEW")).toBeTruthy();
  });

  it("offers the whole closed vocabulary when nothing was recommended", async () => {
    const client = stubClient({
      getLandlordTicket: async () =>
        ticket({
          status: "PARTIAL",
          evidenceStatus: "MISSING_REQUIRED",
          repairPacket: { ...ticket().repairPacket!, recommendation: null },
        }),
    });

    await renderReview(client);
    await screen.findByText("합성 누수 요청");

    for (const routeCode of ALL_ROUTE_CODES) {
      expect(screen.getByTestId(`route-${routeCode}`)).toBeTruthy();
    }
  });

  it("keeps submission disabled for a whitespace-only reason", async () => {
    await renderReview(stubClient());
    await screen.findByText("합성 누수 요청");

    await fireEvent.press(screen.getByTestId("route-LANDLORD_REVIEW"));
    await fireEvent.changeText(screen.getByTestId("override-reason"), "    ");

    expect(isDisabled("override-submit")).toBe(true);
  });

  it.each([
    { status: "SAFETY_ESCALATED" as const },
    { evidenceStatus: "SAFETY_ESCALATED" as const },
    { repairPacket: { ...ticket().repairPacket!, safetyEscalated: true } },
  ])("suppresses override for returned safety state", async (override) => {
    const overrideRoute = jest.fn();
    const client = stubClient({
      getLandlordTicket: async () => ticket(override),
      overrideRoute,
    } as Partial<ApiClient>);

    await renderReview(client);

    expect(await screen.findByTestId("override-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("override-submit")).toBeNull();
    expect(screen.queryByTestId("route-LANDLORD_REVIEW")).toBeNull();
    expect(overrideRoute).not.toHaveBeenCalled();
  });

  it("gives no repair or emergency instruction when safety escalated", async () => {
    const client = stubClient({
      getLandlordTicket: async () => ticket({ status: "SAFETY_ESCALATED" }),
    });

    await renderReview(client);
    await screen.findByTestId("override-unavailable");

    for (const unsafe of ["119", "112", "밸브를 잠그", "차단기를 내리", "직접 수리"]) {
      expect(screen.queryByText(new RegExp(unsafe))).toBeNull();
    }
  });
});

describe("landlord ticket review — more info", () => {
  it("offers only the follow-up options the server returned", async () => {
    await renderReview(stubClient());
    await screen.findByText("합성 누수 요청");

    expect(screen.getByTestId("followup-question-q-server")).toBeTruthy();
    expect(screen.getByTestId("followup-evidence-LEAK_LOCATION")).toBeTruthy();
    expect(screen.queryByTestId("followup-evidence-BOILER_DISPLAY")).toBeNull();
  });

  it("sends the entered reason and the selected items unchanged", async () => {
    const calls: {
      reason: string;
      requestedQuestionIds?: string[];
      requestedEvidenceTypes?: SyntheticEvidenceType[];
    }[] = [];
    const client = stubClient({
      async requestMoreInfo(_ticketId, input) {
        calls.push(input);
        return ticket({ status: "NEEDS_MORE_INFO" });
      },
    });

    await renderReview(client);
    await screen.findByText("합성 누수 요청");

    const reason = "  누수 위치를 다시 확인해 주세요  ";
    await fireEvent.changeText(screen.getByTestId("more-info-reason"), reason);
    await fireEvent.press(screen.getByTestId("followup-question-q-server"));
    await fireEvent.press(screen.getByTestId("followup-evidence-LEAK_LOCATION"));
    await fireEvent.press(screen.getByTestId("more-info-submit"));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      reason,
      requestedQuestionIds: ["q-server"],
      requestedEvidenceTypes: ["LEAK_LOCATION"],
    });
    expect(await screen.findByText("상태: 추가 정보 요청됨")).toBeTruthy();
  });

  it("omits an empty selection rather than sending an empty array", async () => {
    const calls: {
      reason: string;
      requestedQuestionIds?: string[];
      requestedEvidenceTypes?: SyntheticEvidenceType[];
    }[] = [];
    const client = stubClient({
      async requestMoreInfo(_ticketId, input) {
        calls.push(input);
        return ticket({ status: "NEEDS_MORE_INFO" });
      },
    });

    await renderReview(client);
    await screen.findByText("합성 누수 요청");

    await fireEvent.changeText(screen.getByTestId("more-info-reason"), "확인 요청");
    await fireEvent.press(screen.getByTestId("followup-question-q-server"));
    await fireEvent.press(screen.getByTestId("more-info-submit"));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.requestedQuestionIds).toEqual(["q-server"]);
    expect(calls[0]!.requestedEvidenceTypes).toBeUndefined();
  });

  it("stays disabled with nothing selected or a whitespace-only reason", async () => {
    await renderReview(stubClient());
    await screen.findByText("합성 누수 요청");

    await fireEvent.changeText(screen.getByTestId("more-info-reason"), "확인 요청");
    expect(isDisabled("more-info-submit")).toBe(true);

    await fireEvent.press(screen.getByTestId("followup-question-q-server"));
    expect(isDisabled("more-info-submit")).toBe(false);

    await fireEvent.changeText(screen.getByTestId("more-info-reason"), "   ");
    expect(isDisabled("more-info-submit")).toBe(true);
  });

  it("is not offered once a decision is recorded", async () => {
    const client = stubClient({
      getLandlordTicket: async () =>
        ticket({ status: "APPROVED", decision: { type: "APPROVE" } }),
    });

    await renderReview(client);
    await screen.findByText("합성 누수 요청");

    expect(isDisabled("more-info-submit")).toBe(true);
  });
});

describe("landlord ticket review — failures", () => {
  it("keeps the last validated ticket when an action fails", async () => {
    const client = stubClient({
      async approveRoute() {
        throw new ApiClientError("HTTP_ERROR", "요청을 확인해 주세요.", {
          status: 409,
        });
      },
    });

    await renderReview(client);

    await fireEvent.press(await screen.findByTestId("approve"));

    expect(await screen.findByText("요청을 확인해 주세요.")).toBeTruthy();
    expect(screen.getByText("상태: 검토 대기")).toBeTruthy();
  });

  it("never shows the host from an unrecognised failure", async () => {
    const client = stubClient({
      async approveRoute() {
        throw new Error("connect ECONNREFUSED 10.0.2.2:3000");
      },
    });

    await renderReview(client);

    await fireEvent.press(await screen.findByTestId("approve"));

    expect(
      await screen.findByText("오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
    ).toBeTruthy();
    expect(screen.queryByText(/10\.0\.2\.2/)).toBeNull();
  });

  it("shows a sanitized load failure with a retry", async () => {
    let attempts = 0;
    const client = stubClient({
      async getLandlordTicket() {
        attempts += 1;
        if (attempts === 1) {
          throw new ApiClientError("HTTP_ERROR", "요청을 확인해 주세요.", {
            status: 404,
          });
        }
        return ticket();
      },
    });

    await renderReview(client);

    expect(await screen.findByText("요청을 확인해 주세요.")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("retry"));

    expect(await screen.findByText("합성 누수 요청")).toBeTruthy();
  });
});
