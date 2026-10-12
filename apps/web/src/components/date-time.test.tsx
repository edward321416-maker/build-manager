import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DateTime } from "./date-time";

const now = new Date("2026-10-12T05:00:00Z");

describe("DateTime", () => {
  it("shows a recent instant as relative time and keeps the date and time in the title", () => {
    const html = renderToStaticMarkup(<DateTime at="2026-10-12T04:50:00Z" now={now} timeZone="Asia/Seoul" />);
    expect(html).toBe('<time dateTime="2026-10-12T04:50:00Z" title="10월 12일 (월) 오후 1:50">10분 전</time>');
  });

  it("shows an older instant as the date and time without a title", () => {
    const html = renderToStaticMarkup(<DateTime at="2026-10-10T04:18:00Z" now={now} timeZone="Asia/Seoul" />);
    expect(html).toBe('<time dateTime="2026-10-10T04:18:00Z">10월 10일 (토) 오후 1:18</time>');
  });

  it("can keep a recent instant as the date and time, as due dates do", () => {
    const html = renderToStaticMarkup(<DateTime at="2026-10-12T04:50:00Z" now={now} timeZone="Asia/Seoul" relative={false} />);
    expect(html).toContain(">10월 12일 (월) 오후 1:50</time>");
  });
});
