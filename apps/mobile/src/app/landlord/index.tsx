import { useRouter } from "expo-router";
import { ConfigErrorScreen } from "../../components/ui";
import { LandlordHome } from "../../features/landlord/landlord-home";
import { useMobileApiClient } from "../../lib/use-api-client";

/**
 * Route wrapper only: it resolves the runtime client and hands it to the
 * feature, so the feature itself stays testable without any environment.
 */
export default function LandlordHomeRoute() {
  const router = useRouter();
  const client = useMobileApiClient();

  if (client === null) {
    return <ConfigErrorScreen />;
  }

  return (
    <LandlordHome
      client={client}
      onBackToRoles={() => router.replace("/")}
      onBuildingOpen={(buildingId) =>
        router.push(`/landlord/buildings/${buildingId}`)
      }
      onTicketOpen={(ticketId) => router.push(`/landlord/tickets/${ticketId}`)}
    />
  );
}
