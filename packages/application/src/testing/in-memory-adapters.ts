import type { Building, ContextValue, Ticket } from "@build-manager/domain";
import type {
  AddressProvider,
  ApplicationDependencies,
  BuildingRegistryProvider,
  BuildingRepository,
  Clock,
  DemoStateResetter,
  IdGenerator,
  KaptProvider,
  ProviderContextRecord,
  TicketListFilter,
  TicketRepository,
} from "../ports";

export type ProviderFact = {
  key: string;
  value: unknown;
};

/** Records every call so a test can assert a port was never consulted. */
export type RecordingAddressProvider = AddressProvider & {
  lookups: string[];
};

export type InMemoryDependencies = ApplicationDependencies & {
  addresses: RecordingAddressProvider;
};

export type InMemoryOptions = {
  registryContext?: ProviderFact[];
  kaptContext?: ProviderFact[];
  startedAt?: string;
  stepMs?: number;
  demoState?: DemoStateResetter;
};

/**
 * Stands in for the server reset adapter. It reseeds nothing of its own — the
 * real reset semantics belong to the server layer, which is the only place
 * allowed to know the canonical fixtures.
 */
export function createStubDemoStateResetter(
  buildings: Building[] = [],
): DemoStateResetter {
  return {
    async reset() {
      return buildings.map((entry) => structuredClone(entry));
    },
  };
}

export function createInMemoryBuildingRepository(): BuildingRepository {
  const stored = new Map<string, Building>();

  return {
    async save(building) {
      stored.set(building.id, structuredClone(building));
    },
    async findById(id) {
      const found = stored.get(id);
      return found ? structuredClone(found) : null;
    },
    async list() {
      return [...stored.values()].map((entry) => structuredClone(entry));
    },
  };
}

export function createInMemoryTicketRepository(): TicketRepository {
  const stored = new Map<string, Ticket>();

  return {
    async save(ticket) {
      stored.set(ticket.id, structuredClone(ticket));
    },
    async findById(id) {
      const found = stored.get(id);
      return found ? structuredClone(found) : null;
    },
    async list(filter: TicketListFilter) {
      return [...stored.values()]
        .filter(
          (entry) =>
            filter.buildingId === undefined ||
            entry.buildingId === filter.buildingId,
        )
        .map((entry) => structuredClone(entry));
    },
  };
}

/** Deterministic clock: a fixed start advanced by a fixed step per read. */
export function createSteppingClock(
  startedAt = "2026-09-14T00:00:00.000Z",
  stepMs = 1000,
): Clock {
  const start = new Date(startedAt).getTime();
  let reads = 0;

  return {
    now() {
      const value = new Date(start + reads * stepMs).toISOString();
      reads += 1;
      return value;
    },
  };
}

export function createSequentialIdGenerator(): IdGenerator {
  const counters = new Map<string, number>();

  return {
    next(prefix) {
      const nextValue = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, nextValue);
      return `${prefix}-${nextValue}`;
    },
  };
}

export function createRecordingAddressProvider(): RecordingAddressProvider {
  const lookups: string[] = [];

  return {
    lookups,
    async lookup(query) {
      lookups.push(query);
      return null;
    },
  };
}

/**
 * Deliberately hostile: every fact claims to be routing eligible. Use cases
 * must demote provider context to informational regardless of what it claims.
 */
function providerRecord(
  facts: ProviderFact[],
  sourceType: ContextValue<unknown>["sourceType"],
  nativeId: string,
  updatedAt: string,
): ProviderContextRecord | null {
  if (facts.length === 0) {
    return null;
  }

  return {
    nativeId,
    context: facts.map((fact) => ({
      key: fact.key,
      value: fact.value,
      sourceType,
      sourceRef: `${sourceType.toLowerCase()}:${nativeId}`,
      verified: true,
      routingEligible: true,
      fetchedAt: updatedAt,
      updatedAt,
    })),
  };
}

export function createStaticRegistryProvider(
  facts: ProviderFact[],
  updatedAt: string,
): BuildingRegistryProvider {
  return {
    async fetchContext() {
      return providerRecord(facts, "BUILDING_HUB", "demo-hub", updatedAt);
    },
  };
}

export function createStaticKaptProvider(
  facts: ProviderFact[],
  updatedAt: string,
): KaptProvider {
  return {
    async fetchContext() {
      return providerRecord(facts, "KAPT", "demo-kapt", updatedAt);
    },
  };
}

export function createInMemoryDependencies(
  options: InMemoryOptions = {},
): InMemoryDependencies {
  const updatedAt = options.startedAt ?? "2026-09-14T00:00:00.000Z";

  return {
    buildings: createInMemoryBuildingRepository(),
    tickets: createInMemoryTicketRepository(),
    demoState: options.demoState ?? createStubDemoStateResetter(),
    addresses: createRecordingAddressProvider(),
    buildingRegistry: createStaticRegistryProvider(
      options.registryContext ?? [],
      updatedAt,
    ),
    kapt: createStaticKaptProvider(options.kaptContext ?? [], updatedAt),
    clock: createSteppingClock(options.startedAt, options.stepMs),
    ids: createSequentialIdGenerator(),
  };
}
