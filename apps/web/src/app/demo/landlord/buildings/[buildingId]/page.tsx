import { BuildingDetail } from "@/components/landlord/building-detail";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ buildingId: string }> };

export default async function LandlordBuildingPage({ params }: PageProps) {
  const { buildingId } = await params;
  return <BuildingDetail buildingId={buildingId} />;
}
