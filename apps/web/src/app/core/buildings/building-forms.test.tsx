// @vitest-environment jsdom
import type { CoreBuildingInfoDto } from "@build-manager/api-contracts";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddBuildingForm, AddUnitForm, BuildingInfoForm, unitLabelValid } from "./building-forms";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const zeroWidth = String.fromCodePoint(0x200b), directionOverride = String.fromCodePoint(0x202e);
const info: CoreBuildingInfoDto = { buildingId: "11111111-1111-4111-8111-111111111111", displayName: "합성 건물", serviceAddress: null, heatingType: "INDIVIDUAL", managementMode: "OWNER_DIRECT", demo: false, version: 3, unitCount: 0, editable: true };
let root: Root | undefined, host: HTMLDivElement | undefined;
afterEach(async () => { if (root) await act(async () => root?.unmount()); host?.remove(); root = undefined; host = undefined; });
async function mount(element: ReactElement) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(element));
  return host;
}
const field = (name: string) => [...host!.querySelectorAll("label")].find(label => label.textContent === name)!.control as HTMLInputElement;
const group = (legend: string) => [...host!.querySelectorAll("fieldset")].find(set => set.querySelector(":scope > legend")?.textContent === legend)!;
const radio = (name: string, legend: string) => [...group(legend).querySelectorAll("label[data-tile]")].find(label => label.textContent?.startsWith(name))!.querySelector("input")!;
const button = (name: string) => [...host!.querySelectorAll("button")].find(b => b.textContent === name)!;
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const press = async (target: HTMLElement) => { await act(async () => target.click()); };
const alertText = () => host!.querySelector('[role="alert"]')?.textContent ?? null;

describe("building info form (spec PR 2)", () => {
  it("starts from the saved info and sends trimmed text, null for an empty address and 모름", async () => {
    const onSave = vi.fn();
    await mount(<BuildingInfoForm info={info} busy={false} problem={null} onSave={onSave} onReload={vi.fn()} />);
    expect(field("건물 이름").value).toBe("합성 건물");
    expect(field("업체에 알려 줄 주소").value).toBe("");
    expect(radio("개별난방", "난방 방식").checked).toBe(true);
    expect(radio("건물주 직접 관리", "관리 방식").checked).toBe(true);
    await type(field("건물 이름"), "  합성 새 이름  ");
    await type(field("업체에 알려 줄 주소"), "   ");
    await press(radio("모름", "관리 방식"));
    await press(button("저장하기"));
    expect(onSave).toHaveBeenCalledWith({ expectedVersion: 3, displayName: "합성 새 이름", serviceAddress: null, heatingType: "INDIVIDUAL", managementMode: null });
  });

  it("sends an address and the other tiles' values", async () => {
    const onSave = vi.fn();
    await mount(<BuildingInfoForm info={{ ...info, heatingType: null, managementMode: null, version: 0 }} busy={false} problem={null} onSave={onSave} onReload={vi.fn()} />);
    expect(radio("모름", "난방 방식").checked).toBe(true);
    await type(field("업체에 알려 줄 주소"), " 합성 주소 1 ");
    await press(radio("중앙·공용난방", "난방 방식"));
    await press(radio("관리사무소", "관리 방식"));
    await press(button("저장하기"));
    expect(onSave).toHaveBeenCalledWith({ expectedVersion: 0, displayName: "합성 건물", serviceAddress: "합성 주소 1", heatingType: "CENTRAL_SHARED", managementMode: "MANAGEMENT_OFFICE" });
  });

  it("refuses names and addresses the vendor packet would refuse, under the field, without saving", async () => {
    const onSave = vi.fn();
    await mount(<BuildingInfoForm info={info} busy={false} problem={null} onSave={onSave} onReload={vi.fn()} />);
    await type(field("건물 이름"), "합성" + zeroWidth + "건물");
    await type(field("업체에 알려 줄 주소"), "가".repeat(201));
    await press(button("저장하기"));
    expect(onSave).not.toHaveBeenCalled();
    expect(field("건물 이름").getAttribute("aria-invalid")).toBe("true");
    expect(field("업체에 알려 줄 주소").getAttribute("aria-invalid")).toBe("true");
    expect(host!.textContent).toContain("건물 이름을 1~50자로 적어 주세요. 줄바꿈이나 보이지 않는 글자는 쓸 수 없어요.");
    expect(host!.textContent).toContain("주소는 200자 안으로 적어 주세요. 줄바꿈이나 보이지 않는 글자는 쓸 수 없어요.");
    expect(document.activeElement).toBe(field("건물 이름"));
    await type(field("건물 이름"), "");
    await type(field("업체에 알려 줄 주소"), "합성" + directionOverride);
    await press(button("저장하기"));
    expect(onSave).not.toHaveBeenCalled();
    expect(field("건물 이름").getAttribute("aria-invalid")).toBe("true");
    expect(field("업체에 알려 줄 주소").getAttribute("aria-invalid")).toBe("true");
  });

  it("says what happened when a save was refused or its result is unknown, with a way to reload", async () => {
    const onReload = vi.fn();
    await mount(<BuildingInfoForm info={info} busy={false} problem="conflict" onSave={vi.fn()} onReload={onReload} />);
    expect(alertText()).toBe("다른 관리자가 먼저 고쳤어요. 새로 불러온 내용을 확인하고 다시 저장해 주세요.새로 불러오기");
    await press(button("새로 불러오기"));
    expect(onReload).toHaveBeenCalledTimes(1);
    await act(async () => root!.render(<BuildingInfoForm info={info} busy={false} problem="uncertain" onSave={vi.fn()} onReload={onReload} />));
    expect(alertText()).toBe("저장 결과를 확인하지 못했어요. 새로 불러와 저장됐는지 확인해 주세요.새로 불러오기");
    await act(async () => root!.render(<BuildingInfoForm info={info} busy={false} problem="missing" onSave={vi.fn()} onReload={onReload} />));
    expect(alertText()).toBe("이 건물을 열 수 없어요. 목록을 새로고침하고 다시 골라 주세요.");
    await act(async () => root!.render(<BuildingInfoForm info={info} busy={false} problem="invalid" onSave={vi.fn()} onReload={onReload} />));
    expect(alertText()).toBe("입력한 내용을 저장하지 못했어요. 건물 이름과 주소를 확인해 주세요.");
  });

  it("locks every field and the button while saving", async () => {
    await mount(<BuildingInfoForm info={info} busy problem={null} onSave={vi.fn()} onReload={vi.fn()} />);
    expect(host!.querySelector("form > fieldset")!.hasAttribute("disabled")).toBe(true);
    expect(button("저장하기").matches(":disabled")).toBe(true);
    expect(field("건물 이름").matches(":disabled")).toBe(true);
    expect(host!.textContent).toContain("고른 값은 세입자 질문과 처리 경로 추천에 쓰여요. 추천은 늘 관리자가 확인해요.");
  });
});

describe("adding a building and a unit", () => {
  it("adds a building by its name, trimmed", async () => {
    const onSubmit = vi.fn();
    await mount(<AddBuildingForm busy={false} problem={null} onSubmit={onSubmit} onReload={vi.fn()} />);
    expect(host!.querySelector("h2")!.textContent).toBe("어떤 건물인가요?");
    await press(button("건물 추가하기"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field("건물 이름").getAttribute("aria-invalid")).toBe("true");
    await type(field("건물 이름"), " 합성 햇살빌라 ");
    await press(button("건물 추가하기"));
    expect(onSubmit).toHaveBeenCalledWith("합성 햇살빌라");
  });

  it("shows a refused name under the field and an unknown result as an alert with a list reload", async () => {
    const onReload = vi.fn();
    await mount(<AddBuildingForm busy={false} problem="invalid" onSubmit={vi.fn()} onReload={onReload} />);
    expect(field("건물 이름").getAttribute("aria-invalid")).toBe("true");
    await act(async () => root!.render(<AddBuildingForm busy={false} problem="uncertain" onSubmit={vi.fn()} onReload={onReload} />));
    expect(alertText()).toBe("건물을 추가했는지 확인하지 못했어요. 목록을 새로 불러와 확인한 뒤 필요하면 다시 추가해 주세요.목록 새로 불러오기");
    await press(button("목록 새로 불러오기"));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("adds a unit by a name the vendor packet can carry", async () => {
    const onSubmit = vi.fn();
    await mount(<AddUnitForm busy={false} problem={null} onSubmit={onSubmit} onReload={vi.fn()} />);
    expect(host!.querySelector("h2")!.textContent).toBe("어떤 호실인가요?");
    await type(field("호실 이름"), "101" + zeroWidth + "호");
    await press(button("호실 추가하기"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(host!.textContent).toContain("호실 이름을 1~80자로 적어 주세요. 줄바꿈이나 보이지 않는 글자는 쓸 수 없어요.");
    await type(field("호실 이름"), " 101호 ");
    await press(button("호실 추가하기"));
    expect(onSubmit).toHaveBeenCalledWith("101호");
  });

  it("names a duplicate under the field and an unknown result as an alert", async () => {
    const onReload = vi.fn();
    await mount(<AddUnitForm busy={false} problem="duplicate" onSubmit={vi.fn()} onReload={onReload} />);
    expect(field("호실 이름").getAttribute("aria-invalid")).toBe("true");
    expect(host!.textContent).toContain("이 건물에 같은 이름의 호실이 있어요. 다른 이름을 적어 주세요.");
    await act(async () => root!.render(<AddUnitForm busy={false} problem="uncertain" onSubmit={vi.fn()} onReload={onReload} />));
    expect(alertText()).toBe("호실을 추가했는지 확인하지 못했어요. 호실 목록을 새로 불러와 확인한 뒤 필요하면 다시 추가해 주세요.새로 불러오기");
    await press(button("새로 불러오기"));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("checks unit names by B3's limits plus the vendor packet's", () => {
    expect(unitLabelValid("101호")).toBe(true);
    expect(unitLabelValid("가".repeat(80))).toBe(true);
    expect(unitLabelValid("가".repeat(81))).toBe(false);
    expect(unitLabelValid(" 101호")).toBe(false);
    expect(unitLabelValid("")).toBe(false);
    expect(unitLabelValid("101" + String.fromCodePoint(0xad) + "호")).toBe(false);
    expect(unitLabelValid("101" + String.fromCodePoint(0xfeff))).toBe(false);
  });
});
