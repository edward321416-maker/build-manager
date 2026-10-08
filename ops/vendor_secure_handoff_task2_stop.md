# Vendor Secure Handoff v1 — Task 2 STOP Receipt

Status: TASK2_STOPPED_NOT_ACCEPTED
Product implementation authority: remains bounded to accepted plan
Task3+: NOT_STARTED
Ready / merge / deploy: NOT_AUTHORIZED

## Fixed evidence

- Task2 base: aae9755e8144c49d470b21d9ddbf68081c850f4c
- valid RED head: d3253624b6d096b1a7a169bd0c4a93011710575b
- RED App run: 37429902600
- RED PostgreSQL job: 112158072447
- implementation code head at STOP: c4d44529363a8b1e61454cdb836ed8ef20e8dea2
- STOP review/comment: PR75 comment 6011823638

## Valid RED

The Task2 PostgreSQL suites were discovered and failed because the exact new foundation was absent:
- bm_vendor_handoff_owner missing;
- bm_vendor_web missing;
- vendor_handoff schema missing;
- six 0019 tables missing;
- Vendor functions missing.

Repository checks were green at that generation. The RED was not caused by a missing test import or suite-discovery failure.

## T2-H01 — acceptance-oracle successor conflict

The accepted plan requires the new persistence subpath export:

`"./vendor-handoff": "./src/vendor-handoff/index.ts"`.

Existing B5 AC17 explicitly normalizes only `./b5`, `./core-flow` and `./core-onboarding`, then compares the remainder of `packages/persistence-postgres/package.json` with the original frozen B5 baseline. Hosted Apps therefore fails AC17 on the exact Vendor export.

Required bounded normalization:
- add only an exact assertion for `./vendor-handoff`;
- delete only that exact key in memory before the original baseline equality;
- do not replace original frozen hashes/baseline;
- do not add wildcard/range/general export exemptions.

Required extra technical path:
`tests/architecture/b5-boundary.test.ts`.

This path is not in the current Task2 directive, so execution stopped instead of mutating it without authority.

## T2-H02 — migration schema-owner ordering

Hosted Web/B1 migration reached 0019 and failed:
`permission denied for schema vendor_handoff`.

Root cause:
- migrator creates the schema with `AUTHORIZATION bm_vendor_handoff_owner`;
- ownership transfers immediately;
- the NOINHERIT owner is not the active role;
- the migrator then attempts schema REVOKE/GRANT.

Bounded in-scope correction after resume:
1. create schema as migrator;
2. perform PUBLIC revocation and required grants while migrator owns it;
3. transfer schema ownership to bm_vendor_handoff_owner;
4. SET LOCAL ROLE owner for Vendor table/function creation;
5. keep exact RLS/ACL/NO-DML boundaries.

No new role, credential, IAM action, migration slot or Product Design change is required.

## Current implementation delta

Task2 implementation work stayed inside the plan-authorized Task2 paths:
- migration0019;
- persistence-postgres Vendor testing role/bootstrap;
- Vendor persistence adapters;
- Vendor test fixture;
- two PostgreSQL Task2 suites;
- persistence-postgres package subpath export.

No Task3 Web/UI/API route, lockfile, dependency or workflow change was made.

## Resume gate

NEXT_GATE =
`OPERATOR_AUTHORIZATION_VENDOR_SECURE_HANDOFF_TASK2_AC17_SUCCESSOR_NORMALIZATION_AND_RESUME`

If authorized:
1. exact AC17 assertion/delete only;
2. migration schema-owner ordering fix only;
3. focused AC17 once;
4. Task2 focused PostgreSQL GREEN once if AC17 passes;
5. frozen Task2 regressions once if focused GREEN passes;
6. exact path / migration byte / RLS-ACL self-audit;
7. fixed Task2 completion packet;
8. STOP before Task3.

Any unexpected failure stops the generation without a pass-seeking rerun.
