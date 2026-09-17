import { useLocalSearchParams, useRouter } from "expo-router";
import { ConfigErrorScreen } from "../../../components/ui";
import { TicketReview } from "../../../features/landlord/ticket-review";
import { useMobileApiClient } from "../../../lib/use-api-client";

export default function LandlordTicketRoute() {
  const params = useLocalSearchParams<{ ticketId?: string }>();
  const router = useRouter();
  const client = useMobileApiClient();

  if (client === null) {
    return <ConfigErrorScreen />;
  }

  // An unknown id is the server's answer to give, not something to guess at.
  const ticketId = typeof params.ticketId === "string" ? params.ticketId : "";

  return (
    <TicketReview
      client={client}
      onBack={() => router.replace("/landlord")}
      ticketId={ticketId}
    />
  );
}
