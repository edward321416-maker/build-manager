import { TicketIntake } from "@/components/tenant/ticket-intake";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ ticketId: string }> };

export default async function TenantTicketPage({ params }: PageProps) {
  const { ticketId } = await params;
  return <TicketIntake ticketId={ticketId} />;
}
