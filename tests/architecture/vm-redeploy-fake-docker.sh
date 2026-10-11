#!/usr/bin/env bash
# Stand-in for `sudo docker` in vm-redeploy.test.ts. Records every call in $FAKE_DIR/calls.log and keeps the image
# state in small files there: running, latest, known and restarts. A never-ready file keeps the web log unready.
set -euo pipefail
state="$FAKE_DIR"
echo "$*" >> "$state/calls.log"
case "$1" in
  inspect)
    if [ "$3" = "{{.Image}}" ]; then cat "$state/running"; else cat "$state/restarts" 2>/dev/null || echo 0; fi ;;
  image)
    cat "$state/latest" ;;
  save)
    echo "fake-image $2" ;;
  load)
    # A test archive holds one line: "tagged <id>" (saved with the latest tag) or "fake-image <id>" (saved by ID).
    read -r kind id
    echo "$id" >> "$state/known"
    if [ "$kind" = tagged ]; then
      echo "$id" > "$state/latest"
      echo "Loaded image: build-manager-demo-web:latest"
    else
      echo "Loaded image ID: $id"
    fi ;;
  tag)
    ref="${2#sha256:}"
    full="$(grep -m 1 "^sha256:$ref" "$state/known" || true)"
    if [ -z "$full" ]; then echo "Error: No such image: $2" >&2; exit 1; fi
    echo "$full" > "$state/latest" ;;
  compose)
    cp "$state/latest" "$state/running"
    echo 0 > "$state/restarts" ;;
  logs)
    if [ -f "$state/never-ready" ]; then
      echo "starting"
    else
      echo "HOSTED_DEMO_ENSURED | upgraded | migrations current | synthetic accounts=existing | no values printed"
      echo "✓ Ready in 900ms"
    fi ;;
  *)
    echo "unexpected docker call: $*" >&2
    exit 64 ;;
esac
