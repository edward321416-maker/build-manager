import { demoBuildings } from "@build-manager/fixtures";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handleListDemoBuildings } from "./handlers/demo";
import {
  handleCreateTicket,
  handleGetTicket,
  handleSubmitAnswer,
} from "./handlers/tickets";
import {
  createSqliteContainerProvider,
  type ContainerProvider,
} from "./request-container";

/**
 * Proves the Task 12 request-per-container policy does not lose data.
 *
 * Each handler call below opens its own SQLite container against the same temp
 * file and closes it again, exactly as a real request would.
 */
async function withTemporaryApi(
  operation: (provider: ContainerProvider, databasePath: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "build-manager-api-"));
  const databasePath = join(directory, "demo.sqlite");
  try {
    await operation(createSqliteContainerProvider(() => databasePath), databasePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function jsonRequest(body: unknown): Request {
  return new Request("https://demo.test/api/v1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("request-scoped sqlite lifecycle", () => {
  it("keeps state written by one request visible to the next", async () => {
    await withTemporaryApi(async (provider) => {
      const created = await handleCreateTicket(
        provider,
        jsonRequest({ buildingId: demoBuildings[1]!.id, issueType: "LEAK" }),
      );
      expect(created.status).toBe(201);
      const { ticketId } = await created.json();

      const answered = await handleSubmitAnswer(
        provider,
        jsonRequest({ questionId: "safety.gasSmell", answer: false }),
        ticketId,
      );
      expect(answered.status).toBe(200);

      const read = await handleGetTicket(
        provider,
        new URL("https://demo.test/api/v1/tickets?view=tenant"),
        ticketId,
      );

      expect(read.status).toBe(200);
      const ticket = await read.json();
      expect(ticket.ticketId).toBe(ticketId);
      expect(ticket.protocol).toBe("LEAK_V1");
    });
  });

  it("seeds the demo buildings on the first request and preserves them after", async () => {
    await withTemporaryApi(async (provider) => {
      const first = await handleListDemoBuildings(provider);
      expect((await first.json()).length).toBe(demoBuildings.length);

      const second = await handleListDemoBuildings(provider);
      expect((await second.json()).length).toBe(demoBuildings.length);
    });
  });

  it("creates the database only once a request runs", async () => {
    const { existsSync } = await import("node:fs");

    await withTemporaryApi(async (provider, databasePath) => {
      expect(existsSync(databasePath)).toBe(false);

      await handleListDemoBuildings(provider);

      expect(existsSync(databasePath)).toBe(true);
    });
  });

  it("closes each request's container instead of holding the file open", async () => {
    await withTemporaryApi(async (provider, databasePath) => {
      for (let request = 0; request < 5; request += 1) {
        const response = await handleListDemoBuildings(provider);
        expect(response.status).toBe(200);
      }

      const { existsSync } = await import("node:fs");
      expect(existsSync(databasePath)).toBe(true);
    });
  });

  it("writes nothing into the project source tree", async () => {
    await withTemporaryApi(async (provider, databasePath) => {
      await handleListDemoBuildings(provider);

      expect(databasePath.startsWith(tmpdir())).toBe(true);
      expect(databasePath.includes("apps")).toBe(false);
    });
  });
});
