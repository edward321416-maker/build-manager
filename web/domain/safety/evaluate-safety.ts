import type { SafetyFlag } from "@/domain/ticket/types";

export type SafetyAnswer = boolean | null | "unknown";

export type SafetyInput = {
  gasSmell?: SafetyAnswer;
  smokeOrFire?: SafetyAnswer;
  electricalWaterRisk?: SafetyAnswer;
  otherUrgentHazard?: SafetyAnswer;
  rawText?: string;
};

export type SafetyResult = {
  escalated: boolean;
  flags: SafetyFlag[];
};

const FLAG_PRECEDENCE: readonly SafetyFlag[] = [
  "GAS_SMELL",
  "SMOKE_OR_FIRE",
  "ELECTRICAL_WATER_RISK",
  "OTHER_URGENT_HAZARD",
];

const GAS_SMELL_PATTERN = /가스\s*냄새|\bgas\s+(?:smell|odou?r)\b/iu;
const SMOKE_OR_FIRE_PATTERN = /화재|연기|\b(?:fire|smoke)\b/iu;
const ELECTRICAL_WATER_PATTERN =
  /(?:물|누수).{0,24}(?:전기|콘센트|전선|배선)|(?:전기|콘센트|전선|배선).{0,24}(?:물|누수)|(?:water|leak).{0,32}(?:electric|outlet|socket|wire)|(?:electric|outlet|socket|wire).{0,32}(?:water|leak)/iu;
const OTHER_URGENT_PATTERN =
  /불꽃|감전|누전|대량\s*누수|붕괴|심각한\s*(?:구조\s*)?균열|구조\s*균열|\b(?:sparks?|flames?)\b|\belectric(?:al)? shock\b|\b(?:suspected )?electrical leak(?:age)?\b|\b(?:large[- ]scale|major uncontrolled) water leak(?:age)?\b|\bcollaps(?:e|ed|ing)\b|\bserious structural crack(?:s|ing)?\b/iu;

/**
 * Detects explicit answers and bounded Korean/English hazard phrases.
 * Raw-text matching is intentionally conservative and may produce false
 * positives; it is not general-language understanding or safety certification.
 */
function flagsFromRawText(rawText: string | undefined): SafetyFlag[] {
  if (!rawText) return [];

  const flags: SafetyFlag[] = [];
  if (GAS_SMELL_PATTERN.test(rawText)) flags.push("GAS_SMELL");
  if (SMOKE_OR_FIRE_PATTERN.test(rawText)) flags.push("SMOKE_OR_FIRE");
  if (ELECTRICAL_WATER_PATTERN.test(rawText)) {
    flags.push("ELECTRICAL_WATER_RISK");
  }
  if (OTHER_URGENT_PATTERN.test(rawText)) flags.push("OTHER_URGENT_HAZARD");
  return flags;
}

/**
 * `escalated: false` means only that no positive trigger was detected.
 * Missing or unknown answers require a separate completeness gate.
 */
export function evaluateSafety(input: SafetyInput): SafetyResult {
  const flags = new Set<SafetyFlag>();

  if (input.gasSmell === true) flags.add("GAS_SMELL");
  if (input.smokeOrFire === true) flags.add("SMOKE_OR_FIRE");
  if (input.electricalWaterRisk === true) {
    flags.add("ELECTRICAL_WATER_RISK");
  }
  if (input.otherUrgentHazard === true) flags.add("OTHER_URGENT_HAZARD");
  for (const flag of flagsFromRawText(input.rawText)) flags.add(flag);

  return {
    escalated: flags.size > 0,
    flags: FLAG_PRECEDENCE.filter((flag) => flags.has(flag)),
  };
}
