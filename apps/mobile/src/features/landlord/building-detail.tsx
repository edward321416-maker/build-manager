import type { ApiClient } from "@build-manager/api-client";
import type {
  BuildingPassportDto,
  HeatingType,
  ManagementMode,
  OwnerVerificationRequest,
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
import { contextRows } from "./logic";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; passport: BuildingPassportDto };

const MANAGEMENT_MODES: readonly { value: ManagementMode; label: string }[] = [
  { value: "OWNER_DIRECT", label: "임대인 직접 관리" },
  { value: "MANAGEMENT_OFFICE", label: "관리사무소" },
];

const HEATING_TYPES: readonly { value: HeatingType; label: string }[] = [
  { value: "INDIVIDUAL", label: "개별난방" },
  { value: "CENTRAL_SHARED", label: "중앙·공용난방" },
];

export function BuildingDetail({
  client,
  buildingId,
  onBack,
}: {
  client: ApiClient;
  buildingId: string;
  onBack: () => void;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [managementMode, setManagementMode] =
    useState<ManagementMode>("OWNER_DIRECT");
  const [heatingType, setHeatingType] = useState<HeatingType>("INDIVIDUAL");
  // Absent on the server means absent here. It never becomes `false`.
  const [ownerSuppliedBoiler, setOwnerSuppliedBoiler] = useState<
    boolean | undefined
  >(undefined);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /** Returns the next state rather than setting it, so callers own the timing. */
  const fetchPassport = useCallback(async (): Promise<LoadState> => {
    try {
      return { kind: "ready", passport: await client.getBuilding(buildingId) };
    } catch (error) {
      return { kind: "error", message: describeMobileError(error) };
    }
  }, [buildingId, client]);

  /** Applies a settled result, including the fields the form edits. */
  const apply = useCallback((next: LoadState) => {
    setState(next);
    if (next.kind === "ready") {
      setManagementMode(next.passport.managementMode);
      setHeatingType(next.passport.heatingType);
      setOwnerSuppliedBoiler(next.passport.ownerSuppliedBoiler);
    }
  }, []);

  /** Mount already renders the loading state, so it is not set again here. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchPassport();
      if (!cancelled) {
        apply(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply, fetchPassport]);

  const reload = useCallback(() => {
    setState({ kind: "loading" });
    setActionError(null);
    void fetchPassport().then(apply);
  }, [apply, fetchPassport]);

  const save = () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setActionError(null);
    setSaved(false);

    // The optional property is omitted entirely when the server never gave one.
    const request: OwnerVerificationRequest = {
      managementMode,
      heatingType,
      ...(ownerSuppliedBoiler === undefined ? {} : { ownerSuppliedBoiler }),
    };

    void (async () => {
      try {
        const confirmed = await client.verifyBuildingContext(
          buildingId,
          request,
        );
        // The server's answer replaces the form, never the local selection.
        apply({ kind: "ready", passport: confirmed });
        setSaved(true);
      } catch (error) {
        setActionError(describeMobileError(error));
      } finally {
        setBusy(false);
      }
    })();
  };

  const passport = state.kind === "ready" ? state.passport : null;

  return (
    <Screen>
      <DemoBanner />

      {state.kind === "loading" ? <LoadingState /> : null}

      {state.kind === "error" ? (
        <ErrorState message={state.message} onRetry={reload} />
      ) : null}

      {passport === null ? null : (
        <>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {passport.displayName}
            </Text>
            <Text style={styles.note} testID="context-disclaimer">
              DEMO 건물 정보 확인 · 실제 소유권/본인 인증 기능이 아닙니다.
            </Text>
          </View>

          <SectionHeading>건물 정보</SectionHeading>
          <View style={styles.card}>
            {contextRows(passport).map((row) => (
              <View key={row.key} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
                <Text style={styles.rowTag}>
                  {row.routingEligible ? "수리 경로 판단에 사용" : "참고 정보"}
                </Text>
              </View>
            ))}
          </View>

          <SectionHeading>확인할 건물 정보</SectionHeading>
          <Text style={styles.note}>
            여기서 확인한 항목만 수리 경로 판단에 사용됩니다.
          </Text>

          <Text style={styles.rowLabel}>관리 방식</Text>
          <View style={styles.group}>
            {MANAGEMENT_MODES.map((option) => (
              <ActionButton
                disabled={busy}
                key={option.value}
                label={option.label}
                onPress={() => setManagementMode(option.value)}
                selected={managementMode === option.value}
                testID={`management-${option.value}`}
              />
            ))}
          </View>

          <Text style={styles.rowLabel}>난방 방식</Text>
          <View style={styles.group}>
            {HEATING_TYPES.map((option) => (
              <ActionButton
                disabled={busy}
                key={option.value}
                label={option.label}
                onPress={() => setHeatingType(option.value)}
                selected={heatingType === option.value}
                testID={`heating-${option.value}`}
              />
            ))}
          </View>

          {ownerSuppliedBoiler === undefined ? null : (
            <>
              <Text style={styles.rowLabel}>임대인 공급 보일러</Text>
              <View style={styles.group}>
                <ActionButton
                  disabled={busy}
                  label="예"
                  onPress={() => setOwnerSuppliedBoiler(true)}
                  selected={ownerSuppliedBoiler}
                  testID="boiler-true"
                />
                <ActionButton
                  disabled={busy}
                  label="아니오"
                  onPress={() => setOwnerSuppliedBoiler(false)}
                  selected={!ownerSuppliedBoiler}
                  testID="boiler-false"
                />
              </View>
            </>
          )}

          {actionError === null ? null : <ErrorState message={actionError} />}

          <ActionButton
            disabled={busy}
            label={busy ? "저장 중…" : "확인 정보 저장"}
            onPress={save}
            testID="save-context"
          />

          {saved ? (
            <Text style={styles.note} testID="context-saved">
              확인 정보를 저장했습니다.
            </Text>
          ) : null}
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
  header: { gap: 6 },
  title: { color: "#17322b", fontSize: 24, fontWeight: "800" },
  note: { color: "#6b7f78", fontSize: 13, lineHeight: 19 },
  card: {
    borderWidth: 1,
    borderColor: "#c9c1ad",
    borderRadius: 12,
    backgroundColor: "#fffdf7",
    padding: 14,
    gap: 12,
  },
  row: { gap: 2 },
  rowLabel: { color: "#17322b", fontSize: 14, fontWeight: "700" },
  rowValue: { color: "#426057", fontSize: 15 },
  rowTag: { color: "#6b7f78", fontSize: 12 },
  group: { gap: 8 },
});
