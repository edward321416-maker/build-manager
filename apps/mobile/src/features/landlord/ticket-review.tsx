import type { ApiClient } from "@build-manager/api-client";
import type {
  LandlordTicketDetailDto,
  RouteCode,
  SyntheticEvidenceType,
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
import {
  canApprove,
  canRequestMoreInfo,
  isSafetyEscalated,
  overrideOptions,
  recommendationState,
  type RecommendationState,
} from "./logic";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; ticket: LandlordTicketDetailDto };

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "작성 중",
  PARTIAL: "정보 부족",
  READY_FOR_REVIEW: "검토 대기",
  NEEDS_MORE_INFO: "추가 정보 요청됨",
  SAFETY_ESCALATED: "안전 확인 필요",
  APPROVED: "승인됨",
  OVERRIDDEN: "직접 지정됨",
};

const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  COMPLETE: "필수 정보 확인됨",
  MISSING_REQUIRED: "필수 정보 부족",
  CONFLICTING: "정보가 서로 어긋남",
  SAFETY_ESCALATED: "안전 위험 신호",
};

/** Why the server gave no recommendation, in the server's own terms. */
const NO_RECOMMENDATION_REASON: Record<RecommendationState, string> = {
  RECOMMENDED: "",
  SAFETY_ESCALATED: "안전 확인이 필요해 일반 추천을 중단했습니다.",
  MISSING_REQUIRED: "필수 정보가 부족해 추천 경로가 없습니다.",
  CONFLICTING: "제출된 정보가 서로 어긋나 추천 경로가 없습니다.",
  AWAITING_INTAKE: "아직 접수가 끝나지 않아 추천 경로가 없습니다.",
};

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

export function TicketReview({
  client,
  ticketId,
  onBack,
}: {
  client: ApiClient;
  ticketId: string;
  onBack: () => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteCode | "">("");
  const [overrideReason, setOverrideReason] = useState("");
  const [moreInfoReason, setMoreInfoReason] = useState("");
  const [requestedQuestionIds, setRequestedQuestionIds] = useState<string[]>([]);
  const [requestedEvidenceTypes, setRequestedEvidenceTypes] = useState<
    SyntheticEvidenceType[]
  >([]);

  /** Returns the next state rather than setting it, so callers own the timing. */
  const fetchTicket = useCallback(async (): Promise<LoadState> => {
    try {
      return { kind: "ready", ticket: await client.getLandlordTicket(ticketId) };
    } catch (error) {
      return { kind: "error", message: describeMobileError(error) };
    }
  }, [client, ticketId]);

  const apply = useCallback((next: LoadState) => {
    setState(next);
    if (next.kind === "ready") {
      setSelectedRoute(overrideOptions(next.ticket)[0]?.routeCode ?? "");
    }
  }, []);

  /** Mount already renders the loading state, so it is not set again here. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchTicket();
      if (!cancelled) {
        apply(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply, fetchTicket]);

  const reload = useCallback(() => {
    setState({ kind: "loading" });
    setActionError(null);
    void fetchTicket().then(apply);
  }, [apply, fetchTicket]);

  /**
   * Every decision renders the DTO the server returned. A failure keeps the
   * last validated ticket on screen so nothing optimistic is left behind.
   */
  const runAction = (
    action: () => Promise<LandlordTicketDetailDto>,
  ): void => {
    if (busy) {
      return;
    }
    setBusy(true);
    setActionError(null);
    void (async () => {
      try {
        apply({ kind: "ready", ticket: await action() });
      } catch (error) {
        setActionError(describeMobileError(error));
      } finally {
        setBusy(false);
      }
    })();
  };

  const ticket = state.kind === "ready" ? state.ticket : null;
  const packet = ticket?.repairPacket ?? null;
  const escalated = ticket === null ? false : isSafetyEscalated(ticket);
  const options = ticket === null ? [] : overrideOptions(ticket);

  const canSubmitOverride =
    ticket !== null &&
    !escalated &&
    selectedRoute !== "" &&
    overrideReason.trim().length > 0 &&
    !busy;

  const canSubmitMoreInfo =
    ticket !== null &&
    canRequestMoreInfo(ticket) &&
    moreInfoReason.trim().length > 0 &&
    requestedQuestionIds.length + requestedEvidenceTypes.length > 0 &&
    !busy;

  return (
    <Screen>
      <DemoBanner />

      {state.kind === "loading" ? <LoadingState /> : null}

      {state.kind === "error" ? (
        <ErrorState message={state.message} onRetry={reload} />
      ) : null}

      {ticket === null ? null : (
        <>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {ticket.building.displayName}
            </Text>
            <Text style={styles.body}>
              {ticket.issueType} · {ticket.protocol}
            </Text>
            <Text style={styles.body}>
              상태: {STATUS_LABELS[ticket.status] ?? ticket.status}
            </Text>
            <Text style={styles.body}>
              정보 상태:{" "}
              {EVIDENCE_STATUS_LABELS[ticket.evidenceStatus] ??
                ticket.evidenceStatus}
            </Text>
          </View>

          <SectionHeading>수리 요청 요약</SectionHeading>
          <View style={styles.card}>
            {packet === null ? (
              <Text style={styles.body}>아직 제출이 완료되지 않았습니다.</Text>
            ) : (
              <>
                <Text style={styles.body}>제출 회차 {packet.revision}</Text>
                <Text style={styles.body}>{packet.summary}</Text>
              </>
            )}
          </View>

          <SectionHeading>추천 경로</SectionHeading>
          <View style={styles.card}>
            {packet?.recommendation == null ? (
              <Text style={styles.body}>
                {NO_RECOMMENDATION_REASON[recommendationState(ticket)]}
              </Text>
            ) : (
              <>
                <Text style={styles.recommendation}>
                  {packet.recommendation.label}
                </Text>
                <Text style={styles.rowLabel}>왜 이 경로인가</Text>
                {packet.recommendation.reasons.map((reason) => (
                  <Text key={reason} style={styles.body}>
                    {reason}
                  </Text>
                ))}
              </>
            )}

            {packet === null || packet.provenance.length === 0 ? null : (
              <>
                <Text style={styles.rowLabel}>판단 근거가 된 건물 정보</Text>
                {packet.provenance.map((key) => (
                  <Text key={key} style={styles.body}>
                    {key}
                  </Text>
                ))}
              </>
            )}
          </View>

          <SectionHeading>임대인 결정</SectionHeading>

          {actionError === null ? null : <ErrorState message={actionError} />}

          <ActionButton
            disabled={busy || !canApprove(ticket)}
            label="추천 경로 승인"
            onPress={() => runAction(() => client.approveRoute(ticketId))}
            testID="approve"
          />

          {escalated ? (
            <View style={styles.card} testID="override-unavailable">
              <Text style={styles.body}>
                안전 확인이 필요한 요청이므로 일반 경로 지정을 제공하지 않습니다.
                사람이 직접 상황을 확인해야 합니다.
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.rowLabel}>직접 지정할 경로</Text>
              <View style={styles.group}>
                {options.map((option) => (
                  <ActionButton
                    disabled={busy}
                    key={option.routeCode}
                    label={option.label}
                    onPress={() => setSelectedRoute(option.routeCode)}
                    selected={selectedRoute === option.routeCode}
                    testID={`route-${option.routeCode}`}
                  />
                ))}
              </View>

              <Text style={styles.rowLabel}>지정 사유</Text>
              <TextInput
                accessibilityLabel="지정 사유"
                onChangeText={setOverrideReason}
                style={styles.input}
                testID="override-reason"
                value={overrideReason}
              />

              <ActionButton
                disabled={!canSubmitOverride}
                label="경로 직접 지정"
                onPress={() => {
                  if (selectedRoute === "") {
                    return;
                  }
                  // The entered reason goes as typed; trimming only gated it.
                  runAction(() =>
                    client.overrideRoute(ticketId, {
                      routeCode: selectedRoute,
                      reason: overrideReason,
                    }),
                  );
                }}
                testID="override-submit"
              />
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.rowLabel}>추가 정보 요청</Text>
            <TextInput
              accessibilityLabel="추가 정보를 요청하는 이유"
              onChangeText={setMoreInfoReason}
              style={styles.input}
              testID="more-info-reason"
              value={moreInfoReason}
            />

            <Text style={styles.rowLabel}>다시 확인할 질문</Text>
            <View style={styles.group}>
              {ticket.followUpOptions.questions.map((question) => (
                <ActionButton
                  disabled={busy}
                  key={question.questionId}
                  label={question.prompt}
                  onPress={() =>
                    setRequestedQuestionIds((current) =>
                      toggle(current, question.questionId),
                    )
                  }
                  selected={requestedQuestionIds.includes(question.questionId)}
                  testID={`followup-question-${question.questionId}`}
                />
              ))}
            </View>

            <Text style={styles.rowLabel}>다시 제출받을 DEMO 증빙</Text>
            <View style={styles.group}>
              {ticket.followUpOptions.evidence.map((requirement) => (
                <ActionButton
                  disabled={busy}
                  key={requirement.evidenceType}
                  label={requirement.label}
                  onPress={() =>
                    setRequestedEvidenceTypes((current) =>
                      toggle(current, requirement.evidenceType),
                    )
                  }
                  selected={requestedEvidenceTypes.includes(
                    requirement.evidenceType,
                  )}
                  testID={`followup-evidence-${requirement.evidenceType}`}
                />
              ))}
            </View>

            <ActionButton
              disabled={!canSubmitMoreInfo}
              label="추가 정보 요청"
              onPress={() =>
                runAction(() =>
                  client.requestMoreInfo(ticketId, {
                    reason: moreInfoReason,
                    // An empty selection is omitted, never sent as an empty list.
                    requestedQuestionIds:
                      requestedQuestionIds.length === 0
                        ? undefined
                        : requestedQuestionIds,
                    requestedEvidenceTypes:
                      requestedEvidenceTypes.length === 0
                        ? undefined
                        : requestedEvidenceTypes,
                  }),
                )
              }
              testID="more-info-submit"
            />
          </View>
        </>
      )}

      <ActionButton
        label="임대인 홈으로"
        onPress={onBack}
        testID="back-to-landlord"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  title: { color: "#17322b", fontSize: 24, fontWeight: "800" },
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
  rowLabel: { color: "#17322b", fontSize: 14, fontWeight: "700" },
  recommendation: { color: "#17322b", fontSize: 20, fontWeight: "800" },
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
