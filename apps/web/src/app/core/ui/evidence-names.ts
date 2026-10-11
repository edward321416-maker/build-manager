import type { SyntheticEvidenceType, TenantTicketStatusDto } from "@build-manager/api-contracts";

/**
 * One name per evidence type on the Core screens (P1b). The tenant's evidence step and every photo list use it, so
 * tenant and manager read the same words. The server's `label` is the older demo wording and is not shown in /core.
 */
export const EVIDENCE_NAMES: Record<SyntheticEvidenceType, { name: string; prompt: string }> = {
  LEAK_LOCATION: { name: "누수 부위 사진", prompt: "누수 부위가 보이는 사진을 골라 주세요" },
  BOILER_DISPLAY: { name: "보일러 표시창 사진", prompt: "보일러 표시창이 보이는 사진을 골라 주세요" },
  FIXTURE_VIEW: { name: "관련 기기 사진", prompt: "관련 기기가 보이는 사진을 골라 주세요" },
  GENERAL_VIEW: { name: "참고 사진", prompt: "참고할 사진을 골라 주세요" },
};

/** The evidence names each named photo stands for; one photo may stand for several types (spec D3). */
export function evidenceNamesByPhoto(named: TenantTicketStatusDto["submittedEvidence"]): Map<string, string[]> {
  const names = new Map<string, string[]>();
  for (const item of named) {
    if (item.photoId) names.set(item.photoId, [...(names.get(item.photoId) ?? []), EVIDENCE_NAMES[item.evidenceType].name]);
  }
  return names;
}
