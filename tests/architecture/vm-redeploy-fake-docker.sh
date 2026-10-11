#!/usr/bin/env bash
# Stand-in for `sudo docker` in vm-redeploy.test.ts. Records every call in $FAKE_DIR/calls.log and keeps the image
# state in small files there: running, latest, known and restarts. Each switch file changes one behaviour:
#   compose-fails, compose-keeps-old, restarts-after-compose (holds the count), never-ready, only-ensured, only-ready.
set -euo pipefail
state="$FAKE_DIR"
echo "$*" >> "$state/calls.log"
has() { grep -q "^sha256:${1#sha256:}" "$state/known"; }
case "$1" in
  info)
    # The Docker data folder; any existing folder works for df.
    echo "$HOME" ;;
  inspect)
    if [ "$3" = "{{.Image}}" ]; then cat "$state/running"; else cat "$state/restarts" 2>/dev/null || echo 0; fi ;;
  image)
    # image inspect --format {{.Id}} build-manager-demo-web:latest | image inspect <id>
    if [ "$3" = "--format" ]; then
      cat "$state/latest"
    elif has "$3"; then
      echo "[]"
    else
      echo "Error: No such image: $3" >&2
      exit 1
    fi ;;
  save)
    echo "fake-image $2" ;;
  load)
    # A test archive starts with one line: "tagged <id>" (saved with the latest tag), "tagged-v2 <id>" (another tag)
    # or "fake-image <id>" (saved by ID). Like docker load, it reads the whole stream.
    read -r kind id
    cat >/dev/null
    echo "$id" >> "$state/known"
    case "$kind" in
      tagged)
        echo "The image build-manager-demo-web:latest already exists, renaming the old one with ID $(cat "$state/latest") to empty string"
        echo "$id" > "$state/latest"
        echo "Loaded image: build-manager-demo-web:latest" ;;
      tagged-v2)
        echo "Loaded image: build-manager-demo-web:v2" ;;
      *)
        echo "Loaded image ID: $id" ;;
    esac ;;
  tag)
    ref="${2#sha256:}"
    full="$(grep -m 1 "^sha256:$ref" "$state/known" || true)"
    if [ -z "$full" ]; then echo "Error: No such image: $2" >&2; exit 1; fi
    echo "$full" > "$state/latest" ;;
  compose)
    if [ -f "$state/compose-fails" ]; then echo "Error response from daemon: simulated" >&2; exit 1; fi
    [ -f "$state/compose-keeps-old" ] || cp "$state/latest" "$state/running"
    if [ -f "$state/restarts-after-compose" ]; then cp "$state/restarts-after-compose" "$state/restarts"; else echo 0 > "$state/restarts"; fi ;;
  logs)
    if [ -f "$state/never-ready" ]; then
      echo "starting"
    elif [ -f "$state/only-ensured" ]; then
      echo "HOSTED_DEMO_ENSURED | upgraded | migrations current | no values printed"
    elif [ -f "$state/only-ready" ]; then
      echo "✓ Ready in 900ms"
    else
      echo "HOSTED_DEMO_ENSURED | upgraded | migrations current | synthetic accounts=existing | no values printed"
      echo "✓ Ready in 900ms"
    fi ;;
  *)
    echo "unexpected docker call: $*" >&2
    exit 64 ;;
esac
