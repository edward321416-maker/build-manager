import type { ApiClient } from "@build-manager/api-client";
import type {
  BuildingPassportDto,
  IssueType,
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

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; buildings: BuildingPassportDto[] };

const ISSUE_TYPES: readonly { value: IssueType; label: string }[] = [
  { value: "HEATING", label: "난방" },
  { value: "LEAK", label: "누수" },
];

export function TenantHome({
  client,
  onTicketCreated,
}: {
  client: ApiClient;
  onTicketCreated: (ticketId: string) => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [issueType, setIssueType] = useState<IssueType>("HEATING");
  const [rawUserText, setRawUserText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** Returns the next state rather than setting it, so callers own the timing. */
  const fetchBuildings = useCallback(async (): Promise<LoadState> => {
    try {
      return { kind: "ready", buildings: await client.listDemoBuildings() };
    } catch (error) {
      return { kind: "error", message: describeMobileError(error) };
    }
  }, [client]);

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

  const reload = useCallback(() => {
    setState({ kind: "loading" });
    void fetchBuildings().then(setState);
  }, [fetchBuildings]);

  /** The report goes to the server exactly as typed; nothing inspects it. */
  const submit = () => {
    if (buildingId === null || rawUserText.trim().length === 0) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    void (async () => {
      try {
        const ticket = await client.createTicket({
          buildingId,
          issueType,
          rawUserText,
        });
        onTicketCreated(ticket.ticketId);
      } catch (error) {
        setSubmitError(describeMobileError(error));
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const canSubmit =
    buildingId !== null && rawUserText.trim().length > 0 && !submitting;

  return (
    <Screen>
      <DemoBanner />

      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          세입자 데모 · 수리 요청
        </Text>
        <Text style={styles.tagline}>주소가 수리 프로토콜이 된다.</Text>
        <Text style={styles.taglineSub}>
          건물이 다르면, 같은 신고도 다르게 물어야 합니다.
        </Text>
      </View>

      {state.kind === "loading" ? <LoadingState /> : null}

      {state.kind === "error" ? (
        <ErrorState message={state.message} onRetry={reload} />
      ) : null}

      {state.kind === "ready" ? (
        <>
          <SectionHeading>어느 건물인가요?</SectionHeading>
          <View style={styles.group}>
            {state.buildings.map((building) => (
              <ActionButton
                key={building.buildingId}
                label={building.displayName}
                onPress={() => setBuildingId(building.buildingId)}
                selected={buildingId === building.buildingId}
                testID={`building-${building.buildingId}`}
              />
            ))}
          </View>

          <SectionHeading>어떤 문제인가요?</SectionHeading>
          <View style={styles.group}>
            {ISSUE_TYPES.map((option) => (
              <ActionButton
                key={option.value}
                label={option.label}
                onPress={() => setIssueType(option.value)}
                selected={issueType === option.value}
                testID={`issue-${option.value}`}
              />
            ))}
          </View>

          <SectionHeading>어떤 상황인지 적어 주세요</SectionHeading>
          <TextInput
            accessibilityLabel="어떤 상황인지 적어 주세요"
            multiline
            onChangeText={setRawUserText}
            placeholder="예: 난방이 안 돼요"
            style={styles.input}
            testID="raw-user-text"
            value={rawUserText}
          />

          {submitError === null ? null : <ErrorState message={submitError} />}

          <ActionButton
            disabled={!canSubmit}
            label={submitting ? "접수 중…" : "수리 요청 접수"}
            onPress={submit}
            testID="create-ticket"
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  title: { color: "#17322b", fontSize: 26, fontWeight: "800" },
  tagline: { color: "#426057", fontSize: 16 },
  taglineSub: { color: "#6b7f78", fontSize: 14 },
  group: { gap: 8 },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: "#c9c1ad",
    borderRadius: 10,
    backgroundColor: "#fffdf7",
    padding: 12,
    color: "#17322b",
    fontSize: 16,
    textAlignVertical: "top",
  },
});
