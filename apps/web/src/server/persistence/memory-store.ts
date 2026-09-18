import type {
  BuildingRepository,
  DemoStateResetter,
  TicketListFilter,
  TicketRepository,
} from "@build-manager/application";
import type { Building, Ticket } from "@build-manager/domain";

export type MemoryStore = {
  buildings: BuildingRepository;
  tickets: TicketRepository;
  demoState: DemoStateResetter;
  seedCanonical(): void;
  counts(): { buildings: number; tickets: number };
};

/**
 * Resettable in-process store for the memory container.
 *
 * The application's in-memory adapters are deliberately minimal test doubles
 * with no way to clear them, so the server keeps its own store that can honour
 * the demo reset contract.
 */
export function createMemoryStore(
  canonicalBuildings: readonly Building[],
): MemoryStore {
  const buildings = new Map<string, Building>();
  const tickets = new Map<string, Ticket>();

  const seedCanonical = (): void => {
    for (const building of canonicalBuildings) {
      buildings.set(building.id, structuredClone(building));
    }
  };

  return {
    buildings: {
      async save(building) {
        buildings.set(building.id, structuredClone(building));
      },
      async findById(id) {
        const found = buildings.get(id);
        return found ? structuredClone(found) : null;
      },
      async list() {
        return [...buildings.values()].map((entry) => structuredClone(entry));
      },
    },

    tickets: {
      async save(ticket) {
        tickets.set(ticket.id, structuredClone(ticket));
      },
      async findById(id) {
        const found = tickets.get(id);
        return found ? structuredClone(found) : null;
      },
      async list(filter: TicketListFilter) {
        return [...tickets.values()]
          .filter(
            (entry) =>
              filter.buildingId === undefined ||
              entry.buildingId === filter.buildingId,
          )
          .map((entry) => structuredClone(entry));
      },
    },

    demoState: {
      async reset() {
        // Replacing both maps wholesale keeps the reset all-or-nothing.
        tickets.clear();
        buildings.clear();
        seedCanonical();
        return canonicalBuildings.map((building) => structuredClone(building));
      },
    },

    seedCanonical,

    counts() {
      return { buildings: buildings.size, tickets: tickets.size };
    },
  };
}
