# Building-aware mobile demo app

Expo Router app carrying both demo flows: the tenant side, which reports an
issue and answers the guided questions, and the landlord side, which reviews the
resulting repair packet and records a decision.

The server stays authoritative throughout. Safety, protocol choice, evidence
completeness, the repair packet, the recommendation, route provenance, and every
ticket transition are decided there and arrive already settled on each response.
The app renders what it is given and submits what a person chose.

Landlord context confirmation is exactly that — confirming the building context
the demo routes on. It is not ownership, identity, or authorization
verification, and the screen says so.

## Required configuration

| Variable | Required | Example |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | yes | `http://10.0.2.2:3000` |

The app never guesses a host. With this unset or unusable every screen that
needs the API shows a configuration screen instead of failing later as a
confusing network error.

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

The API is the web workspace, started from the repository root:

```bash
npm --workspace @build-manager/web run dev
```

## Routes

```text
/                                    role selection
/tenant                              report an issue
/tenant/tickets/[ticketId]           guided intake and status
/landlord                            demo buildings and landlord tickets
/landlord/buildings/[buildingId]     building passport and context confirmation
/landlord/tickets/[ticketId]         repair packet review and decision
```

## Tests

```bash
npm run test:mobile
```

Route files under `src/app/**` are not test locations — Jest discovers tests
under `src/components`, `src/features`, `src/lib`, and `src/testing`. Navigation
is asserted against the real route tree with `expo-router/testing-library`.
