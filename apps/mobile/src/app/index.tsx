import { HERO_MESSAGE, PRODUCT_NAME } from "@build-manager/api-contracts";
import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>BUILDING-AWARE REPAIR ROUTER</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {PRODUCT_NAME}
      </Text>
      <Text style={styles.message}>{HERO_MESSAGE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#f4f1e8",
  },
  eyebrow: {
    marginBottom: 16,
    color: "#7b4c2f",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  title: {
    color: "#17322b",
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 46,
  },
  message: {
    marginTop: 20,
    color: "#426057",
    fontSize: 18,
    lineHeight: 26,
  },
});
