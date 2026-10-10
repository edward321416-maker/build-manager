# Next.js and sharp security update acceptance

Snapshot: **2026-10-10 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN**. The hosted demo is redeployed only after a separate operator confirmation right before deployment (development rules DEV-04). This record does not claim that the demo runs the new versions.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: reopens the B5 AC17 frozen dependency inventory |
| Operator decisions | 2026-10-10, in session: security update first; one new candidate from current main that replaces PR #73; libvips (LGPL-3.0-or-later) allowed through sharp ([REF-07](../references/REFERENCE_RULES.md) 1.0.2); spec approved before implementation |
| Earlier authorization | Next.js 16.3.8 in issue #72, comment 5995544213 |
| Base | main `6e50b44` |
| Reviewed candidate | `65f00d3`, CI run 38032343682 with every required check SUCCESS |
| PR | #97 (final head and its CI are recorded there) |
| Superseded | PR #73 |
| Follow-up | issue #95, development and mobile tooling alerts |

## Change

- `next` and `eslint-config-next` 16.3.4 → 16.3.8 and `sharp` 0.35.4 → 0.35.5, pinned exactly. The lockfile was written by the CI-pinned npm 11.19.0 and changes 53 entries:
  - next and @next entries, and the `apps/web` workspace entry
  - eslint-config-next
  - sharp and @img entries, plus two added optional packages, `@img/sharp-wasm32` and `@emnapi/runtime`
  - entries whose only change is newly filled `resolved` and `integrity` fields
- The B5 AC17 inventory test now checks a reviewed fixture with each changed entry's original value and successor hash, restores those entries, and then compares the original frozen hash. The Expo and sharp projections and every frozen hash are unchanged. Separate negative cases reject an unreviewed version, a tampered fixture and a dropped entry.

## Threats

| Advisory | Exposure in this codebase |
| --- | --- |
| GHSA-vcvr-r3jv-pc5j, next/og remote code execution (critical) | Not used: no `next/og` or `ImageResponse` |
| GHSA-cjq9-62q9-8jv4, image optimization SSRF (high) | The optimizer is unused because every `Image` is `unoptimized`, but `/_next/image` still answers |
| Other 16.3.8 advisories (cache poisoning, information disclosure) | Not assessed one by one; the update removes them |
| GHSA-wq5f-xc86-pv6w, librsvg in sharp (high) | Photo uploads are limited to PNG and JPEG by MIME type and signature before `sharp()`, so the SVG loader is not reached |

## Checks

- CI run 38032343682 at `65f00d3`: apps, web-e2e with the Core, SDK, Web, B1 and Vendor browser suites, postgres-integration, the mobile jobs, repository-safety, verify and foundation-gate all SUCCESS.
- Local results and their limits are listed in PR #97. On Windows with Node 24.14.0, the postgres Node-version assertions and the core, SDK, Vendor and B1 browser suites could not run, so CI is the evidence for those.

## Independent review

A fresh-context reviewer at `65f00d3` returned **APPROVE**: BLOCKER 0, HIGH 0, MEDIUM 0, LOW 3, Nit 4.

- The three LOW wording errors are fixed in the final candidate: the LGPL package list, the librsvg exposure wording and the source-map-js path.
- Two Nits are fixed: the lockfile breakdown and the placement of the negative cases.
- The hardening suggestion `images: { unoptimized: true }`, which would close `/_next/image`, is left as a follow-up outside the approved spec.

## Rollback

- Code: revert PR #97 with a new PR.
- Demo: before deployment, keep the image that is running now as an archive, and reload it if the new image fails (DEV-12).

## Retained risks

- The hosted demo keeps Next.js 16.3.4 and sharp 0.35.4 until the operator confirms a redeploy.
- Development and mobile tooling alerts remain in issue #95.
- `/_next/image` stays reachable until the hardening follow-up.
