export type VerifiedDatabaseIdentity = Readonly<{ issuer: string; subject: string }>;
export type SessionProof = Readonly<{ handle: string }>;
export type SessionDigest = string;
export type Actor = Readonly<{ userId: string }>;
export type OrganizationView = Readonly<{ id: string; displayName: string }>;
export type PropertyView = Readonly<{ id: string; orgId: string; addressReference: string | null }>;
export type PageQuery = Readonly<{ after?: string; limit: number }>;
export type Page<T> = Readonly<{ items: readonly T[]; nextCursor: string | null }>;
export interface IdentitySessionPort {
  begin(input: { identity: VerifiedDatabaseIdentity; digest: SessionDigest; expiresAt: Date }): Promise<Actor>;
  currentActor(digest: SessionDigest): Promise<Actor | null>;
  revoke(digest: SessionDigest): Promise<void>;
}
export interface OrganizationReadPort {
  listMine(digest: SessionDigest, page: PageQuery): Promise<Page<OrganizationView>>;
  listProperties(digest: SessionDigest, orgId: string, page: PageQuery): Promise<Page<PropertyView>>;
  getProperty(digest: SessionDigest, orgId: string, propertyId: string): Promise<PropertyView>;
}
export interface SessionProofCodec { digest(proof: SessionProof): SessionDigest; }
