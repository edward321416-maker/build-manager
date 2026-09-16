import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ActionButton, DemoBanner, Screen, SectionHeading } from "../../components/ui";

/**
 * Placeholder on purpose. The Landlord App is the next task, and this screen
 * makes no API call so it cannot imply behaviour that does not exist yet.
 */
export default function LandlordHomeRoute() {
  const router = useRouter();

  return (
    <Screen>
      <DemoBanner />

      <View style={styles.card}>
        <SectionHeading>임대인 앱</SectionHeading>
        <Text style={styles.body}>
          임대인 앱 데모는 다음 단계에서 연결됩니다.
        </Text>
        <Text style={styles.body}>
          지금은 세입자 데모만 동작합니다. 임대인 검토 화면은 웹 데모에서 확인할
          수 있습니다.
        </Text>
      </View>

      <ActionButton
        label="역할 선택으로 돌아가기"
        onPress={() => router.replace("/")}
        testID="back-to-roles"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#c9c1ad",
    borderRadius: 12,
    backgroundColor: "#fffdf7",
    padding: 14,
    gap: 10,
  },
  body: { color: "#426057", fontSize: 15, lineHeight: 22 },
});
