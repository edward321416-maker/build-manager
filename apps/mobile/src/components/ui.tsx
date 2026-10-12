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
import { color, radius, size, space, text } from "../design/tokens";

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
    <View accessibilityRole="alert" style={[styles.state, styles.errorBox]} testID="error">
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
        selected !== undefined && styles.buttonTile,
        selected === true && styles.buttonSelected,
        disabled && styles.buttonDisabled,
      ]}
      testID={testID}
    >
      {/* The selection is stated in text, not carried by colour alone. */}
      <Text style={[styles.buttonLabel, disabled && styles.buttonLabelDisabled]}>
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

// Design rules v1 values (src/design/tokens.ts).
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.page },
  screenContent: { padding: space.s4, paddingBottom: space.s10, gap: space.s4 },
  // A notice box: surface fill, 1px edge, 10 corners, 15 padding (rules §4, §6.2).
  banner: {
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.control,
    backgroundColor: color.surface,
    padding: space.s3,
    gap: space.s1,
  },
  bannerTitle: { ...text.label, color: color.text },
  bannerBody: { ...text.body, color: color.textSecondary },
  state: { gap: space.s2, paddingVertical: space.s2 },
  stateText: { ...text.body, color: color.textSecondary },
  // Error notice: soft danger fill and 1px danger edge; the message stays in a readable text colour (§8.11).
  // Per-side padding, so it wins over `state`'s 10 vertical padding (notice boxes are 15/15, §4).
  errorBox: {
    backgroundColor: color.dangerSoft,
    borderWidth: 1,
    borderColor: color.danger,
    borderRadius: radius.control,
    paddingVertical: space.s3,
    paddingHorizontal: space.s3,
  },
  errorText: { ...text.body, color: color.text },
  heading: { ...text.heading, color: color.text },
  // Text in the middle of the box both ways (design rules §4).
  button: {
    minHeight: size.target,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.control,
    paddingHorizontal: space.s4,
    paddingVertical: space.s2,
    backgroundColor: color.surface,
  },
  // A choice (a button that can be selected) is a tile: control-coloured edge, 15/15 padding (§2.1, §4, §8.3).
  buttonTile: { borderColor: color.borderControl, paddingVertical: space.s3, paddingHorizontal: space.s3 },
  // Selected: 2px primary edge on the soft primary fill, with the ✓ in the label (§2.4).
  buttonSelected: { borderColor: color.primary, backgroundColor: color.primarySoft, borderWidth: 2 },
  // Disabled: a subtle fill and secondary text, never transparency (§2.4, §6.5).
  buttonDisabled: { backgroundColor: color.fillSubtle, borderColor: color.border },
  buttonLabel: { ...text.label, color: color.text, textAlign: "center" },
  buttonLabelDisabled: { color: color.textSecondary },
});
