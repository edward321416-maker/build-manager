import type { ApiClient } from "@build-manager/api-client";
import type {
  BuildingPassportDto,
  LandlordTicketDetailDto,
} from "@build-manager/api-contracts";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
  | {
      kind: "ready";
      buildings: BuildingPassportDto[];
      tickets: LandlordTicketDetailDto[];
    };

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "작성 중",
  PARTIAL: "정보 부족",
  READY_FOR_REVIEW: "검토 대기",
  NEEDS_MORE_INFO: "추가 정보 요청됨",
  SAFETY_ESCALATED: "안전 확인 필요",
  APPROVED: "승인됨",
  OVERRIDDEN: "직접 지정됨",
};

export function LandlordHome({
  client,
  onBuildingOpen,
  onTicketOpen,
  onBackToRoles,
}: {
  client: ApiClient;
  onBuildingOpen: (buildingId: string) => void;
  onTicketOpen: (ticketId: string) => void;
  onBackToRoles: () => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  /** Returns the next state rather than setting it, so callers own the timing. */
  const fetchHome = useCallback(async (): Promise<LoadState> => {
    try {
      const [buildings, tickets] = await Promise.all([
        client.listDemoBuildings(),
        // The landlord projection only. This screen never reads the tenant view.
        client.listTickets({ view: "landlord" }),
      ]);
      return { kind: "ready", buildings, tickets };
    } catch (error) {
      return { kind: "error", message: describeMobileError(error) };
    }
  }, [client]);

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

  const reload = useCallback(() => {
    setState({ kind: "loading" });
    void fetchHome().then(setState);
  }, [fetchHome]);

  return (
    <Screen>
      <DemoBanner />

      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          임대인 데모 · 수리 요청 검토
        </Text>
        <Text style={styles.tagline}>주소가 수리 프로토콜이 된다.</Text>
      </View>

      {state.kind === "loading" ? <LoadingState /> : null}

      {state.kind === "error" ? (
        <ErrorState message={state.message} onRetry={reload} />
      ) : null}

      {state.kind === "ready" ? (
        <>
          <SectionHeading>데모 건물</SectionHeading>
          <View style={styles.group}>
            {state.buildings.map((building) => (
              <ActionButton
                key={building.buildingId}
                label={building.displayName}
                onPress={() => onBuildingOpen(building.buildingId)}
                testID={`building-${building.buildingId}`}
              />
            ))}
          </View>

          <SectionHeading>수리 요청 {state.tickets.length}건</SectionHeading>
          {state.tickets.length === 0 ? (
            <Text style={styles.body}>접수된 수리 요청이 없습니다.</Text>
          ) : (
            <View style={styles.group}>
              {state.tickets.map((ticket) => (
                <ActionButton
                  key={ticket.ticketId}
                  label={`${ticket.building.displayName} · ${
                    STATUS_LABELS[ticket.status] ?? ticket.status
                  }`}
                  onPress={() => onTicketOpen(ticket.ticketId)}
                  testID={`ticket-${ticket.ticketId}`}
                />
              ))}
            </View>
          )}
        </>
      ) : null}

      <ActionButton
        label="역할 선택으로 돌아가기"
        onPress={onBackToRoles}
        testID="back-to-roles"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  title: { color: "#17322b", fontSize: 26, fontWeight: "800" },
  tagline: { color: "#426057", fontSize: 16 },
  group: { gap: 8 },
  body: { color: "#426057", fontSize: 15, lineHeight: 22 },
});
