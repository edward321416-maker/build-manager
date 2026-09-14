import {
  approveRecommendation,
  createDemoBuilding,
  createTicket,
  finalizeTicket,
  getBuilding,
  getTicket,
  listBuildings,
  listTickets,
  overrideRoute,
  requestMoreInfo,
  resetDemo,
  searchAddress,
  submitTicketAnswer,
  submitTicketEvidence,
  verifyBuildingContext,
  type ApplicationDependencies,
  type Clock,
  type IdGenerator,
} from "@build-manager/application";
import type { Building } from "@build-manager/domain";
import { demoBuildings } from "@build-manager/fixtures";
import { encodeBuilding } from "./persistence/codecs";
import { openSqliteDatabase } from "./persistence/database";
import { createSqliteDemoStateResetter, decideInitialSeed } from "./persistence/demo-reset";
import { createMemoryStore } from "./persistence/memory-store";
import {
  createSqliteBuildingRepository,
  createSqliteTicketRepository,
} from "./persistence/repositories";
import { bootstrapSchema } from "./persistence/schema";
import { withTransaction } from "./persistence/transaction";
import {
  createFixtureAddressProvider,
  createFixtureBuildingRegistryProvider,
  createFixtureKaptProvider,
} from "./providers/fixture-providers";
import { createRandomIdGenerator, createSystemClock } from "./runtime/system";

/**
 * The wired use cases, bound to this container's dependencies. Route handlers
 * call these instead of assembling dependencies themselves.
 */
export type ServerUseCases = {
  createDemoBuilding: (
    input: Parameters<typeof createDemoBuilding>[1],
  ) => ReturnType<typeof createDemoBuilding>;
  verifyBuildingContext: (
    input: Parameters<typeof verifyBuildingContext>[1],
  ) => ReturnType<typeof verifyBuildingContext>;
  createTicket: (
    input: Parameters<typeof createTicket>[1],
  ) => ReturnType<typeof createTicket>;
  submitTicketAnswer: (
    input: Parameters<typeof submitTicketAnswer>[1],
  ) => ReturnType<typeof submitTicketAnswer>;
  submitTicketEvidence: (
    input: Parameters<typeof submitTicketEvidence>[1],
  ) => ReturnType<typeof submitTicketEvidence>;
  finalizeTicket: (
    input: Parameters<typeof finalizeTicket>[1],
  ) => ReturnType<typeof finalizeTicket>;
  approveRecommendation: (
    input: Parameters<typeof approveRecommendation>[1],
  ) => ReturnType<typeof approveRecommendation>;
  overrideRoute: (
    input: Parameters<typeof overrideRoute>[1],
  ) => ReturnType<typeof overrideRoute>;
  requestMoreInfo: (
    input: Parameters<typeof requestMoreInfo>[1],
  ) => ReturnType<typeof requestMoreInfo>;
  listTickets: (
    filter: Parameters<typeof listTickets>[1],
  ) => ReturnType<typeof listTickets>;
  getTicket: (
    input: Parameters<typeof getTicket>[1],
  ) => ReturnType<typeof getTicket>;
  listBuildings: () => ReturnType<typeof listBuildings>;
  getBuilding: (
    input: Parameters<typeof getBuilding>[1],
  ) => ReturnType<typeof getBuilding>;
  searchAddress: (
    input: Parameters<typeof searchAddress>[1],
  ) => ReturnType<typeof searchAddress>;
  resetDemo: () => ReturnType<typeof resetDemo>;
};

export type ServerContainer = {
  dependencies: ApplicationDependencies;
  useCases: ServerUseCases;
  /** Idempotent: safe to call more than once. */
  close(): void;
};

export type SqliteServerContainerOptions = {
  databasePath: string;
  clock?: Clock;
  idGenerator?: IdGenerator;
  canonicalBuildings?: readonly Building[];
};

export type MemoryServerContainerOptions = {
  clock?: Clock;
  idGenerator?: IdGenerator;
  canonicalBuildings?: readonly Building[];
};

function bindUseCases(dependencies: ApplicationDependencies): ServerUseCases {
  return {
    createDemoBuilding: (input) => createDemoBuilding(dependencies, input),
    verifyBuildingContext: (input) => verifyBuildingContext(dependencies, input),
    createTicket: (input) => createTicket(dependencies, input),
    submitTicketAnswer: (input) => submitTicketAnswer(dependencies, input),
    submitTicketEvidence: (input) => submitTicketEvidence(dependencies, input),
    finalizeTicket: (input) => finalizeTicket(dependencies, input),
    approveRecommendation: (input) => approveRecommendation(dependencies, input),
    overrideRoute: (input) => overrideRoute(dependencies, input),
    requestMoreInfo: (input) => requestMoreInfo(dependencies, input),
    listTickets: (filter) => listTickets(dependencies, filter),
    getTicket: (input) => getTicket(dependencies, input),
    listBuildings: () => listBuildings(dependencies),
    getBuilding: (input) => getBuilding(dependencies, input),
    searchAddress: (input) => searchAddress(dependencies, input),
    resetDemo: () => resetDemo(dependencies),
  };
}

function providers() {
  return {
    addresses: createFixtureAddressProvider(),
    buildingRegistry: createFixtureBuildingRegistryProvider(),
    kapt: createFixtureKaptProvider(),
  };
}

export function createMemoryServerContainer(
  options: MemoryServerContainerOptions = {},
): ServerContainer {
  const canonical = options.canonicalBuildings ?? demoBuildings;
  const store = createMemoryStore(canonical);

  if (decideInitialSeed(store.counts()) === "SEED") {
    store.seedCanonical();
  }

  const dependencies: ApplicationDependencies = {
    buildings: store.buildings,
    tickets: store.tickets,
    demoState: store.demoState,
    ...providers(),
    clock: options.clock ?? createSystemClock(),
    ids: options.idGenerator ?? createRandomIdGenerator(),
  };

  return {
    dependencies,
    useCases: bindUseCases(dependencies),
    close() {
      // Nothing to release: the store is reclaimed with the container.
    },
  };
}

/**
 * Owns the database handle for its lifetime. Construction validates the schema
 * and applies the initial-seed decision; it never runs the destructive reset,
 * so an existing store — including owner-verified mutations — survives.
 */
export function createSqliteServerContainer(
  options: SqliteServerContainerOptions,
): ServerContainer {
  const canonical = options.canonicalBuildings ?? demoBuildings;
  const handle = openSqliteDatabase(options.databasePath);

  try {
    bootstrapSchema(handle.database);

    const counts = {
      buildings: (
        handle.database
          .prepare("SELECT COUNT(*) AS total FROM buildings")
          .get() as { total: number }
      ).total,
      tickets: (
        handle.database.prepare("SELECT COUNT(*) AS total FROM tickets").get() as {
          total: number;
        }
      ).total,
    };

    if (decideInitialSeed(counts) === "SEED") {
      withTransaction(handle.database, () => {
        const insert = handle.database.prepare(
          "INSERT INTO buildings (id, aggregate_version, aggregate_json) VALUES (?, ?, ?)",
        );
        for (const building of canonical) {
          const row = encodeBuilding(building);
          insert.run(row.id, row.aggregate_version, row.aggregate_json);
        }
      });
    }
  } catch (error) {
    handle.close();
    throw error;
  }

  const dependencies: ApplicationDependencies = {
    buildings: createSqliteBuildingRepository(handle.database),
    tickets: createSqliteTicketRepository(handle.database),
    demoState: createSqliteDemoStateResetter(handle.database, canonical),
    ...providers(),
    clock: options.clock ?? createSystemClock(),
    ids: options.idGenerator ?? createRandomIdGenerator(),
  };

  return {
    dependencies,
    useCases: bindUseCases(dependencies),
    close() {
      handle.close();
    },
  };
}
