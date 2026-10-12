import { HERO_MESSAGE, PRODUCT_NAME } from "@build-manager/api-contracts";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ActionButton, DemoBanner, Screen, SectionHeading } from "../components/ui";
import { color, space, text } from "../design/tokens";

export default function RoleHomeScreen() {
  const router = useRouter();

  return (
    <Screen>
      <DemoBanner />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>BUILDING-AWARE REPAIR ROUTER</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {PRODUCT_NAME}
        </Text>
        <Text style={styles.message}>{HERO_MESSAGE}</Text>
      </View>

      <SectionHeading>데모 시작하기</SectionHeading>
      <ActionButton label="RC1 수리 접수·처리" onPress={() => router.push("/core")} testID="start-core" />
      <View style={styles.group}>
        <ActionButton
          label="세입자로 시작"
          onPress={() => router.push("/tenant")}
          testID="start-tenant"
        />
        <ActionButton
          label="임대인으로 시작"
          onPress={() => router.push("/landlord")}
          testID="start-landlord"
        />
      </View>
    </Screen>
  );
}

// Design rules v1 values (src/design/tokens.ts): no widened letter spacing, weights 400/600/700 only (§3.2).
const styles = StyleSheet.create({
  header: { gap: space.s2 },
  eyebrow: { ...text.caption, color: color.textSecondary },
  title: { ...text.title, color: color.text },
  message: { ...text.body, color: color.textSecondary },
  group: { gap: space.s2 },
});
