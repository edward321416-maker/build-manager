import { describe, expect, it } from "vitest";
import { historyLines } from "./history-lines";

type Kind = "CREATED" | "ANSWERED" | "EVIDENCE" | "FINALIZED" | "MORE_INFO" | "DECISION" | "HANDLING" | "SOMETHING_NEW";
let next = 0;
const event = (kind: Kind, actorRole: "TENANT" | "MANAGER" = "TENANT", message = "") =>
  ({ id: `event-${++next}`, kind, actorRole, message, at: `2026-10-12T0${next % 10}:00:00Z` });

describe("history lines", () => {
  it("folds consecutive answers by the same person into one line with a count and the last time", () => {
    const answers = Array.from({ length: 8 }, () => event("ANSWERED"));
    const lines = historyLines([event("CREATED"), ...answers, event("FINALIZED")]);
    expect(lines.map(line => line.label)).toEqual(["접수 내용 저장", "질문 답변 8건", "수리 요청 제출"]);
    expect(lines[1]).toMatchObject({ actor: "세입자", at: answers[7].at, id: answers[7].id });
  });

  it("starts a new line when the person changes, and never folds a line that carries a message", () => {
    const lines = historyLines([
      event("ANSWERED"), event("ANSWERED", "MANAGER"), event("ANSWERED"),
      event("MORE_INFO", "MANAGER", "합성 질문 하나"), event("MORE_INFO", "MANAGER", "합성 질문 둘"),
    ]);
    expect(lines.map(line => `${line.actor} · ${line.label}${line.message ? ` · ${line.message}` : ""}`)).toEqual([
      "세입자 · 질문 답변", "관리자 · 질문 답변", "세입자 · 질문 답변",
      "관리자 · 추가 확인 요청 · 합성 질문 하나", "관리자 · 추가 확인 요청 · 합성 질문 둘",
    ]);
  });

  it("folds only repeated intake saves, so a decision and its correction stay two lines", () => {
    const lines = historyLines([event("EVIDENCE"), event("EVIDENCE"), event("DECISION", "MANAGER"), event("DECISION", "MANAGER")]);
    expect(lines.map(line => line.label)).toEqual(["증빙 사진 지정 2건", "처리 방법 결정", "처리 방법 결정"]);
  });

  it("names every kind, with one name for both kinds of decision and a fallback for new kinds", () => {
    const lines = historyLines([event("EVIDENCE"), event("DECISION", "MANAGER"), event("HANDLING", "MANAGER", "합성 기록"), event("SOMETHING_NEW")]);
    expect(lines.map(line => line.label)).toEqual(["증빙 사진 지정", "처리 방법 결정", "처리 기록", "접수 정보 변경"]);
  });
});
