#!/usr/bin/env bash
# Replace or roll back the hosted demo's Web container on the VM, from inside the repository clone
# (spec: docs/superpowers/specs/2026-10-11-demo-ops-reliability-design.md, PR B).
#   bash deploy/vm/redeploy.sh deploy <archive.tar.gz> <sha256>   load a new image archive and recreate the web container
#   bash deploy/vm/redeploy.sh rollback <image-id>                 go back to an image that is kept or still loaded
# A deploy first keeps the running image as ~/demo-web-<image-id>.tar.gz, so it can always be rolled back.
# Secrets stay unread: compose gets the env file's path, and only the two readiness lines of the web log are shown.
# There is no automatic rollback (spec decision D3): when the new container is not ready, the reason and the rollback
# command are printed. Run it as the VM user, not with sudo; it calls `sudo docker` itself.
# Exit 0 = done or nothing to change, 1 = stopped or not ready, 2 = usage.
set -euo pipefail

IMAGE=build-manager-demo-web
CONTAINER=vm-web-1 # compose project "vm" (this folder), service "web"
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SELF="$(printf '%q' "$REPO_DIR/deploy/vm/redeploy.sh")"
COMPOSE_ENV="$HOME/build-manager-demo-secrets/compose.env"
LOCK="$HOME/.redeploy.lock"
READY_SECONDS="${REDEPLOY_READY_SECONDS:-180}"
DOCKER="${REDEPLOY_DOCKER:-sudo docker}" # tests put a fake here; docker_ splits it into words on purpose
USAGE="USAGE: bash deploy/vm/redeploy.sh deploy <archive.tar.gz> <sha256> | rollback <image-id>"
reason=""

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

# Free KB on the emptier of the home folder (archives) and Docker's data folder (loaded layers).
free_kb() {
  local root
  if [ -n "${REDEPLOY_FREE_KB:-}" ]; then
    echo "$REDEPLOY_FREE_KB"
    return
  fi
  root="$(docker_ info -f '{{.DockerRootDir}}')" || stop "DOCKER_UNAVAILABLE: nothing was changed"
  df -Pk "$HOME" "$root" | awk 'NR > 1 && (min == "" || $4 < min) { min = $4 } END { print min }'
}

# Recreate only the web container, then wait until the provisioning check and Next.js report ready, the container runs
# the wanted image and it has not restarted. Prints the two readiness lines; on failure, sets the reason.
recreate_and_wait() {
  local want="$1" started logs
  docker_ compose --env-file "$COMPOSE_ENV" -f "$REPO_DIR/deploy/vm/compose.yml" up -d --no-deps --force-recreate web >/dev/null || {
    reason="compose failed"
    return 1
  }
  started=$(date +%s)
  while :; do
    logs="$(docker_ logs "$CONTAINER" 2>&1 || true)"
    if grep -q HOSTED_DEMO_ENSURED <<<"$logs" && grep -q "Ready in" <<<"$logs"; then break; fi
    if [ $(($(date +%s) - started)) -ge "$READY_SECONDS" ]; then
      reason="not ready in ${READY_SECONDS}s"
      return 1
    fi
    sleep 2
  done
  if [ "$(running_image || true)" != "$want" ]; then
    reason="the container does not run $(short "$want")"
    return 1
  fi
  if [ "$(docker_ inspect --format '{{.RestartCount}}' "$CONTAINER" || true)" != 0 ]; then
    reason="the container restarted"
    return 1
  fi
  grep -E "HOSTED_DEMO_ENSURED|Ready in" <<<"$logs"
}

deploy() {
  local archive="$1" sum="${2,,}" need free old keep loaded ref new
  [[ "$sum" =~ ^[0-9a-f]{64}$ ]] || usage
  [ -f "$archive" ] || stop "ARCHIVE_NOT_FOUND: $archive"
  echo "$sum  $archive" | sha256sum -c --status - || stop "ARCHIVE_CHECKSUM_MISMATCH: nothing was changed"
  # Docker unpacks the whole image before it registers the layers, so loading needs about twice the unpacked size;
  # a rollback archive of the running image needs about as much as this archive.
  need=$(($(gzip -dc "$archive" | wc -c) * 2 / 1024 + $(stat -c %s "$archive") / 1024 + 1))
  free="$(free_kb)"
  [ "${free:-0}" -ge "$need" ] || stop "LOW_DISK: $need KB must be free in $HOME and Docker's data folder; nothing was changed"
  old="$(running_image)" || stop "WEB_CONTAINER_NOT_FOUND: nothing was changed"
  keep="$HOME/demo-web-$(short "$old").tar.gz"
  if [ -s "$keep" ] && gzip -t "$keep" 2>/dev/null; then
    echo "The running image $(short "$old") is already kept as $keep"
  else
    echo "Keeping the running image $(short "$old") as $keep"
    docker_ save "$old" | gzip -1 >"$keep.partial" || {
      rm -f "$keep.partial"
      stop "ROLLBACK_ARCHIVE_FAILED: nothing was changed"
    }
    mv -f "$keep.partial" "$keep"
  fi
  loaded="$(gunzip -c "$archive" | docker_ load)" || stop "LOAD_FAILED: the running container was not touched"
  if ! grep -qxF "Loaded image: $IMAGE:latest" <<<"$loaded"; then
    # An archive saved by image ID carries no tag; anything else is not the demo's image.
    ref="$(sed -n 's/^Loaded image ID: //p' <<<"$loaded" | tail -n 1)"
    [ -n "$ref" ] || stop "ARCHIVE_NOT_DEMO_IMAGE: the archive holds no $IMAGE:latest image; the running container was not touched"
    docker_ tag "$ref" "$IMAGE:latest" || stop "TAG_FAILED: the running container was not touched"
  fi
  new="$(latest_image)" || stop "LATEST_TAG_MISSING: the running container was not touched"
  if [ "$new" = "$old" ]; then
    echo "REDEPLOY_UNCHANGED | $(short "$new") is already running"
    return 0
  fi
  if recreate_and_wait "$new"; then
    echo "REDEPLOY_DONE | from $(short "$old") to $(short "$new") | roll back with: bash $SELF rollback $(short "$old")"
  else
    echo "REDEPLOY_NOT_READY | $(short "$new"): $reason | roll back with: bash $SELF rollback $(short "$old")"
    return 1
  fi
}

rollback() {
  local id="${1,,}" archive want
  [[ "$id" =~ ^[0-9a-f]{12}$ ]] || usage
  archive="$HOME/demo-web-$id.tar.gz"
  if docker_ image inspect "$id" >/dev/null 2>&1; then
    echo "The image $id is still loaded; skipping the archive"
  else
    [ -s "$archive" ] || stop "ROLLBACK_ARCHIVE_NOT_FOUND: $archive"
    gunzip -c "$archive" | docker_ load >/dev/null || stop "LOAD_FAILED: the running container was not touched"
  fi
  docker_ tag "$id" "$IMAGE:latest" || stop "TAG_FAILED: the running container was not touched"
  want="$(latest_image)" || stop "LATEST_TAG_MISSING: the running container was not touched"
  if recreate_and_wait "$want"; then
    echo "ROLLBACK_DONE | running $id"
  else
    echo "ROLLBACK_NOT_READY | $id: $reason"
    return 1
  fi
}

case "${1:-}" in
deploy) [ "$#" -eq 3 ] || usage ;;
rollback) [ "$#" -eq 2 ] || usage ;;
*) usage ;;
esac
[ "$(id -u)" != 0 ] || stop "RUN_WITHOUT_SUDO: run as the VM user; the script calls sudo docker and keeps archives in that user's home"
# One run at a time: a second one could recreate the container in the middle of the first.
mkdir "$LOCK" 2>/dev/null || stop "ALREADY_RUNNING: $LOCK exists; remove it only if no other redeploy is running"
trap 'rmdir "$LOCK"' EXIT
"$@"
