import type { Building, ContextValue, Ticket } from "@build-manager/domain";

/**
 * Time and identity are ports so use cases stay deterministic and
 * framework-independent; nothing here reads the ambient environment.
 */
export type Clock = {
  now(): string;
};

export type IdGenerator = {
  next(prefix: string): string;
};

export type BuildingRepository = {
  save(building: Building): Promise<void>;
  findById(id: string): Promise<Building | null>;
  list(): Promise<Building[]>;
};

export type TicketListFilter = {
  buildingId?: string;
};

export type TicketRepository = {
  save(ticket: Ticket): Promise<void>;
  findById(id: string): Promise<Ticket | null>;
  list(filter: TicketListFilter): Promise<Ticket[]>;
};

export type AddressLookup = {
  normalizedAddress: string | null;
  jusoBdMgtSn: string | null;
};

/**
 * Real address resolution. Public P0 demo buildings never carry an address, so
 * no P0 use case consults this port.
 */
export type AddressProvider = {
  lookup(query: string): Promise<AddressLookup | null>;
};

/**
 * External registry facts. Whatever these return is informational: the
 * application never marks provider context routing eligible.
 */
export type ProviderContextRecord = {
  nativeId: string | null;
  context: ContextValue<unknown>[];
};

export type BuildingRegistryProvider = {
  fetchContext(buildingId: string): Promise<ProviderContextRecord | null>;
};

export type KaptProvider = {
  fetchContext(buildingId: string): Promise<ProviderContextRecord | null>;
};

export type ApplicationDependencies = {
  buildings: BuildingRepository;
  tickets: TicketRepository;
  addresses: AddressProvider;
  buildingRegistry: BuildingRegistryProvider;
  kapt: KaptProvider;
  clock: Clock;
  ids: IdGenerator;
};
