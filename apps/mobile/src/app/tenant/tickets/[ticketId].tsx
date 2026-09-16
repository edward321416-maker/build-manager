import { useLocalSearchParams } from "expo-router";
import { ConfigErrorScreen } from "../../../components/ui";
import { TenantTicket } from "../../../features/tenant/tenant-ticket";
import { useMobileApiClient } from "../../../lib/use-api-client";

export default function TenantTicketRoute() {
  const params = useLocalSearchParams<{ ticketId?: string }>();
  const client = useMobileApiClient();

  if (client === null) {
    return <ConfigErrorScreen />;
  }

  // An unknown id is the server's answer to give, not something to guess at.
  const ticketId = typeof params.ticketId === "string" ? params.ticketId : "";

  return <TenantTicket client={client} ticketId={ticketId} />;
}
