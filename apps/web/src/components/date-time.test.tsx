// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "./date-time";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const now = new Date("2026-10-12T05:00:00Z");
afterEach(() => { vi.useRealTimers(); });

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

  it("shows an unreadable instant as written instead of breaking the screen", () => {
    expect(renderToStaticMarkup(<DateTime at="not a date" now={now} />)).toBe('<time dateTime="not a date">not a date</time>');
  });

  it("keeps relative time true while the page stays open: 방금 becomes N분 전 and then the date", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(now);
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => { root.render(<DateTime at="2026-10-12T04:59:40Z" timeZone="Asia/Seoul" />); });
      expect(host.textContent).toBe("방금");
      await act(async () => { vi.advanceTimersByTime(3 * 60_000); });
      expect(host.textContent).toBe("3분 전");
      await act(async () => { vi.advanceTimersByTime(60 * 60_000); });
      expect(host.textContent).toBe("10월 12일 (월) 오후 1:59");
    } finally {
      // Unmounting stops the shared timer, so a failed assertion cannot leave a fake interval behind.
      await act(async () => root.unmount()); host.remove();
    }
  });
});
