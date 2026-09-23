import type { Client } from 'pg';
export function attachSyntheticOrganization(client:Pick<Client,'query'>, options:{databaseUrl:string;userId:string;intent:string}):Promise<{orgId:string;propertyId:string}>;
