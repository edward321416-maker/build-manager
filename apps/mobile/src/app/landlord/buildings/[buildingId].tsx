import { useLocalSearchParams, useRouter } from "expo-router";
import { ConfigErrorScreen } from "../../../components/ui";
import { BuildingDetail } from "../../../features/landlord/building-detail";
import { useMobileApiClient } from "../../../lib/use-api-client";

export default function LandlordBuildingRoute() {
  const params = useLocalSearchParams<{ buildingId?: string }>();
  const router = useRouter();
  const client = useMobileApiClient();

  if (client === null) {
    return <ConfigErrorScreen />;
  }

  // An unknown id is the server's answer to give, not something to guess at.
  const buildingId =
    typeof params.buildingId === "string" ? params.buildingId : "";

  return (
    <BuildingDetail
      buildingId={buildingId}
      client={client}
      onBack={() => router.replace("/landlord")}
    />
  );
}
