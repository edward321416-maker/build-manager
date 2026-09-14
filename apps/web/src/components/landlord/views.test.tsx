import type {
  BuildingPassportDto,
  LandlordTicketDetailDto,
} from "@build-manager/api-contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BuildingList,
  BuildingPassportPanel,
  DemoBanner,
  RepairPacketPanel,
  StateMessage,
  TicketList,
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

const sharedPassport: BuildingPassportDto = {
  ...passport,
  buildingId: "demo-building-b",
  displayName: "DEMO 라온하우징",
  managementMode: "MANAGEMENT_OFFICE",
  heatingType: "CENTRAL_SHARED",
  ownerSuppliedBoiler: undefined,
  routingEligibleFields: ["managementMode", "heatingType"],
};

function ticket(
  overrides: Partial<LandlordTicketDetailDto> = {},
): LandlordTicketDetailDto {
  return {
    ticketId: "ticket-a",
    building: sharedPassport,
    issueType: "LEAK",
    protocol: "LEAK_V1",
    status: "READY_FOR_REVIEW",
    evidenceStatus: "COMPLETE",
    activeQuestion: null,
    repairPacket: {
      revision: 2,
      summary: "누수 접수 건입니다.",
      safetyEscalated: false,
      recommendation: {
        routeCode: "MANAGEMENT_OFFICE",
        label: "관리사무소",
        reasons: ["관리사무소 관리 건물의 천장·벽 누수"],
      },
      routeAlternatives: [{ routeCode: "LANDLORD_REVIEW", label: "임대인 검토" }],
      provenance: ["managementMode", "heatingType"],
      internalNotes: [],
      estimatedCost: null,
      affectedUnits: [],
      hiddenContacts: [],
    },
    decision: null,
    ...overrides,
  };
}

function markup(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe("demo banner", () => {
  it("states plainly that this is a demo with synthetic data", () => {
    const html = markup(<DemoBanner />);

    expect(html).toContain("DEMO MODE");
    expect(html).toContain("합성");
  });

  it("denies rather than implies auth, ownership, and dispatch", () => {
    const html = markup(<DemoBanner />);

    // The banner may name these capabilities, but only to disclaim them.
    expect(html).toContain("포함되어 있지 않습니다");
    for (const affirmative of [
      "인증되었습니다",
      "소유가 확인되었습니다",
      "업체가 배정되었습니다",
      "실제 고객",
      "국내 최초",
    ]) {
      expect(html).not.toContain(affirmative);
    }
  });
});

describe("building list", () => {
  it("renders every demo building with a link to its passport", () => {
    const html = markup(<BuildingList buildings={[passport, sharedPassport]} />);

    expect(html).toContain("DEMO 해솔빌라");
    expect(html).toContain("DEMO 라온하우징");
    expect(html).toContain("/demo/landlord/buildings/demo-building-a");
    expect(html).toContain("/demo/landlord/buildings/demo-building-b");
  });

  it("shows an empty state rather than a blank area", () => {
    const html = markup(<BuildingList buildings={[]} />);

    expect(html).toContain("건물이 없습니다");
  });
});

describe("building passport", () => {
  it("separates routing-eligible context from informational context", () => {
    const html = markup(<BuildingPassportPanel passport={passport} />);

    expect(html).toContain("난방 방식");
    expect(html).toContain("개별난방");
    expect(html).toContain("라우팅 기준");
    expect(html).toContain("참고 정보");
  });

  it("does not present the approval year as a routing input", () => {
    const html = markup(<BuildingPassportPanel passport={passport} />);
    const approvalIndex = html.indexOf("사용승인 연도");
    const informationalIndex = html.indexOf("참고 정보");

    expect(approvalIndex).toBeGreaterThan(-1);
    expect(approvalIndex).toBeGreaterThan(informationalIndex);
  });

  it("marks the building as synthetic demo data", () => {
    expect(markup(<BuildingPassportPanel passport={passport} />)).toContain(
      "DEMO",
    );
  });
});

describe("ticket list", () => {
  it("renders a row per ticket with its status", () => {
    const html = markup(<TicketList tickets={[ticket()]} />);

    expect(html).toContain("ticket-a");
    expect(html).toContain("/demo/landlord/tickets/ticket-a");
    expect(html).toContain("검토 대기");
  });

  it("shows a zero-ticket empty state", () => {
    const html = markup(<TicketList tickets={[]} />);

    expect(html).toContain("접수된 수리 요청이 없습니다");
  });
});

describe("repair packet", () => {
  it("shows the revision, evidence state, recommendation, and why", () => {
    const html = markup(<RepairPacketPanel ticket={ticket()} />);

    expect(html).toContain("2");
    expect(html).toContain("관리사무소");
    expect(html).toContain("관리사무소 관리 건물의 천장·벽 누수");
    expect(html).toContain("managementMode");
  });

  it("states why no route is recommended when evidence is missing", () => {
    const html = markup(
      <RepairPacketPanel
        ticket={ticket({
          status: "PARTIAL",
          evidenceStatus: "MISSING_REQUIRED",
          repairPacket: {
            ...ticket().repairPacket!,
            recommendation: null,
            routeAlternatives: [],
          },
        })}
      />,
    );

    expect(html).toContain("추천 경로가 없습니다");
    expect(html).not.toContain("관리사무소 관리 건물의 천장·벽 누수");
  });

  it("never presents a normal approval path for a safety-escalated ticket", () => {
    const html = markup(
      <RepairPacketPanel
        ticket={ticket({
          status: "SAFETY_ESCALATED",
          evidenceStatus: "SAFETY_ESCALATED",
          repairPacket: {
            ...ticket().repairPacket!,
            safetyEscalated: true,
            recommendation: null,
            routeAlternatives: [],
          },
        })}
      />,
    );

    expect(html).toContain("안전");
    expect(html).not.toContain("추천 경로: ");
    for (const unsafe of ["119", "직접 수리", "밸브를 잠그", "차단기를 내리"]) {
      expect(html).not.toContain(unsafe);
    }
  });

  it("shows the recorded human decision once one exists", () => {
    const html = markup(
      <RepairPacketPanel
        ticket={ticket({ status: "APPROVED", decision: { type: "APPROVE" } })}
      />,
    );

    expect(html).toContain("승인");
  });
});

describe("state messages", () => {
  it("renders a loading state", () => {
    expect(markup(<StateMessage kind="loading" />)).toContain("불러오는 중");
  });

  it("renders a sanitized error state with a retry affordance", () => {
    const html = markup(
      <StateMessage kind="error" message="요청을 확인해 주세요." />,
    );

    expect(html).toContain("요청을 확인해 주세요.");
    expect(html).toContain("다시 시도");
  });

  it("never renders raw server internals", () => {
    const html = markup(
      <StateMessage kind="error" message="요청을 확인해 주세요." />,
    );

    for (const leak of ["SQLITE", "at Object.", ".sqlite", "Error:"]) {
      expect(html).not.toContain(leak);
    }
  });
});
