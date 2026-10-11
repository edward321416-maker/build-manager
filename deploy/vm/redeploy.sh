#!/usr/bin/env bash
# Replace or roll back the hosted demo's Web container on the VM, from inside the repository clone
# (spec: docs/superpowers/specs/2026-10-11-demo-ops-reliability-design.md, PR B).
#   bash deploy/vm/redeploy.sh deploy <archive.tar.gz> <sha256>   load a new image archive and recreate the web container
#   bash deploy/vm/redeploy.sh rollback <image-id>                 go back to ~/demo-web-<image-id>.tar.gz
# A deploy first keeps the running image as ~/demo-web-<image-id>.tar.gz, so it can always be rolled back.
# Secrets stay unread: compose gets the env file's path, and only the two readiness lines of the web log are shown.
# There is no automatic rollback (spec decision D3): when the new container is not ready, the rollback command is printed.
# Exit 0 = done or nothing to change, 1 = stopped or not ready, 2 = usage.
set -euo pipefail

IMAGE=build-manager-demo-web
CONTAINER=vm-web-1 # compose project "vm" (this folder), service "web"
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_ENV="$HOME/build-manager-demo-secrets/compose.env"
READY_SECONDS="${REDEPLOY_READY_SECONDS:-180}"
DOCKER="${REDEPLOY_DOCKER:-sudo docker}" # tests put a fake here; docker_ splits it into words on purpose
USAGE="USAGE: bash deploy/vm/redeploy.sh deploy <archive.tar.gz> <sha256> | rollback <image-id>"

docker_() { $DOCKER "$@"; }
usage() {
  echo "$USAGE" >&2
  exit 2
}
stop() {
  echo "REDEPLOY_STOPPED | $*"
  exit 1
}
short() {
  local id="${1#sha256:}"
  echo "${id:0:12}"
}
running_image() { docker_ inspect --format '{{.Image}}' "$CONTAINER"; }
latest_image() { docker_ image inspect --format '{{.Id}}' "$IMAGE:latest"; }
free_kb() {
  if [ -n "${REDEPLOY_FREE_KB:-}" ]; then echo "$REDEPLOY_FREE_KB"; else df -Pk "$HOME" | awk 'NR == 2 { print $4 }'; fi
}

# Recreate only the web container, then wait until the provisioning check and Next.js report ready, the container runs
# the wanted image and it has not restarted. Prints the two readiness lines.
recreate_and_wait() {
  local want="$1" started logs
  docker_ compose --env-file "$COMPOSE_ENV" -f "$REPO_DIR/deploy/vm/compose.yml" up -d --no-deps --force-recreate web >/dev/null
  started=$(date +%s)
  while :; do
    logs="$(docker_ logs "$CONTAINER" 2>&1 || true)"
    if grep -q HOSTED_DEMO_ENSURED <<<"$logs" && grep -q "Ready in" <<<"$logs"; then break; fi
    [ $(($(date +%s) - started)) -lt "$READY_SECONDS" ] || return 1
    sleep 2
  done
  [ "$(running_image)" = "$want" ] || return 1
  [ "$(docker_ inspect --format '{{.RestartCount}}' "$CONTAINER")" = 0 ] || return 1
  grep -E "HOSTED_DEMO_ENSURED|Ready in" <<<"$logs"
}

deploy() {
  local archive="$1" sum="$2" need old keep loaded new
  [[ "$sum" =~ ^[0-9a-f]{64}$ ]] || usage
  [ -f "$archive" ] || stop "ARCHIVE_NOT_FOUND: $archive"
  echo "$sum  $archive" | sha256sum -c --status - || stop "ARCHIVE_CHECKSUM_MISMATCH: nothing was changed"
  # Room for the loaded image and a rollback archive of the running one.
  need=$(($(stat -c %s "$archive") * 4 / 1024 + 1))
  [ "$(free_kb)" -ge "$need" ] || stop "LOW_DISK: $need KB must be free in $HOME; nothing was changed"
  old="$(running_image)" || stop "WEB_CONTAINER_NOT_FOUND: nothing was changed"
  keep="$HOME/demo-web-$(short "$old").tar.gz"
  if [ ! -s "$keep" ]; then
    echo "Keeping the running image $(short "$old") as $keep"
    docker_ save "$old" | gzip -1 >"$keep.partial" || {
      rm -f "$keep.partial"
      stop "ROLLBACK_ARCHIVE_FAILED: nothing was changed"
    }
    mv "$keep.partial" "$keep"
  fi
  loaded="$(gunzip -c "$archive" | docker_ load)" || stop "LOAD_FAILED: the running container was not touched"
  if [[ "$loaded" == *"Loaded image ID: "* ]]; then
    # Saved by image ID, without the tag that compose runs: point the tag at it.
    new="${loaded##*Loaded image ID: }"
    docker_ tag "$new" "$IMAGE:latest" || stop "TAG_FAILED: the running container was not touched"
  fi
  new="$(latest_image)"
  if [ "$new" = "$old" ]; then
    echo "REDEPLOY_UNCHANGED | $(short "$new") is already running"
    return 0
  fi
  if recreate_and_wait "$new"; then
    echo "REDEPLOY_DONE | from $(short "$old") to $(short "$new") | roll back with: bash deploy/vm/redeploy.sh rollback $(short "$old")"
  else
    echo "REDEPLOY_NOT_READY | $(short "$new") did not become ready in ${READY_SECONDS}s | roll back with: bash deploy/vm/redeploy.sh rollback $(short "$old")"
    return 1
  fi
}

rollback() {
  local id="$1" archive want
  [[ "$id" =~ ^[0-9a-f]{12}$ ]] || usage
  archive="$HOME/demo-web-$id.tar.gz"
  [ -s "$archive" ] || stop "ROLLBACK_ARCHIVE_NOT_FOUND: $archive"
  gunzip -c "$archive" | docker_ load >/dev/null || stop "LOAD_FAILED: the running container was not touched"
  # Also covers an archive saved by image ID, without the tag.
  docker_ tag "$id" "$IMAGE:latest" || stop "TAG_FAILED: the running container was not touched"
  want="$(latest_image)"
  if recreate_and_wait "$want"; then
    echo "ROLLBACK_DONE | running $id"
  else
    echo "ROLLBACK_NOT_READY | $id did not become ready in ${READY_SECONDS}s"
    return 1
  fi
}

case "${1:-}" in
deploy)
  [ "$#" -eq 3 ] || usage
  deploy "$2" "$3"
  ;;
rollback)
  [ "$#" -eq 2 ] || usage
  rollback "$2"
  ;;
*) usage ;;
esac
