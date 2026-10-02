# Run the synthetic core flow

Use the `feat/core-flow-rc1` worktree, Node **24.21.0**, npm **11.19.0**, Docker Desktop and the existing lockfile. These are development commands, not deployment. All accounts, buildings and reports must remain synthetic.

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
2. Follow the existing safety/questions flow. Photo upload is unsupported; submit available text for partial review.
3. In the manager browser, open the same unit's ticket. Ask a follow-up question or record handling start and completion with a message.
4. Refresh the tenant view and reopen unit history. Completion is a human-entered record, separate from route approval or proof of repair.
5. Stop/restart the Web server. Tickets remain in the named PostgreSQL volume. Do not remove that volume to restart.

The small-screen Web flow was exercised at320px; result layout also checked390/768/1280px. Saved intake and handling show a confirmation and a building/unit result summary. Initial loading disables code entry; expired or revoked access clears the protected screen and directs you to a fresh code. A failed save keeps the input: use the read-only refresh to check history before submitting again, because an interrupted response does not prove the save failed. Empty lists and missing unit assignments explain the next step. These are Web checks, not Expo/device evidence.

Codes last55minutes. Run `--prepare` again to issue fresh codes for the same synthetic accounts while retaining tickets, then sign in with the new codes. Logging out revokes that code's session. Browser refresh retains its HttpOnly session; Mobile stores its code only in memory and requires re-entry after app restart.

## Existing Expo app

From `apps/mobile` in a shell using the same isolated Node:

```powershell
$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:3130'
npx --no-install expo start --offline --localhost --port 8081
```

Open the Expo Web entry and choose **RC1 수리 접수·처리**, or visit `/core`. Enter the same synthetic tenant/manager codes to use the shared API and DB. **These startup requests were blocked by automatic approval review in the executor session; Expo UI execution is not yet verified.** Component tests and Android/iOS JS/assets exports passed; neither is an APK/device run.

The operator-authorized 2026-10-03 resume again received `blocked by policy` before process creation for `expo start --web --offline --localhost --port 8081`. A separate Expo Web static export succeeded with nine routes including `/core`. This verifies compilation, not browser interaction or native execution; see the [resume receipt](../ops/core_flow_rc1.md#2026-10-03-resumed-runtime-check). Existing Web startup and synthetic data preparation remain usable.

For a physical phone, loopback is not usable. Configure `CORE_FLOW_HOST` to an actual private IPv4 interface on the development PC and set `EXPO_PUBLIC_API_URL` to that address/port before starting Expo with the appropriate LAN settings. The launcher rejects wildcard/public hosts. Device reachability and any firewall requirements must be verified separately; do not alter firewall/IAM or connect a new account automatically. No phone-accessible LAN was verified in this execution.

## Reproduce the new checks

```powershell
npm run test:postgres -- tests/postgres/core-flow.test.ts
node scripts/core-flow-restart-check.mjs
Push-Location apps/web
npx --no-install playwright test --config playwright.core.config.ts
Pop-Location
```

Prepare fresh session codes first. The seven core browser tests (original4 plus usability3) use synthetic local state, disable trace/video, and save only post-login or cleared-code synthetic screenshots outside Git. Controlled network/empty-state responses are explicitly distinguished from actual API/database checks. They have their own report and do not replace or feed the existing60-test B1 checker. See [execution evidence](../ops/core_flow_rc1.md) for full regressions and retained failures.
