import { B1Error } from '@build-manager/application';
import { createPostgresDatabase } from '@build-manager/persistence-postgres';
import { createOrganizationReadPort,createSessionRegistryPort } from '@build-manager/persistence-postgres/b1';
import { parseApplicationMode } from '../../runtime/application-mode';
import { getB1Auth0 } from './auth0';
import type { B1HTTPDependencies } from './http';
let container:B1HTTPDependencies|undefined;
export function getB1Container():B1HTTPDependencies{
 if(parseApplicationMode(process.env.BUILD_MANAGER_MODE)!=='B1')throw new B1Error('DEPENDENCY_UNAVAILABLE');
 if(!container){
  const connectionString=process.env.B1_WEB_DATABASE_URL;
  if(!connectionString)throw new B1Error('DEPENDENCY_UNAVAILABLE');
  const auth0=getB1Auth0(),database=createPostgresDatabase({connectionString,max:5,connectionTimeoutMillis:5000});
  container={sessions:createSessionRegistryPort(database),organizations:createOrganizationReadPort(database),readSession:request=>auth0.getSession(request)};
 }
 return container;
}
