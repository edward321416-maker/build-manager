type HistoryEvent = { id: string; kind: string; actorRole: string; message: string; at: string };
export type HistoryLine = { id: string; at: string; actor: "세입자" | "관리자"; label: string; message: string };

const EVENT_NAMES: Record<string, string> = {
  CREATED: "접수 내용 저장", ANSWERED: "답변 저장", EVIDENCE: "증빙 사진 지정", FINALIZED: "수리 요청 제출",
  MORE_INFO: "추가 확인 요청", DECISION: "처리 방법 결정", HANDLING: "처리 기록",
};
const eventName = (kind: string) => (Object.hasOwn(EVENT_NAMES, kind) ? EVENT_NAMES[kind] : "접수 정보 변경");
// Only the intake's repeated saves fold. Decisions, requests and handling records stay one line each, so a correction stays visible.
const FOLDING_KINDS = new Set(["ANSWERED", "EVIDENCE"]);

/**
 * One line per step instead of one per saved answer: consecutive answers or evidence choices by the same person,
 * without a message, fold into `답변 저장 8건` at the last event's time. Lines keep the events' order.
 */
export function historyLines(events: readonly HistoryEvent[]): HistoryLine[] {
  const groups: { last: HistoryEvent; count: number }[] = [];
  for (const event of events) {
    const open = groups.at(-1);
    if (open && FOLDING_KINDS.has(event.kind) && !event.message && !open.last.message && open.last.kind === event.kind && open.last.actorRole === event.actorRole) {
      open.last = event; open.count += 1;
    } else groups.push({ last: event, count: 1 });
  }
  return groups.map(({ last, count }) => ({
    id: last.id, at: last.at, actor: last.actorRole === "TENANT" ? "세입자" : "관리자",
    label: count > 1 ? `${eventName(last.kind)} ${count}건` : eventName(last.kind), message: last.message,
  }));
}
