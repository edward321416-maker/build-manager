import {
  B3Error,
  type BuildingRegistrationPort,
  type PropertyView,
  type UnitView,
} from "@build-manager/application";
import type { PostgresDatabase } from "../database";
import { withB1OrgTransaction } from "../b1/org-transaction";
import {
  allocateUuid,
  assertB3Digest,
  assertB3Uuid,
  canAdministerOrg,
  canReadParent,
  postgresFailure,
  proof,
  toB3Error,
} from "./common";

class AuthorityChanged extends Error {
  constructor(public readonly scope: "property" | "unit") {
    super("AUTHORITY_CHANGED");
  }
}

function propertyView(row: { id: string; org_id: string; address_reference: string | null }): PropertyView {
  return { id: row.id, orgId: row.org_id, addressReference: row.address_reference };
}

function unitView(row: { id: string; org_id: string; property_id: string; label: string }): UnitView {
  return { id: row.id, orgId: row.org_id, propertyId: row.property_id, label: row.label };
}

async function classifyPropertyAuthority(
  database: PostgresDatabase,
  digest: string,
  orgId: string,
): Promise<never> {
  try {
    const admin = await withB1OrgTransaction(database, digest, orgId, client =>
      canAdministerOrg(client, digest, orgId));
    if (!admin) throw new B3Error("FORBIDDEN");
    throw new B3Error("DEPENDENCY_UNAVAILABLE");
  } catch (error) {
    throw toB3Error(error);
  }
}

async function classifyUnitAuthority(
  database: PostgresDatabase,
  digest: string,
  orgId: string,
  propertyId: string,
): Promise<never> {
  try {
    const status = await withB1OrgTransaction(database, digest, orgId, async client => {
      if (!await canReadParent(client, digest, orgId, propertyId)) return "NOT_FOUND" as const;
      if (!await canAdministerOrg(client, digest, orgId)) return "FORBIDDEN" as const;
      return "DEPENDENCY_UNAVAILABLE" as const;
    });
    throw new B3Error(status);
  } catch (error) {
    throw toB3Error(error);
  }
}

export function createBuildingRegistrationPort(database: PostgresDatabase): BuildingRegistrationPort {
  return {
    async createProperty(digest, orgId, input) {
      assertB3Digest(digest);
      assertB3Uuid(orgId);
      try {
        return await withB1OrgTransaction(database, digest, orgId, async client => {
          if (!await canAdministerOrg(client, digest, orgId)) throw new B3Error("FORBIDDEN");
          const id = await allocateUuid(client);
          await client.query(
            "INSERT INTO app.property(id,org_id,address_reference,status) VALUES($1,$2,$3,'ACTIVE')",
            [id, orgId, input.addressReference],
          );
          const result = await client.query<{ id: string; org_id: string; address_reference: string | null }>(
            "SELECT id,org_id,address_reference FROM app.property " +
              "WHERE org_id=$1 AND id=$2 AND authn.can_read_property($3::bytea,org_id,id)",
            [orgId, id, proof(digest)],
          );
          if (result.rows.length !== 1) throw new AuthorityChanged("property");
          return propertyView(result.rows[0]);
        });
      } catch (error) {
        const failure = postgresFailure(error);
        if (error instanceof AuthorityChanged || failure.code === "42501") {
          return classifyPropertyAuthority(database, digest, orgId);
        }
        throw toB3Error(error);
      }
    },

    async createUnit(digest, orgId, propertyId, input) {
      assertB3Digest(digest);
      assertB3Uuid(orgId);
      assertB3Uuid(propertyId);
      try {
        return await withB1OrgTransaction(database, digest, orgId, async client => {
          if (!await canReadParent(client, digest, orgId, propertyId)) throw new B3Error("NOT_FOUND");
          if (!await canAdministerOrg(client, digest, orgId)) throw new B3Error("FORBIDDEN");
          const id = await allocateUuid(client);
          await client.query(
            "INSERT INTO app.unit(id,org_id,property_id,label,status) VALUES($1,$2,$3,$4,'ACTIVE')",
            [id, orgId, propertyId, input.label],
          );
          const result = await client.query<{ id: string; org_id: string; property_id: string; label: string }>(
            "SELECT id,org_id,property_id,label FROM app.unit " +
              "WHERE org_id=$1 AND property_id=$2 AND id=$3 AND status='ACTIVE' " +
              "AND authn.can_read_property($4::bytea,org_id,property_id)",
            [orgId, propertyId, id, proof(digest)],
          );
          if (result.rows.length !== 1) throw new AuthorityChanged("unit");
          return unitView(result.rows[0]);
        });
      } catch (error) {
        const failure = postgresFailure(error);
        if (failure.code === "23505" && failure.constraint === "unit_active_label_unique") {
          throw new B3Error("CONFLICT");
        }
        if (
          error instanceof AuthorityChanged ||
          failure.code === "42501" ||
          (failure.code === "23503" && failure.constraint === "unit_property_fk")
        ) {
          return classifyUnitAuthority(database, digest, orgId, propertyId);
        }
        throw toB3Error(error);
      }
    },

    async canCreateProperty(digest, orgId) {
      assertB3Digest(digest);
      assertB3Uuid(orgId);
      try {
        return await withB1OrgTransaction(database, digest, orgId, client =>
          canAdministerOrg(client, digest, orgId));
      } catch (error) {
        throw toB3Error(error);
      }
    },

    async canCreateUnit(digest, orgId, propertyId) {
      assertB3Digest(digest);
      assertB3Uuid(orgId);
      assertB3Uuid(propertyId);
      try {
        return await withB1OrgTransaction(database, digest, orgId, async client => {
          if (!await canReadParent(client, digest, orgId, propertyId)) throw new B3Error("NOT_FOUND");
          return canAdministerOrg(client, digest, orgId);
        });
      } catch (error) {
        throw toB3Error(error);
      }
    },
  };
}
