import type { CoreOnboardingPort,OnboardingResult } from "@build-manager/application";
import type { PostgresDatabase } from "./database";
import { withTransaction } from "./transaction";

export function createCoreOnboardingPort(database:PostgresDatabase):CoreOnboardingPort {
 return {async execute(digest,action,orgId,input){
  if(!/^[a-f0-9]{64}$/.test(digest))return {code:"UNAUTHENTICATED"};
  // Expected failures are values: commit the shared attempt counter even when a token is unknown.
  // Infrastructure/unknown COMMIT failures propagate without automatic replay.
  return withTransaction(database,async client=>{
   await client.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
   await client.query("SET LOCAL lock_timeout='2000ms'");
   await client.query("SET LOCAL statement_timeout='5000ms'");
   return (await client.query<{value:OnboardingResult}>("SELECT core_onboarding.command($1,$2,$3,$4) AS value",[Buffer.from(digest,"hex"),action,orgId,JSON.stringify(input)])).rows[0].value;
  });
 }};
}
