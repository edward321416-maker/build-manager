"use client";

import type { LandlordTicketDetailDto } from "@build-manager/api-contracts";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  createBrowserApiClient,
  describeApiError,
} from "@/lib/browser-api-client";
import { canApprove, canRequestMoreInfo, overrideOptions } from "./logic";
import { DemoBanner, RepairPacketPanel, StateMessage } from "./views";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; ticket: LandlordTicketDetailDto };

export function TicketReview({ ticketId }: { ticketId: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [moreInfoReason, setMoreInfoReason] = useState("");

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const ticket = await createBrowserApiClient().getLandlordTicket(ticketId);
      setState({ kind: "ready", ticket });
      setSelectedRoute(overrideOptions(ticket)[0]?.routeCode ?? "");
    } catch (error) {
      setState({ kind: "error", message: describeApiError(error) });
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Every action re-reads the validated server state; nothing is faked here. */
  const runAction = async (
    action: (client: ReturnType<typeof createBrowserApiClient>) => Promise<
      LandlordTicketDetailDto
    >,
  ) => {
    setBusy(true);
    setActionError(null);
    try {
      const ticket = await action(createBrowserApiClient());
      setState({ kind: "ready", ticket });
      setSelectedRoute(overrideOptions(ticket)[0]?.routeCode ?? "");
    } catch (error) {
      setActionError(describeApiError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="landlord-page">
      <DemoBanner />
      <p>
        <Link href="/demo/landlord">← 임대인 데모 홈</Link>
      </p>

      {state.kind === "loading" ? <StateMessage kind="loading" /> : null}

      {state.kind === "error" ? (
        <StateMessage
          kind="error"
          message={state.message}
          onRetry={() => void load()}
        />
      ) : null}

      {state.kind === "ready" ? (
        <>
          <RepairPacketPanel ticket={state.ticket} />

          <section aria-labelledby="decision-heading" className="decision-panel">
            <h3 id="decision-heading">임대인 결정</h3>

            {actionError === null ? null : (
              <p className="state-error" role="alert">
                {actionError}
              </p>
            )}

            <div className="decision-action">
              <button
                type="button"
                data-testid="approve"
                disabled={busy || !canApprove(state.ticket)}
                onClick={() =>
                  void runAction((client) => client.approveRoute(ticketId))
                }
              >
                추천 경로 승인
              </button>
              {canApprove(state.ticket) ? null : (
                <p className="action-note">
                  현재 상태에서는 승인할 수 있는 추천 경로가 없습니다.
                </p>
              )}
            </div>

            <form
              className="decision-action"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction((client) =>
                  client.overrideRoute(ticketId, {
                    routeCode: selectedRoute,
                    reason: overrideReason,
                  }),
                );
              }}
            >
              <label htmlFor="overrideRoute">직접 지정할 경로</label>
              <select
                id="overrideRoute"
                name="overrideRoute"
                value={selectedRoute}
                disabled={busy || overrideOptions(state.ticket).length === 0}
                onChange={(event) => setSelectedRoute(event.target.value)}
              >
                {overrideOptions(state.ticket).map((option) => (
                  <option key={option.routeCode} value={option.routeCode}>
                    {option.label}
                  </option>
                ))}
              </select>

              <label htmlFor="overrideReason">지정 사유</label>
              <input
                id="overrideReason"
                name="overrideReason"
                type="text"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
              />

              <button
                type="submit"
                data-testid="override"
                disabled={
                  busy ||
                  selectedRoute === "" ||
                  overrideReason.trim().length === 0
                }
              >
                경로 직접 지정
              </button>
              {overrideOptions(state.ticket).length === 0 ? (
                <p className="action-note">
                  서버가 제시한 경로 후보가 없어 직접 지정할 수 없습니다.
                </p>
              ) : null}
            </form>

            <form
              className="decision-action"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction((client) =>
                  client.requestMoreInfo(ticketId, {
                    reason: moreInfoReason,
                    requestedItems: [moreInfoReason],
                  }),
                );
              }}
            >
              <label htmlFor="moreInfoReason">추가로 확인할 내용</label>
              <input
                id="moreInfoReason"
                name="moreInfoReason"
                type="text"
                value={moreInfoReason}
                onChange={(event) => setMoreInfoReason(event.target.value)}
              />
              <button
                type="submit"
                data-testid="request-more-info"
                disabled={
                  busy ||
                  !canRequestMoreInfo(state.ticket) ||
                  moreInfoReason.trim().length === 0
                }
              >
                추가 정보 요청
              </button>
              {canRequestMoreInfo(state.ticket) ? null : (
                <p className="action-note">
                  현재 상태에서는 추가 정보를 요청할 수 없습니다.
                </p>
              )}
            </form>
          </section>
        </>
      ) : null}
    </main>
  );
}
