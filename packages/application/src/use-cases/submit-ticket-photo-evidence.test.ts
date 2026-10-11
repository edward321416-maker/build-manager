import type { Ticket } from "@build-manager/domain";
import { beforeEach, describe, expect, it } from "vitest";
import type { ApplicationDependencies } from "../ports";
import { createInMemoryDependencies } from "../testing/in-memory-adapters";
import { approveRecommendation } from "./approve-recommendation";
import { createDemoBuilding } from "./create-demo-building";
import { createTicket } from "./create-ticket";
import { finalizeTicket } from "./finalize-ticket";
import { submitTicketAnswer } from "./submit-ticket-answer";
import { submitTicketPhotoEvidence } from "./submit-ticket-photo-evidence";
import { verifyBuildingContext } from "./verify-building-context";

// Spec: docs/superpowers/specs/2026-10-11-intake-photo-evidence-p1b-design.md (PR 1).
const PHOTO_A = "0b6f7d1e-2c3a-4d5e-8f90-1a2b3c4d5e6f";
const PHOTO_B = "1c7e8f2a-3b4c-4d6e-9a01-2b3c4d5e6f70";

let deps: ApplicationDependencies;
beforeEach(() => {
  deps = createInMemoryDependencies();
});

/** A leak in an office-managed building, answered up to the evidence step. */
async function leakAwaitingEvidence(location: "CEILING_WALL" | "APPLIANCE" = "CEILING_WALL"): Promise<Ticket> {
  const building = await createDemoBuilding(deps, { displayName: "DEMO 라온하우징" });
  await verifyBuildingContext(deps, { buildingId: building.id, managementMode: "MANAGEMENT_OFFICE", heatingType: "CENTRAL_SHARED" });
  const ticket = await createTicket(deps, { buildingId: building.id, unitId: "demo-unit-b", issueType: "LEAK", rawUserText: "합성 천장 누수" });
  let current = ticket;
  for (const [questionId, value] of [
    ["safety.electricalWaterRisk", false],
    ["safety.otherUrgentHazard", false],
    ["safety.gasSmell", false],
    ["safety.smokeOrFire", false],
    ["leak.location", location],
    ["leak.active", true],
    ["leak.applianceOnly", false],
    ["leak.firstObservedAt", "오늘 아침"],
  ] as const) {
    current = await submitTicketAnswer(deps, { ticketId: ticket.id, questionId, value });
  }
  return current;
}

describe("submitTicketPhotoEvidence", () => {
  it("records the tenant's photo as the evidence the protocol asks for, so the intake completes", async () => {
    const ticket = await leakAwaitingEvidence();
    const result = await submitTicketPhotoEvidence(deps, { ticketId: ticket.id, evidenceType: "LEAK_AREA_PHOTO", photoId: PHOTO_A });
    expect(result.changed).toBe(true);
    expect(result.ticket.evidence).toEqual([
      expect.objectContaining({ type: "LEAK_AREA_PHOTO", source: "TENANT_UPLOAD", storageRef: `core-photo:${PHOTO_A}`, fixtureRef: null }),
    ]);
    expect(result.ticket.status).toBe("IN_PROGRESS");
    const finalized = await finalizeTicket(deps, { ticketId: ticket.id });
    expect(finalized.status).toBe("READY_FOR_REVIEW");
    expect(finalized.repairPacket?.recommendation?.primary).toBeTruthy();
  });

  it("still ends as PARTIAL when no photo is chosen", async () => {
    const ticket = await leakAwaitingEvidence();
    expect((await finalizeTicket(deps, { ticketId: ticket.id })).status).toBe("PARTIAL");
  });

  it("replaces the photo for the same evidence type and leaves a repeated request unchanged", async () => {
    const ticket = await leakAwaitingEvidence();
    await submitTicketPhotoEvidence(deps, { ticketId: ticket.id, evidenceType: "LEAK_AREA_PHOTO", photoId: PHOTO_A });
    const replaced = await submitTicketPhotoEvidence(deps, { ticketId: ticket.id, evidenceType: "LEAK_AREA_PHOTO", photoId: PHOTO_B });
    expect(replaced.changed).toBe(true);
    expect(replaced.ticket.evidence.map((item) => item.storageRef)).toEqual([`core-photo:${PHOTO_B}`]);
    const repeated = await submitTicketPhotoEvidence(deps, { ticketId: ticket.id, evidenceType: "LEAK_AREA_PHOTO", photoId: PHOTO_B });
    expect(repeated.changed).toBe(false);
    expect(repeated.ticket).toEqual(replaced.ticket);
  });

  it("rejects an evidence type the protocol does not ask for now", async () => {
    const ticket = await leakAwaitingEvidence();
    for (const evidenceType of ["FIXTURE_PHOTO", "GENERAL_PHOTO", "CONTROL_PANEL_PHOTO"] as const) {
      await expect(submitTicketPhotoEvidence(deps, { ticketId: ticket.id, evidenceType, photoId: PHOTO_A })).rejects.toMatchObject({ code: "STATE_CONFLICT" });
    }
    expect((await deps.tickets.findById(ticket.id))?.evidence).toEqual([]);
  });

  it("accepts the appliance photo once the answers make it required", async () => {
    const ticket = await leakAwaitingEvidence("APPLIANCE");
    const result = await submitTicketPhotoEvidence(deps, { ticketId: ticket.id, evidenceType: "FIXTURE_PHOTO", photoId: PHOTO_A });
    expect(result.ticket.evidence.map((item) => item.type)).toEqual(["FIXTURE_PHOTO"]);
  });

  it("rejects a change once a landlord decision is recorded", async () => {
    const ticket = await leakAwaitingEvidence();
    await submitTicketPhotoEvidence(deps, { ticketId: ticket.id, evidenceType: "LEAK_AREA_PHOTO", photoId: PHOTO_A });
    const finalized = await finalizeTicket(deps, { ticketId: ticket.id });
    await approveRecommendation(deps, { ticketId: ticket.id, selectedRoute: finalized.repairPacket!.recommendation!.primary });
    await expect(submitTicketPhotoEvidence(deps, { ticketId: ticket.id, evidenceType: "LEAK_AREA_PHOTO", photoId: PHOTO_B })).rejects.toMatchObject({ code: "STATE_CONFLICT" });
  });
});
