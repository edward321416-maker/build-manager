import { B3Error, type Page, type PageQuery, type UnitReadPort, type UnitView } from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { withB1OrgTransaction } from "../b1/org-transaction";
import { assertB3Digest, assertB3Uuid, canReadParent, proof, toB3Error } from "./common";

function validatePage(page: PageQuery): void {
  if (
    !Number.isInteger(page.limit) ||
    page.limit < 1 ||
    page.limit > 50 ||
    (page.after !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(page.after))
  ) {
    throw new B3Error("INVALID_INPUT");
  }
}

function view(row: { id: string; org_id: string; property_id: string; label: string }): UnitView {
  return { id: row.id, orgId: row.org_id, propertyId: row.property_id, label: row.label };
}

function page(rows: Array<{ id: string; org_id: string; property_id: string; label: string }>, limit: number): Page<UnitView> {
  const items = rows.slice(0, limit).map(view);
  return {
    items,
    nextCursor: rows.length > limit ? items[items.length - 1]?.id ?? null : null,
  };
}

export function createUnitReadPort(database: PostgresDatabase): UnitReadPort {
  return {
    async listUnits(digest, orgId, propertyId, query) {
      assertB3Digest(digest);
      assertB3Uuid(orgId);
      assertB3Uuid(propertyId);
      validatePage(query);
      try {
        return await withB1OrgTransaction(database, digest, orgId, async client => {
          if (!await canReadParent(client, digest, orgId, propertyId)) throw new B3Error("NOT_FOUND");
          const result = await client.query<{ id: string; org_id: string; property_id: string; label: string }>(
            "SELECT id,org_id,property_id,label FROM app.unit " +
              "WHERE org_id=$1 AND property_id=$2 AND status='ACTIVE' " +
              "AND authn.can_read_property($5::bytea,org_id,property_id) " +
              "AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4",
            [orgId, propertyId, query.after ?? null, query.limit + 1, proof(digest)],
          );
          return page(result.rows, query.limit);
        });
      } catch (error) {
        throw toB3Error(error);
      }
    },

    async getUnit(digest, orgId, propertyId, unitId) {
      assertB3Digest(digest);
      assertB3Uuid(orgId);
      assertB3Uuid(propertyId);
      assertB3Uuid(unitId);
      try {
        return await withB1OrgTransaction(database, digest, orgId, async client => {
          if (!await canReadParent(client, digest, orgId, propertyId)) throw new B3Error("NOT_FOUND");
          const result = await client.query<{ id: string; org_id: string; property_id: string; label: string }>(
            "SELECT id,org_id,property_id,label FROM app.unit " +
              "WHERE org_id=$1 AND property_id=$2 AND id=$3 AND status='ACTIVE' " +
              "AND authn.can_read_property($4::bytea,org_id,property_id)",
            [orgId, propertyId, unitId, proof(digest)],
          );
          const row = result.rows[0];
          if (!row) throw new B3Error("NOT_FOUND");
          return view(row);
        });
      } catch (error) {
        throw toB3Error(error);
      }
    },
  };
}
