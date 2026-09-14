import type { Unit } from "@/domain/building/types";

export const demoUnitA: Unit = {
  id: "demo-unit-a",
  buildingId: "demo-building-a",
  unitLabel: "203호",
  tenantToken: "dt_7Kx4pQ2mN9vR",
  context: [],
};

export const demoUnitB: Unit = {
  id: "demo-unit-b",
  buildingId: "demo-building-b",
  unitLabel: "203호",
  tenantToken: "dt_B8wL3sT6yH1c",
  context: [],
};

export const demoUnits: Unit[] = [demoUnitA, demoUnitB];
