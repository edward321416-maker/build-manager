import type {
  SyntheticEvidenceRequirementDto,
  TenantQuestionDto,
  TenantTicketStatusDto,
} from "@build-manager/api-contracts";
import { describe, expect, it } from "vitest";
import { intakeStage, moreInfoFulfilled, outstandingEvidence } from "./logic";

const leakEvidence: SyntheticEvidenceRequirementDto = {
  evidenceType: "LEAK_LOCATION",
  label: "DEMO 누수 위치 이미지",
  required: true,
  demoFixtureId: "demo-leak-location",
};

const optionalEvidence: SyntheticEvidenceRequirementDto = {
  evidenceType: "GENERAL_VIEW",
  label: "DEMO 일반 참고 이미지",
  required: false,
  demoFixtureId: "demo-general-view",
};

const question: TenantQuestionDto = {
  questionId: "leak.active",
  protocol: "LEAK_V1",
  prompt: "현재도 계속 새고 있나요?",
  responseType: "YES_NO",
  required: true,
  evidenceRequirements: [leakEvidence],
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
    evidenceRequirements: [leakEvidence],
    submittedEvidence: [],
    packet: null,
    moreInfoRequest: null,
    ...overrides,
  };
}

describe("intake stage", () => {
  it("puts safety ahead of every other stage", () => {
    expect(
      intakeStage(
        ticket({
          status: "SAFETY_ESCALATED",
          evidenceStatus: "SAFETY_ESCALATED",
          activeQuestion: question,
          moreInfoRequest: {
            reason: "확인",
            requestedQuestions: [question],
            requestedEvidence: [],
          },
        }),
      ),
    ).toBe("SAFETY");
  });

  it("puts an outstanding follow-up ahead of ordinary intake", () => {
    expect(
      intakeStage(
        ticket({
          status: "NEEDS_MORE_INFO",
          activeQuestion: question,
          moreInfoRequest: {
            reason: "확인",
            requestedQuestions: [question],
            requestedEvidence: [],
          },
        }),
      ),
    ).toBe("MORE_INFO");
  });

  it("asks the active question while one remains", () => {
    expect(intakeStage(ticket({ activeQuestion: question }))).toBe("QUESTION");
  });

  it("moves to evidence once the questions are answered", () => {
    expect(intakeStage(ticket({ activeQuestion: null }))).toBe("EVIDENCE");
  });

  it("is ready to submit once required evidence is in", () => {
    expect(
      intakeStage(
        ticket({
          submittedEvidence: [
            {
              evidenceId: "evidence-1",
              evidenceType: "LEAK_LOCATION",
              label: "DEMO 누수 위치 이미지",
            },
          ],
        }),
      ),
    ).toBe("READY_TO_FINALIZE");
  });

  it("reports a decided ticket as closed to further intake", () => {
    expect(intakeStage(ticket({ status: "APPROVED" }))).toBe("DECIDED");
    expect(intakeStage(ticket({ status: "OVERRIDDEN" }))).toBe("DECIDED");
  });
});

describe("outstanding evidence", () => {
  it("lists required evidence the tenant has not supplied", () => {
    expect(outstandingEvidence(ticket()).map((item) => item.evidenceType)).toEqual(
      ["LEAK_LOCATION"],
    );
  });

  it("ignores optional evidence", () => {
    expect(
      outstandingEvidence(
        ticket({ evidenceRequirements: [optionalEvidence] }),
      ),
    ).toEqual([]);
  });

  it("drops a requirement once matching evidence is submitted", () => {
    expect(
      outstandingEvidence(
        ticket({
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
});

describe("follow-up fulfilment", () => {
  it("is not fulfilled while anything remains outstanding", () => {
    expect(
      moreInfoFulfilled(
        ticket({
          moreInfoRequest: {
            reason: "확인",
            requestedQuestions: [question],
            requestedEvidence: [],
          },
        }),
      ),
    ).toBe(false);
    expect(
      moreInfoFulfilled(
        ticket({
          moreInfoRequest: {
            reason: "확인",
            requestedQuestions: [],
            requestedEvidence: [leakEvidence],
          },
        }),
      ),
    ).toBe(false);
  });

  it("is fulfilled once both lists are empty", () => {
    expect(
      moreInfoFulfilled(
        ticket({
          moreInfoRequest: {
            reason: "확인",
            requestedQuestions: [],
            requestedEvidence: [],
          },
        }),
      ),
    ).toBe(true);
  });

  it("is not fulfilled when there is no request at all", () => {
    expect(moreInfoFulfilled(ticket())).toBe(false);
  });
});
