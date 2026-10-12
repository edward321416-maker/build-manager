import type { CoreTicketDto, ManagerVendorHandoffDto } from "@build-manager/api-contracts";
import { describe, expect, it } from "vitest";
import { managerNextStep, managerRowHint, type ManagerNextStepInput } from "./manager-next-step";

type Detail = { status: string; decision?: { type: string; routeCode?: string } | null; repairPacket?: { safetyEscalated?: boolean; recommendation?: { routeCode: string } | null } | null };
function ticket(workStatus: CoreTicketDto["workStatus"], detail: Detail, events: string[] = ["CREATED"]): CoreTicketDto {
  // Only the fields the next-step rules read; the rest of the DTO is irrelevant to these rules.
  return { workStatus, detail: { decision: null, repairPacket: null, ...detail }, events: events.map(kind => ({ kind })) } as unknown as CoreTicketDto;
}
function handoff(assignment: string | null, extra: Partial<Pick<ManagerVendorHandoffDto, "phase" | "waitingOn">> & { blocker?: boolean; correction?: boolean } = {}): ManagerVendorHandoffDto {
  return { assignment: assignment ? { status: assignment } : null, phase: extra.phase ?? "OFFERED", waitingOn: extra.waitingOn ?? "NONE", activeBlocker: extra.blocker ? { code: "ACCESS" } : null,
    correctionRequest: extra.correction ? { id: "c", completionReportId: "r", reason: "합성 수정 사유" } : null } as unknown as ManagerVendorHandoffDto;
}
const step = (input: Partial<ManagerNextStepInput> & Pick<ManagerNextStepInput, "ticket">) =>
  managerNextStep({ handoff: null, vendorEnabled: false, handoffLoading: false, factRecorded: null, ...input });
const vendorRoute = (workStatus: CoreTicketDto["workStatus"] = "OPEN") => ticket(workStatus, { status: "OVERRIDDEN", decision: { type: "OVERRIDE", routeCode: "GENERAL_VENDOR" } }, ["CREATED", "FINALIZED", "DECISION"]);

describe("manager next step", () => {
  it("waits without a button while the tenant has not submitted, or answers a more-info request", () => {
    expect(step({ ticket: ticket("OPEN", { status: "IN_PROGRESS" }) })).toEqual({ title: "세입자가 아직 질문에 답하는 중이에요.", detail: "제출되면 처리 방법을 정할 수 있어요." });
    expect(step({ ticket: ticket("OPEN", { status: "NEEDS_MORE_INFO" }, ["CREATED", "FINALIZED", "MORE_INFO"]) })?.title).toBe("세입자의 추가 답변을 기다리고 있어요.");
    // An answer resets the server status to IN_PROGRESS inside the more-info round; it still waits on the tenant.
    expect(step({ ticket: ticket("OPEN", { status: "IN_PROGRESS" }, ["CREATED", "FINALIZED", "MORE_INFO", "ANSWERED"]) })?.title).toBe("세입자의 추가 답변을 기다리고 있어요.");
    expect(step({ ticket: ticket("OPEN", { status: "SAFETY_ESCALATED" }) })).toEqual({ title: "안전 확인이 필요한 접수예요.", detail: "세입자에게 직접 연락해 상황을 먼저 확인해 주세요." });
  });

  it("asks for a route decision once a request was submitted and is undecided", () => {
    for (const status of ["PARTIAL", "READY_FOR_REVIEW"]) {
      expect(step({ ticket: ticket("OPEN", { status }, ["CREATED", "FINALIZED"]) })?.action).toEqual({ label: "처리 방법 정하기", target: "decision" });
    }
  });

  it("points at the handling record for routes without a Vendor and when Vendor handoff is off", () => {
    const office = ticket("OPEN", { status: "OVERRIDDEN", decision: { type: "OVERRIDE", routeCode: "MANAGEMENT_OFFICE" } });
    expect(step({ ticket: office })).toEqual({ title: "처리를 시작하면 기록해 주세요.", detail: "기록하면 세입자도 진행 상황을 볼 수 있어요.", action: { label: "처리 기록 열기", target: "handling" } });
    expect(step({ ticket: office, vendorEnabled: true, handoff: handoff(null) })?.action?.target).toBe("handling");
    expect(step({ ticket: vendorRoute("IN_PROGRESS") })?.title).toBe("처리를 마치면 완료를 기록해 주세요.");
  });

  it("follows the Vendor assignment on Vendor routes and shows nothing while it loads", () => {
    expect(step({ ticket: vendorRoute(), vendorEnabled: true, handoffLoading: true })).toBeNull();
    expect(step({ ticket: vendorRoute(), vendorEnabled: true, handoff: handoff(null) })?.action).toEqual({ label: "업체 연결 열기", target: "vendor" });
    expect(step({ ticket: vendorRoute(), vendorEnabled: true, handoff: handoff("ENDED") })?.title).toBe("업체에 작업을 보내 주세요.");
    expect(step({ ticket: vendorRoute(), vendorEnabled: true, handoff: handoff("PREPARING") })?.title).toBe("업체 전달을 마무리해 주세요.");
    expect(step({ ticket: vendorRoute(), vendorEnabled: true, handoff: handoff("OFFERED") })).toEqual({ title: "업체가 요청을 확인하기를 기다리고 있어요.", detail: "보안 링크를 업체에 전했는지 확인해 주세요." });
    const reported = step({ ticket: vendorRoute("IN_PROGRESS"), vendorEnabled: true, handoff: handoff("ACTIVE", { phase: "COMPLETION_REPORTED" }) });
    expect(reported).toEqual({ title: "업체가 작업 보고를 보냈어요.", detail: "보고를 확인하고 처리 완료를 기록하거나 수정·추가 작업을 요청해 주세요.", action: { label: "업체 보고 확인하기", target: "vendor" } });
    // A requested correction leaves the phase as COMPLETION_REPORTED, but there is nothing to review until it arrives.
    expect(step({ ticket: vendorRoute("IN_PROGRESS"), vendorEnabled: true, handoff: handoff("ACTIVE", { phase: "COMPLETION_REPORTED", correction: true }) }))
      .toEqual({ title: "업체가 보고를 수정하기를 기다리고 있어요.", detail: "수정한 보고가 오면 이 칸에 표시돼요." });
    expect(step({ ticket: vendorRoute("IN_PROGRESS"), vendorEnabled: true, handoff: handoff("ACTIVE", { phase: "IN_PROGRESS", blocker: true }) })?.title).toBe("업체 작업이 막혔어요.");
    expect(step({ ticket: vendorRoute("IN_PROGRESS"), vendorEnabled: true, handoff: handoff("ACTIVE", { phase: "SCHEDULING", waitingOn: "TENANT" }) })).toEqual({ title: "방문 일정을 조율하고 있어요.", detail: "세입자가 시간을 알려 주기를 기다리고 있어요." });
    expect(step({ ticket: vendorRoute("IN_PROGRESS"), vendorEnabled: true, handoff: handoff("ACTIVE", { phase: "SCHEDULING", waitingOn: "VENDOR" }) })).toEqual({ title: "방문 일정을 조율하고 있어요.", detail: "업체가 시간을 제안하기를 기다리고 있어요." });
    expect(step({ ticket: vendorRoute("IN_PROGRESS"), vendorEnabled: true, handoff: handoff("ACTIVE", { phase: "SCHEDULED" }) })).toEqual({ title: "업체가 작업 중이에요.", detail: "작업 보고가 오면 이 칸에 표시돼요." });
  });

  it("lets an active assignment decide the step even after the route moved away from a Vendor", () => {
    const office = ticket("IN_PROGRESS", { status: "OVERRIDDEN", decision: { type: "OVERRIDE", routeCode: "MANAGEMENT_OFFICE" } });
    expect(step({ ticket: office, vendorEnabled: true, handoff: handoff("ACTIVE", { phase: "IN_PROGRESS" }) })).toEqual({ title: "업체가 작업 중이에요.", detail: "작업 보고가 오면 이 칸에 표시돼요." });
    expect(step({ ticket: office, vendorEnabled: true, handoff: handoff("ENDED") })?.action?.target).toBe("handling");
  });

  it("asks for a maintenance fact only after completion when none is recorded", () => {
    const done = ticket("COMPLETED", { status: "OVERRIDDEN" });
    expect(step({ ticket: done, factRecorded: false })?.action).toEqual({ label: "정비 사실 기록하기", target: "fact" });
    expect(step({ ticket: done, factRecorded: true })).toBeNull();
    expect(step({ ticket: done, factRecorded: null })).toBeNull();
  });
});

describe("manager queue row hint", () => {
  it("names only intake steps that the row data can prove", () => {
    expect(managerRowHint(ticket("OPEN", { status: "IN_PROGRESS" }))).toBe("DRAFT");
    expect(managerRowHint(ticket("OPEN", { status: "PARTIAL" }, ["CREATED", "FINALIZED"]))).toBe("DECIDE");
    expect(managerRowHint(ticket("OPEN", { status: "IN_PROGRESS" }, ["CREATED", "FINALIZED", "MORE_INFO", "ANSWERED"]))).toBe("NEEDS_MORE_INFO");
    expect(managerRowHint(ticket("OPEN", { status: "SAFETY_ESCALATED" }))).toBe("SAFETY_ESCALATED");
    expect(managerRowHint(ticket("OPEN", { status: "OVERRIDDEN" }))).toBeNull();
    expect(managerRowHint(ticket("IN_PROGRESS", { status: "PARTIAL" }))).toBeNull();
    expect(managerRowHint(undefined)).toBeNull();
  });
});
