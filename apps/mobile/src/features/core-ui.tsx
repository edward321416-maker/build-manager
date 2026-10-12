import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, type TextProps, View } from "react-native";
import type { CoreTicketDto } from "@build-manager/api-contracts";
import { color, inputText, radius, size, space, status, text } from "../design/tokens";

/** Local presentation primitives on design rules v1 values (src/design/tokens.ts). */
export function Screen({ children }: { children: ReactNode }) {
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="screen-scroll">{children}</ScrollView>;
}

export function CoreText({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.text, props.accessibilityRole === "alert" && styles.error, style]} />;
}

/** The screen's heading area. Hierarchy comes from size and spacing, not a colour band (rules §7). */
export function CoreHeader({ children }: { children: ReactNode }) {
  return <View style={styles.header}>{children}</View>;
}

export function ScreenTitle({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={styles.title}>{children}</Text>;
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>;
}

export function ActionButton({ label, onPress, disabled = false, testID, selected, primary = false }: {
  label: string; onPress: () => void; disabled?: boolean; testID?: string; selected?: boolean; primary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled, ...(selected === undefined ? {} : { selected }) }}
    disabled={disabled} onPress={onPress} testID={testID}
    style={[styles.button, selected !== undefined && styles.tile, selected === true && styles.selected, primary && styles.primary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, primary && styles.inverse, disabled && styles.disabledText]}>{selected === true ? `✓ ${label}` : label}</Text>
  </Pressable>;
}

const labels = { OPEN: "접수", IN_PROGRESS: "처리중", COMPLETED: "처리 완료 (관리자 기록)" };
export function CoreWorkStatus({ status: work }: { status: CoreTicketDto["workStatus"] }) {
  return <Text testID="work-status" style={[styles.badge, work === "IN_PROGRESS" && styles.progress, work === "COMPLETED" && styles.completed]}>{labels[work]}</Text>;
}

const inputBox = {
  borderWidth: 1, borderColor: color.borderControl, borderRadius: radius.control,
  paddingVertical: space.s2, paddingHorizontal: space.s3, color: color.text, backgroundColor: color.surface,
} as const;
export const coreInputStyle = StyleSheet.create({ input: { ...inputBox, ...inputText, minHeight: size.target, textAlignVertical: "center" } }).input;
/** Multi-line inputs start at 120 tall and keep the body line height (rules §8.2). */
export const coreMultilineInputStyle = StyleSheet.create({ input: { ...inputBox, ...text.body, minHeight: size.multiline, textAlignVertical: "top" } }).input;
/** Placeholder text is secondary text, never the platform's faint default (rules §2.1). */
export const corePlaceholderColor = color.textSecondary;

/** Optional detail under a heading: the caption style in the secondary text colour (rules §3.2). */
export const coreCaptionStyle = StyleSheet.create({ caption: { ...text.caption, color: color.textSecondary } }).caption;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.page },
  content: { padding: space.s4, gap: space.s4, paddingBottom: space.s6 },
  text: { ...text.body, color: color.text, flexShrink: 1 },
  header: { gap: space.s2 },
  title: { ...text.title, color: color.text, flexShrink: 1 },
  heading: { ...text.heading, color: color.text, flexShrink: 1 },
  inverse: { color: color.textInverse },
  // Text in the middle of the box both ways (design rules §4).
  button: {
    minHeight: size.target, borderWidth: 1, borderColor: color.borderStrong, borderRadius: radius.control,
    paddingVertical: space.s2, paddingHorizontal: space.s4, justifyContent: "center", alignItems: "center", backgroundColor: color.surface,
  },
  buttonText: { ...text.label, color: color.text, flexShrink: 1, textAlign: "center" },
  // A choice (a button that can be selected) is a tile: control-coloured edge, 15/15 padding (§2.1, §4, §8.3).
  tile: { borderColor: color.borderControl, paddingVertical: space.s3, paddingHorizontal: space.s3 },
  // Selected: 2px primary edge on the soft primary fill, with the ✓ in the label (§2.4). The padding gives back the
  // extra 1px of edge (2 + 14 = 1 + 15), so choosing a tile does not move the content below it.
  selected: { borderColor: color.primary, backgroundColor: color.primarySoft, borderWidth: 2, paddingVertical: space.s3 - 1, paddingHorizontal: space.s3 - 1 },
  primary: { backgroundColor: color.primary, borderColor: color.primary },
  // Disabled: a subtle fill and secondary text, never transparency (§2.4, §6.5).
  disabled: { backgroundColor: color.fillSubtle, borderColor: color.border },
  disabledText: { color: color.textSecondary },
  // Error notice: soft danger fill, 1px danger edge, text in the normal text colour (§2.2, §8.11).
  error: {
    color: color.text, backgroundColor: color.dangerSoft, borderWidth: 1, borderColor: color.danger,
    padding: space.s3, borderRadius: radius.control, overflow: "hidden",
  },
  // Status label: label text, 5/10 padding, 5 corners, the status colour pair (§8.7).
  badge: {
    alignSelf: "flex-start", flexShrink: 1, textAlign: "center", ...text.label, ...status.neutral,
    paddingVertical: space.s1, paddingHorizontal: space.s2, borderRadius: radius.small, overflow: "hidden",
  },
  progress: status.progress,
  completed: status.done,
});
