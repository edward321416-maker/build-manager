# Tenant demo app

Expo Router app for the tenant side of the building-aware repair router demo.
Every decision it shows — which question to ask, whether a report escalated on
safety, whether a submission is complete — comes from the server. The app
renders the response and nothing more.

## Required configuration

| Variable | Required | Example |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | yes | `http://10.0.2.2:3000` |

The app never guesses a host. With this unset or unusable it shows a
configuration screen instead of failing later as a confusing network error.

Use the address the device can reach, which is not the one the server sees:

- Android emulator → `http://10.0.2.2:3000`
- physical device → `http://<your-LAN-IP>:3000`

Put your own value in `apps/mobile/.env.local`. That file is not committed, and
no real address belongs in the repository. A committed `.env.example` is not
possible here because the repository ignores `.env.*`.

Only absolute `http:` and `https:` URLs are accepted. A value carrying
credentials, a query string, or a fragment is rejected, and the configured
value is never echoed into an error message.

## Running

```bash
npm --workspace @build-manager/mobile run android   # or: start / ios
```

The server is the web workspace: `npm run dev:web` from the repository root.

## Tests

```bash
npm run test:mobile
```

Route files under `src/app/**` are not test locations — Jest discovers tests
under `src/components`, `src/features`, `src/lib`, and `src/testing`. Navigation
is asserted against the real route tree with `expo-router/testing-library`.
