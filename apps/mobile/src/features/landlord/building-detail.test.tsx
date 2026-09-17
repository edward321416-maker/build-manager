import { ApiClientError, type ApiClient } from "@build-manager/api-client";
import type {
  BuildingPassportDto,
  OwnerVerificationRequest,
} from "@build-manager/api-contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { BuildingDetail } from "./building-detail";

const BUILDING_ID = "building-server-id";

function passport(
  overrides: Partial<BuildingPassportDto> = {},
): BuildingPassportDto {
  return {
    buildingId: BUILDING_ID,
    displayName: "DEMO 건물",
    demo: true,
    primaryUse: "공동주택",
    approvalYear: "2018",
    managementMode: "OWNER_DIRECT",
    heatingType: "INDIVIDUAL",
    contextVerified: true,
    routingEligibleFields: ["managementMode", "heatingType"],
    ...overrides,
  };
}

function stubClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    async getBuilding() {
      return passport();
    },
    async verifyBuildingContext() {
      return passport();
    },
    ...overrides,
  } as ApiClient;
}

function renderDetail(client: ApiClient, onBack = jest.fn()) {
  return render(
    <BuildingDetail buildingId={BUILDING_ID} client={client} onBack={onBack} />,
  );
}

describe("landlord building detail — load", () => {
  it("reads the building named by the route", async () => {
    const seen: string[] = [];
    const client = stubClient({
      async getBuilding(buildingId) {
        seen.push(buildingId);
        return passport();
      },
    });

    await renderDetail(client);

    await waitFor(() => expect(seen).toEqual([BUILDING_ID]));
  });

  it("shows loading until the passport arrives", async () => {
    await renderDetail(
      stubClient({
        getBuilding: () => new Promise<BuildingPassportDto>(() => {}),
      }),
    );

    expect(screen.getByTestId("loading")).toBeTruthy();
  });

  it("separates routing context from informational context", async () => {
    await renderDetail(stubClient());

    expect(await screen.findByText("DEMO 건물")).toBeTruthy();
    expect(screen.getByText("주용도")).toBeTruthy();
    expect(screen.getByText("공동주택")).toBeTruthy();
    expect(screen.getByText("사용승인 연도")).toBeTruthy();
    // Informational fields carry no mutation control.
    expect(screen.queryByTestId("primaryUse-input")).toBeNull();
    expect(screen.queryByTestId("approvalYear-input")).toBeNull();
  });

  it("says this is demo context confirmation, not identity verification", async () => {
    await renderDetail(stubClient());
    await screen.findByText("DEMO 건물");

    expect(screen.getByTestId("context-disclaimer")).toBeTruthy();
    for (const overclaim of [
      "소유권이 확인되었습니다",
      "본인 인증 완료",
      "집주인 인증",
      "권한이 확인되었습니다",
    ]) {
      expect(screen.queryByText(new RegExp(overclaim))).toBeNull();
    }
  });

  it("returns to the landlord home on request", async () => {
    const onBack = jest.fn();

    await renderDetail(stubClient(), onBack);

    await fireEvent.press(await screen.findByTestId("back-to-landlord"));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe("landlord building detail — context confirmation", () => {
  it("sends the selected context exactly", async () => {
    const requests: OwnerVerificationRequest[] = [];
    const client = stubClient({
      async getBuilding() {
        return passport({ ownerSuppliedBoiler: true });
      },
      async verifyBuildingContext(_buildingId, request) {
        requests.push(request);
        return passport({
          managementMode: "MANAGEMENT_OFFICE",
          heatingType: "CENTRAL_SHARED",
          ownerSuppliedBoiler: false,
        });
      },
    });

    await renderDetail(client);

    await fireEvent.press(
      await screen.findByTestId("management-MANAGEMENT_OFFICE"),
    );
    await fireEvent.press(screen.getByTestId("heating-CENTRAL_SHARED"));
    await fireEvent.press(screen.getByTestId("boiler-false"));
    await fireEvent.press(screen.getByTestId("save-context"));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toEqual({
      managementMode: "MANAGEMENT_OFFICE",
      heatingType: "CENTRAL_SHARED",
      ownerSuppliedBoiler: false,
    });
  });

  it("never invents a boiler value the server did not supply", async () => {
    const requests: OwnerVerificationRequest[] = [];
    const client = stubClient({
      async getBuilding() {
        return passport();
      },
      async verifyBuildingContext(_buildingId, request) {
        requests.push(request);
        return passport();
      },
    });

    await renderDetail(client);
    await screen.findByText("DEMO 건물");

    // No returned value means no control and no submitted property.
    expect(screen.queryByTestId("boiler-true")).toBeNull();
    expect(screen.queryByTestId("boiler-false")).toBeNull();

    await fireEvent.press(screen.getByTestId("save-context"));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(Object.hasOwn(requests[0]!, "ownerSuppliedBoiler")).toBe(false);
  });

  it("renders the passport the server returned, not the local selection", async () => {
    const client = stubClient({
      async getBuilding() {
        return passport({ ownerSuppliedBoiler: true });
      },
      async verifyBuildingContext() {
        return passport({
          displayName: "DEMO 건물",
          managementMode: "MANAGEMENT_OFFICE",
          heatingType: "CENTRAL_SHARED",
          ownerSuppliedBoiler: false,
          routingEligibleFields: [
            "managementMode",
            "heatingType",
            "ownerSuppliedBoiler",
          ],
        });
      },
    });

    await renderDetail(client);

    await fireEvent.press(await screen.findByTestId("heating-CENTRAL_SHARED"));
    await fireEvent.press(screen.getByTestId("save-context"));

    expect(await screen.findByTestId("context-saved")).toBeTruthy();
    expect(screen.getByText("중앙·공용난방")).toBeTruthy();
    expect(screen.getByText("관리사무소")).toBeTruthy();
  });

  it("blocks a duplicate save while one is in flight", async () => {
    let calls = 0;
    const client = stubClient({
      async verifyBuildingContext() {
        calls += 1;
        return new Promise<BuildingPassportDto>(() => {});
      },
    });

    await renderDetail(client);

    await fireEvent.press(await screen.findByTestId("save-context"));
    await fireEvent.press(screen.getByTestId("save-context"));

    expect(calls).toBe(1);
  });

  it("keeps the last validated passport when saving fails", async () => {
    const client = stubClient({
      async getBuilding() {
        return passport({ managementMode: "OWNER_DIRECT" });
      },
      async verifyBuildingContext() {
        throw new ApiClientError("HTTP_ERROR", "요청을 확인해 주세요.", {
          status: 400,
        });
      },
    });

    await renderDetail(client);

    await fireEvent.press(await screen.findByTestId("save-context"));

    expect(await screen.findByText("요청을 확인해 주세요.")).toBeTruthy();
    expect(screen.getByText("임대인 직접 관리")).toBeTruthy();
  });

  it("never shows the host from an unrecognised save failure", async () => {
    const client = stubClient({
      async verifyBuildingContext() {
        throw new Error("connect ECONNREFUSED 10.0.2.2:3000");
      },
    });

    await renderDetail(client);

    await fireEvent.press(await screen.findByTestId("save-context"));

    expect(
      await screen.findByText("오류가 발생했습니다. 잠시 후 다시 시도해 주세요."),
    ).toBeTruthy();
    expect(screen.queryByText(/10\.0\.2\.2/)).toBeNull();
  });
});
