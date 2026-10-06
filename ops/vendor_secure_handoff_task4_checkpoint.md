# Vendor Secure Handoff v1 — Task4 local checkpoint

POLICY_REF: `4f3d3dbdf57c7d537ad6b79674b05b29888c44e1`.
Entry TARGET_REF: `fe64d6d` (Task3 closure; reviewed Task3 source `3c7d3ad471b35a072f67fb4b701517aef9f357ef`), clean at start.
Final Task4 source HEAD: `dc29c47fb39fb2e66346db94762654c427fba195`.
Authority: accepted plan blob `51123e2583c8ecdb132711d86cacdf43027743b1` and PR75 execution directive 6013595548. Previous receipts: [Task3 checkpoint](vendor_secure_handoff_task3_checkpoint.md).

## Local Task4 result

The standalone no-account Vendor capability/session Web boundary is implemented:

- `POST /api/v2/vendor/session/redeem` consumes the fragment capability once and sets an HttpOnly, SameSite=Strict, host-only `vendor_session` cookie scoped to `/api/v2/vendor`. It returns the current job plus a fresh server-issued CSRF value; only digests are persisted.
- `GET /api/v2/vendor/session` rotates the CSRF digest without extending the 7-day absolute session expiry.
- `GET /api/v2/vendor/job`, OFFERED-only `POST /api/v2/vendor/job/decline` (ENDED/DECLINED; source ticket untouched; reason/note stored assignment-private), and `POST /api/v2/vendor/session/logout` (exact replay idempotent without a generic active-session precheck).
- `GET /api/v2/vendor/job/source-photos/:photoId` serves only the current packet allowlist; guessed, malformed and cross-assignment IDs share one hidden 404.
- Every Vendor API response carries `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, frame denial; `/vendor/job` page headers are configured. No third-party resources.
- `/vendor/job` redeems the fragment, clears it only after success or a definitive rejection, keeps the exact request identity through unknown outcomes and reloads, and never treats another assignment's session as proof of redemption.
- Exact Vendor page/API paths bypass the B1/Auth0 proxy; B1/Core and look-alike paths remain protected. A separate `bm_vendor_web` container uses a configured `VENDOR_HANDOFF_APP_ORIGIN`.
- Accept/Withdraw remain unimplemented until Task5; Manager revoke remains Task9.

SQL was added to the still-unmerged foundation migration 0019 (Task3 precedent). Migrations 0001–0018, Design/D9/D9R1 and the accepted plan remain byte-identical (frozen audit 28/28).

## Independent review

| Generation | Verdict | Outcome |
| --- | --- | --- |
| `88b5bf9` implementation | BLOCKER 0 / HIGH 0 / MEDIUM 2 / LOW 6 | stale-tab CSRF false logout; missing lock-wait tests; header/transient/same-tab/boundary/CHECK/origin LOWs |
| `baee4df` remediation | BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 1 | all eight closed; new LOW: pending decline across same-tab assignment switch |
| `dc29c47` remediation | BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0 | closed; one uncounted below-LOW in-flight observation carried to Task5 |

## Verified local evidence

Pinned runtime Node 24.21.0 / npm 11.19.0; disposable PostgreSQL 18.6. Private logs live in `.superpowers/sdd/2026-10-06-vendor-secure-handoff-v1/` and are not published.

| Gate | Generation | Result |
| --- | --- | --- |
| Vendor PostgreSQL (foundation, security, external HTTP, manager preview/HTTP) | `baee4df` | 68/68 PASS |
| Frozen PostgreSQL regressions | `baee4df` | 42/42 PASS |
| `npm run verify` (shared 481/481, lint 0 errors / 4 unchanged warnings, typecheck, Next build, deps) | `baee4df` | exit 0 |
| Focused Vendor Web (token, HTTP, container, screen, proxy) | `dc29c47` | 73/73 PASS |
| Full Web | `dc29c47` | 657/657 PASS |
| Staged public scan | `dc29c47` | PASS, 698 files / 328 links / 0 findings |
| Frozen authority audit | `baee4df` | 28/28 PASS |

Meaningful failed generations are retained privately: missing-module discovery RED, 46-failure skeleton behavioral RED, note-validation RED, route-count normalization, test typing/lint fixes, scanner phone/credential-shape findings, remediation RED (16 Web / 4 PostgreSQL), and the NEW-1 mounted RED. The `dc29c47` delta is UI-only; PostgreSQL/verify evidence is from `baee4df`.

## Limits and next gate

AC evidence is partial and local only; no 57/57 acceptance is claimed. Live browser confirmation of `/vendor/job` headers, query handling and origin provisioning belongs to Task12; Manager visibility of the decline note is tracked for Task9. D7-L01, D8-L01, D8-L02 retained. No remote/Ready/merge/deploy/production/external Google write; sync_status=pending; tokens=unknown. Next: Task5 (scheduling persistence, atomic Accept/Withdraw, migration 0020).
