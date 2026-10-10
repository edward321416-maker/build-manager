import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EnvironmentNote, InvitationMetadata, PhotoSelectionSurface, TaskZone, TicketProgress } from "./core-display";
import { intakeDisplayStatus, isIntakeDraft } from "./work-status-badge";

describe("Apple-Toss presentation boundaries", () => {
  it("keeps the synthetic environment disclosure outside collapsed limitations", () => {
    const html = renderToStaticMarkup(<EnvironmentNote>업체 출동·알림은 지원하지 않습니다.</EnvironmentNote>);
    expect(html.indexOf("개발 환경 · 샘플 데이터")).toBeLessThan(html.indexOf("<details"));
    expect(html).toContain("<summary>검증 환경 안내</summary>");
    expect(html).toContain("업체 출동·알림은 지원하지 않습니다.");
  });

  it("retains the complete request reference and both original timestamps", () => {
    const invite = { requestNumber: "12345678-1234-4234-8234-123456789abc", requestedAt: "2026-10-04T01:00:00Z", expiresAt: "2026-10-05T00:00:00Z" };
    const html = renderToStaticMarkup(<InvitationMetadata invite={invite} />);
    expect(html).toContain(invite.requestNumber);
    expect(html).toContain(`dateTime="${invite.requestedAt}"`);
    expect(html).toContain(`dateTime="${invite.expiresAt}"`);
    expect(html).toContain("확인 번호");
  });

  it("does not invent a request code or application date before a request", () => {
    const html = renderToStaticMarkup(<InvitationMetadata invite={{ requestNumber: null, requestedAt: null, expiresAt: "2026-10-05T00:00:00Z" }} />);
    expect(html).not.toContain("확인 번호");
    expect(html).not.toContain("신청 시각");
    expect(html).toContain("만료 시각");
  });

  it("keeps manager completion and insufficient intake evidence as separate status axes", () => {
    const html = renderToStaticMarkup(<TicketProgress workStatus="COMPLETED" intakeStatus="PARTIAL">관리자가 완료로 기록했습니다.</TicketProgress>);
    expect(html).toContain('data-testid="work-status"');
    expect(html).toContain('aria-hidden="true">✓ </span>처리 완료');
    expect(html).toContain("접수 상태: 추가 정보 필요");
    expect(html.indexOf("접수 상태")).toBeLessThan(html.indexOf("관리자가 완료로 기록했습니다."));
  });

  it("shows an unsubmitted request as one 제출 전 state instead of 접수 plus an intake line", () => {
    const html = renderToStaticMarkup(<TicketProgress workStatus="OPEN" intakeStatus="IN_PROGRESS">아직 보내지 않았어요.</TicketProgress>);
    expect(html).toContain('data-work-state="DRAFT">제출 전</span>');
    expect(html).not.toContain("접수 상태:");
    expect(html).not.toContain('data-work-state="OPEN"');
    expect(html).toContain("아직 보내지 않았어요.");
  });

  it("keeps the separate intake line once the request was submitted", () => {
    const html = renderToStaticMarkup(<TicketProgress workStatus="OPEN" intakeStatus="PARTIAL">관리자에게 보냈어요.</TicketProgress>);
    expect(html).toContain('data-work-state="OPEN">접수</span>');
    expect(html).toContain("접수 상태: 추가 정보 필요");
    expect(html).not.toContain("제출 전");
  });

  it("treats only an open, unsubmitted intake as a draft", () => {
    expect(isIntakeDraft({ workStatus: "OPEN", detail: { status: "IN_PROGRESS" } })).toBe(true);
    expect(isIntakeDraft({ workStatus: "OPEN", detail: { status: "PARTIAL" } })).toBe(false);
    expect(isIntakeDraft({ workStatus: "OPEN", detail: { status: "NEEDS_MORE_INFO" } })).toBe(false);
    expect(isIntakeDraft({ workStatus: "IN_PROGRESS", detail: { status: "IN_PROGRESS" } })).toBe(false);
  });

  it("keeps a request that was sent once out of the draft state while its more-info answers reset the status", () => {
    const sent = [{ kind: "CREATED" }, { kind: "FINALIZED" }, { kind: "MORE_INFO" }, { kind: "ANSWERED" }];
    expect(intakeDisplayStatus({ workStatus: "OPEN", detail: { status: "IN_PROGRESS" }, events: sent })).toBe("NEEDS_MORE_INFO");
    expect(isIntakeDraft({ workStatus: "OPEN", detail: { status: "IN_PROGRESS" }, events: sent })).toBe(false);
    expect(intakeDisplayStatus({ workStatus: "OPEN", detail: { status: "IN_PROGRESS" }, events: [{ kind: "CREATED" }, { kind: "ANSWERED" }] })).toBe("IN_PROGRESS");
    expect(intakeDisplayStatus({ workStatus: "OPEN", detail: { status: "SAFETY_ESCALATED" }, events: sent })).toBe("SAFETY_ESCALATED");
    expect(intakeDisplayStatus({ workStatus: "OPEN", detail: { status: "PARTIAL" }, events: sent })).toBe("PARTIAL");
  });

  it("names a second to-do zone apart while keeping the visible heading and conversation default", () => {
    const intake = renderToStaticMarkup(<TaskZone tenant label="지금 할 일: 추가 확인" message="질문에 모두 답하면 '수리 요청 제출' 버튼이 나와요.">질문</TaskZone>);
    expect(intake).toContain('aria-label="지금 할 일: 추가 확인"');
    expect(intake).toContain("<h2>지금 할 일</h2>");
    expect(intake).toContain("질문에 모두 답하면");
    expect(intake).not.toContain("관리자 질문에 답변해주세요.");
    const conversation = renderToStaticMarkup(<TaskZone tenant>대화</TaskZone>);
    expect(conversation).toContain('aria-label="지금 할 일"');
    expect(conversation).toContain("관리자 질문에 답변해주세요.");
  });

  it("retains the caller's disabled native file input and accessible name", () => {
    const html = renderToStaticMarkup(<PhotoSelectionSurface disabled selectionCount={2}>
      <input aria-label="참고 사진 선택" type="file" accept="image/jpeg,image/png" multiple disabled />
    </PhotoSelectionSurface>);
    expect(html).toMatch(/<label[^>]*>[\s\S]*<input[^>]*aria-label="참고 사진 선택"[^>]*>[\s\S]*<\/label>/);
    expect(html).toContain('accept="image/jpeg,image/png"');
    expect(html).toContain('multiple=""');
    expect(html).toContain('disabled=""');
    expect(html).toContain("사진 2장 선택됨");
  });
});
