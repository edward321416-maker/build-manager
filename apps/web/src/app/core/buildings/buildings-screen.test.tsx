// @vitest-environment jsdom
import { ApiClientError } from "@build-manager/api-client";
import type { CoreBuildingInfoDto, CoreBuildingListDto, CoreUnitDto } from "@build-manager/api-contracts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BuildingPlace } from "./building-place";
import { BuildingsScreen } from "./buildings-screen";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const org = "99999999-9999-4999-8999-999999999999", a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222";
const list: CoreBuildingListDto = { editable: true, items: [{ buildingId: a, displayName: "합성 햇살빌라", unitCount: 1, needsInfo: false }, { buildingId: b, displayName: null, unitCount: 0, needsInfo: true }] };
const infoA: CoreBuildingInfoDto = { buildingId: a, displayName: "합성 햇살빌라", serviceAddress: "합성 주소 1", heatingType: "INDIVIDUAL", managementMode: null, demo: false, version: 2, unitCount: 1, editable: true };
const units = [{ id: "u1", buildingId: a, buildingName: "합성 햇살빌라", label: "101호" }] as CoreUnitDto[];
const failure = (status: number) => new ApiClientError("HTTP_ERROR", "요청이 실패했어요.", { status });
const network = () => new ApiClientError("NETWORK_ERROR", "요청을 보내지 못했어요.");

function fakeClient() {
  return { buildings: {
    list: vi.fn(async () => list), read: vi.fn(async (id: string) => id === a ? infoA : { ...infoA, buildingId: id, displayName: null, serviceAddress: null, heatingType: null, version: 0, unitCount: 0 }),
    save: vi.fn(async (id: string, input: { expectedVersion: number; displayName: string; serviceAddress: string | null; heatingType: CoreBuildingInfoDto["heatingType"]; managementMode: CoreBuildingInfoDto["managementMode"] }) =>
      ({ ...infoA, buildingId: id, ...input, version: input.expectedVersion + 1 })),
    create: vi.fn(async (orgId: string, name: string) => ({ id: b, orgId, addressReference: name })),
    addUnit: vi.fn(async (orgId: string, buildingId: string, label: string) => ({ id: "u2", orgId, propertyId: buildingId, label })),
  } };
}
type Client = ReturnType<typeof fakeClient>;
let root: Root | undefined, host: HTMLDivElement | undefined;
afterEach(async () => { if (root) await act(async () => root?.unmount()); host?.remove(); document.querySelectorAll("[data-toast]").forEach(node => node.remove()); root = undefined; host = undefined; });
const settle = async () => { await act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); }); };
function props(client: Client, place: BuildingPlace, extra: Record<string, unknown> = {}) {
  return { client: client as never, orgId: org, units, place, revision: 0, disabled: false, onOpen: vi.fn(), onReplace: vi.fn(), onBack: vi.fn(), onName: vi.fn(), onUnitsChanged: vi.fn(async () => undefined), ...extra };
}
async function mount(p: ReturnType<typeof props>) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<BuildingsScreen {...p} />)); await settle();
  return p;
}
async function rerender(p: ReturnType<typeof props>) { await act(async () => root!.render(<BuildingsScreen {...p} />)); await settle(); }
const button = (name: string) => [...host!.querySelectorAll("button")].find(item => item.textContent === name)!;
const field = (name: string) => [...host!.querySelectorAll("label")].find(label => label.textContent === name)!.control as HTMLInputElement;
const press = async (target: HTMLElement) => { await act(async () => target.click()); await settle(); };
async function type(input: HTMLInputElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
const toast = () => document.querySelector("[data-toast]")?.textContent ?? null;
const alertText = () => host!.querySelector('[role="alert"]')?.textContent ?? null;

describe("building screen flows (P6 PR 2)", () => {
  it("lists buildings and opens one by its row", async () => {
    const client = fakeClient(), p = await mount(props(client, { kind: "list" }));
    expect(host!.textContent).toContain("건물 2곳");
    await press(host!.querySelector<HTMLButtonElement>(`[data-building-row="${b}"]`)!);
    expect(p.onOpen).toHaveBeenCalledWith({ kind: "building", id: b });
    expect(p.onName).toHaveBeenLastCalledWith(null);
  });

  it("reads the open building and names it for the top bar", async () => {
    const client = fakeClient(), p = await mount(props(client, { kind: "building", id: a }));
    expect(client.buildings.read).toHaveBeenCalledWith(a);
    expect(host!.textContent).toContain("합성 주소 1");
    expect(host!.textContent).toContain("101호");
    expect(p.onName).toHaveBeenLastCalledWith("합성 햇살빌라");
    await press(button("고치기"));
    expect(p.onOpen).toHaveBeenCalledWith({ kind: "edit", id: a });
    await press(button("호실 추가하기"));
    expect(p.onOpen).toHaveBeenCalledWith({ kind: "addUnit", id: a });
  });

  it("saves building info, refreshes units and the list, goes back and says 저장했어요", async () => {
    const client = fakeClient(), p = await mount(props(client, { kind: "edit", id: a }));
    await type(field("업체에 알려 줄 주소"), "합성 주소 2");
    await press(button("저장하기"));
    expect(client.buildings.save).toHaveBeenCalledWith(a, { expectedVersion: 2, displayName: "합성 햇살빌라", serviceAddress: "합성 주소 2", heatingType: "INDIVIDUAL", managementMode: null });
    expect(p.onUnitsChanged).toHaveBeenCalledTimes(1);
    expect(client.buildings.list).toHaveBeenCalledTimes(2);
    expect(p.onBack).toHaveBeenCalledTimes(1);
    expect(toast()).toBe("저장했어요");
  });

  it("keeps the input on a version conflict and refills the form from the reload", async () => {
    const client = fakeClient();
    client.buildings.save.mockRejectedValueOnce(failure(409));
    const p = await mount(props(client, { kind: "edit", id: a }));
    await type(field("건물 이름"), "합성 새 이름");
    await press(button("저장하기"));
    expect(alertText()).toContain("다른 관리자가 먼저 고쳤어요.");
    expect(field("건물 이름").value).toBe("합성 새 이름");
    expect(p.onBack).not.toHaveBeenCalled();
    client.buildings.read.mockResolvedValueOnce({ ...infoA, displayName: "합성 다른 이름", version: 3 });
    await press(button("새로 불러오기"));
    expect(alertText()).toBeNull();
    expect(field("건물 이름").value).toBe("합성 다른 이름");
    expect(p.onBack).not.toHaveBeenCalled();
  });

  it("treats an unknown save result as saved only when the reload shows exactly that save", async () => {
    const client = fakeClient();
    client.buildings.save.mockRejectedValueOnce(network());
    const p = await mount(props(client, { kind: "edit", id: a }));
    await type(field("업체에 알려 줄 주소"), "합성 주소 2");
    await press(button("저장하기"));
    expect(alertText()).toContain("저장 결과를 확인하지 못했어요.");
    client.buildings.read.mockResolvedValueOnce({ ...infoA, serviceAddress: "합성 주소 2", version: 3 });
    await press(button("새로 불러오기"));
    expect(p.onBack).toHaveBeenCalledTimes(1);
    expect(toast()).toBe("저장했어요");
  });

  it("adds a building: B3 creates it, the name is saved as building info, and the building opens", async () => {
    const client = fakeClient(), p = await mount(props(client, { kind: "add" }));
    await type(field("건물 이름"), "합성 새 건물");
    await press(button("건물 추가하기"));
    expect(client.buildings.create).toHaveBeenCalledWith(org, "합성 새 건물");
    expect(client.buildings.save).toHaveBeenCalledWith(b, { expectedVersion: 0, displayName: "합성 새 건물", serviceAddress: null, heatingType: null, managementMode: null });
    expect(p.onReplace).toHaveBeenCalledWith({ kind: "building", id: b });
    expect(toast()).toBe("건물을 추가했어요");
    expect(client.buildings.list).toHaveBeenCalledTimes(2);
  });

  it("says the building exists but has no name when the second step fails", async () => {
    const client = fakeClient();
    client.buildings.save.mockRejectedValueOnce(network());
    const p = await mount(props(client, { kind: "add" }));
    await type(field("건물 이름"), "합성 새 건물");
    await press(button("건물 추가하기"));
    expect(p.onReplace).toHaveBeenCalledWith({ kind: "building", id: b });
    expect(toast()).toBeNull();
    await rerender({ ...p, place: { kind: "building", id: b } });
    expect(alertText()).toBe("건물은 추가했어요. 이름을 저장하지 못했어요. 건물 정보에서 다시 저장해 주세요.");
  });

  it("never saves a name when it cannot tell whether the building was created", async () => {
    const client = fakeClient();
    client.buildings.create.mockRejectedValueOnce(network());
    const p = await mount(props(client, { kind: "add" }));
    await type(field("건물 이름"), "합성 새 건물");
    await press(button("건물 추가하기"));
    expect(client.buildings.save).not.toHaveBeenCalled();
    expect(alertText()).toContain("건물을 추가했는지 확인하지 못했어요.");
    await press(button("목록 새로 불러오기"));
    expect(client.buildings.list).toHaveBeenCalledTimes(2);
    expect(p.onBack).toHaveBeenCalledTimes(1);
  });

  it("adds a unit, refreshes and goes back; a duplicate name stays on the form", async () => {
    const client = fakeClient();
    client.buildings.addUnit.mockRejectedValueOnce(failure(409));
    const p = await mount(props(client, { kind: "addUnit", id: a }));
    await type(field("호실 이름"), "101호");
    await press(button("호실 추가하기"));
    expect(host!.textContent).toContain("이 건물에 같은 이름의 호실이 있어요.");
    expect(p.onBack).not.toHaveBeenCalled();
    await type(field("호실 이름"), "102호");
    await press(button("호실 추가하기"));
    expect(client.buildings.addUnit).toHaveBeenLastCalledWith(org, a, "102호");
    expect(p.onUnitsChanged).toHaveBeenCalledTimes(1);
    expect(p.onBack).toHaveBeenCalledTimes(1);
    expect(toast()).toBe("호실을 추가했어요");
  });

  it("offers a retry when the list cannot be read", async () => {
    const client = fakeClient();
    client.buildings.list.mockRejectedValueOnce(network());
    await mount(props(client, { kind: "list" }));
    expect(alertText()).toBe("건물 목록을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.다시 시도하기");
    await press(button("다시 시도하기"));
    expect(host!.textContent).toContain("건물 2곳");
  });

  it("says a missing building cannot be opened", async () => {
    const client = fakeClient();
    client.buildings.read.mockRejectedValueOnce(failure(404));
    await mount(props(client, { kind: "building", id: a }));
    expect(alertText()).toBe("이 건물을 열 수 없어요. 목록을 새로고침하고 다시 골라 주세요.");
  });

  it("shows no input at all for the public demo, even on an input step", async () => {
    const client = fakeClient();
    client.buildings.list.mockResolvedValue({ ...list, editable: false });
    client.buildings.read.mockResolvedValue({ ...infoA, editable: false });
    for (const place of [{ kind: "edit", id: a }, { kind: "addUnit", id: a }, { kind: "add" }] as BuildingPlace[]) {
      await mount(props(client, place));
      expect(host!.querySelector("input")).toBeNull();
      expect(host!.textContent).toContain("체험에서는 바꿀 수 없어요.");
      await act(async () => root!.unmount()); host!.remove(); root = undefined;
    }
  });

  it("reads again when the screen's refresh count changes", async () => {
    const client = fakeClient(), p = await mount(props(client, { kind: "building", id: a }));
    await rerender({ ...p, revision: 1 });
    expect(client.buildings.list).toHaveBeenCalledTimes(2);
    expect(client.buildings.read).toHaveBeenCalledTimes(2);
  });
});
