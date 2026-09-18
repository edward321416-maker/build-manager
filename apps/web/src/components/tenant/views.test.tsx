import type {
  BuildingPassportDto,
  SyntheticEvidenceRequirementDto,
  TenantQuestionDto,
  TenantTicketStatusDto,
} from "@build-manager/api-contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EvidenceStage,
  FollowUpPanel,
  QuestionCard,
  SafetyNotice,
  TenantBuildingChoices,
  TenantDemoBanner,
  TenantStatusPanel,
} from "./views";

const passport: BuildingPassportDto = {
  buildingId: "demo-building-a",
  displayName: "DEMO 해솔빌라",
  demo: true,
  primaryUse: "다가구주택",
  approvalYear: "2011",
  managementMode: "OWNER_DIRECT",
  heatingType: "INDIVIDUAL",
  ownerSuppliedBoiler: true,
  contextVerified: true,
  routingEligibleFields: ["managementMode", "heatingType", "ownerSuppliedBoiler"],
};

const evidence: SyntheticEvidenceRequirementDto = {
  evidenceType: "LEAK_LOCATION",
  label: "DEMO 누수 위치 이미지",
  required: true,
  demoFixtureId: "demo-leak-location",
};

function question(
  overrides: Partial<TenantQuestionDto> = {},
): TenantQuestionDto {
  return {
    questionId: "leak.active",
    protocol: "LEAK_V1",
    prompt: "현재도 계속 새고 있나요?",
    responseType: "YES_NO",
    required: true,
    evidenceRequirements: [],
    ...overrides,
  } as TenantQuestionDto;
}

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
    evidenceRequirements: [evidence],
    submittedEvidence: [],
    packet: null,
    moreInfoRequest: null,
    ...overrides,
  };
}

function markup(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe("tenant demo banner", () => {
  it("states this is a demo with synthetic data", () => {
    const html = markup(<TenantDemoBanner />);

    expect(html).toContain("DEMO MODE");
    expect(html).toContain("합성");
  });

  it("claims no tenancy verification", () => {
    const html = markup(<TenantDemoBanner />);

    expect(html).toContain("포함되어 있지 않습니다");
    for (const affirmative of ["본인 확인되었습니다", "임차인으로 인증"]) {
      expect(html).not.toContain(affirmative);
    }
  });
});

describe("building choices", () => {
  it("offers each demo building with tenant-relevant context", () => {
    const html = markup(
      <TenantBuildingChoices buildings={[passport]} selected={null} />,
    );

    expect(html).toContain("DEMO 해솔빌라");
    expect(html).toContain("다가구주택");
    expect(html).toContain("demo-building-a");
  });

  it("shows an empty state when nothing is seeded", () => {
    expect(markup(<TenantBuildingChoices buildings={[]} selected={null} />)).toContain(
      "건물이 없습니다",
    );
  });
});

describe("question card", () => {
  it("renders a yes/no question as two explicit choices", () => {
    const html = markup(<QuestionCard question={question()} />);

    expect(html).toContain("현재도 계속 새고 있나요?");
    expect(html).toContain("예");
    expect(html).toContain("아니오");
  });

  it("renders a free-text question with a labelled field", () => {
    const html = markup(
      <QuestionCard
        question={question({
          questionId: "leak.firstObservedAt",
          responseType: "TEXT",
          prompt: "처음 발견한 시점을 입력해 주세요.",
        })}
      />,
    );

    expect(html).toContain("처음 발견한 시점을 입력해 주세요.");
    expect(html).toContain("<input");
  });

  it("renders a single-select question with its options", () => {
    const html = markup(
      <QuestionCard
        question={question({
          questionId: "leak.location",
          responseType: "SINGLE_SELECT",
          prompt: "물이 어디에서 보이나요?",
          options: [
            { value: "CEILING_WALL", label: "천장 또는 벽" },
            { value: "APPLIANCE", label: "특정 기기" },
          ],
        })}
      />,
    );

    expect(html).toContain("물이 어디에서 보이나요?");
    expect(html).toContain("천장 또는 벽");
    expect(html).toContain("특정 기기");
  });
});

describe("safety notice", () => {
  it("stops ordinary intake and explains why", () => {
    const html = markup(<SafetyNotice />);

    expect(html).toContain("안전");
    expect(html).toContain("중단");
  });

  it("gives no DIY instruction and no invented emergency contact", () => {
    const html = markup(<SafetyNotice />);

    for (const unsafe of [
      "119",
      "112",
      "직접 수리",
      "밸브를 잠그",
      "차단기를 내리",
      "환기",
    ]) {
      expect(html).not.toContain(unsafe);
    }
  });
});

describe("evidence stage", () => {
  it("offers each outstanding DEMO evidence slot", () => {
    const html = markup(<EvidenceStage requirements={[evidence]} submitted={[]} />);

    expect(html).toContain("DEMO 누수 위치 이미지");
    expect(html).toContain("demo-leak-location");
  });

  it("offers no file, camera, or gallery control", () => {
    const html = markup(<EvidenceStage requirements={[evidence]} submitted={[]} />);

    for (const forbidden of ['type="file"', "capture=", "accept=", "multiple"]) {
      expect(html).not.toContain(forbidden);
    }
  });

  it("lists evidence already submitted", () => {
    const html = markup(
      <EvidenceStage
        requirements={[]}
        submitted={[
          {
            evidenceId: "evidence-1",
            evidenceType: "LEAK_LOCATION",
            label: "DEMO 누수 위치 이미지",
          },
        ]}
      />,
    );

    expect(html).toContain("제출한 DEMO 증빙");
    expect(html).toContain("DEMO 누수 위치 이미지");
  });
});

describe("follow-up panel", () => {
  it("shows the landlord's reason and the outstanding items", () => {
    const html = markup(
      <FollowUpPanel
        request={{
          reason: "누수 위치를 다시 확인해 주세요",
          requestedQuestions: [question()],
          requestedEvidence: [evidence],
        }}
      />,
    );

    expect(html).toContain("누수 위치를 다시 확인해 주세요");
    expect(html).toContain("현재도 계속 새고 있나요?");
    expect(html).toContain("DEMO 누수 위치 이미지");
  });

  it("prompts a resubmission once everything requested is done", () => {
    const html = markup(
      <FollowUpPanel
        request={{
          reason: "누수 위치를 다시 확인해 주세요",
          requestedQuestions: [],
          requestedEvidence: [],
        }}
      />,
    );

    expect(html).toContain("추가정보가 반영되었습니다. 다시 제출해 주세요.");
    expect(html).toContain("누수 위치를 다시 확인해 주세요");
  });
});

describe("tenant status panel", () => {
  it("shows the tenant's own status and evidence state", () => {
    const html = markup(
      <TenantStatusPanel
        ticket={ticket({
          status: "PARTIAL",
          evidenceStatus: "MISSING_REQUIRED",
          packet: { revision: 1, summary: "누수 접수 건입니다.", safetyEscalated: false },
        })}
      />,
    );

    expect(html).toContain("정보 부족");
    expect(html).toContain("필수 정보 부족");
    expect(html).toContain("누수 접수 건입니다.");
  });

  it("never renders landlord-only review data", () => {
    const html = markup(
      <TenantStatusPanel
        ticket={ticket({
          status: "READY_FOR_REVIEW",
          evidenceStatus: "COMPLETE",
          packet: { revision: 2, summary: "요약", safetyEscalated: false },
        })}
      />,
    );

    for (const landlordOnly of [
      "추천 경로",
      "관리사무소",
      "routeCode",
      "provenance",
      "내부 메모",
      "예상 비용",
    ]) {
      expect(html).not.toContain(landlordOnly);
    }
  });
});
