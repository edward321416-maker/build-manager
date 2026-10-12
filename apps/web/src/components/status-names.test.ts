import { RouteCodeSchema, TicketStatusSchema, VendorAccessPolicySchema } from "@build-manager/api-contracts";
import { describe, expect, it } from "vitest";
import { ACCESS_POLICY_NAMES, INTAKE_STATUS_NAMES, ROUTE_NAMES, WORK_STATUS_NAMES, buildingFieldName, buildingValueName } from "./status-names";

const rawCode = /[A-Z]{2,}|_/;

describe("status names", () => {
  it("names every server value with the approved names", () => {
    expect(WORK_STATUS_NAMES).toEqual({ OPEN: "접수됨", IN_PROGRESS: "처리 중", COMPLETED: "처리 완료" });
    expect(Object.keys(INTAKE_STATUS_NAMES).sort()).toEqual([...TicketStatusSchema.options].sort());
    expect(INTAKE_STATUS_NAMES).toEqual({
      IN_PROGRESS: "제출 전", READY_FOR_REVIEW: "결정 대기", PARTIAL: "정보 부족", NEEDS_MORE_INFO: "추가 확인 필요",
      SAFETY_ESCALATED: "긴급 확인 필요", APPROVED: "처리 방법 결정됨", OVERRIDDEN: "처리 방법 결정됨",
    });
    expect(Object.keys(ACCESS_POLICY_NAMES).sort()).toEqual([...VendorAccessPolicySchema.options].sort());
    expect(ACCESS_POLICY_NAMES).toEqual({
      TENANT_PRESENT_REQUIRED: "세입자가 있을 때만 방문",
      TENANT_PREAUTHORIZATION_ALLOWED: "세입자가 따로 동의한 시간에만 부재 중 출입 가능",
    });
    expect(Object.keys(ROUTE_NAMES).sort()).toEqual([...RouteCodeSchema.options].sort());
    expect(ROUTE_NAMES.LANDLORD_REVIEW).toBe("관리자 검토");
    expect(ROUTE_NAMES.GENERAL_VENDOR).toBe("일반 수리업체");
  });

  it("never shows a raw code or the old landlord term", () => {
    const names = [...Object.values(WORK_STATUS_NAMES), ...Object.values(INTAKE_STATUS_NAMES), ...Object.values(ACCESS_POLICY_NAMES), ...Object.values(ROUTE_NAMES)];
    for (const name of names) {
      expect(name).not.toMatch(rawCode);
      expect(name).not.toContain("임대인");
    }
  });

  it("names building fields and their coded values, and leaves free text as it is", () => {
    expect(buildingFieldName("heatingType")).toBe("난방 방식");
    expect(buildingFieldName("managementMode")).toBe("관리 방식");
    expect(buildingFieldName("ownerSuppliedBoiler")).toBe("건물주 제공 보일러");
    expect(buildingValueName("heatingType", "INDIVIDUAL")).toBe("개별난방");
    expect(buildingValueName("heatingType", "CENTRAL_SHARED")).toBe("중앙·공용난방");
    expect(buildingValueName("managementMode", "OWNER_DIRECT")).toBe("건물주 직접 관리");
    expect(buildingValueName("managementMode", "MANAGEMENT_OFFICE")).toBe("관리사무소");
    expect(buildingValueName("primaryUse", "다가구주택")).toBe("다가구주택");
    expect(buildingValueName("heatingType", "UNKNOWN_FUTURE")).toBe("UNKNOWN_FUTURE");
  });
});
