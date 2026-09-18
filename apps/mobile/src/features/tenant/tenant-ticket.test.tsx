import { ApiClientError, type ApiClient } from "@build-manager/api-client";
import type {
  SubmitSyntheticEvidenceRequest,
  SubmitTenantAnswerRequest,
  SyntheticEvidenceRequirementDto,
  TenantQuestionDto,
  TenantTicketStatusDto,
} from "@build-manager/api-contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { TenantTicket } from "./tenant-ticket";

const TICKET_ID = "ticket-demo-1";

const boilerEvidence: SyntheticEvidenceRequirementDto = {
  evidenceType: "BOILER_DISPLAY",
  label: "DEMO 보일러 표시창 이미지",
  required: true,
  demoFixtureId: "demo-boiler-display",
};

function yesNo(prompt: string, questionId = "heating.hotWater"): TenantQuestionDto {
  return {
    questionId,
    protocol: "HEATING_V1",
    prompt,
    responseType: "YES_NO",
    required: true,
    evidenceRequirements: [],
  };
}

function ticket(
  overrides: Partial<TenantTicketStatusDto> = {},
): TenantTicketStatusDto {
  return {
    ticketId: TICKET_ID,
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
    ...overrides,
  };
}

/** Serves a queue of server responses, one per call, in order. */
function clientServing(
  first: TenantTicketStatusDto,
  overrides: Partial<ApiClient> = {},
): ApiClient {
  return {
    async getTenantTicketStatus() {
      return first;
    },
    async submitAnswer() {
      return first;
    },
    async submitEvidence() {
      return first;
    },
    async finalizeTicket() {
      return first;
    },
    ...overrides,
  } as ApiClient;
}

async function renderTicket(client: ApiClient) {
  await render(<TenantTicket client={client} ticketId={TICKET_ID} />);
}

describe("tenant ticket — loading", () => {
  it("loads the ticket named by the route", async () => {
    const seen: string[] = [];
    const client = clientServing(ticket(), {
      async getTenantTicketStatus(id) {
        seen.push(id);
        return ticket();
      },
    });

    await renderTicket(client);

    await waitFor(() => expect(seen).toEqual([TICKET_ID]));
  });

  it("shows a sanitized error with a retry", async () => {
    let attempts = 0;
    const client = clientServing(ticket(), {
      async getTenantTicketStatus() {
        attempts += 1;
        if (attempts === 1) {
          throw new ApiClientError("HTTP_ERROR", "요청을 확인해 주세요.", {
            status: 404,
          });
        }
        return ticket({ status: "PARTIAL" });
      },
    });

    await renderTicket(client);

    expect(await screen.findByText("요청을 확인해 주세요.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("retry"));
    expect(await screen.findByText("상태: 정보 부족")).toBeTruthy();
  });

  it("re-reads the ticket on manual refresh", async () => {
    let calls = 0;
    const client = clientServing(ticket(), {
      async getTenantTicketStatus() {
        calls += 1;
        return calls === 1
          ? ticket({ status: "IN_PROGRESS" })
          : ticket({ status: "READY_FOR_REVIEW", evidenceStatus: "COMPLETE" });
      },
    });

    await renderTicket(client);
    expect(await screen.findByText("상태: 작성 중")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("refresh"));

    expect(await screen.findByText("상태: 검토 대기")).toBeTruthy();
  });
});

describe("tenant ticket — guided questions", () => {
  it("answers a yes/no question with two labelled actions", async () => {
    const answers: SubmitTenantAnswerRequest[] = [];
    const client = clientServing(
      ticket({ activeQuestion: yesNo("온수도 나오지 않나요?") }),
      {
        async submitAnswer(_id, request) {
          answers.push(request);
          return ticket({ activeQuestion: yesNo("난방이 모든 방에서 안 되나요?", "heating.allRooms") });
        },
      },
    );

    await renderTicket(client);
    expect(await screen.findByText("온수도 나오지 않나요?")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("answer-no"));

    await waitFor(() =>
      expect(answers).toEqual([
        { questionId: "heating.hotWater", answer: false },
      ]),
    );
    // The next question is whatever the server returned.
    expect(
      await screen.findByText("난방이 모든 방에서 안 되나요?"),
    ).toBeTruthy();
  });

  it("answers a free-text question", async () => {
    const answers: SubmitTenantAnswerRequest[] = [];
    const client = clientServing(
      ticket({
        activeQuestion: {
          questionId: "heating.errorCode",
          protocol: "HEATING_V1",
          prompt: "표시창에 오류 코드가 있나요?",
          responseType: "TEXT",
          required: true,
          evidenceRequirements: [],
        },
      }),
      {
        async submitAnswer(_id, request) {
          answers.push(request);
          return ticket({ status: "PARTIAL" });
        },
      },
    );

    await renderTicket(client);
    await screen.findByText("표시창에 오류 코드가 있나요?");

    await fireEvent.changeText(screen.getByTestId("answer-text"), "E1");
    await fireEvent.press(screen.getByTestId("answer-text-submit"));

    await waitFor(() =>
      expect(answers).toEqual([{ questionId: "heating.errorCode", answer: "E1" }]),
    );
  });

  it("answers a single-select question using the server's option values", async () => {
    const answers: SubmitTenantAnswerRequest[] = [];
    const client = clientServing(
      ticket({
        issueType: "LEAK",
        protocol: "LEAK_V1",
        activeQuestion: {
          questionId: "leak.location",
          protocol: "LEAK_V1",
          prompt: "물이 어디에서 보이나요?",
          responseType: "SINGLE_SELECT",
          required: true,
          evidenceRequirements: [],
          options: [
            { value: "CEILING_WALL", label: "천장 또는 벽" },
            { value: "APPLIANCE", label: "특정 기기" },
          ],
        },
      }),
      {
        async submitAnswer(_id, request) {
          answers.push(request);
          return ticket({ status: "PARTIAL" });
        },
      },
    );

    await renderTicket(client);
    await screen.findByText("물이 어디에서 보이나요?");
    expect(screen.getByText("천장 또는 벽")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("answer-CEILING_WALL"));

    await waitFor(() =>
      expect(answers).toEqual([
        { questionId: "leak.location", answer: "CEILING_WALL" },
      ]),
    );
  });

  it("renders whichever question the server sends, without choosing one itself", async () => {
    // Same tenant report, two buildings: the server decides what to ask, and
    // the app renders exactly that.
    const buildingA = clientServing(
      ticket({ activeQuestion: yesNo("온수도 나오지 않나요?") }),
    );
    const buildingB = clientServing(
      ticket({
        buildingId: "demo-building-b",
        protocol: "HEATING_V1",
        activeQuestion: {
          ...yesNo("이 호실만 난방이 안 되나요?", "heating.unitOnly"),
          protocol: "HEATING_V1",
        },
      }),
    );

    await renderTicket(buildingA);
    expect(await screen.findByText("온수도 나오지 않나요?")).toBeTruthy();
    expect(screen.queryByText("이 호실만 난방이 안 되나요?")).toBeNull();
    await screen.unmount();

    await renderTicket(buildingB);
    expect(await screen.findByText("이 호실만 난방이 안 되나요?")).toBeTruthy();
    expect(screen.queryByText("온수도 나오지 않나요?")).toBeNull();
  });
});

describe("tenant ticket — safety", () => {
  it("interrupts intake when the report itself escalated", async () => {
    const client = clientServing(
      ticket({
        status: "SAFETY_ESCALATED",
        evidenceStatus: "SAFETY_ESCALATED",
        activeQuestion: yesNo("온수도 나오지 않나요?"),
        evidenceRequirements: [boilerEvidence],
      }),
    );

    await renderTicket(client);

    expect(await screen.findByTestId("safety-notice")).toBeTruthy();
    expect(screen.queryByTestId("answer-yes")).toBeNull();
    expect(screen.queryByTestId("submit-BOILER_DISPLAY")).toBeNull();
    expect(screen.queryByTestId("finalize")).toBeNull();
    expect(screen.getByText("상태: 안전 확인 필요")).toBeTruthy();
  });

  it("interrupts intake when an answer escalated it", async () => {
    const client = clientServing(
      ticket({ activeQuestion: yesNo("가스 냄새가 나나요?", "safety.gasSmell") }),
      {
        async submitAnswer() {
          return ticket({
            status: "SAFETY_ESCALATED",
            evidenceStatus: "SAFETY_ESCALATED",
          });
        },
      },
    );

    await renderTicket(client);
    await screen.findByText("가스 냄새가 나나요?");

    await fireEvent.press(screen.getByTestId("answer-yes"));

    expect(await screen.findByTestId("safety-notice")).toBeTruthy();
    expect(screen.queryByTestId("finalize")).toBeNull();
  });

  it("gives no DIY instruction and invents no emergency contact", async () => {
    const client = clientServing(ticket({ status: "SAFETY_ESCALATED" }));

    await renderTicket(client);
    await screen.findByTestId("safety-notice");

    for (const unsafe of ["119", "112", "직접 수리", "밸브를 잠그", "차단기를 내리"]) {
      expect(screen.queryByText(new RegExp(unsafe))).toBeNull();
    }
  });
});

describe("tenant ticket — synthetic evidence", () => {
  it("offers the DEMO evidence the server asked for", async () => {
    const client = clientServing(
      ticket({ evidenceRequirements: [boilerEvidence] }),
    );

    await renderTicket(client);

    expect(await screen.findByText("DEMO 보일러 표시창 이미지")).toBeTruthy();
    expect(screen.getByTestId("submit-BOILER_DISPLAY")).toBeTruthy();
    expect(screen.getByTestId("evidence-stage")).toBeTruthy();
  });

  it("submits the server's fixture id verbatim", async () => {
    const submitted: SubmitSyntheticEvidenceRequest[] = [];
    const client = clientServing(
      ticket({ evidenceRequirements: [boilerEvidence] }),
      {
        async submitEvidence(_id, request) {
          submitted.push(request);
          return ticket({
            evidenceRequirements: [boilerEvidence],
            submittedEvidence: [
              {
                evidenceId: "evidence-1",
                evidenceType: "BOILER_DISPLAY",
                label: "DEMO 보일러 표시창 이미지",
              },
            ],
            evidenceStatus: "COMPLETE",
          });
        },
      },
    );

    await renderTicket(client);
    await screen.findByTestId("submit-BOILER_DISPLAY");

    await fireEvent.press(screen.getByTestId("submit-BOILER_DISPLAY"));

    await waitFor(() =>
      expect(submitted).toEqual([
        { evidenceType: "BOILER_DISPLAY", fixtureId: "demo-boiler-display" },
      ]),
    );
    expect(await screen.findByText("제출한 DEMO 증빙")).toBeTruthy();
  });

  it("offers no camera, gallery, or file control", async () => {
    const client = clientServing(
      ticket({ evidenceRequirements: [boilerEvidence] }),
    );

    await renderTicket(client);
    await screen.findByTestId("evidence-stage");

    for (const forbidden of ["사진 촬영", "갤러리", "파일 선택", "업로드"]) {
      expect(screen.queryByText(new RegExp(forbidden))).toBeNull();
    }
  });
});

describe("tenant ticket — finalize and status", () => {
  it("finalizes and renders the returned state", async () => {
    let finalized = 0;
    const client = clientServing(ticket(), {
      async finalizeTicket() {
        finalized += 1;
        return ticket({
          status: "READY_FOR_REVIEW",
          evidenceStatus: "COMPLETE",
          packet: { revision: 1, summary: "난방 접수 건입니다.", safetyEscalated: false },
        });
      },
    });

    await renderTicket(client);
    await screen.findByTestId("finalize");

    await fireEvent.press(screen.getByTestId("finalize"));

    await waitFor(() => expect(finalized).toBe(1));
    expect(await screen.findByText("상태: 검토 대기")).toBeTruthy();
    expect(screen.getByText("정보 상태: 필수 정보 확인됨")).toBeTruthy();
    expect(screen.getByText("난방 접수 건입니다.")).toBeTruthy();
  });

  it("shows a partial submission as missing information", async () => {
    const client = clientServing(
      ticket({
        status: "PARTIAL",
        evidenceStatus: "MISSING_REQUIRED",
        packet: { revision: 1, summary: "누수 접수 건입니다.", safetyEscalated: false },
      }),
    );

    await renderTicket(client);

    expect(await screen.findByText("상태: 정보 부족")).toBeTruthy();
    expect(screen.getByText("정보 상태: 필수 정보 부족")).toBeTruthy();
  });

  it("never renders landlord-only review detail", async () => {
    const client = clientServing(
      ticket({
        status: "READY_FOR_REVIEW",
        evidenceStatus: "COMPLETE",
        packet: { revision: 2, summary: "요약", safetyEscalated: false },
      }),
    );

    await renderTicket(client);
    await screen.findByText("상태: 검토 대기");

    for (const landlordOnly of [
      "추천 경로",
      "관리사무소",
      "임대인 검토",
      "내부 메모",
      "예상 비용",
      "판단 근거",
    ]) {
      expect(screen.queryByText(new RegExp(landlordOnly))).toBeNull();
    }
  });
});

describe("tenant ticket — landlord follow-up", () => {
  const requestedQuestion = yesNo("누수가 계속되고 있나요?", "leak.active");

  it("shows the landlord's reason and the outstanding items first", async () => {
    const client = clientServing(
      ticket({
        status: "NEEDS_MORE_INFO",
        activeQuestion: yesNo("온수도 나오지 않나요?"),
        moreInfoRequest: {
          reason: "누수 시점을 다시 확인해 주세요",
          requestedQuestions: [requestedQuestion],
          requestedEvidence: [boilerEvidence],
        },
      }),
    );

    await renderTicket(client);

    expect(await screen.findByTestId("follow-up")).toBeTruthy();
    expect(screen.getByText("누수 시점을 다시 확인해 주세요")).toBeTruthy();
    expect(screen.getByText("누수가 계속되고 있나요?")).toBeTruthy();
    expect(screen.getByTestId("submit-BOILER_DISPLAY")).toBeTruthy();
    // The ordinary question flow waits behind the landlord's request.
    expect(screen.queryByText("온수도 나오지 않나요?")).toBeNull();
  });

  it("answers a requested question through the follow-up panel", async () => {
    const answers: SubmitTenantAnswerRequest[] = [];
    const client = clientServing(
      ticket({
        status: "NEEDS_MORE_INFO",
        moreInfoRequest: {
          reason: "확인해 주세요",
          requestedQuestions: [requestedQuestion],
          requestedEvidence: [],
        },
      }),
      {
        async submitAnswer(_id, request) {
          answers.push(request);
          return ticket({
            status: "IN_PROGRESS",
            moreInfoRequest: {
              reason: "확인해 주세요",
              requestedQuestions: [],
              requestedEvidence: [],
            },
          });
        },
      },
    );

    await renderTicket(client);
    await screen.findByText("누수가 계속되고 있나요?");

    await fireEvent.press(screen.getByTestId("answer-yes"));

    await waitFor(() =>
      expect(answers).toEqual([{ questionId: "leak.active", answer: true }]),
    );
    expect(
      await screen.findByText("추가정보가 반영되었습니다. 다시 제출해 주세요."),
    ).toBeTruthy();
    expect(screen.getByTestId("refinalize")).toBeTruthy();
  });

  it("clears the request after the tenant resubmits", async () => {
    let finalized = 0;
    const client = clientServing(
      ticket({
        status: "IN_PROGRESS",
        moreInfoRequest: {
          reason: "확인해 주세요",
          requestedQuestions: [],
          requestedEvidence: [],
        },
      }),
      {
        async finalizeTicket() {
          finalized += 1;
          return ticket({
            status: "READY_FOR_REVIEW",
            evidenceStatus: "COMPLETE",
            moreInfoRequest: null,
            packet: { revision: 2, summary: "요약", safetyEscalated: false },
          });
        },
      },
    );

    await renderTicket(client);
    await screen.findByTestId("refinalize");

    await fireEvent.press(screen.getByTestId("refinalize"));

    await waitFor(() => expect(finalized).toBe(1));
    expect(await screen.findByText("상태: 검토 대기")).toBeTruthy();
    expect(screen.queryByTestId("follow-up")).toBeNull();
  });

  it("closes the flow once the landlord has decided", async () => {
    const client = clientServing(
      ticket({
        status: "APPROVED",
        evidenceStatus: "COMPLETE",
        activeQuestion: yesNo("온수도 나오지 않나요?"),
        packet: { revision: 2, summary: "요약", safetyEscalated: false },
      }),
    );

    await renderTicket(client);

    expect(await screen.findByText("상태: 임대인 확인 완료")).toBeTruthy();
    expect(screen.queryByTestId("answer-yes")).toBeNull();
    expect(screen.queryByTestId("finalize")).toBeNull();
  });
});
