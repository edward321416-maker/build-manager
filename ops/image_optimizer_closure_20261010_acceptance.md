# Image optimizer route closure acceptance

Snapshot: **2026-10-10 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN**. The hosted demo is redeployed only after a separate operator confirmation right before deployment (development rules DEV-04). This record does not claim that the demo has the route closed.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: security setting, followed by a demo redeploy |
| Operator decisions | 2026-10-10, in session: start this follow-up; spec approved before implementation, including a rollback rehearsal before the redeploy |
| Origin | Follow-up left by the security update ([acceptance record](security_update_20261010_acceptance.md), retained risk "`/_next/image` stays reachable") |
| Base | main `36cf207` |
| Reviewed candidate | `fead66e`, CI with every required check SUCCESS |
| PR | #106 (final head and its CI are recorded there) |

## Change

- `apps/web/next.config.ts`: `images: { unoptimized: true }`.
  - All five `<Image>` already passed `unoptimized`: three in `vendor-handoff-manager.tsx` and two in `vendor-job-screen.tsx`.
  - The global setting sets the same flag, so rendered `src` values do not change.
- `apps/web/tests/e2e/image-optimizer.spec.ts`: on a real `next start` build, `/_next/image` answers 404 and never an image for three requests:
  - no query
  - an internal path
  - a remote URL on a reserved `.invalid` domain
- With this setting, Next.js 16.3.8 answers 404 under `next start` before it reads the query or fetches anything (`node_modules/next/dist/server/next-server.js`, line 198). The demo image starts the app with `next start`.

## Threats

| Threat | Before | After |
| --- | --- | --- |
| Server-side fetches on a visitor's behalf (SSRF class; GHSA-cjq9-62q9-8jv4 was fixed in 16.3.8) | The hosted demo answered `url=/` with 400 "isn't a valid image": the server rendered the internal page to inspect it, without cookies | 404 before any fetch |
| Optimizer CPU and image cache | Potential only: no public image or remote pattern existed, so no resize or cache write was reachable. The real cost was one internal page render per request, open to anyone because the auth proxy matcher excludes `_next/image` | 404 before any work |

The closure is defense in depth: a future Next.js advisory in the optimizer, or a later public image, no longer reaches this server.

## Checks

- RED: on the build before the change, the three new requests answered 400, the same as the hosted demo.
- GREEN: 3/3 after the change. Web e2e 26/26.
- Local, Windows and Node 24.14.0:
  - `lint`: 0 errors.
  - `typecheck`, `check:deps` and `build:web`: passed.
  - `test:web`: 856/856. `test:shared`: 572/572.
  - `test:postgres`: 622/627. The 5 failures are the known Node v24.21.0 assertion, which is satisfied in CI.
  - The history scan passed.
- CI on `fead66e`: every required check SUCCESS, including web-e2e with the Core, SDK, Web, B1 and Vendor browser suites, and postgres-integration.

## Independent review

A fresh-context reviewer at `fead66e` returned **APPROVE**: BLOCKER 0, HIGH 0, MEDIUM 0, LOW 1, Nit 3.

- **LOW: the redeploy ships all of main since the deployed `ec4712f`.** That includes PR #100, the tenant intake completion screens.
  - The pre-deploy confirmation lists the commit range.
  - The live check adds a tenant intake that confirms the #100 screens.
  - A rollback to `f4a98a3fb611` would also remove #100 from the demo.
- **Nit: the test used a real domain.** It now uses `example.invalid`.
- **Nit: the optimizer CPU and cache threats are only potential today.** The threat table above states this.
- **Nit: the e2e suite runs in DEMO mode while the hosted demo runs B1.** The 404 happens before the proxy and app code. The live check after the redeploy still covers `/_next/image`.

## Rollback

- Code: revert PR #106 with a new PR.
- Demo:
  - The running image `f4a98a3fb611` is kept as an archive on the VM and reloaded if the new image fails.
  - Since `ec4712f` no migration, package, persistence, provisioning or `deploy/` file changed, so the rollback needs no database change.
  - The procedure is rehearsed before the redeploy and written into `deploy/vm/README.md` (development rules DEV-12).

## Retained risks

- The hosted demo keeps the route open until the operator confirms the redeploy.
- If optimized images are ever needed, the setting must be revisited under a new spec with narrow `remotePatterns` and `localPatterns`.
