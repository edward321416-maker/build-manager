# Run the synthetic core flow

Use the `feat/core-flow-rc1` worktree, Node **24.21.0**, npm **11.19.0**, Docker Desktop and the existing lockfile. These are development commands, not deployment. All accounts, buildings and reports must remain synthetic.

## Existing login bridge

The B1 login bridge is implemented and exercised with **synthetic SDK sessions**, separately from the development access-code mode below. Actual Auth0 provider login is **NOT_RUN / CONFIGURATION_REQUIRED** on this machine. No Auth0 settings, accounts or identities were changed. Existing photo/ticket data remains available in its original mode; separate SDK test actors have their own synthetic records.

From the repository root with the same isolated Node24.21.0/npm11.19.0:

```powershell
npm run build:web
node --experimental-transform-types scripts/core-flow-dev.mjs --prepare
node --experimental-transform-types scripts/core-flow-b1-dev.mjs --prepare-synthetic-sdk
node --experimental-transform-types scripts/core-flow-b1-dev.mjs --serve-synthetic-sdk
```

The last command keeps **http://localhost:3133/core** running. In another terminal, open isolated synthetic SDK browser sessions:

```powershell
node scripts/core-flow-b1-open.mjs --tenant
node scripts/core-flow-b1-open.mjs --manager
```

These explicitly use the installed Auth0 SDK testing helper, existing B1 completion endpoint and registered synthetic identities. They **do not authenticate with live Auth0**. No access code/secret is printed or placed in a URL. The helper visits `/api/v2/session/complete` → `/workspace`, then follows the RC1 entry link. A normal unseeded browser shows **계정으로 로그인**. That provider button is unavailable in synthetic SDK mode; use the explicit test helper rather than treating it as a live login.

Select **내 소속** when more than one association exists; one association opens automatically. Confirm **건물·호실**, create a synthetic report and optional reference photos, then read/handle that ticket in the manager window. Refresh/reopen the tenant history to confirm the result. Switching organization clears unsaved text/photo selections; stored data remains in its own organization's history. An account without association gets connection guidance and logout, with no developer/admin fallback.

Logout uses the existing B1 POST endpoint. In synthetic SDK mode the nonexistent provider produces a503 response **after local registry revocation**; revisiting `/core` shows login and old raw photo requests return401. This is tested local logout, not successful provider logout. Close the isolated test browser when finished.

For an **already configured** real Auth0 test environment, use its existing private `B1_AUTH0_DOMAIN`, `B1_AUTH0_CLIENT_ID`, `B1_AUTH0_CLIENT_SECRET`, `B1_AUTH0_SECRET` and `B1_APP_BASE_URL` in the process, then:

```powershell
node --experimental-transform-types scripts/core-flow-b1-dev.mjs --serve
```

This validates/reuses the configured loopback callback/base origin unchanged, with login/registry/core roles from the same prepared synthetic database. It never assumes3130/3133 is an allowed callback. Missing config fails with a sanitized `CORE_B1_CONFIGURATION_REQUIRED` message; it does not start demo authentication. A real authenticated actor with no existing membership/occupancy sees no association. The launcher does not create grants, link email identities or transfer older tickets/photos. This live-mode preflight was exercised and failed as expected because configuration was absent; no real Auth0 login/logout is claimed.

Reproduce the separate new login tests with the prepared SDK fixture and no manually running3133 server:

```powershell
npm exec --workspace @build-manager/web -- playwright test --config playwright.core-login.config.ts
npm run test:postgres -- tests/postgres/core-flow-access.test.ts
```

The five new browser cases use actual SDK cookies/B1 completion/PostgreSQL/Web, with no live provider. They remain separate from the frozen60-case B1 checker. See [login evidence](../ops/core_flow_rc1_login.md). Expo/native authentication and actual Expo/device runtime remain unexecuted.

## Explicit development access-code mode

From repository root in PowerShell, with the project-isolated Node directory on this shell's PATH:

```powershell
node --version
npm --version
npm ci --ignore-scripts --no-audit --no-fund
npm run build:web
node --experimental-transform-types scripts/core-flow-dev.mjs --prepare
node --experimental-transform-types scripts/core-flow-dev.mjs --serve
```

Open **http://127.0.0.1:3130/core**. `--prepare` prints the private access-code file location but never its contents. Open that local file yourself. Use `tenant` in one browser profile and `manager` in another. The `tenantPeer`, `tenantOther`, `otherTenant` and `otherManager` accounts demonstrate ownership/organization isolation; `staff` is scoped by its property assignment. Roles are resolved by the server, not selected in the UI.

1. Enter the tenant code; select a building/unit, choose heating or leak, and enter a synthetic report.
2. Optionally select up to three JPEG/PNG reference photos (5MiB and20megapixels each), inspect previews, then submit. Text is saved first; photos attach to that ticket. Follow the existing safety/questions flow separately: reference photos do not satisfy evidence requirements or trigger image analysis.
3. In the manager browser, open the same unit's ticket. Ask a follow-up question or record handling start and completion with a message.
4. Refresh the tenant view and reopen unit history. Completion is a human-entered record, separate from route approval or proof of repair.
5. Stop/restart the Web server. Tickets and normalized photo bytes remain in the named PostgreSQL volume. Do not remove that volume to restart. Stored photos can be enlarged from detail and unit history; managers can view them but cannot upload on a tenant's behalf.

If a photo upload fails, the existing ticket remains saved. Keep the page open: untransmitted selections stay in memory. Use **사진 저장 상태 확인**, then **사진만 전송**; the client reads saved upload IDs before sending remaining files. A lost response does not create another ticket or another photo. Cancel only unsaved selections. Closing/reloading the page loses unsent File selections; saved photos remain. Completed tickets reject new attachments. Expired/revoked access clears photos and pending selections.

The Web strips image metadata and applies orientation before storing new JPEG/PNG bytes. Originals, original filenames and public photo URLs are not stored. Synthetic test pictures are illustrative fixtures, not a real property diagnosis. There is no saved-photo deletion/replacement or automatic evidence/repair decision.

The small-screen Web flow was exercised at320px; result layout also checked390/768/1280px. Saved intake and handling show a confirmation and a building/unit result summary. Initial loading disables code entry; expired or revoked access clears the protected screen and directs you to a fresh code. A failed save keeps the input: use the read-only refresh to check history before submitting again, because an interrupted response does not prove the save failed. Empty lists and missing unit assignments explain the next step. These are Web checks, not Expo/device evidence.

Codes last55minutes. Run `--prepare` again to issue fresh codes for the same synthetic accounts while retaining tickets, then sign in with the new codes. Logging out revokes that code's session. Browser refresh retains its HttpOnly session; Mobile stores its code only in memory and requires re-entry after app restart.

## Existing Expo app

From `apps/mobile` in a shell using the same isolated Node:

```powershell
$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3130'
npx --no-install expo start --offline --localhost --port 8081
```

The command above is a historical startup recipe, **not an instruction to retry the current host restriction**. Actual startup must wait for formally permitted host conditions. No startup, alternate port or serving bypass was attempted during photo implementation. Protected photo list/read/enlargement code is included in Mobile; selection/upload remains Web-only. Current Mobile test failures and static-export results are recorded separately in the [photo evidence](../ops/core_flow_rc1_photos.md). Neither component tests nor JS/assets exports prove Expo/device execution.

The operator-authorized 2026-10-03 resume again received `blocked by policy` before process creation for `expo start --web --offline --localhost --port 8081`. A separate Expo Web static export succeeded with nine routes including `/core`. This verifies compilation, not browser interaction or native execution; see the [resume receipt](../ops/core_flow_rc1.md#2026-10-03-resumed-runtime-check). Existing Web startup and synthetic data preparation remain usable.

For a physical phone, loopback is not usable. Configure `CORE_FLOW_HOST` to an actual private IPv4 interface on the development PC and set `EXPO_PUBLIC_API_URL` to that address/port before starting Expo with the appropriate LAN settings. The launcher rejects wildcard/public hosts. Device reachability and any firewall requirements must be verified separately; do not alter firewall/IAM or connect a new account automatically. No phone-accessible LAN was verified in this execution.

## Reproduce the new checks

```powershell
npm run test:postgres -- tests/postgres/core-flow.test.ts tests/postgres/core-flow-photos.test.ts
node scripts/core-flow-restart-check.mjs
Push-Location apps/web
npx --no-install playwright test --config playwright.core.config.ts
Pop-Location
```

Prepare fresh session codes first. The11core browser tests preserve the original4 and usability3, and add4photo cases. They use synthetic local state, disable trace/video, and save only post-login or cleared-code synthetic screenshots outside Git. Controlled network/empty-state responses are explicitly distinguished from actual API/database checks. They have their own report and do not replace or feed the existing60-test B1 checker. See [photo evidence](../ops/core_flow_rc1_photos.md) and the [earlier execution evidence](../ops/core_flow_rc1.md) for regressions and retained failures.
