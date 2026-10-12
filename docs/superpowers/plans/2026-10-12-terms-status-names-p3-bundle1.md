# 용어·상태 이름 정리 묶음 1 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 웹의 모든 화면이 한 벌의 이름표로 상태·출입·경로·건물 값을 보여 주고, 내부 값과 `임대인` 용어를 숨긴다.

**Architecture:** `apps/web/src/components/status-names.ts` 하나에 서버 값 → 이름 표를 모은다. 표는 계약 타입 위의 전체 레코드라서 서버 값이 늘면 타입 검사가 실패한다. `/core`, 끼워 넣은 옛 질문·결정 화면, 업체 화면이 이 파일만 쓴다. 서버·DB·API는 바꾸지 않는다.

**Tech Stack:** Next.js 16 웹, React 19, vitest(`renderToStaticMarkup`), Playwright

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-10-12-terms-status-names-p3-design.md` (운영자 승인 2026-10-12)
- 위험 등급: 일반. 서버, DB, API, 권한, `packages/domain`의 질문·안전·추천 이유 문장은 바꾸지 않는다.
- 이름은 스펙의 이름 표 그대로 쓴다. 새 이름을 지어내지 않는다(디자인 규칙 8.7).
- 다시 쓰는 문장은 해요체로 쓴다(디자인 규칙 10절). 손대지 않는 문장의 말투는 묶음 3에서 바꾼다.
- 화면 코드는 `domain`·`application`·`fixtures`를 가져오지 않는다(`tests/architecture/import-boundaries.ts`). `status-names.ts`는 `@build-manager/api-contracts`의 타입만 가져온다. vitest가 `@/` 별칭을 풀지 못하므로 상대 경로만 쓴다.
- Node 24.21.0, npm 11.19.0: `PATH="/c/Users/admin/AppData/Local/build-manager-b5-runtime/node-24.21.0/node-v24.21.0-win-x64:$PATH"`
- 화면 시험과 단위 시험은 함께 돌리지 않는다(5초 시험 시간 초과, DEV-15).

---

### Task 1: 이름표 파일

**Files:**
- Create: `apps/web/src/components/status-names.ts`
- Test: `apps/web/src/components/status-names.test.ts`

**Interfaces:**
- Produces: `WORK_STATUS_NAMES`, `INTAKE_STATUS_NAMES`, `ACCESS_POLICY_NAMES`, `ROUTE_NAMES`, `buildingFieldName(key: string): string`, `buildingValueName(key: string, value: string): string`

- [ ] **Step 1: 실패하는 시험**

```ts
import { RouteCodeSchema, TicketStatusSchema, VendorAccessPolicySchema } from "@build-manager/api-contracts";
import { describe, expect, it } from "vitest";
import { ACCESS_POLICY_NAMES, INTAKE_STATUS_NAMES, ROUTE_NAMES, WORK_STATUS_NAMES, buildingFieldName, buildingValueName } from "./status-names";

const rawCode = /[A-Z]{2,}|_/;
describe("status names", () => {
  it("names every server value with the approved names", () => {
    expect(WORK_STATUS_NAMES).toEqual({ OPEN: "접수됨", IN_PROGRESS: "처리 중", COMPLETED: "처리 완료" });
    expect(Object.keys(INTAKE_STATUS_NAMES).sort()).toEqual([...TicketStatusSchema.options].sort());
    expect(INTAKE_STATUS_NAMES).toMatchObject({ IN_PROGRESS: "제출 전", READY_FOR_REVIEW: "결정 대기", PARTIAL: "정보 부족", NEEDS_MORE_INFO: "추가 확인 필요", SAFETY_ESCALATED: "긴급 확인 필요", APPROVED: "처리 방법 결정됨", OVERRIDDEN: "처리 방법 결정됨" });
    expect(Object.keys(ACCESS_POLICY_NAMES).sort()).toEqual([...VendorAccessPolicySchema.options].sort());
    expect(ACCESS_POLICY_NAMES.TENANT_PRESENT_REQUIRED).toBe("세입자가 있을 때만 방문");
    expect(Object.keys(ROUTE_NAMES).sort()).toEqual([...RouteCodeSchema.options].sort());
    expect(ROUTE_NAMES.LANDLORD_REVIEW).toBe("관리자 검토");
  });
  it("never shows a raw code or the old landlord term", () => {
    for (const name of [...Object.values(WORK_STATUS_NAMES), ...Object.values(INTAKE_STATUS_NAMES), ...Object.values(ACCESS_POLICY_NAMES), ...Object.values(ROUTE_NAMES)]) {
      expect(name).not.toMatch(rawCode);
      expect(name).not.toContain("임대인");
    }
  });
  it("names building fields and their coded values, and leaves free text as it is", () => {
    expect(buildingFieldName("heatingType")).toBe("난방 방식");
    expect(buildingFieldName("ownerSuppliedBoiler")).toBe("건물주 제공 보일러");
    expect(buildingValueName("heatingType", "INDIVIDUAL")).toBe("개별난방");
    expect(buildingValueName("managementMode", "OWNER_DIRECT")).toBe("건물주 직접 관리");
    expect(buildingValueName("primaryUse", "다가구주택")).toBe("다가구주택");
    expect(buildingValueName("heatingType", "UNKNOWN_FUTURE")).toBe("UNKNOWN_FUTURE");
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run --config apps/web/vitest.config.ts apps/web/src/components/status-names.test.ts` (작업 폴더 `apps/web`): 파일 없음으로 실패

- [ ] **Step 3: 구현**

```ts
import type { CoreTicketDto, HeatingType, ManagementMode, RouteCode, TicketStatus, VendorAccessPolicy } from "@build-manager/api-contracts";

/**
 * The one set of display names for server values on every web screen (design rules 8.7 and 13).
 * Each table is a total record over the contract's values, so a new server value without a name fails the type check.
 */
export const WORK_STATUS_NAMES: Record<CoreTicketDto["workStatus"], string> = { OPEN: "접수됨", IN_PROGRESS: "처리 중", COMPLETED: "처리 완료" };
export const INTAKE_STATUS_NAMES: Record<TicketStatus, string> = {
  IN_PROGRESS: "제출 전", READY_FOR_REVIEW: "결정 대기", PARTIAL: "정보 부족", NEEDS_MORE_INFO: "추가 확인 필요",
  SAFETY_ESCALATED: "긴급 확인 필요", APPROVED: "처리 방법 결정됨", OVERRIDDEN: "처리 방법 결정됨",
};
export const ACCESS_POLICY_NAMES: Record<VendorAccessPolicy, string> = {
  TENANT_PRESENT_REQUIRED: "세입자가 있을 때만 방문",
  TENANT_PREAUTHORIZATION_ALLOWED: "세입자가 따로 동의한 시간에만 부재 중 출입 가능",
};
/** The decision screen's route names; the server's recommendation label is not shown, so both use these. */
export const ROUTE_NAMES: Record<RouteCode, string> = {
  LANDLORD_REVIEW: "관리자 검토", MANAGEMENT_OFFICE: "관리사무소", THIRD_PARTY_MANAGER: "위탁관리",
  MANUFACTURER_AS: "제조사 A/S", GENERAL_VENDOR: "일반 수리업체",
};
const BUILDING_FIELD_NAMES: Record<string, string> = {
  heatingType: "난방 방식", managementMode: "관리 방식", ownerSuppliedBoiler: "건물주 제공 보일러", primaryUse: "주용도", approvalYear: "사용승인 연도",
};
const MANAGEMENT_MODE_NAMES: Record<ManagementMode, string> = { OWNER_DIRECT: "건물주 직접 관리", MANAGEMENT_OFFICE: "관리사무소" };
const HEATING_TYPE_NAMES: Record<HeatingType, string> = { INDIVIDUAL: "개별난방", CENTRAL_SHARED: "중앙·공용난방" };
const CODED_VALUES: Record<string, Record<string, string>> = { managementMode: MANAGEMENT_MODE_NAMES, heatingType: HEATING_TYPE_NAMES };

export function buildingFieldName(key: string): string {
  return BUILDING_FIELD_NAMES[key] ?? key;
}
/** Coded building values get their name; free text such as a primary use is shown as written. */
export function buildingValueName(key: string, value: string): string {
  return CODED_VALUES[key]?.[value] ?? value;
}
```

- [ ] **Step 4: 통과 확인** — 같은 명령, PASS
- [ ] **Step 5: 커밋** — `feat(web): add one name table for server values`

### Task 2: `/core`가 이름표를 쓴다

**Files:**
- Modify: `apps/web/src/app/core/ui/work-status-badge.tsx` (`labels`, `intakeLabels` → 이름표)
- Modify: `apps/web/src/app/core/core-screen.tsx:25` (`DECISION:"추천 경로 결정"` → `"처리 방법 결정"`), `:35` (관리자 `"세입자가 아직 질문에 답하는 중이에요."` → `"세입자가 아직 제출하지 않았어요."`)
- Modify: `apps/web/src/app/core/manager-next-step.ts:66` (같은 문구)
- Test: `apps/web/src/app/core/ui/core-display.test.tsx:34,49` (`접수 상태: 추가 정보 필요` → `접수 상태: 정보 부족`), `apps/web/src/app/core/manager-next-step.test.ts:20`

- [ ] **Step 1:** 두 시험의 기대값을 새 이름으로 바꾸고, `core-display.test.tsx`에 `OPEN` 배지 `접수됨`과 `IN_PROGRESS` 배지 `처리 중` 기대를 더한다. 실행해 실패를 본다.
- [ ] **Step 2:** `work-status-badge.tsx`에서 `labels`와 `intakeLabels`를 지우고 `WORK_STATUS_NAMES[status]`, `INTAKE_STATUS_NAMES[status]`를 쓴다(`import { INTAKE_STATUS_NAMES, WORK_STATUS_NAMES } from "../../../components/status-names";`).
- [ ] **Step 3:** `core-screen.tsx`와 `manager-next-step.ts`의 두 문구를 바꾼다.
- [ ] **Step 4:** 시험 통과 확인, 커밋 `fix(web): use the name table on /core`

### Task 3: 끼워 넣은 옛 질문·결정 화면

**Files:**
- Modify: `apps/web/src/components/landlord/logic.ts` (`ROUTE_LABELS` → `ROUTE_NAMES`, `CONTEXT_LABELS`·`VALUE_LABELS` → `buildingFieldName`·`buildingValueName`)
- Modify: `apps/web/src/components/landlord/views.tsx`
  - `STATUS_LABELS` → `INTAKE_STATUS_NAMES`
  - 제목 `수리 요청 {ticket.ticketId}` → `처리 방법 정하기`
  - `검토 문서 개정` 줄 삭제
  - 추천 `{recommendation.label}` → `{routeLabel(recommendation.routeCode)}`
  - 판단 근거 `{key}` → `{buildingFieldName(key)}`
  - 결정 문구: `추천 경로를 승인했어요.`, `관리자가 처리 방법을 직접 정했어요: ${routeLabel(routeCode)}`, `추가 정보를 요청했어요.`
  - 건물 정보 `임대인이 확인한 정보입니다.` → `관리자가 확인한 정보예요.`, 출처 `임대인 확인` → `관리자 확인`
- Modify: `apps/web/src/components/landlord/ticket-review.tsx:142` (`임대인 결정` → `처리 방법 결정`), `:191` (`자동 추천이 없어요. 처리 방법을 직접 골라 주세요.`)
- Modify: `apps/web/src/components/tenant/views.tsx`
  - `STATUS_LABELS` → `INTAKE_STATUS_NAMES`
  - 안전 안내의 `임대인·관리 주체에게` → `관리자에게`(뜻 유지, 그 줄만 해요체)
  - 추가 정보 제목 → `관리자가 추가 정보를 요청했어요`
- Modify: `apps/web/src/components/tenant/ticket-intake.tsx:291` (`제출한 뒤 필요한 정보가 더 있으면 관리자가 추가로 요청할 수 있어요.`)
- Test: `apps/web/src/components/landlord/logic.test.ts:200`, `apps/web/src/components/landlord/views.test.tsx`, `apps/web/src/components/tenant/views.test.tsx`

- [ ] **Step 1:** `views.test.tsx`(landlord)에 시험을 더한다. 추천 경로가 `GENERAL_VENDOR`이고 서버 이름이 `일반 수리 업체`인 결정 화면은 `일반 수리업체`를 보이고, 제목에 접수번호가 없으며, `검토 문서 개정`과 `heatingType`이 없고 `난방 방식`이 있다. 직접 지정 결정은 `관리자가 처리 방법을 직접 정했어요: 관리자 검토`를 보인다. `logic.test.ts:200`의 기대를 `관리자 검토`로, 목록 기대 `검토 대기`를 `결정 대기`로 바꾼다. 실패를 본다.
- [ ] **Step 2:** 위 수정을 한다. 코드를 바꾼 것이지 시험 데이터를 바로잡은 것이 아니므로, 바꾼 기대값은 PR에 "구현 변경"으로 적는다.
- [ ] **Step 3:** 시험 통과 확인, 커밋 `fix(web): name states and routes in the embedded intake and decision screens`

### Task 4: 업체 전달 내용과 업체 화면

**Files:**
- Modify: `apps/web/src/app/core/vendor-handoff-manager.tsx`
  - `policyLabels` → `ACCESS_POLICY_NAMES`
  - `:125`의 선택지 두 개도 이름표로 그린다.
  - 공유 정보 `{detail.value}` 네 곳(`:123,133,141,153`) → `{buildingValueName(detail.key,detail.value)}`
  - `:97` `처리 완료 · COMPLETED / ENDED/CLOSED · 업체 접근 종료` → `처리 완료 · 업체 접근 종료`
- Modify: `apps/web/src/app/vendor/job/vendor-job-screen.tsx` (`ACCESS` → `ACCESS_POLICY_NAMES`, `:876` 값 → `buildingValueName`)
- Test: `apps/web/src/app/core/vendor-handoff-manager.test.tsx`, `apps/web/src/app/core/vendor-handoff-manager-schedule.test.tsx:106-118`, `apps/web/src/app/vendor/job/vendor-job-screen.test.tsx`

- [ ] **Step 1:** 시험을 더한다. 관리자 미리보기와 게시 내용에서 `heatingType`·`INDIVIDUAL` 공유 정보가 `난방 방식: 개별난방`으로 보이고 `INDIVIDUAL`이 없다. 출입 이름은 `세입자가 있을 때만 방문`이다. 업체 화면의 공유 정보와 출입 방식도 같다. 완료 줄은 `처리 완료 · 업체 접근 종료`이고 `COMPLETED`가 없다(schedule 시험의 문자열 기대를 이 줄로 바꾼다). 실패를 본다.
- [ ] **Step 2:** 수정한다.
- [ ] **Step 3:** 통과 확인, 커밋 `fix(web): show names instead of raw values in the Vendor handoff`

### Task 5: 관리자 입주 연결 화면과 조사 오류

**Files:**
- Modify: `apps/web/src/app/core/onboarding-panel.tsx:66-71` (`내 연결 요청` 구역과 그 `더 보기` 버튼을 `{!manager||mine.items.length?<>…</>:null}`로 감싼다)
- Modify: `apps/web/src/app/core/manager-work.tsx:60` (`최신 정보으로` → `최신 정보로`), `:73` (`담당자은` → `담당자는`)
- Test: `apps/web/src/app/core/onboarding-panel.test.tsx` (새 파일)

- [ ] **Step 1:** `renderToStaticMarkup(<OnboardingPanel csrf="c" orgId="o" manager onRefreshAccess={()=>{}} onDenied={()=>{}}/>)`의 첫 그림에 `내 연결 요청`이 없고, `manager={false}`(orgId 없음)에는 있다는 시험을 쓴다. 실패를 본다.
- [ ] **Step 2:** 수정한다. 조사 오류 두 곳도 고친다.
- [ ] **Step 3:** 통과 확인, 커밋 `fix(web): hide the tenant request section from managers and fix two particles`

### Task 6: 화면 시험 기대값과 새 확인

**Files:**
- Modify: `apps/web/tests/**`에서 바뀐 이름을 보는 줄. 처리 상태는 `toHaveText("접수")` → `"접수됨"`, `"처리중"` → `"처리 중"`.
  - `apps/web/tests/core-e2e/`: `core.spec.ts`, `manager-work.spec.ts`, `photo-evidence.spec.ts`(추천 `임대인 검토` → `관리자 검토`), `usability.spec.ts`, `manager-next-step.spec.ts:87`(`처리 방법 결정`)
  - `apps/web/tests/core-login-e2e/`: `design.spec.ts`, `login.spec.ts`, `onboarding.spec.ts`
  - `apps/web/tests/e2e/`: `landlord-demo.spec.ts`, `tenant-demo.spec.ts`, `web-milestone.spec.ts`, `cross-platform-hero-b.spec.ts`
  - `apps/web/tests/vendor-e2e/vendor-job.spec.ts:206`
- Modify: `apps/web/tests/core-login-e2e/manager-next-step.spec.ts` (결정 뒤 요약 `접수 상태: 처리 방법 결정됨`과 결정 화면 `상태: 처리 방법 결정됨`이 같은지 본다)

- [ ] **Step 1:** `rg -n "처리중|toHaveText\(\"접수\"\)|확인 대기|추가 정보 필요|확인 완료|임대인|승인됨|검토 대기|추가 정보 요청됨|안전 확인 필요|작성 중|재실 필요|입회 필요|사전 동의 허용|추천 경로 결정|ENDED/CLOSED|검토 문서|질문에 답하는 중|내 연결 요청" apps/web/tests`로 대상을 찾아 기대값을 새 이름으로 바꾼다. `/demo` 전용 문구(`임대인 데모 시작`, `임대인 데모 · 수리 요청 검토`)는 바꾸지 않는다. `tenant-demo.spec.ts:243`의 세입자에게 안 보여야 할 글자 목록은 `관리자 검토`로 바꿔 검사 뜻을 유지한다.
- [ ] **Step 2:** 결정 뒤 같은 이름을 보는 확인을 더한다.
- [ ] **Step 3:** `npm run test:e2e:core`, `npm run test:e2e:sdk`, `npm run test:e2e:vendor`, `npm run test:e2e:web`를 하나씩 돌린다. 실패하면 원인을 보고 고친다(flaky는 1회만 재실행하고 기록).
- [ ] **Step 4:** 커밋 `test(web): expect the approved names in browser tests`

### Task 7: 검사, 기록, PR

- [ ] `npm run test:shared`, `npm run test:web`, `npm run lint`, `npm run typecheck`, `npm run build:web`, `npm run check:deps`, `python scripts/verify_repository.py --history`
- [ ] 디자인 점검 `node --experimental-transform-types scripts/design-audit.mjs <저장 폴더>` 발견 0건, 390px·1280px 캡처
- [ ] STATUS.md P3 줄, `ops/AI_Execution_Log.csv` 한 줄, `ops/pending_external_sync.md` 한 줄
- [ ] #122 병합 뒤 main을 합치고 다시 검사한 다음 PR을 연다. 본문 첫 줄 `Risk tier: 일반`.
- [ ] CI 통과 뒤 새 문맥 끝 리뷰(DEV-03), 지적 수정, `gh pr merge --merge --match-head-commit <SHA>`
