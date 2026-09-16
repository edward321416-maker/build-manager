import { HERO_MESSAGE, PRODUCT_NAME } from "@build-manager/api-contracts";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ActionButton, DemoBanner, Screen, SectionHeading } from "../components/ui";

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

const styles = StyleSheet.create({
  header: { gap: 10 },
  eyebrow: {
    color: "#7b4c2f",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  title: { color: "#17322b", fontSize: 34, fontWeight: "800", lineHeight: 40 },
  message: { color: "#426057", fontSize: 17, lineHeight: 25 },
  group: { gap: 10 },
});
