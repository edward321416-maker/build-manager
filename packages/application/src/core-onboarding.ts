/** Actor identity is always derived from the registered B1 session in PostgreSQL. */
export type OnboardingAction="CREATE"|"INSPECT"|"CLAIM"|"MINE"|"LIST"|"UNITS"|"APPROVE"|"REJECT"|"REVOKE";
export type OnboardingCode="UNAUTHENTICATED"|"FORBIDDEN"|"NOT_FOUND"|"INVALID_INPUT"|"STATE_CONFLICT"|"RATE_LIMITED"|"DEPENDENCY_UNAVAILABLE";
export type OnboardingResult={code:OnboardingCode}|{data:unknown};
export type CoreOnboardingPort={execute(digest:string,action:OnboardingAction,orgId:string|null,input:Record<string,unknown>):Promise<OnboardingResult>};
