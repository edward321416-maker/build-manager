import type { Building, Ticket } from "@build-manager/domain";

/**
 * Version of the JSON aggregate stored inside a row, kept in each row's
 * `aggregate_version` column. Distinct from
 * `SQLITE_DATABASE_SCHEMA_VERSION`, which versions the table layout.
 */
export const PERSISTED_AGGREGATE_VERSION = 1;

export type PersistedAggregateRow = {
  id: string;
  aggregate_version: number;
  aggregate_json: string;
};

/**
 * Domain aggregates are plain JSON-safe data: every timestamp is already an
 * ISO string, and there is no Date, Map, Set, or class instance to smuggle
 * through. The round-trip tests hold that property in place.
 */
function encode(id: string, aggregate: unknown): PersistedAggregateRow {
  return {
    id,
    aggregate_version: PERSISTED_AGGREGATE_VERSION,
    aggregate_json: JSON.stringify(aggregate),
  };
}

function parseAggregate(row: PersistedAggregateRow, label: string): unknown {
  if (row.aggregate_version !== PERSISTED_AGGREGATE_VERSION) {
    throw new Error(
      `Refusing to decode ${label} ${row.id}: unsupported aggregate version ${row.aggregate_version}; expected ${PERSISTED_AGGREGATE_VERSION}`,
    );
  }

  try {
    return JSON.parse(row.aggregate_json);
  } catch {
    throw new Error(
      `Refusing to decode ${label} ${row.id}: stored aggregate is not valid JSON`,
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

/**
 * Structural guard only. It rejects corruption — a truncated write, a wrong
 * row, a hand-edited file — without restating domain rules, which stay in the
 * domain package.
 */
function assertShape(
  candidate: Record<string, unknown> | null,
  label: string,
  id: string,
  required: ReadonlyArray<[string, (value: unknown) => boolean]>,
): Record<string, unknown> {
  if (candidate === null) {
    throw new Error(
      `Refusing to decode ${label} ${id}: stored aggregate is not an object`,
    );
  }

  for (const [field, isValid] of required) {
    if (!isValid(candidate[field])) {
      throw new Error(
        `Refusing to decode ${label} ${id}: stored aggregate field ${field} is missing or malformed`,
      );
    }
  }

  return candidate;
}

/** The row key and the aggregate's own identity must agree. */
function assertIdentity(rowId: string, aggregateId: unknown, label: string): void {
  if (aggregateId !== rowId) {
    throw new Error(
      `Persistence corruption: ${label} row ${rowId} stores an aggregate whose id is ${String(aggregateId)}`,
    );
  }
}

export function encodeBuilding(building: Building): PersistedAggregateRow {
  return encode(building.id, building);
}

export function decodeBuilding(row: PersistedAggregateRow): Building {
  const parsed = parseAggregate(row, "building");
  const candidate = assertShape(asRecord(parsed), "building", row.id, [
    ["id", isNonEmptyString],
    ["displayName", isNonEmptyString],
    ["demo", (value) => typeof value === "boolean"],
    ["sourceNativeIds", (value) => asRecord(value) !== null],
    ["context", (value) => Array.isArray(value)],
  ]);

  assertIdentity(row.id, candidate.id, "building");
  return candidate as unknown as Building;
}

export function encodeTicket(ticket: Ticket): PersistedAggregateRow {
  return encode(ticket.id, ticket);
}

export function decodeTicket(row: PersistedAggregateRow): Ticket {
  const parsed = parseAggregate(row, "ticket");
  const candidate = assertShape(asRecord(parsed), "ticket", row.id, [
    ["id", isNonEmptyString],
    ["buildingId", isNonEmptyString],
    ["issueType", isNonEmptyString],
    ["status", isNonEmptyString],
    ["answers", (value) => Array.isArray(value)],
    ["evidence", (value) => Array.isArray(value)],
    ["safetyFlags", (value) => Array.isArray(value)],
  ]);

  assertIdentity(row.id, candidate.id, "ticket");
  return candidate as unknown as Ticket;
}
