import { TenantTicketStatusDtoSchema } from "@build-manager/api-contracts";
import { demoBuildings } from "@build-manager/fixtures";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handleCreateTicket,
  handleFinalizeTicket,
  handleSubmitAnswer,
  handleSubmitEvidence,
  handleTicketDecision,
} from "./handlers/tickets";
import { createSqliteContainerProvider } from "./request-container";

/**
 * A request-scoped container builds its own dependencies, so two requests can
 * hold two different Clock instances. Wall time is frozen in these tests so the
 * only thing that can still order two operations is a clock shared by the whole
 * process.
 */
const BUILDING_B = demoBuildings[1]!.id;
const FROZEN_MS = Date.parse("2026-09-16T09:00:00.000Z");

const CLEAN_LEAK_ANSWERS: ReadonlyArray<readonly [string, boolean | string]> = [
  ["safety.electricalWaterRisk", false],
  ["safety.otherUrgentHazard", false],
  ["safety.gasSmell", false],
  ["safety.smokeOrFire", false],
  ["leak.location", "CEILING_WALL"],
  ["leak.active", true],
  ["leak.applianceOnly", false],
  ["leak.firstObservedAt", "2026-09-14 아침"],
];

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

function jsonRequest(body: unknown): Request {
  return new Request("https://demo.test/api/v1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function withTempDatabase(
  operation: (databasePath: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "build-manager-clock-"));
  try {
    await operation(join(directory, "demo.sqlite"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** Re-evaluates the container module, as a separately bundled route would. */
async function loadContainerModule() {
  vi.resetModules();
  return import("./request-container");
}

/** Builds a ticket the landlord can review, through ordinary requests. */
async function reviewableTicket(databasePath: string): Promise<string> {
  const provider = createSqliteContainerProvider(() => databasePath);

  const created = await handleCreateTicket(
    provider,
    jsonRequest({
      buildingId: BUILDING_B,
      issueType: "LEAK",
      rawUserText: "천장에서 물이 떨어집니다.",
    }),
  );
  const { ticketId } = TenantTicketStatusDtoSchema.parse(await created.json());

  for (const [questionId, answer] of CLEAN_LEAK_ANSWERS) {
    await handleSubmitAnswer(
      provider,
      jsonRequest({ questionId, answer }),
      ticketId,
    );
  }
  await handleSubmitEvidence(
    provider,
    jsonRequest({
      evidenceType: "LEAK_LOCATION",
      fixtureId: "demo-leak-location",
    }),
    ticketId,
  );
  await handleFinalizeTicket(provider, jsonRequest({}), ticketId);

  return ticketId;
}

describe("process clock ordering", () => {
  it("keeps ordering across duplicate evaluations of the container module", async () => {
    await withTempDatabase(async (databasePath) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(FROZEN_MS);

      const moduleA = await loadContainerModule();
      const first = await moduleA.createSqliteContainerProvider(
        () => databasePath,
      )((container) => container.dependencies.clock.now());

      const moduleB = await loadContainerModule();
      const second = await moduleB.createSqliteContainerProvider(
        () => databasePath,
      )((container) => container.dependencies.clock.now());

      expect(Date.parse(second)).toBeGreaterThan(Date.parse(first));
    });
  });

  it("orders a follow-up response strictly after the request that asked for it", async () => {
    await withTempDatabase(async (databasePath) => {
      const ticketId = await reviewableTicket(databasePath);

      // Wall time stops here: only a process-shared clock can still advance.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(FROZEN_MS);

      await handleTicketDecision(
        createSqliteContainerProvider(() => databasePath),
        jsonRequest({
          type: "REQUEST_MORE_INFO",
          reason: "누수 시점을 다시 확인해 주세요",
          requestedQuestionIds: ["leak.firstObservedAt"],
        }),
        ticketId,
      );

      await handleSubmitAnswer(
        createSqliteContainerProvider(() => databasePath),
        jsonRequest({
          questionId: "leak.firstObservedAt",
          answer: "2026-09-16 아침",
        }),
        ticketId,
      );

      const times = await createSqliteContainerProvider(() => databasePath)(
        async (container) => {
          const ticket = await container.dependencies.tickets.findById(ticketId);
          const answered = (ticket?.answers ?? [])
            .filter((answer) => answer.questionId === "leak.firstObservedAt")
            .map((answer) => Date.parse(answer.createdAt));

          return {
            requestedAt: Date.parse(ticket?.moreInfoRequest?.requestedAt ?? ""),
            answeredAt: Math.max(...answered),
          };
        },
      );

      expect(times.answeredAt).toBeGreaterThan(times.requestedAt);
    });
  });
});
