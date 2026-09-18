import type { Protocol, ProtocolQuestion, SafetyCheck } from "./types";

const safetyChecks: SafetyCheck[] = [
  {
    id: "leak.safety.electricalWaterRisk",
    flag: "ELECTRICAL_WATER_RISK",
    questionId: "safety.electricalWaterRisk",
    hardStop: true,
  },
  {
    id: "leak.safety.uncontrolledWater",
    flag: "OTHER_URGENT_HAZARD",
    questionId: "safety.otherUrgentHazard",
    hardStop: true,
  },
  {
    id: "leak.safety.gasSmell",
    flag: "GAS_SMELL",
    questionId: "safety.gasSmell",
    hardStop: true,
  },
  {
    id: "leak.safety.smokeOrFire",
    flag: "SMOKE_OR_FIRE",
    questionId: "safety.smokeOrFire",
    hardStop: true,
  },
];

const safetyQuestions: ProtocolQuestion[] = [
  {
    id: "safety.electricalWaterRisk",
    prompt: "물이 콘센트, 멀티탭 또는 전기기구 주변까지 번졌나요?",
    type: "YES_NO",
    required: true,
  },
  {
    id: "safety.otherUrgentHazard",
    prompt:
      "물이 통제하기 어려울 정도로 계속 흐르거나 감전, 붕괴 또는 심각한 구조 균열 같은 긴급 위험이 있나요?",
    type: "YES_NO",
    required: true,
  },
  {
    id: "safety.gasSmell",
    prompt: "가스 냄새가 나나요?",
    type: "YES_NO",
    required: true,
  },
  {
    id: "safety.smokeOrFire",
    prompt: "연기나 불꽃이 보이나요?",
    type: "YES_NO",
    required: true,
  },
];

export const leakV1: Protocol = {
  id: "LEAK_V1",
  version: "1",
  issueType: "LEAK",
  match: { op: "eq", field: "issueType", value: "LEAK" },
  safetyChecks,
  questions: [
    ...safetyQuestions,
    {
      id: "leak.location",
      prompt: "물이 어디에서 보이나요?",
      type: "SINGLE_SELECT",
      choices: [
        { value: "CEILING_WALL", label: "천장 또는 벽" },
        { value: "SINK_BATHROOM_FIXTURE", label: "싱크대·욕실 설비" },
        { value: "APPLIANCE", label: "특정 기기" },
        { value: "UNKNOWN", label: "잘 모르겠음" },
      ],
      required: true,
    },
    {
      id: "leak.active",
      prompt: "현재도 계속 새고 있나요?",
      type: "YES_NO",
      required: true,
    },
    {
      id: "leak.applianceOnly",
      prompt: "특정 기기를 사용할 때만 발생하나요?",
      type: "YES_NO",
      required: true,
    },
    {
      id: "leak.firstObservedAt",
      prompt: "처음 발견한 시점을 입력해 주세요.",
      type: "SHORT_TEXT",
      required: true,
    },
  ],
  evidence: [
    {
      type: "LEAK_AREA_PHOTO",
      required: true,
      instruction:
        "안전한 거리에서 누수 부위와 주변 위치가 함께 보이도록 촬영해 주세요.",
      why: "누수 위치와 범위를 관리자가 검토하는 데 필요합니다.",
    },
    {
      type: "FIXTURE_PHOTO",
      required: true,
      showWhen: { op: "eq", field: "answer.leak.location", value: "APPLIANCE" },
      instruction: "안전한 거리에서 누수와 관련된 기기가 보이도록 촬영해 주세요.",
      why: "관련 기기를 관리자가 구분해 검토하는 데 필요합니다.",
    },
  ],
  routeRules: [
    {
      id: "leak.ceiling.managementOffice",
      when: {
        op: "and",
        rules: [
          {
            op: "eq",
            field: "context.managementMode",
            value: "MANAGEMENT_OFFICE",
          },
          { op: "eq", field: "answer.leak.location", value: "CEILING_WALL" },
        ],
      },
      primary: "MANAGEMENT_OFFICE",
      alternatives: ["LANDLORD_REVIEW"],
      rationaleTemplate:
        "관리사무소 관리 건물의 천장·벽 누수이므로 원인을 단정하지 않고 관리사무소에 먼저 상황 확인을 요청합니다.",
    },
    {
      id: "leak.default.landlordReview",
      when: { op: "eq", field: "issueType", value: "LEAK" },
      primary: "LANDLORD_REVIEW",
      alternatives: [],
      rationaleTemplate:
        "누수 원인이나 책임을 단정하지 않고 임대인에게 먼저 상황 검토를 요청합니다.",
    },
  ],
};
