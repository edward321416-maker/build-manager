# Login-free demo and hosted demo v1

Date: 2026-10-09. Base: main `1b00df16c83bef1e6330b08187006e9e647a7829` (Vendor Secure Handoff v1 merged).

## Decisions

- [DECISION] 2026-10-09: the operator asked to remove login from the experience for now and add it back later ("우선 로그인 기능을 빼고 나중에 다시 추가").
- [DECISION] Same day: for local use, a role chooser outside the application (`scripts/demo-local.mjs`), keeping application security rules unchanged.
- [DECISION] Same day, after asking for "컴퓨터가 꺼져도 실행할 수 있는 사이트": a hosted demo whose visitors enter through in-app role buttons ("로그인 없이 체험 버튼"), accepting a narrow, explicitly tested exception to the B1 production-graph rules for the synthetic provider only.
- [DECISION] Hosting: Railway for the Web app and PostgreSQL 18 together. [FACT] A Neon owner (non-superuser with CREATEROLE) cannot satisfy the frozen B1 role contract of migrations 0004-0006: PostgreSQL 16+ automatically grants the creating role an ADMIN membership (grantor = bootstrap superuser) in every role it creates, and only a superuser may revoke it; a throwaway creator role cannot be dropped because it granted the migrator memberships. Rehearsed on PostgreSQL 18.6 with a Neon-like owner on 2026-10-09; the same provisioning passed with a true superuser.

## In-app demo entry

- When `BUILD_MANAGER_MODE=B1`, `BUILD_MANAGER_DEMO_ENTRY=1`, the configured provider domain is the synthetic `b1.synthetic.invalid` and `BUILD_MANAGER_DEMO_SUBJECTS` names two `auth0|synthetic-…` subjects, the `/core` sign-in panel and the home page offer "관리자로 체험하기" / "세입자로 체험하기" instead of the provider login. With a real provider configured, demo entry is off and the existing login is unchanged.
- `POST /api/v2/session/demo` (same-origin form, role `manager` or `tenant` only) creates the same transport session a provider callback would and begins the database session through the existing `completeTransportSession`; no cookie is set unless that succeeds. Demo logout revokes the database session, clears the SDK cookie and returns to `/core`.
- Architecture rules stay enforced with pinned exceptions: only `apps/web/src/server/b1/demo-entry.ts` may import `@auth0/nextjs-auth0/testing` (public SDK cookie sealing), only it and its route may hold the login capability besides callback completion, and the route inventory pins exactly this one extra route. Tests prove other files are still rejected.
- Authorization is unchanged: demo sessions map to the seeded synthetic identities' memberships; Vendor access remains a Manager-issued capability link. Anyone can read and change the synthetic demo data by design.

## Hosting changes

- B1 base URL: plain http stays loopback-only; an https origin is accepted. SDK and demo cookies are `Secure` on https.
- Runtime databases: loopback, the provider's private network (`*.railway.internal`, not Internet-reachable), or any other host only with verified TLS. Invitation and Vendor origins accept https.
- `scripts/hosted-demo-provision.mjs generate` writes all runtime values (random role passwords, session secret, fixed synthetic demo subjects) to a private file; `ensure` runs as Railway's pre-deploy command, provisions an empty PostgreSQL 18 database (true superuser required) with the existing role helpers, migrations 0001-0023 and synthetic seed data, binds the demo subjects, and on later deploys only applies outstanding migrations and re-asserts role passwords. It prints no secrets.
- `railway.json` builds the Web app, runs `ensure` before each deploy and starts `next start`.

## Out of scope

Mobile hosting (the app uses development access codes against DEMO mode), real login, notifications, data reset scheduling, custom domain.

## Verification

Unit tests for demo-entry gating/validation/session/cookie, demo logout, sign-in panel, https base, secure cookie, database host and origin rules; architecture exception tests; browser test D01 (role buttons, signed-in screens, demo logout, cross-site/unknown-role rejection, 390px/200% layout); rehearsed `generate` + `ensure` twice on a fresh PostgreSQL 18.6 and a hosted-style smoke run (6/6). A first rehearsal smoke failed because a global rule hid every form in the sign-in panel; the demo forms now carry their own class.
