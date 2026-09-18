"use client";

import type {
  BuildingPassportDto,
  LandlordTicketDetailDto,
} from "@build-manager/api-contracts";
import { useCallback, useEffect, useState } from "react";
import {
  createBrowserApiClient,
  describeApiError,
} from "@/lib/browser-api-client";
import { BuildingList, DemoBanner, StateMessage, TicketList } from "./views";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      buildings: BuildingPassportDto[];
      tickets: LandlordTicketDetailDto[];
    };

export function LandlordHome() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  /** Reads the next state rather than setting it, so callers own the timing. */
  const fetchHome = useCallback(async (): Promise<LoadState> => {
    const client = createBrowserApiClient();

    try {
      const [buildings, tickets] = await Promise.all([
        client.listDemoBuildings(),
        client.listTickets({ view: "landlord" }),
      ]);
      return { kind: "ready", buildings, tickets };
    } catch (error) {
      return { kind: "error", message: describeApiError(error) };
    }
  }, []);

  /** Mount already renders the loading state, so it is not set again here. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchHome();
      if (!cancelled) {
        setState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchHome]);

  /** A retry is a user action, so it visibly returns to the loading state. */
  const reload = useCallback(() => {
    setState({ kind: "loading" });
    void fetchHome().then(setState);
  }, [fetchHome]);

  return (
    <main className="landlord-page">
      <DemoBanner />

      <header className="landlord-header">
        <h1>임대인 데모 · 수리 요청 검토</h1>
        <p className="tagline">주소가 수리 프로토콜이 된다.</p>
        <p className="tagline-sub">
          건물이 다르면, 같은 신고도 다르게 물어야 합니다.
        </p>
      </header>

      {state.kind === "loading" ? <StateMessage kind="loading" /> : null}

      {state.kind === "error" ? (
        <StateMessage
          kind="error"
          message={state.message}
          onRetry={reload}
        />
      ) : null}

      {state.kind === "ready" ? (
        <>
          <section aria-labelledby="buildings-heading">
            <h2 id="buildings-heading">데모 건물</h2>
            <BuildingList buildings={state.buildings} />
          </section>

          <section aria-labelledby="tickets-heading">
            <h2 id="tickets-heading">
              수리 요청 <span data-testid="ticket-count">{state.tickets.length}</span>건
            </h2>
            <TicketList tickets={state.tickets} />
          </section>
        </>
      ) : null}
    </main>
  );
}
