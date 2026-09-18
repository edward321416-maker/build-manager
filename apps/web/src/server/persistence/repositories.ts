import type {
  BuildingRepository,
  TicketListFilter,
  TicketRepository,
} from "@build-manager/application";
import type { Building, Ticket } from "@build-manager/domain";
import type { DatabaseSync } from "node:sqlite";
import {
  decodeBuilding,
  decodeTicket,
  encodeBuilding,
  encodeTicket,
  type PersistedAggregateRow,
} from "./codecs";

/**
 * Snapshot persistence: one row per aggregate, no relational decomposition.
 * Every value is bound as a parameter, never interpolated into SQL.
 */
const UPSERT_SQL = (table: "buildings" | "tickets"): string =>
  `INSERT INTO ${table} (id, aggregate_version, aggregate_json)
   VALUES (?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET
     aggregate_version = excluded.aggregate_version,
     aggregate_json = excluded.aggregate_json`;

const SELECT_ONE_SQL = (table: "buildings" | "tickets"): string =>
  `SELECT id, aggregate_version, aggregate_json FROM ${table} WHERE id = ?`;

const SELECT_ALL_SQL = (table: "buildings" | "tickets"): string =>
  `SELECT id, aggregate_version, aggregate_json FROM ${table}`;

function asRow(row: unknown): PersistedAggregateRow {
  return row as PersistedAggregateRow;
}

/**
 * Repositories borrow the connection. They never close it — the database
 * handle is the sole owner.
 */
export function createSqliteBuildingRepository(
  database: DatabaseSync,
): BuildingRepository {
  return {
    async save(building: Building) {
      const row = encodeBuilding(building);
      database
        .prepare(UPSERT_SQL("buildings"))
        .run(row.id, row.aggregate_version, row.aggregate_json);
    },

    async findById(id: string) {
      const row = database.prepare(SELECT_ONE_SQL("buildings")).get(id);
      return row === undefined ? null : decodeBuilding(asRow(row));
    },

    async list() {
      return database
        .prepare(SELECT_ALL_SQL("buildings"))
        .all()
        .map((row) => decodeBuilding(asRow(row)));
    },
  };
}

export function createSqliteTicketRepository(
  database: DatabaseSync,
): TicketRepository {
  return {
    async save(ticket: Ticket) {
      const row = encodeTicket(ticket);
      database
        .prepare(UPSERT_SQL("tickets"))
        .run(row.id, row.aggregate_version, row.aggregate_json);
    },

    async findById(id: string) {
      const row = database.prepare(SELECT_ONE_SQL("tickets")).get(id);
      return row === undefined ? null : decodeTicket(asRow(row));
    },

    /**
     * The filter is applied after decoding rather than denormalising
     * `buildingId` into its own column. The port returns the whole list with
     * no paging or count, so the observable semantics are identical, and the
     * aggregate stays the single source of truth for its own fields.
     */
    async list(filter: TicketListFilter) {
      return database
        .prepare(SELECT_ALL_SQL("tickets"))
        .all()
        .map((row) => decodeTicket(asRow(row)))
        .filter(
          (ticket) =>
            filter.buildingId === undefined ||
            ticket.buildingId === filter.buildingId,
        );
    },
  };
}
