import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MOBILE_CONFIG_MESSAGE } from "../lib/api-config";

/** Phone-height content always scrolls rather than clipping. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      testID="screen-scroll"
    >
      {children}
    </ScrollView>
  );
}

export function DemoBanner() {
  return (
    <View accessibilityRole="alert" style={styles.banner} testID="demo-banner">
      <Text style={styles.bannerTitle}>DEMO MODE</Text>
      <Text style={styles.bannerBody}>
        모든 건물·수리 요청 데이터는 합성 데모 데이터입니다. 임차인 본인 확인,
        권한 체계, 실제 공공 데이터 연동, 업체 배정은 이 데모에 포함되어 있지
        않습니다.
      </Text>
    </View>
  );
}

export function LoadingState({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" style={styles.state} testID="loading">
      <ActivityIndicator accessibilityLabel={label} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.state} testID="error">
      <Text style={styles.errorText}>{message}</Text>
      {onRetry === undefined ? null : (
        <ActionButton label="다시 시도" onPress={onRetry} testID="retry" />
      )}
    </View>
  );
}

/** Shown instead of the app when the demo server address is not configured. */
export function ConfigErrorScreen() {
  return (
    <Screen>
      <DemoBanner />
      <View accessibilityRole="alert" style={styles.state} testID="config-error">
        <Text accessibilityRole="header" style={styles.heading}>
          데모 설정이 필요합니다
        </Text>
        <Text style={styles.stateText}>{MOBILE_CONFIG_MESSAGE}</Text>
      </View>
    </Screen>
  );
}

export function ActionButton({
  label,
  onPress,
  disabled = false,
  testID,
  selected,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled,
        ...(selected === undefined ? {} : { selected }),
      }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        selected === true && styles.buttonSelected,
        disabled && styles.buttonDisabled,
      ]}
      testID={testID}
    >
      {/* The selection is stated in text, not carried by colour alone. */}
      <Text style={styles.buttonLabel}>
        {selected === true ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f1e8" },
  screenContent: { padding: 20, paddingBottom: 48, gap: 16 },
  banner: {
    borderWidth: 1,
    borderColor: "#c9c1ad",
    borderRadius: 12,
    backgroundColor: "#fffdf7",
    padding: 14,
    gap: 6,
  },
  bannerTitle: { color: "#7b4c2f", fontWeight: "800", letterSpacing: 1.5 },
  bannerBody: { color: "#426057", fontSize: 13, lineHeight: 19 },
  state: { gap: 10, paddingVertical: 12 },
  stateText: { color: "#426057", fontSize: 15, lineHeight: 22 },
  errorText: { color: "#8a2d20", fontSize: 15, lineHeight: 22 },
  heading: { color: "#17322b", fontSize: 20, fontWeight: "800" },
  button: {
    minHeight: 48,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#c9c1ad",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fffdf7",
  },
  buttonSelected: { borderColor: "#7b4c2f", backgroundColor: "#f7efe2" },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { color: "#17322b", fontSize: 16, fontWeight: "600" },
});
