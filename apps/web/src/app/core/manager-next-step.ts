import type { CoreTicketDto, ManagerVendorHandoffDto } from "@build-manager/api-contracts";
import { intakeDisplayStatus } from "./ui/work-status-badge";
import { vendorHandoffEligible } from "./vendor-handoff-manager";

/** Where the step's button takes the manager: a section that already exists further down the request. */
export type ManagerStepTarget = "decision" | "vendor" | "handling" | "fact";

export type ManagerNextStep = {
  title: string;
  detail: string;
  action?: { label: string; target: ManagerStepTarget };
};

export type ManagerNextStepInput = {
  ticket: CoreTicketDto;
  /** The Vendor handoff for this ticket once loaded; null when none exists or Vendor handoff is off. */
  handoff: ManagerVendorHandoffDto | null;
  vendorEnabled: boolean;
  /** True while the Vendor handoff for this ticket is still loading; no guess is shown meanwhile. */
  handoffLoading: boolean;
  /** Whether a unit maintenance fact is recorded for a completed request; null while unknown. */
  factRecorded: boolean | null;
};

const decide: ManagerNextStep["action"] = { label: "처리 방법 정하기", target: "decision" };
const vendor: ManagerNextStep["action"] = { label: "업체 연결 열기", target: "vendor" };
const handling: ManagerNextStep["action"] = { label: "처리 기록 열기", target: "handling" };

function vendorStep(handoff: ManagerVendorHandoffDto | null): ManagerNextStep {
  const assignment = handoff?.assignment ?? null;
  if (!assignment || assignment.status === "ENDED") {
    return { title: "업체에 작업을 보내 주세요.", detail: "전달 내용을 확인하고 보안 링크를 발급해 업체에 직접 전해 주세요.", action: vendor };
  }
  if (assignment.status === "PREPARING") {
    return { title: "업체 전달을 마무리해 주세요.", detail: "전달 내용을 게시하고 보안 링크를 발급해 주세요.", action: vendor };
  }
  if (assignment.status === "OFFERED") {
    return { title: "업체가 요청을 확인하기를 기다리고 있어요.", detail: "보안 링크를 업체에 전했는지 확인해 주세요." };
  }
  if (handoff?.phase === "COMPLETION_REPORTED") {
    // After 보고 수정 요청 the phase stays, but the Vendor section only says it waits for the corrected report.
    if (handoff.correctionRequest) return { title: "업체가 보고를 수정하기를 기다리고 있어요.", detail: "수정한 보고가 오면 이 칸에 표시돼요." };
    return { title: "업체가 작업 보고를 보냈어요.", detail: "보고를 확인하고 처리 완료를 기록하거나 수정·추가 작업을 요청해 주세요.", action: { label: "업체 보고 확인하기", target: "vendor" } };
  }
  if (handoff?.activeBlocker) {
    return { title: "업체 작업이 막혔어요.", detail: "막힘 내용을 확인해 주세요.", action: vendor };
  }
  if (handoff?.phase === "SCHEDULING") {
    return { title: "방문 일정을 조율하고 있어요.", detail: handoff.waitingOn === "TENANT" ? "세입자가 시간을 알려 주기를 기다리고 있어요." : "업체가 시간을 제안하기를 기다리고 있어요." };
  }
  return { title: "업체가 작업 중이에요.", detail: "작업 보고가 오면 이 칸에 표시돼요." };
}

/**
 * The one thing the manager should do next on this request, derived only from data the screen already holds.
 * Returns null when there is nothing to do or the answer is not known yet.
 */
export function managerNextStep({ ticket, handoff, vendorEnabled, handoffLoading, factRecorded }: ManagerNextStepInput): ManagerNextStep | null {
  if (ticket.workStatus === "COMPLETED") {
    return factRecorded === false
      ? { title: "처리를 마쳤어요. 호실 정비 사실을 남겨 주세요.", detail: "남긴 사실은 호실 정비 이력에 쌓여요.", action: { label: "정비 사실 기록하기", target: "fact" } }
      : null;
  }
  const intake = intakeDisplayStatus(ticket);
  if (ticket.workStatus === "OPEN") {
    if (intake === "IN_PROGRESS") return { title: "세입자가 아직 질문에 답하는 중이에요.", detail: "제출되면 처리 방법을 정할 수 있어요." };
    if (intake === "NEEDS_MORE_INFO") return { title: "세입자의 추가 답변을 기다리고 있어요.", detail: "답변이 오면 처리 방법을 다시 확인해 주세요." };
    if (intake === "SAFETY_ESCALATED") return { title: "안전 확인이 필요한 접수예요.", detail: "세입자에게 직접 연락해 상황을 먼저 확인해 주세요." };
    if (intake === "PARTIAL" || intake === "READY_FOR_REVIEW") return { title: "처리 방법을 정해 주세요.", detail: "정하면 업체 연결이나 처리 기록을 이어서 할 수 있어요.", action: decide };
  }
  // Until the Vendor handoff is known, neither the Vendor step nor the direct handling form can be told apart.
  if (vendorEnabled && handoffLoading) return null;
  // An active assignment decides the next step even if the route changed after it was made.
  const activeAssignment = Boolean(handoff?.assignment && handoff.assignment.status !== "ENDED");
  if (vendorEnabled && (vendorHandoffEligible(ticket) || activeAssignment)) return vendorStep(handoff);
  return ticket.workStatus === "OPEN"
    ? { title: "처리를 시작하면 기록해 주세요.", detail: "기록하면 세입자도 진행 상황을 볼 수 있어요.", action: handling }
    : { title: "처리를 마치면 완료를 기록해 주세요.", detail: "완료를 기록하면 세입자가 결과를 확인할 수 있어요.", action: handling };
}

/** A short queue-row hint for requests that still wait on an intake step; later steps need the Vendor data. */
export type ManagerRowHint = "DRAFT" | "DECIDE" | "NEEDS_MORE_INFO" | "SAFETY_ESCALATED";

export function managerRowHint(ticket: CoreTicketDto | undefined): ManagerRowHint | null {
  if (!ticket || ticket.workStatus !== "OPEN") return null;
  const intake = intakeDisplayStatus(ticket);
  if (intake === "IN_PROGRESS") return "DRAFT";
  if (intake === "NEEDS_MORE_INFO" || intake === "SAFETY_ESCALATED") return intake;
  if (intake === "PARTIAL" || intake === "READY_FOR_REVIEW") return "DECIDE";
  return null;
}
