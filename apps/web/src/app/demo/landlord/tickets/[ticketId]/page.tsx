import { TicketReview } from "@/components/landlord/ticket-review";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ ticketId: string }> };

export default async function LandlordTicketPage({ params }: PageProps) {
  const { ticketId } = await params;
  return <TicketReview ticketId={ticketId} />;
}
