#!/usr/bin/env bash
# Hosted synthetic demo on one Ubuntu 24.04 VM (operator decision 2026-10-09; e.g. Oracle Cloud Always Free).
#   deploy/vm/setup.sh <public-ipv4> [--image-archive <web-image.tar.gz>]
# Installs Docker, opens TCP 80/443 in the host firewall, builds the Web image, generates the runtime values
# once on this VM (outside the repository, never printed) and starts PostgreSQL 18, the Web app and Caddy.
# The site is served at https://<ip-with-dashes>.sslip.io. Re-running keeps the existing values and data.
# Small hosts (for example a 1 GB Always Free VM.Standard.E2.1.Micro) cannot build the image: build it elsewhere
# with `docker save build-manager-demo-web | gzip`, copy it over and pass --image-archive; a swap file is added.
set -euo pipefail
IP="${1:-}"
[[ "$IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || { echo "PUBLIC_IPV4_REQUIRED"; exit 1; }
ARCHIVE=""
if [ "$#" -gt 1 ]; then
  [ "$#" -eq 3 ] && [ "$2" = "--image-archive" ] && [ -f "$3" ] || { echo "USAGE: setup.sh <public-ipv4> [--image-archive <file>]"; exit 1; }
  ARCHIVE="$3"
fi
HOST="${IP//./-}.sslip.io"
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SECRETS="$HOME/build-manager-demo-secrets"
IMAGE="build-manager-demo-web"

if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -q
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -yq docker.io docker-compose-v2
fi
# Oracle Ubuntu images reject inbound traffic other than SSH in iptables; allow only HTTP and HTTPS.
for port in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
done
if command -v netfilter-persistent >/dev/null 2>&1; then sudo netfilter-persistent save >/dev/null; fi

# Below 2 GB of memory, add a 2 GB swap file once so PostgreSQL and the Web app fit.
if [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 2000000 ] && [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

if [ -n "$ARCHIVE" ]; then
  gunzip -c "$ARCHIVE" | sudo docker load
else
  sudo docker build -t "$IMAGE" -f "$REPO_DIR/deploy/vm/Dockerfile" "$REPO_DIR"
fi

mkdir -p "$SECRETS" && chmod 700 "$SECRETS"
if [ ! -f "$SECRETS/generated.json" ]; then
  sudo docker run --rm -v "$SECRETS:/out" "$IMAGE" node scripts/hosted-demo-provision.mjs generate /out/generated.json \
    --origin "https://$HOST" --db-host 127.0.0.1 --db-port 5432 --database demo
fi
# Render the compose and Web environment files from the generated values without printing them.
sudo docker run --rm -e SITE_HOST="$HOST" -e SECRETS="$SECRETS" -v "$SECRETS:/out" "$IMAGE" node -e '
  const fs=require("node:fs");const g=JSON.parse(fs.readFileSync("/out/generated.json","utf8"));
  const line=(k,v)=>{if(/[\r\n]/.test(v))throw new Error("MULTILINE_VALUE_"+k);return k+"="+v;};
  fs.writeFileSync("/out/web.env",Object.entries(g.web).map(([k,v])=>line(k,v)).join("\n")+"\n",{mode:0o600});
  fs.writeFileSync("/out/compose.env",[line("POSTGRES_PASSWORD",g.database.POSTGRES_PASSWORD),line("SITE_HOST",process.env.SITE_HOST),line("WEB_ENV_FILE",process.env.SECRETS+"/web.env")].join("\n")+"\n",{mode:0o600});'

sudo docker compose --env-file "$SECRETS/compose.env" -f "$REPO_DIR/deploy/vm/compose.yml" up -d
echo "DEMO_VM_STARTED | https://$HOST | first start provisions the database; check: sudo docker compose -f deploy/vm/compose.yml logs web"
