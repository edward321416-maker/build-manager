import { useRouter } from "expo-router";
import { ConfigErrorScreen } from "../../components/ui";
import { TenantHome } from "../../features/tenant/tenant-home";
import { useMobileApiClient } from "../../lib/use-api-client";

/**
 * Route wrapper only: it resolves the runtime client and hands it to the
 * feature, so the feature itself stays testable without any environment.
 */
export default function TenantHomeRoute() {
  const router = useRouter();
  const client = useMobileApiClient();

  if (client === null) {
    return <ConfigErrorScreen />;
  }

  return (
    <TenantHome
      client={client}
      onTicketCreated={(ticketId) =>
        router.push(`/tenant/tickets/${ticketId}`)
      }
    />
  );
}
