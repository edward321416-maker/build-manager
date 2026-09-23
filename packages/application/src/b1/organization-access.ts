import type { IdentitySessionPort,OrganizationReadPort,PageQuery } from './ports';
import { B1Error } from './errors';
export type B1ReadDependencies={sessions:Omit<IdentitySessionPort,'begin'>;organizations:OrganizationReadPort};
async function requireActor(d:B1ReadDependencies,digest:string){if(!/^[a-f0-9]{64}$/.test(digest)||!await d.sessions.currentActor(digest))throw new B1Error('UNAUTHENTICATED');}
export async function listMyOrganizations(d:B1ReadDependencies,digest:string,page:PageQuery){await requireActor(d,digest);return d.organizations.listMine(digest,page);}
export async function listOrganizationProperties(d:B1ReadDependencies,digest:string,orgId:string,page:PageQuery){await requireActor(d,digest);return d.organizations.listProperties(digest,orgId,page);}
export async function getOrganizationProperty(d:B1ReadDependencies,digest:string,orgId:string,propertyId:string){await requireActor(d,digest);return d.organizations.getProperty(digest,orgId,propertyId);}
