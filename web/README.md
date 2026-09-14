# Building-Aware Repair Router Web MVP

This directory contains the isolated Next.js application for the synthetic contest demo. Task 2 provides only the application and test harness plus a minimal root page; later tasks add domain and demo behavior.

Use Node.js 24 and npm. Install the locked dependencies with `npm ci`, then run `npm test`, `npm run lint`, and `npm run build`. Browser tests are available through `npm run test:e2e` after the later UI tasks add their cases.

No environment variables or live services are required for this scaffold. Keep local values in `.env.local`; the tracked `.env.example` intentionally contains no values.
