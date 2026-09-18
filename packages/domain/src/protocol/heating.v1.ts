import type { Protocol, ProtocolQuestion, SafetyCheck } from "./types";

const safetyChecks: SafetyCheck[] = [
  {
    id: "heating.safety.gasSmell",
    flag: "GAS_SMELL",
    questionId: "safety.gasSmell",
    hardStop: true,
  },
  {
    id: "heating.safety.smokeOrFire",
    flag: "SMOKE_OR_FIRE",
    questionId: "safety.smokeOrFire",
    hardStop: true,
  },
  {
    id: "heating.safety.electricalWaterRisk",
    flag: "ELECTRICAL_WATER_RISK",
    questionId: "safety.electricalWaterRisk",
    hardStop: true,
  },
  {
    id: "heating.safety.otherUrgentHazard",
    flag: "OTHER_URGENT_HAZARD",
    questionId: "safety.otherUrgentHazard",
    hardStop: true,
  },
];

const safetyQuestions: ProtocolQuestion[] = [
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
  {
    id: "safety.electricalWaterRisk",
    prompt: "물이나 누수가 전기, 콘센트, 전선 가까이에 있나요?",
    type: "YES_NO",
    required: true,
  },
  {
    id: "safety.otherUrgentHazard",
    prompt:
      "감전, 대량 누수, 붕괴 또는 심각한 구조 균열 같은 긴급 위험이 있나요?",
    type: "YES_NO",
    required: true,
  },
];

export const heatingIndividualV1: Protocol = {
  id: "HEATING_INDIVIDUAL_V1",
  version: "1",
  issueType: "HEATING",
  match: { op: "eq", field: "context.heatingType", value: "INDIVIDUAL" },
  safetyChecks,
  questions: [
    ...safetyQuestions,
    {
      id: "heating.hotWater",
      prompt: "온수도 나오지 않나요?",
      type: "YES_NO",
      required: true,
    },
    {
      id: "heating.allRooms",
      prompt: "난방이 모든 방에서 작동하지 않나요?",
      type: "YES_NO",
      required: true,
    },
    {
      id: "heating.powerOn",
      prompt: "보일러 또는 조절기 전원이 켜져 있나요?",
      type: "YES_NO",
      required: true,
    },
    {
      id: "heating.errorCode",
      prompt: "표시창에 오류 코드가 있나요? 있다면 입력해 주세요.",
      type: "SHORT_TEXT",
      required: true,
    },
  ],
  evidence: [
    {
      type: "CONTROL_PANEL_PHOTO",
      required: true,
      instruction: "안전한 거리에서 보일러 또는 조절기 표시창을 촬영해 주세요.",
      why: "표시 상태와 오류 코드를 관리자가 검토하는 데 필요합니다.",
    },
  ],
  routeRules: [
    {
      id: "heating.individual.ownerDirect",
      when: {
        op: "and",
        rules: [
          { op: "eq", field: "context.heatingType", value: "INDIVIDUAL" },
          { op: "eq", field: "context.managementMode", value: "OWNER_DIRECT" },
        ],
      },
      primary: "LANDLORD_REVIEW",
      alternatives: ["MANUFACTURER_AS"],
      rationaleTemplate:
        "개별난방 및 임대인 직접 관리의 검증된 건물 정보를 기준으로 임대인 검토가 우선입니다.",
    },
  ],
};

export const heatingSharedV1: Protocol = {
  id: "HEATING_SHARED_V1",
  version: "1",
  issueType: "HEATING",
  match: { op: "eq", field: "context.heatingType", value: "CENTRAL_SHARED" },
  safetyChecks,
  questions: [
    ...safetyQuestions,
    {
      id: "heating.unitOnly",
      prompt: "난방 문제가 이 호실에만 있는 것으로 알고 있나요?",
      type: "YES_NO",
      required: true,
    },
    {
      id: "heating.hotWater",
      prompt: "온수에도 문제가 있나요?",
      type: "YES_NO",
      required: true,
    },
    {
      id: "heating.controllerAbnormal",
      prompt: "세대 조절기 화면에 이상 표시가 있나요?",
      type: "YES_NO",
      required: true,
    },
  ],
  evidence: [
    {
      type: "FIXTURE_PHOTO",
      required: true,
      instruction: "안전한 거리에서 세대 조절기 화면을 촬영해 주세요.",
      why: "세대 조절기 상태를 관리자가 검토하는 데 필요합니다.",
    },
  ],
  routeRules: [
    {
      id: "heating.shared.managementOffice",
      when: {
        op: "and",
        rules: [
          { op: "eq", field: "context.heatingType", value: "CENTRAL_SHARED" },
          {
            op: "eq",
            field: "context.managementMode",
            value: "MANAGEMENT_OFFICE",
          },
        ],
      },
      primary: "MANAGEMENT_OFFICE",
      alternatives: ["LANDLORD_REVIEW"],
      rationaleTemplate:
        "공용난방 및 관리사무소 관리의 검증된 건물 정보를 기준으로 관리사무소 검토가 우선입니다.",
    },
  ],
};

export const heatingUnknownV1: Protocol = {
  id: "HEATING_UNKNOWN_V1",
  version: "1",
  issueType: "HEATING",
  match: { op: "eq", field: "context.heatingType", value: "UNKNOWN" },
  safetyChecks,
  questions: [
    ...safetyQuestions,
    {
      id: "heating.type",
      prompt: "건물의 난방 방식을 알고 있나요?",
      type: "SINGLE_SELECT",
      choices: [
        { value: "INDIVIDUAL", label: "개별난방" },
        { value: "CENTRAL_SHARED", label: "중앙·공용난방" },
        { value: "DISTRICT", label: "지역난방" },
        { value: "UNKNOWN", label: "잘 모르겠음" },
      ],
      required: true,
    },
  ],
  evidence: [],
  routeRules: [
    {
      id: "heating.unknown.landlordReview",
      when: { op: "eq", field: "issueType", value: "HEATING" },
      primary: "LANDLORD_REVIEW",
      alternatives: [],
      rationaleTemplate:
        "검증된 난방 방식이 없어 자동 추정하지 않고 임대인 확인을 요청합니다.",
    },
  ],
};
