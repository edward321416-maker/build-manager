import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, type TextProps, View } from "react-native";
import type { CoreTicketDto } from "@build-manager/api-contracts";

/** Local presentation primitives. Shared demo and protocol screens stay unchanged. */
export function Screen({ children }: { children: ReactNode }) {
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="screen-scroll">{children}</ScrollView>;
}

export function CoreText({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.text, props.accessibilityRole === "alert" && styles.error, style]} />;
}

export function CoreHeader({ children }: { children: ReactNode }) {
  return <View style={styles.header}>{children}</View>;
}

export function SectionHeading({ children, inverse = false }: { children: ReactNode; inverse?: boolean }) {
  return <Text accessibilityRole="header" style={[styles.heading, inverse && styles.inverse]}>{children}</Text>;
}

export function ActionButton({ label, onPress, disabled = false, testID, selected, primary = false }: {
  label: string; onPress: () => void; disabled?: boolean; testID?: string; selected?: boolean; primary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled, ...(selected === undefined ? {} : { selected }) }}
    disabled={disabled} onPress={onPress} testID={testID}
    style={[styles.button, selected === true && styles.selected, primary && styles.primary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, primary && styles.inverse, disabled && styles.muted]}>{selected === true ? `✓ ${label}` : label}</Text>
  </Pressable>;
}

const labels = { OPEN: "접수", IN_PROGRESS: "처리중", COMPLETED: "처리 완료 (관리자 기록)" };
export function CoreWorkStatus({ status }: { status: CoreTicketDto["workStatus"] }) {
  return <Text testID="work-status" style={[styles.badge, status === "IN_PROGRESS" && styles.progress, status === "COMPLETED" && styles.completed]}>{labels[status]}</Text>;
}

export const coreInputStyle = StyleSheet.create({ input: {
  borderWidth: 1, borderColor: "#7A8897", borderRadius: 8, padding: 12,
  minHeight: 48, color: "#172B3A", backgroundColor: "#FFFFFF", fontSize: 16, lineHeight: 24,
  textAlignVertical: "top",
} }).input;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F7F9" },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  text: { color: "#172B3A", fontSize: 16, lineHeight: 24, flexShrink: 1 },
  header: { backgroundColor: "#17283B", padding: 24, gap: 12, marginHorizontal: -16, marginTop: -16 },
  heading: { color: "#172B3A", fontSize: 24, lineHeight: 32, fontWeight: "700", flexShrink: 1 },
  inverse: { color: "#FFFFFF" },
  muted: { color: "#526275" },
  button: { minHeight: 48, borderWidth: 1, borderColor: "#7A8897", borderRadius: 8, padding: 12, justifyContent: "center", backgroundColor: "#FFFFFF" },
  buttonText: { color: "#172B3A", fontSize: 16, lineHeight: 24, fontWeight: "600", flexShrink: 1 },
  selected: { borderColor: "#245CB2", backgroundColor: "#EFF6FF", borderWidth: 2 },
  primary: { backgroundColor: "#245CB2", borderColor: "#245CB2" },
  disabled: { backgroundColor: "#E9EDF2", borderColor: "#7A8897" },
  error: { color: "#B42318", backgroundColor: "#FEF3F2", padding: 16, borderRadius: 8 },
  badge: { alignSelf: "flex-start", flexShrink: 1, color: "#526275", backgroundColor: "#E9EDF2", fontSize: 14, lineHeight: 21, fontWeight: "600", paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12 },
  progress: { color: "#1D4ED8", backgroundColor: "#EFF6FF" },
  completed: { color: "#166534", backgroundColor: "#DCFCE7" },
});
