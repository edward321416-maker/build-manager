import type { ApiClient } from "@build-manager/api-client";
import type {
  SyntheticEvidenceRequirementDto,
  TenantQuestionDto,
  TenantTicketStatusDto,
} from "@build-manager/api-contracts";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  ActionButton,
  DemoBanner,
  ErrorState,
  LoadingState,
  Screen,
  SectionHeading,
} from "../../components/ui";
import { describeMobileError } from "../../lib/errors";
import { intakeStage, moreInfoFulfilled, outstandingEvidence } from "./logic";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; ticket: TenantTicketStatusDto };

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "작성 중",
  PARTIAL: "정보 부족",
  READY_FOR_REVIEW: "검토 대기",
  NEEDS_MORE_INFO: "추가 정보 요청됨",
  SAFETY_ESCALATED: "안전 확인 필요",
  APPROVED: "임대인 확인 완료",
  OVERRIDDEN: "임대인 확인 완료",
};

const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  COMPLETE: "필수 정보 확인됨",
  MISSING_REQUIRED: "필수 정보 부족",
  CONFLICTING: "정보가 서로 어긋남",
  SAFETY_ESCALATED: "안전 위험 신호",
};

function QuestionCard({
  question,
  onAnswer,
  busy,
}: {
  question: TenantQuestionDto;
  onAnswer: (answer: boolean | string) => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");

  return (
    <View style={styles.card} testID="question-card">
      <SectionHeading>{question.prompt}</SectionHeading>

      {question.responseType === "YES_NO" ? (
        <View style={styles.group}>
          <ActionButton
            disabled={busy}
            label="예"
            onPress={() => onAnswer(true)}
            testID="answer-yes"
          />
          <ActionButton
            disabled={busy}
            label="아니오"
            onPress={() => onAnswer(false)}
            testID="answer-no"
          />
        </View>
      ) : null}

      {question.responseType === "TEXT" ? (
        <View style={styles.group}>
          <TextInput
            accessibilityLabel="답변"
            onChangeText={setText}
            style={styles.input}
            testID="answer-text"
            value={text}
          />
          <ActionButton
            disabled={busy || text.trim().length === 0}
            label="답변 제출"
            onPress={() => onAnswer(text)}
            testID="answer-text-submit"
          />
        </View>
      ) : null}

      {question.responseType === "SINGLE_SELECT" ? (
        <View style={styles.group}>
          {question.options.map((option) => (
            <ActionButton
              disabled={busy}
              key={option.value}
              label={option.label}
              onPress={() => onAnswer(option.value)}
              testID={`answer-${option.value}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SafetyNotice() {
  return (
    <View accessibilityRole="alert" style={styles.card} testID="safety-notice">
      <SectionHeading>안전 확인이 필요합니다</SectionHeading>
      <Text style={styles.body}>
        신고 내용에서 위험 신호가 확인되어 일반 절차를 중단했습니다.
      </Text>
      <Text style={styles.body}>
        이 데모는 안전을 진단하거나 인증하지 않습니다. 사람이 직접 상황을 확인해야
        합니다. 임대인·관리 주체에게 전달되도록 접수 상태가 표시됩니다.
      </Text>
    </View>
  );
}

function EvidenceStage({
  requirements,
  submitted,
  onSubmit,
  busy,
}: {
  requirements: SyntheticEvidenceRequirementDto[];
  submitted: TenantTicketStatusDto["submittedEvidence"];
  onSubmit: (requirement: SyntheticEvidenceRequirementDto) => void;
  busy: boolean;
}) {
  return (
    <View style={styles.card} testID="evidence-stage">
      <SectionHeading>DEMO 증빙</SectionHeading>
      <Text style={styles.body}>
        이 데모는 실제 사진을 올리지 않습니다. 준비된 합성 예시를 선택해
        제출합니다.
      </Text>

      {requirements.map((requirement) => (
        <View key={requirement.evidenceType} style={styles.group}>
          <Text style={styles.body}>{requirement.label}</Text>
          <ActionButton
            disabled={busy}
            label="DEMO 증빙 제출"
            onPress={() => onSubmit(requirement)}
            testID={`submit-${requirement.evidenceType}`}
          />
        </View>
      ))}

      {submitted.length === 0 ? null : (
        <View style={styles.group}>
          <Text style={styles.bodyStrong}>제출한 DEMO 증빙</Text>
          {submitted.map((item) => (
            <Text key={item.evidenceId} style={styles.body}>
              {item.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

export function TenantTicket({
  client,
  ticketId,
}: {
  client: ApiClient;
  ticketId: string;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Returns the next state rather than setting it, so callers own the timing. */
  const fetchTicket = useCallback(async (): Promise<LoadState> => {
    try {
      return {
        kind: "ready",
        ticket: await client.getTenantTicketStatus(ticketId),
      };
    } catch (error) {
      return { kind: "error", message: describeMobileError(error) };
    }
  }, [client, ticketId]);

  /**
   * Mount already renders the loading state, so it is not set again here. A
   * result that arrives after unmount — or after the route moved to another
   * ticket — belongs to a screen that is gone, and is dropped.
   */
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

  const reload = useCallback(() => {
    setState({ kind: "loading" });
    setActionError(null);
    void fetchTicket().then(setState);
  }, [fetchTicket]);

  /** Every action renders the DTO the server returned; nothing is assumed. */
  const runAction = (
    action: () => Promise<TenantTicketStatusDto>,
  ): void => {
    setBusy(true);
    setActionError(null);
    void (async () => {
      try {
        setState({ kind: "ready", ticket: await action() });
      } catch (error) {
        setActionError(describeMobileError(error));
      } finally {
        setBusy(false);
      }
    })();
  };

  const ticket = state.kind === "ready" ? state.ticket : null;
  const stage = ticket === null ? null : intakeStage(ticket);

  const answerQuestion = (
    question: TenantQuestionDto,
    answer: boolean | string,
  ) => {
    runAction(() =>
      client.submitAnswer(ticketId, {
        questionId: question.questionId,
        answer,
      }),
    );
  };

  const submitEvidence = (requirement: SyntheticEvidenceRequirementDto) => {
    runAction(() =>
      client.submitEvidence(ticketId, {
        evidenceType: requirement.evidenceType,
        // Server-provided: the app never invents a fixture identifier.
        fixtureId: requirement.demoFixtureId,
      }),
    );
  };

  return (
    <Screen>
      <DemoBanner />

      {state.kind === "loading" ? <LoadingState /> : null}

      {state.kind === "error" ? (
        <ErrorState message={state.message} onRetry={reload} />
      ) : null}

      {ticket === null ? null : (
        <>
          {actionError === null ? null : <ErrorState message={actionError} />}

          {stage === "SAFETY" ? <SafetyNotice /> : null}

          {stage === "MORE_INFO" && ticket.moreInfoRequest !== null ? (
            <View style={styles.card} testID="follow-up">
              <SectionHeading>임대인이 추가 정보를 요청했습니다</SectionHeading>
              <Text style={styles.body}>{ticket.moreInfoRequest.reason}</Text>

              {moreInfoFulfilled(ticket) ? (
                <>
                  <Text style={styles.body}>
                    추가정보가 반영되었습니다. 다시 제출해 주세요.
                  </Text>
                  <ActionButton
                    disabled={busy}
                    label="다시 제출하기"
                    onPress={() =>
                      runAction(() => client.finalizeTicket(ticketId))
                    }
                    testID="refinalize"
                  />
                </>
              ) : null}

              {ticket.moreInfoRequest.requestedQuestions.map((question) => (
                <QuestionCard
                  busy={busy}
                  key={question.questionId}
                  onAnswer={(answer) => answerQuestion(question, answer)}
                  question={question}
                />
              ))}

              {ticket.moreInfoRequest.requestedEvidence.length === 0 ? null : (
                <EvidenceStage
                  busy={busy}
                  onSubmit={submitEvidence}
                  requirements={ticket.moreInfoRequest.requestedEvidence}
                  submitted={[]}
                />
              )}
            </View>
          ) : null}

          {stage === "QUESTION" && ticket.activeQuestion !== null ? (
            <QuestionCard
              busy={busy}
              onAnswer={(answer) => answerQuestion(ticket.activeQuestion!, answer)}
              question={ticket.activeQuestion}
            />
          ) : null}

          {stage === "EVIDENCE" ? (
            <EvidenceStage
              busy={busy}
              onSubmit={submitEvidence}
              requirements={outstandingEvidence(ticket)}
              submitted={ticket.submittedEvidence}
            />
          ) : null}

          {stage === "READY_TO_FINALIZE" ? (
            <View style={styles.card}>
              <SectionHeading>제출할 준비가 되었습니다</SectionHeading>
              <Text style={styles.body}>
                제출 후 필요한 정보가 더 있으면 임대인이 추가로 요청할 수 있습니다.
              </Text>
              <ActionButton
                disabled={busy}
                label="수리 요청 제출"
                onPress={() => runAction(() => client.finalizeTicket(ticketId))}
                testID="finalize"
              />
            </View>
          ) : null}

          {ticket.submittedEvidence.length === 0 || stage === "EVIDENCE" ? null : (
            <View style={styles.card}>
              <Text style={styles.bodyStrong}>제출한 DEMO 증빙</Text>
              {ticket.submittedEvidence.map((item) => (
                <Text key={item.evidenceId} style={styles.body}>
                  {item.label}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.card} testID="tenant-status">
            <SectionHeading>접수 상태</SectionHeading>
            <Text style={styles.body}>
              상태: {STATUS_LABELS[ticket.status] ?? ticket.status}
            </Text>
            <Text style={styles.body}>
              정보 상태:{" "}
              {EVIDENCE_STATUS_LABELS[ticket.evidenceStatus] ??
                ticket.evidenceStatus}
            </Text>
            {ticket.packet === null ? (
              <Text style={styles.body}>아직 제출이 완료되지 않았습니다.</Text>
            ) : (
              <>
                <Text style={styles.body}>제출 회차 {ticket.packet.revision}</Text>
                <Text style={styles.body}>{ticket.packet.summary}</Text>
              </>
            )}
          </View>

          <ActionButton
            disabled={busy}
            label="상태 새로고침"
            onPress={reload}
            testID="refresh"
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#c9c1ad",
    borderRadius: 12,
    backgroundColor: "#fffdf7",
    padding: 14,
    gap: 10,
  },
  group: { gap: 8 },
  body: { color: "#426057", fontSize: 15, lineHeight: 22 },
  bodyStrong: { color: "#17322b", fontSize: 15, fontWeight: "700" },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#c9c1ad",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    color: "#17322b",
    fontSize: 16,
  },
});
