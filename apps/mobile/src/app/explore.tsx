import { StyleSheet, Text, View } from "react-native";

export default function ExploreScreen() {
  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        수리 접수 준비 중
      </Text>
      <Text style={styles.message}>P0 접수 흐름은 다음 구현 단계에서 연결됩니다.</Text>
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
  title: {
    color: "#17322b",
    fontSize: 32,
    fontWeight: "800",
  },
  message: {
    marginTop: 16,
    color: "#426057",
    fontSize: 16,
    lineHeight: 24,
  },
});
