"use client";

import type {
  SyntheticEvidenceRequirementDto,
  TenantQuestionDto,
  TenantTicketStatusDto,
} from "@build-manager/api-contracts";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  createBrowserApiClient,
  describeApiError,
} from "@/lib/browser-api-client";
import { StateMessage } from "@/components/landlord/views";
import { intakeStage, outstandingEvidence } from "./logic";
import {
  EvidenceStage,
  FollowUpPanel,
  QuestionCard,
  SafetyNotice,
  TenantDemoBanner,
  TenantStatusPanel,
} from "./views";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; ticket: TenantTicketStatusDto };

/** Reads the answer the tenant chose, shaped by the question's response type. */
function readAnswer(
  question: TenantQuestionDto,
  form: HTMLFormElement,
  submitter: HTMLButtonElement | null,
): boolean | string | null {
  if (question.responseType === "YES_NO") {
    if (submitter?.value === "yes") {
      return true;
    }
    return submitter?.value === "no" ? false : null;
  }

  if (question.responseType === "TEXT") {
    const value = new FormData(form).get("answer");
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }

  return submitter?.value ?? null;
}

export function TicketIntake({ ticketId }: { ticketId: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Reads the next state rather than setting it, so callers own the timing. */
  const fetchTicket = useCallback(async (): Promise<LoadState> => {
    try {
      const ticket =
        await createBrowserApiClient().getTenantTicketStatus(ticketId);
      return { kind: "ready", ticket };
    } catch (error) {
      return { kind: "error", message: describeApiError(error) };
    }
  }, [ticketId]);

  /** Mount already renders the loading state, so it is not set again here. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchTicket();
      if (!cancelled) {
        setState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchTicket]);

  /** Retry and refresh are user actions, so they visibly reload. */
  const reload = useCallback(() => {
    setState({ kind: "loading" });
    void fetchTicket().then(setState);
  }, [fetchTicket]);

  /** Every step renders the DTO the server returned; nothing is assumed here. */
  const runAction = async (
    action: (
      client: ReturnType<typeof createBrowserApiClient>,
    ) => Promise<TenantTicketStatusDto>,
  ) => {
    setBusy(true);
    setActionError(null);
    try {
      setState({ kind: "ready", ticket: await action(createBrowserApiClient()) });
    } catch (error) {
      setActionError(describeApiError(error));
    } finally {
      setBusy(false);
    }
  };

  const answerQuestion = (
    question: TenantQuestionDto,
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const answer = readAnswer(question, event.currentTarget, submitter);
    if (answer === null) {
      setActionError("답변을 입력해 주세요.");
      return;
    }
    void runAction((client) =>
      client.submitAnswer(ticketId, { questionId: question.questionId, answer }),
    );
  };

  const submitEvidence = (
    requirements: SyntheticEvidenceRequirementDto[],
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const requirement = requirements.find(
      (candidate) => candidate.demoFixtureId === submitter?.value,
    );
    if (requirement === undefined) {
      return;
    }
    void runAction((client) =>
      client.submitEvidence(ticketId, {
        evidenceType: requirement.evidenceType,
        // Server-provided: the browser never invents a fixture identifier.
        fixtureId: requirement.demoFixtureId,
      }),
    );
  };

  const ticket = state.kind === "ready" ? state.ticket : null;
  const stage = ticket === null ? null : intakeStage(ticket);

  return (
    <main className="tenant-page">
      <TenantDemoBanner />
      <p>
        <Link href="/demo/tenant">← 세입자 데모 홈</Link>
      </p>

      {state.kind === "loading" ? <StateMessage kind="loading" /> : null}

      {state.kind === "error" ? (
        <StateMessage
          kind="error"
          message={state.message}
          onRetry={reload}
        />
      ) : null}

      {ticket === null ? null : (
        <>
          {actionError === null ? null : (
            <p className="state-error" role="alert">
              {actionError}
            </p>
          )}

          {stage === "SAFETY" ? <SafetyNotice /> : null}

          {stage === "MORE_INFO" && ticket.moreInfoRequest !== null ? (
            <FollowUpPanel request={ticket.moreInfoRequest}>
              {ticket.moreInfoRequest.requestedQuestions.length > 0 ? (
                <form
                  onSubmit={(event) =>
                    answerQuestion(
                      ticket.moreInfoRequest!.requestedQuestions[0]!,
                      event,
                    )
                  }
                >
                  <QuestionCard
                    question={ticket.moreInfoRequest.requestedQuestions[0]!}
                  />
                </form>
              ) : null}

              {ticket.moreInfoRequest.requestedEvidence.length > 0 ? (
                <form
                  onSubmit={(event) =>
                    submitEvidence(
                      ticket.moreInfoRequest!.requestedEvidence,
                      event,
                    )
                  }
                >
                  <EvidenceStage
                    requirements={ticket.moreInfoRequest.requestedEvidence}
                    submitted={[]}
                  />
                </form>
              ) : null}

              {ticket.moreInfoRequest.requestedQuestions.length === 0 &&
              ticket.moreInfoRequest.requestedEvidence.length === 0 ? (
                <button
                  type="button"
                  data-testid="refinalize"
                  disabled={busy}
                  onClick={() =>
                    void runAction((client) => client.finalizeTicket(ticketId))
                  }
                >
                  다시 제출하기
                </button>
              ) : null}
            </FollowUpPanel>
          ) : null}

          {stage === "QUESTION" && ticket.activeQuestion !== null ? (
            <form
              onSubmit={(event) => answerQuestion(ticket.activeQuestion!, event)}
            >
              <QuestionCard question={ticket.activeQuestion} />
            </form>
          ) : null}

          {stage === "EVIDENCE" ? (
            <form
              onSubmit={(event) =>
                submitEvidence(outstandingEvidence(ticket), event)
              }
            >
              <EvidenceStage
                requirements={outstandingEvidence(ticket)}
                submitted={ticket.submittedEvidence}
              />
            </form>
          ) : null}

          {stage === "READY_TO_FINALIZE" ? (
            <section className="finalize-stage">
              <h2>제출할 준비가 되었습니다</h2>
              <p className="passport-note">
                제출 후 필요한 정보가 더 있으면 임대인이 추가로 요청할 수 있습니다.
              </p>
              <button
                type="button"
                data-testid="finalize"
                disabled={busy}
                onClick={() =>
                  void runAction((client) => client.finalizeTicket(ticketId))
                }
              >
                수리 요청 제출
              </button>
            </section>
          ) : null}

          <TenantStatusPanel ticket={ticket} />

          <button
            type="button"
            data-testid="refresh"
            disabled={busy}
            onClick={reload}
          >
            상태 새로고침
          </button>
        </>
      )}
    </main>
  );
}
