# Hosted synthetic demo Web image (operator decision 2026-10-09). Built from the repository root:
#   docker compose -f deploy/vm/compose.yml up -d --build
FROM node:24.21.0-bookworm-slim
WORKDIR /app
COPY . .
# Development dependencies stay installed: the start-up provisioning uses the migration runner and role helpers.
RUN npm ci --include=dev --no-audit --no-fund && npm run build:web
ENV NODE_ENV=production
# Idempotent database provisioning before every start, then Next.js on loopback behind the reverse proxy.
CMD ["sh", "-c", "node --experimental-transform-types scripts/hosted-demo-provision.mjs ensure && exec npm --workspace @build-manager/web run start -- --hostname 127.0.0.1 --port 3000"]
