import type {
  SyntheticEvidenceRequirementDto,
  TenantTicketStatusDto,
} from "@build-manager/api-contracts";
import { intakeStage, moreInfoFulfilled, outstandingEvidence } from "./logic";

const evidence: SyntheticEvidenceRequirementDto = {
  evidenceType: "LEAK_LOCATION",
  label: "DEMO 누수 위치 이미지",
  required: true,
  demoFixtureId: "demo-leak-location",
};

function ticket(
  overrides: Partial<TenantTicketStatusDto> = {},
): TenantTicketStatusDto {
  return {
    ticketId: "ticket-a",
    buildingId: "demo-building-b",
    issueType: "LEAK",
    protocol: "LEAK_V1",
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

const question: NonNullable<TenantTicketStatusDto["activeQuestion"]> = {
  questionId: "leak.active",
  protocol: "LEAK_V1",
  prompt: "현재도 계속 새고 있나요?",
  responseType: "YES_NO",
  required: true,
  evidenceRequirements: [],
};

describe("outstanding evidence", () => {
  it("lists required evidence the tenant has not supplied", () => {
    expect(
      outstandingEvidence(ticket({ evidenceRequirements: [evidence] })),
    ).toEqual([evidence]);
  });

  it("drops evidence already submitted", () => {
    expect(
      outstandingEvidence(
        ticket({
          evidenceRequirements: [evidence],
          submittedEvidence: [
            {
              evidenceId: "evidence-1",
              evidenceType: "LEAK_LOCATION",
              label: "DEMO 누수 위치 이미지",
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("ignores optional evidence", () => {
    expect(
      outstandingEvidence(
        ticket({ evidenceRequirements: [{ ...evidence, required: false }] }),
      ),
    ).toEqual([]);
  });
});

describe("more info fulfilled", () => {
  it("is false when nothing was requested", () => {
    expect(moreInfoFulfilled(ticket())).toBe(false);
  });

  it("is false while an item is still outstanding", () => {
    expect(
      moreInfoFulfilled(
        ticket({
          moreInfoRequest: {
            reason: "확인해 주세요",
            requestedQuestions: [question],
            requestedEvidence: [],
          },
        }),
      ),
    ).toBe(false);
  });

  it("is true once the server reports both lists empty", () => {
    expect(
      moreInfoFulfilled(
        ticket({
          moreInfoRequest: {
            reason: "확인해 주세요",
            requestedQuestions: [],
            requestedEvidence: [],
          },
        }),
      ),
    ).toBe(true);
  });
});

describe("intake stage", () => {
  it("puts safety ahead of an active question", () => {
    expect(
      intakeStage(
        ticket({ status: "SAFETY_ESCALATED", activeQuestion: question }),
      ),
    ).toBe("SAFETY");
  });

  it("puts safety ahead of an outstanding follow-up", () => {
    expect(
      intakeStage(
        ticket({
          evidenceStatus: "SAFETY_ESCALATED",
          moreInfoRequest: {
            reason: "확인해 주세요",
            requestedQuestions: [question],
            requestedEvidence: [],
          },
        }),
      ),
    ).toBe("SAFETY");
  });

  it("reads safety from the packet the server returned", () => {
    expect(
      intakeStage(
        ticket({
          packet: { revision: 1, summary: "요약", safetyEscalated: true },
        }),
      ),
    ).toBe("SAFETY");
  });

  it("treats a landlord decision as decided", () => {
    expect(intakeStage(ticket({ status: "APPROVED" }))).toBe("DECIDED");
    expect(intakeStage(ticket({ status: "OVERRIDDEN" }))).toBe("DECIDED");
  });

  it("puts an active request ahead of the ordinary question flow", () => {
    expect(
      intakeStage(
        ticket({
          activeQuestion: question,
          moreInfoRequest: {
            reason: "확인해 주세요",
            requestedQuestions: [question],
            requestedEvidence: [],
          },
        }),
      ),
    ).toBe("MORE_INFO");
  });

  it("asks the active question before collecting evidence", () => {
    expect(
      intakeStage(
        ticket({ activeQuestion: question, evidenceRequirements: [evidence] }),
      ),
    ).toBe("QUESTION");
  });

  it("collects outstanding evidence once questions are done", () => {
    expect(intakeStage(ticket({ evidenceRequirements: [evidence] }))).toBe(
      "EVIDENCE",
    );
  });

  it("is ready to finalize when nothing is outstanding", () => {
    expect(intakeStage(ticket())).toBe("READY_TO_FINALIZE");
  });
});
