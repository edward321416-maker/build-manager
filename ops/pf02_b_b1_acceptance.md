# PF02-B B1 independent acceptance and main publication

Snapshot: 2026-09-23. POLICY_REF: `87341f143b04dd96a5b7e66dedf8df47b5f5ae73`. TARGET_REF / implementation main: `2ede1520e681c3fe02cb5ac2b85847ea803282d8`.

## Disposition and scope

[FACT] **PF02-B / B1 = VERIFIED / FROZEN** after exact-head independent acceptance, implementation merge and fresh actual-main CI 9/9 SUCCESS. **PF02-B = IN_PROGRESS; B2 = NOT_STARTED / NEXT**. PF00 remains FROZEN; PF01 REVIEW_DRAFT; PF02-A VERIFIED / FROZEN. This records the B1 slice, not completion of PF02-B or production readiness.

[DECISION] D01 = **RESOLVED_FOR_B1** for Auth0 selection and the Database-only Web identity path. Production hosting, production credential provisioning (D02b), real-data pilot, final operational session/retention policy, Kakao, account linking, Mobile auth and PROPERTY_STAFF/B2 remain outside the completed scope. REAL_TENANT_DATA = NOT_AUTHORIZED; PRODUCTION_DB_HOSTING = NOT_AUTHORIZED. Security/privacy work and real property/unit/occupancy operations are not complete.

B1 implements verified issuer/subject bootstrap without email merging or automatic administrator membership; authoritative DB session revocation; active ORG_ADMIN own-organization/property reads; repeated API/application/PostgreSQL authorization; exact proxy transport and production/test boundaries. Session lifetime remains a provisional test value, separate from data/audit retention.

## Independent acceptance and exact Git publication

- Accepted [PR #31](https://github.com/edward321416-maker/build-manager/pull/31) candidate: `281bb651c2f47a528fd148137fd94d318aa193c7`; base: `87341f143b04dd96a5b7e66dedf8df47b5f5ae73`.
- Operator-side independent Opus implementation review: **NO_BLOCKING_FINDINGS**, BLOCKER 0 / HIGH 0; review artifact SHA-256 `7c6e6714f92ce98aaa44442cec8428de9099e8ed5f5d573a334eeb2b4797e5ed`. The executor did not perform that independent review. The private review is not copied into public Git.
- Approved implementation plan SHA-256: `ff8437dc3f1a636da86218ffe5589372d91d9c20ec7bc97e57271c134b1fdec8`; unchanged. User separately approved exact direct jose 6.2.12 signature verification through the public SDK hook.
- Expected-head-protected merge commit: `2ede1520e681c3fe02cb5ac2b85847ea803282d8`; parent 1 `87341f143b04dd96a5b7e66dedf8df47b5f5ae73`, parent 2 `281bb651c2f47a528fd148137fd94d318aa193c7`.
- Accepted candidate and actual merge trees both `2d410853d1a699c231f2e92c00cd80b95a7e1b20`. The earlier GitHub PR test merge is not this actual main merge.
- PR #31 = MERGED. Feature branch `feat/pf02-b-b1-auth-org-read` retained. PR #30 remains Draft/Open and unchanged.

## CI provenance

Candidate PR evidence: [App 35832637261](https://github.com/edward321416-maker/build-manager/actions/runs/35832637261), [Repository 35832637203](https://github.com/edward321416-maker/build-manager/actions/runs/35832637203), pull_request attempt 1 at `281bb651c2f47a528fd148137fd94d318aa193c7`, nine required checks SUCCESS.

Fresh actual merged-main evidence: [App 35838146830](https://github.com/edward321416-maker/build-manager/actions/runs/35838146830), [Repository 35838146810](https://github.com/edward321416-maker/build-manager/actions/runs/35838146810), push/main attempt 1 at **`2ede1520e681c3fe02cb5ac2b85847ea803282d8`**, both SUCCESS. PR results were not promoted into main evidence.

| Required check | Fresh implementation main |
| --- | --- |
| verify | SUCCESS |
| repository-safety | SUCCESS |
| apps | SUCCESS |
| mobile-cold-linux | SUCCESS |
| install-mobile-windows | SUCCESS |
| web-e2e | SUCCESS |
| mobile-health | SUCCESS |
| postgres-integration | SUCCESS |
| foundation-gate | SUCCESS |

Actual job logs confirm Shared 358, Web unit 313, PostgreSQL 124 across 6 files (including 86 foundation tests), existing Web E2E 21 and B1 E2E 12 without skips/retries. Expo Doctor 1.20.4 passes 21/21; Android and iOS JS/assets exports execute successfully. The foundation-gate log reports all seven internal dependencies success. These are automatic runtime checks, not native/device compilation or a complete security audit.

PostgreSQL actual server is 18.6; the existing exact numeric version assertion is 180006. The actual main log records R27-H01 swallowed-error rejection/SAVEPOINT recovery, R27-H02 terminated idle backend recovery and F23 diagnostic **Lock → SQLSTATE 23505 → exactly one ACTIVE occupancy**. B1 concurrent identity and migration/session/authorization regressions also execute.

## Executor-local and actual Auth0 evidence

**Actual Auth0 live smoke = EXECUTOR_LIVE_EVIDENCE. LIVE_AUTH0_INDEPENDENT_REPRO = NOT_RUN.** The independent reviewer checked code/evidence consistency but did not repeat provider login or local Docker/browser execution. Hosted B1 E2E is separately **SYNTHETIC_AUTH_ACTUAL_WEB_POSTGRES**, not a live Auth0 login.

The previously executed live smoke used the operator's Database test identity, a validation-only B1 application and synthetic business data: anonymous API 401; real login and empty organization list; explicitly provisioned synthetic ORG_ADMIN own-property read; foreign property 404; caller role input 400; committed Membership ENDED denied new access; actual provider logout followed by current/old-cookie session, protected API and completion 401. It used the same product tree as the accepted candidate. No existing PASS was rerun for closure. No private identity, secret, token, raw cookie or provider URL is published here.

Prior local receipts: Shared 358; PG 124; Web 313; Mobile 133; DEMO E2E 21 + B1 E2E 12; lint/typecheck/build/dependencies PASS; scanners 3 + 14; tree/history 0 findings; Doctor 21/21; Android 29 and iOS 25 JS/assets files. These remain executor-local evidence, distinct from independent review and main CI.

## PF02-A preservation and M05

Existing migrations 0001–0003 remain byte-identical; the frozen runtime privilege matrix, F18/F19 meanings, seven app tables and RLS foundation are preserved. Only approved B1 additions evolve the schema. No superuser or migration-owner runtime substitutes for the tested B1 roles.

M05 missing required B1 roles on a fresh empty DB fails the entire single-transaction migration chain: no app/authn schema and zero applied history rows. node-pg-migrate creates its empty metadata infrastructure before BEGIN; that empty table is not a partially applied foundation. Normal role provisioning/validation precedes successful migration and policy/grant/PF02-A regression. No new bounded production runner was introduced.

Canonical acceptance cases are unchanged: F18/F19/F23 = PASS_POSTGRES_INTEGRATION; the other 41 F cases, including F01/F16/F41/F43, remain NOT_RUN. B1 slice evidence does not automatically execute their full canonical semantics.

## B1I-M01 — OPEN_HARDENING_BACKLOG

`authn.list_my_organizations` is currently safely constrained by restrictive RLS. A future defense-in-depth improvement may also place an explicit current ACTIVE ORG_ADMIN membership predicate in the function body. The independent review found no current exploitable widening; the operator accepted this as non-blocking. No SQL, policy or source change is made in closure. A future scoped change should retain existing regression and add an isolated negative control for missing discovery policies.

## B1I-M02 — DOCUMENT_RECONCILED

The immutable approved plan's named paths were forecasts; **the exact 84-path base-to-candidate inventory below is the final implementation fact**, independently reviewed. Additional paths support tests, type declarations, exports and execution; the review found no product risk. Consolidated/unchanged planned files are reconciled below without rewriting the plan.

| Planned or additional path | Actual implementation / reason |
| --- | --- |
| Three separate organization use-case files | `packages/application/src/b1/organization-access.ts` consolidates the three operations with current-actor enforcement |
| Separate `revoke-web-session.ts` and its test | Registry port/PG adapter and Web `logout.ts` implement revoke; PG session and Web logout tests exercise commit/replay behavior |
| `apps/web/src/server/b1/csrf.ts` | CSRF validation is contained in `logout.ts`; transport material stays in `auth-transport.ts` |
| `apps/web/src/components/b1/api.ts` | Guarded no-store HTTP reads live in `workspace-shell.tsx` |
| `packages/persistence-postgres/src/testing/b1-fixtures.ts` | Test fixtures live under `tests/postgres/helpers/b1-fixture.ts`; CLI fixture is separately tested |
| Existing PG root and testing `index.ts` edits | Those files stay unchanged; `src/b1/index.ts` and package subpath exports keep the B1 boundary explicit |
| Existing root `apps/web/src/app/layout.tsx` edit | Root layout stays unchanged; workspace/demo layouts and mode-aware root page supply presentation boundaries |
| Existing `import-boundaries.test.ts` additions | Separate `b1-proxy.test.ts` and `b1-boundary.test.ts` carry positive/negative controls; original tests remain unchanged |
| `tests/architecture/b1-graph.ts` | Bounded import-graph checks for proxy and production/test isolation |
| `tests/postgres/b1-local-fixture.test.ts` | Real PostgreSQL coverage of explicitly authorized local synthetic-fixture attachment |
| `packages/persistence-postgres/src/b1/index.ts` | Public B1 adapter factory exports; no raw Pool exposure |
| `apps/web/tests/b1-e2e/package.json` | Test-harness module execution boundary |
| `apps/web/tests/b1-e2e/check-results.mjs` | Enforces actual named E2E execution, positive count and no skips/retries |
| `scripts/b1-local-fixture.d.mts` | Type declarations for the test-only CLI |
| `apps/web/src/server/http/request-container.test.ts` | DEMO/B1 container separation regression |
| `apps/web/src/components/b1/workspace-shell.test.ts` | Protected HTTP presentation regression |
| `apps/web/src/app/page.test.tsx` | Explicit mode/root page regression |
| `tests/postgres/foundation.test.ts` | Exact column inventory includes approved session_epoch; original F18/F19 semantics unchanged |
| Exact `jose` dependency | Separately operator-approved public signature check; existing locked 6.2.12 made direct, not a scope expansion |

### Exact accepted implementation inventory (84 paths)

This is PR #31's implementation inventory, not the documentation-only closure diff.

- `.github/workflows/app-check.yml`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `apps/web/playwright.b1.config.ts`
- `apps/web/playwright.config.ts`
- `apps/web/src/app/api/v2/me/organizations/route.ts`
- `apps/web/src/app/api/v2/organizations/[orgId]/properties/[propertyId]/route.ts`
- `apps/web/src/app/api/v2/organizations/[orgId]/properties/route.ts`
- `apps/web/src/app/api/v2/session/complete/route.ts`
- `apps/web/src/app/api/v2/session/logout/route.ts`
- `apps/web/src/app/api/v2/session/route.ts`
- `apps/web/src/app/demo/layout.tsx`
- `apps/web/src/app/page.test.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/workspace/layout.tsx`
- `apps/web/src/app/workspace/organizations/[orgId]/page.tsx`
- `apps/web/src/app/workspace/organizations/[orgId]/properties/[propertyId]/page.tsx`
- `apps/web/src/app/workspace/page.tsx`
- `apps/web/src/components/b1/workspace-shell.test.ts`
- `apps/web/src/components/b1/workspace-shell.tsx`
- `apps/web/src/proxy.ts`
- `apps/web/src/runtime/application-mode.test.ts`
- `apps/web/src/runtime/application-mode.ts`
- `apps/web/src/server/b1/auth-transport.test.ts`
- `apps/web/src/server/b1/auth-transport.ts`
- `apps/web/src/server/b1/auth0.test.ts`
- `apps/web/src/server/b1/auth0.ts`
- `apps/web/src/server/b1/complete-session.test.ts`
- `apps/web/src/server/b1/complete-session.ts`
- `apps/web/src/server/b1/config.test.ts`
- `apps/web/src/server/b1/config.ts`
- `apps/web/src/server/b1/container.ts`
- `apps/web/src/server/b1/errors.ts`
- `apps/web/src/server/b1/http.test.ts`
- `apps/web/src/server/b1/http.ts`
- `apps/web/src/server/b1/logout.test.ts`
- `apps/web/src/server/b1/logout.ts`
- `apps/web/src/server/b1/session.test.ts`
- `apps/web/src/server/b1/session.ts`
- `apps/web/src/server/http/request-container.test.ts`
- `apps/web/src/server/http/request-container.ts`
- `apps/web/tests/b1-e2e/b1.spec.ts`
- `apps/web/tests/b1-e2e/check-results.mjs`
- `apps/web/tests/b1-e2e/fixture-session.ts`
- `apps/web/tests/b1-e2e/global-setup.ts`
- `apps/web/tests/b1-e2e/global-teardown.ts`
- `apps/web/tests/b1-e2e/package.json`
- `apps/web/tests/b1-e2e/provider-network-preload.mjs`
- `ops/AI_Execution_Log.csv`
- `package-lock.json`
- `package.json`
- `packages/api-contracts/src/b1.test.ts`
- `packages/api-contracts/src/b1.ts`
- `packages/api-contracts/src/index.ts`
- `packages/application/src/b1/begin-web-session.test.ts`
- `packages/application/src/b1/begin-web-session.ts`
- `packages/application/src/b1/errors.ts`
- `packages/application/src/b1/organization-access.test.ts`
- `packages/application/src/b1/organization-access.ts`
- `packages/application/src/b1/ports.ts`
- `packages/application/src/index.ts`
- `packages/persistence-postgres/migrations/0004_b1_identity_sessions.sql`
- `packages/persistence-postgres/migrations/0005_b1_auth_capabilities.sql`
- `packages/persistence-postgres/migrations/0006_b1_organization_access.sql`
- `packages/persistence-postgres/package.json`
- `packages/persistence-postgres/src/b1/identity-session.ts`
- `packages/persistence-postgres/src/b1/index.ts`
- `packages/persistence-postgres/src/b1/org-transaction.ts`
- `packages/persistence-postgres/src/b1/organization-reader.ts`
- `packages/persistence-postgres/src/testing/b1-roles.ts`
- `packages/persistence-postgres/src/testing/roles.ts`
- `scripts/b1-local-fixture.d.mts`
- `scripts/b1-local-fixture.mjs`
- `tests/architecture/b1-boundary.test.ts`
- `tests/architecture/b1-graph.ts`
- `tests/architecture/b1-proxy.test.ts`
- `tests/architecture/import-boundaries.ts`
- `tests/postgres/b1-access.test.ts`
- `tests/postgres/b1-capabilities.test.ts`
- `tests/postgres/b1-identity.test.ts`
- `tests/postgres/b1-local-fixture.test.ts`
- `tests/postgres/b1-session.test.ts`
- `tests/postgres/foundation.test.ts`
- `tests/postgres/helpers/b1-fixture.ts`

## Deferred LOW findings and other open risks

All six LOW findings remain non-blocking/deferred; no source change is made for them in closure.

| Finding | Follow-up boundary |
| --- | --- |
| B1I-L01 | Make the loopback-only configuration / cookie secure flag relationship more explicit before broader deployment |
| B1I-L02 | Preserve completion no-store/single-use protection; future prefetch/POST hardening requires scoped work |
| B1I-L03 | Public jose 6.2.12 supplemental approval is recorded above; original SDK behavioral RED remains executor evidence, not independent reproduction |
| B1I-L04 | Consider extension-specific TS/TSX parsing in the architecture graph |
| B1I-L05 | Align adapter UUID validation with the canonical repository validator |
| B1I-L06 | Improve Web E2E Docker preflight diagnostics without changing timeouts |

- OPEN_RISK / dependency-security-triage: existing 14 moderate npm advisories and unrs-resolver install-script warning. Candidate audit found no new advisory packages/source IDs or HIGH/CRITICAL advisories. No audit fix or install-script approval here.
- OPEN_RISK / ci-supply-chain-maintenance: pinned v4 Actions older internal runtime / hosted Node24 forcing warning. No Actions upgrade.
- Preserved Windows-mounted Ubuntu Mobile timeout: 2/133 tests at unchanged 5000 ms; prior cache UNKNOWN, ROOT_CAUSE_NOT_ESTABLISHED. Native ext4/hosted passes remain separate; TIMEOUT_NOT_REPRODUCED_ON_NATIVE_EXT4 is unchanged.
- Auth0 Free entitlement NOT_VERIFIED: the live validation tenant displayed trial status. Independent live Auth0 reproduction remains NOT_RUN.
- Production hosting/credentials, real-data pilot, final operational session/retention and complete security/privacy review remain unfinished; B2 and all excluded authentication/product surfaces are not started here.

## Closure publication boundary

This receipt is authored on a separate documentation branch from the verified implementation main. Its own PR and later main CI are separate publication receipts; this text does not predict their result. Closure changes only documentation/ops, keeps the canonical case registry unchanged and recomputes all 12 existing revision 0.9 manifest entries from final UTF-8 bytes. Historical audits are retained verbatim below their new current-disposition header.

The prior local-only candidate-CI log row remains in the implementation worktree and is not duplicated here. New merge/main-CI/closure events use distinct IDs. External Google Sheets/Drive writes have not occurred: EXTERNAL_SYNC = PENDING; see [pending queue](pending_external_sync.md). No provider settings, IAM, dependencies, tests, workflows or product code are changed by closure. The next gate is PF02-B B2; closure does not implement it.
