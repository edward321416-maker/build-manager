import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EnvironmentNote, InvitationMetadata, PhotoSelectionSurface, TicketProgress } from "./core-display";

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
