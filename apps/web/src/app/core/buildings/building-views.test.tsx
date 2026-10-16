import type { CoreBuildingInfoDto, CoreBuildingListDto, CoreUnitDto } from "@build-manager/api-contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuildingDetail, BuildingList, READ_ONLY_NOTE } from "./building-views";

const noop = () => undefined;
const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222", c = "33333333-3333-4333-8333-333333333333";
const list: CoreBuildingListDto = { editable: true, items: [
  { buildingId: a, displayName: "합성 햇살빌라", unitCount: 8, needsInfo: false },
  { buildingId: b, displayName: "합성 한빛오피스텔", unitCount: 24, needsInfo: true },
  { buildingId: c, displayName: null, unitCount: 2, needsInfo: true },
] };
const info: CoreBuildingInfoDto = { buildingId: b, displayName: "합성 한빛오피스텔", serviceAddress: null, heatingType: "INDIVIDUAL", managementMode: null, demo: false, version: 0, unitCount: 2, editable: true };
const units = [
  { id: "u1", buildingId: b, buildingName: "합성 한빛오피스텔", label: "101호" },
  { id: "u2", buildingId: b, buildingName: "합성 한빛오피스텔", label: "102호" },
  { id: "u3", buildingId: a, buildingName: "합성 햇살빌라", label: "201호" },
] as CoreUnitDto[];
const text = (html: string) => html.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");
const rows = (html: string) => [...html.matchAll(/<button[^>]*data-building-row="([^"]+)"[^>]*>(.*?)<\/button>/g)].map(([, id, inner]) => ({ id, text: text(inner) }));

describe("building list (approved mockup A)", () => {
  it("counts buildings and shows each row's name, units and missing info", () => {
    const html = renderToStaticMarkup(<BuildingList list={list} selectedId={null} disabled={false} onOpen={noop} onAdd={noop} />);
    expect(html).toContain("<h2>건물 3곳</h2>");
    expect(rows(html)).toEqual([
      { id: a, text: "|합성 햇살빌라|호실 8개|" },
      { id: b, text: "|합성 한빛오피스텔|호실 24개|정보 입력 필요|" },
      { id: c, text: "|건물|이름 없음 · 호실 2개|정보 입력 필요|" },
    ]);
    expect(html).toMatch(/<button[^>]*>건물 추가하기<\/button>/);
    expect(html).not.toContain(READ_ONLY_NOTE);
    expect(html).not.toContain("aria-current");
  });

  it("marks the open building's row", () => {
    const html = renderToStaticMarkup(<BuildingList list={list} selectedId={b} disabled={false} onOpen={noop} onAdd={noop} />);
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`data-building-row="${b}" aria-current="true"`));
  });

  it("is read-only for the public demo and says why where the button was", () => {
    const html = renderToStaticMarkup(<BuildingList list={{ ...list, editable: false }} selectedId={null} disabled={false} onOpen={noop} onAdd={noop} />);
    expect(html).not.toContain("건물 추가하기");
    expect(html).toMatch(/data-building-bar[^>]*><p[^>]*>체험에서는 바꿀 수 없어요\.<\/p>/);
  });

  it("says what to do when there are no buildings", () => {
    expect(renderToStaticMarkup(<BuildingList list={{ editable: true, items: [] }} selectedId={null} disabled={false} onOpen={noop} onAdd={noop} />)).toContain("아직 건물이 없어요. 건물을 추가해 주세요.");
    const readOnly = renderToStaticMarkup(<BuildingList list={{ editable: false, items: [] }} selectedId={null} disabled={false} onOpen={noop} onAdd={noop} />);
    expect(readOnly).toContain("아직 건물이 없어요.");
    expect(readOnly).not.toContain("건물을 추가해 주세요");
  });
});

describe("building screen", () => {
  const facts = (html: string) => [...html.matchAll(/<dt>([^<]+)<\/dt><dd([^>]*)>([^<]+)<\/dd>/g)].map(([, name, attrs, value]) => [name, value, attrs.includes('data-missing="true"')]);

  it("shows the four facts with shared names and 입력 전 before the first save", () => {
    const html = renderToStaticMarkup(<BuildingDetail info={info} units={units} notice={null} disabled={false} onEdit={noop} onAddUnit={noop} />);
    expect(facts(html)).toEqual([
      ["건물 이름", "합성 한빛오피스텔", false],
      ["업체에 알려 줄 주소", "입력 전", true],
      ["난방 방식", "개별난방", false],
      ["관리 방식", "입력 전", true],
    ]);
    expect(html).toMatch(/<button[^>]*>고치기<\/button>/);
  });

  it("says 모름 for a heating or management answer saved as unknown", () => {
    const html = renderToStaticMarkup(<BuildingDetail info={{ ...info, displayName: null, serviceAddress: "합성 주소 1", heatingType: null, managementMode: "OWNER_DIRECT", version: 2 }} units={units} notice={null} disabled={false} onEdit={noop} onAddUnit={noop} />);
    expect(facts(html)).toEqual([
      ["건물 이름", "입력 전", true],
      ["업체에 알려 줄 주소", "합성 주소 1", false],
      ["난방 방식", "모름", false],
      ["관리 방식", "건물주 직접 관리", false],
    ]);
  });

  it("lists only this building's units, in the order given", () => {
    const html = renderToStaticMarkup(<BuildingDetail info={info} units={units} notice={null} disabled={false} onEdit={noop} onAddUnit={noop} />);
    expect(html).toContain("<h2>호실 2개</h2>");
    expect([...html.matchAll(/<li>([^<]+)<\/li>/g)].map(m => m[1])).toEqual(["101호", "102호"]);
    expect(html).toMatch(/data-building-bar[^>]*><button[^>]*>호실 추가하기<\/button>/);
  });

  it("is read-only for the demo: no 고치기, no 호실 추가하기, and the reason in the bar", () => {
    const html = renderToStaticMarkup(<BuildingDetail info={{ ...info, demo: true, editable: false }} units={[]} notice={null} disabled={false} onEdit={noop} onAddUnit={noop} />);
    expect(html).not.toContain("고치기");
    expect(html).not.toContain("호실 추가하기");
    expect(html).toContain("아직 호실이 없어요.");
    expect(html).not.toContain("호실을 추가해 주세요");
    expect(html).toMatch(/data-building-bar[^>]*><p[^>]*>체험에서는 바꿀 수 없어요\.<\/p>/);
  });

  it("puts a notice first as an alert", () => {
    const html = renderToStaticMarkup(<BuildingDetail info={info} units={units} notice="건물은 추가했어요. 이름을 저장하지 못했어요. 건물 정보에서 다시 저장해 주세요." disabled={false} onEdit={noop} onAddUnit={noop} />);
    expect(html).toMatch(/^<div[^>]*><p role="alert">건물은 추가했어요\./);
  });
});
