"use client";

import type { BuildingPassportDto, IssueType } from "@build-manager/api-contracts";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  createBrowserApiClient,
  describeApiError,
} from "@/lib/browser-api-client";
import { StateMessage } from "@/components/landlord/views";
import { TenantBuildingChoices, TenantDemoBanner } from "./views";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; buildings: BuildingPassportDto[] };

const ISSUE_TYPES: ReadonlyArray<{ value: IssueType; label: string }> = [
  { value: "HEATING", label: "난방" },
  { value: "LEAK", label: "누수" },
];

export function TenantHome() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [issueType, setIssueType] = useState<IssueType>("HEATING");
  const [rawUserText, setRawUserText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** Reads the next state rather than setting it, so callers own the timing. */
  const fetchBuildings = useCallback(async (): Promise<LoadState> => {
    try {
      const buildings = await createBrowserApiClient().listDemoBuildings();
      return { kind: "ready", buildings };
    } catch (error) {
      return { kind: "error", message: describeApiError(error) };
    }
  }, []);

  /** Mount already renders the loading state, so it is not set again here. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchBuildings();
      if (!cancelled) {
        setState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchBuildings]);

  /** A retry is a user action, so it visibly returns to the loading state. */
  const reload = useCallback(() => {
    setState({ kind: "loading" });
    void fetchBuildings().then(setState);
  }, [fetchBuildings]);

  /** The report text goes to the server untouched; nothing here inspects it. */
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const buildingId = new FormData(event.currentTarget).get("buildingId");
    if (typeof buildingId !== "string" || buildingId.length === 0) {
      setSubmitError("건물을 선택해 주세요.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const ticket = await createBrowserApiClient().createTicket({
        buildingId,
        issueType,
        rawUserText,
      });
      router.push(`/demo/tenant/tickets/${ticket.ticketId}`);
    } catch (error) {
      setSubmitError(describeApiError(error));
      setSubmitting(false);
    }
  };

  return (
    <main className="tenant-page">
      <TenantDemoBanner />

      <header className="landlord-header">
        <h1>세입자 데모 · 수리 요청</h1>
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
        <form onSubmit={submit} className="tenant-intake-form">
          <TenantBuildingChoices buildings={state.buildings} selected={null} />

          <fieldset className="issue-choices">
            <legend>어떤 문제인가요?</legend>
            {ISSUE_TYPES.map((option) => (
              <div className="field-check" key={option.value}>
                <input
                  type="radio"
                  id={`issue-${option.value}`}
                  name="issueType"
                  value={option.value}
                  checked={issueType === option.value}
                  onChange={() => setIssueType(option.value)}
                />
                <label htmlFor={`issue-${option.value}`}>{option.label}</label>
              </div>
            ))}
          </fieldset>

          <div className="field">
            <label htmlFor="rawUserText">어떤 상황인지 적어 주세요</label>
            <input
              id="rawUserText"
              name="rawUserText"
              type="text"
              value={rawUserText}
              onChange={(event) => setRawUserText(event.target.value)}
              required
            />
          </div>

          {submitError === null ? null : (
            <p className="state-error" role="alert">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            data-testid="create-ticket"
            disabled={submitting || rawUserText.trim().length === 0}
          >
            {submitting ? "접수 중…" : "수리 요청 접수"}
          </button>
        </form>
      ) : null}
    </main>
  );
}
