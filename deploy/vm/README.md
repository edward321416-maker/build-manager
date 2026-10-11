# Hosted synthetic demo on one VM

A login-free, synthetic-data demo that keeps running when the operator's computer is off: PostgreSQL 18, the Web app and Caddy (automatic HTTPS) on a single Ubuntu 24.04 VM, for example Oracle Cloud Always Free (Ampere A1). [Design record](../../docs/superpowers/specs/2026-10-09-demo-entry-v1-design.md).

## Prepare the VM

1. Create an Ubuntu 24.04 instance with a public IPv4 address and your SSH public key.
2. In the cloud firewall (Oracle: the subnet's security list), allow inbound TCP 80 and 443 from anywhere. SSH (22) stays key-only.

## Deploy

```bash
git clone https://github.com/edward321416-maker/build-manager.git
cd build-manager
bash deploy/vm/setup.sh <public-ipv4>
```

The script installs Docker, opens TCP 80/443 in the host firewall, builds the Web image, generates every runtime value once into `~/build-manager-demo-secrets` (outside the repository, never printed) and starts the stack. Each Web start runs the idempotent `scripts/hosted-demo-provision.mjs ensure`, which provisions the empty database on first start and later only applies outstanding migrations. The demo is served at `https://<ip-with-dashes>.sslip.io`; visitors choose **관리자로 체험하기** or **세입자로 체험하기**.

### Small VM (1 GB memory)

A 1 GB host such as Oracle's Always Free `VM.Standard.E2.1.Micro` (x86-64) cannot build the image. Build it on another x86-64 machine from the same commit and copy it over:

```bash
docker build --platform linux/amd64 -t build-manager-demo-web -f deploy/vm/Dockerfile .
docker save build-manager-demo-web | gzip -1 > demo-web.tar.gz
scp demo-web.tar.gz ubuntu@<public-ipv4>:
# on the VM, inside the clone:
bash deploy/vm/setup.sh <public-ipv4> --image-archive ~/demo-web.tar.gz
```

The script then loads the image instead of building it and adds a 2 GB swap file on hosts with less than 2 GB of memory.

## Update

```bash
git pull && bash deploy/vm/setup.sh <public-ipv4>
```

`sudo docker build` refreshes the image; existing values and the database volume are kept. Logs: `sudo docker compose -f deploy/vm/compose.yml logs -f web`. This path keeps no rollback archive by itself, so keep one first as described in [Rollback](#rollback).

### Update a small VM

Build and save the image on another x86-64 machine from a clean checkout of the commit to deploy, then replace only the web container:

```bash
docker build --platform linux/amd64 -t build-manager-demo-web -f deploy/vm/Dockerfile .
id=$(docker images -q build-manager-demo-web:latest)
docker save build-manager-demo-web:latest | gzip -1 > "demo-web-$id.tar.gz"
sha256sum "demo-web-$id.tar.gz"
scp "demo-web-$id.tar.gz" ubuntu@<public-ipv4>:
# on the VM, inside the clone
git pull --ff-only
bash deploy/vm/redeploy.sh deploy ~/demo-web-<image-id>.tar.gz <sha256>
```

- Run it as the VM user, not with `sudo`: it calls `sudo docker` itself. Run it inside `tmux` or `screen`, so a dropped SSH session cannot stop it halfway.
- A second run at the same time stops with `ALREADY_RUNNING`. If a dropped session left `~/.redeploy.lock` behind, remove it once no other run is active.
- It stops before changing anything if the sha256 differs, the archive is not gzip, or the home folder or Docker's data folder has less free space than twice the unpacked image plus the archive.
- Measuring the unpacked size and testing an existing rollback archive each unpack an archive once. On a 1 GB VM this can take a few minutes while the demo keeps running.
- It keeps the running image as `~/demo-web-<image-id>.tar.gz` unless a valid archive with that name exists. Naming the upload after its image ID means the next deploy finds it already kept.
- It loads the new image and tags it if the archive was saved by image ID, then recreates only the web container.
- It waits up to 180 seconds for `HOSTED_DEMO_ENSURED` and `Ready in`, then checks that the container runs the new image and has not restarted.
- It prints only the two readiness lines and never reads the files in `~/build-manager-demo-secrets`.
- It ends with one of these:
  - `REDEPLOY_DONE` and the rollback command
  - `REDEPLOY_UNCHANGED` when the archive holds the running image
  - `REDEPLOY_NOT_READY`, the reason, the rollback command and exit 1. It does not roll back by itself.
  - `REDEPLOY_STOPPED` and the reason. Stops before the load change nothing; later ones leave the running container untouched.
- Each deploy leaves the previous image's archive (about 0.9 GB) in the home folder and the old image in Docker. Keep the archive you may roll back to. When the disk runs low, delete older archives and run `sudo docker image prune`.
- Then run the [checks](#checks).

## Rollback

On the VM, inside the clone:

```bash
bash deploy/vm/redeploy.sh rollback <image-id>
```

It uses the image if it is still loaded and otherwise loads `~/demo-web-<image-id>.tar.gz`. Then it points the `latest` tag at it, recreates only the web container and waits until it is ready, as `deploy` does.

`redeploy.sh deploy` keeps the running image as an archive named after its image ID before it loads a new one. Without the script, keep it yourself (`sudo docker images build-manager-demo-web` shows the ID):

- If the image was loaded from an archive, keep that archive under the new name.
- Otherwise save it: `sudo docker save build-manager-demo-web:latest | gzip -1 > ~/demo-web-<image-id>.tar.gz`.

The steps the rollback runs, for doing them by hand:

```bash
# on the VM, inside the clone
gunzip -c ~/demo-web-<image-id>.tar.gz | sudo docker load
sudo docker tag <image-id> build-manager-demo-web:latest   # also covers an archive saved without the tag
sudo docker compose --env-file "$HOME/build-manager-demo-secrets/compose.env" -f deploy/vm/compose.yml up -d --no-deps --force-recreate web
sudo docker inspect --format '{{.Image}}' vm-web-1   # the archived image ID
sudo docker logs --since 5m vm-web-1                 # Ready, and HOSTED_DEMO_ENSURED from the provisioning check
```

- This procedure does not undo database changes.
  - An older image also logs `migrations current` on a newer schema, so that line does not prove the two fit together.
  - Before rolling back, check that no migration was added between the two images. If one was, that rollback needs its own plan.
- Afterwards, run the [checks](#checks).

Rehearsed on 2026-10-10 with image `f4a98a3fb611` before the PR #106 redeploy, using the manual steps:
- Load, recreate and ready took 161 seconds.
- The live checks passed.
- That archive was saved with the `latest` tag, so the load set the tag and no separate tag step ran.

The script has not run on the VM yet; its first use is the next deploy.

## Checks

Run these after every deploy or rollback, and whenever the demo looks wrong, from a checkout where `npm ci` has run. The browser checks also need Playwright's Chromium once per machine: `npx playwright install chromium`.

```bash
DEMO_ORIGIN=https://<ip-with-dashes>.sslip.io node scripts/demo-smoke.mjs              # HTTP and browser checks
DEMO_ORIGIN=https://<ip-with-dashes>.sslip.io node scripts/demo-smoke.mjs --http-only  # HTTP only
```

- Each check prints one `PASS` or `FAIL` line, and the run ends with `SMOKE PASS` or `SMOKE FAIL`. The address is printed as `<demo>`. Exit 0 means every check passed, 1 means a check failed and 2 means a usage error.
- HTTP checks: the first page, `/core`, `/vendor/job`, one static chunk, `/api/v2/core/access` (401 when signed out), `/demo/landlord` (404), the closed `/_next/image` route and, over HTTPS, a certificate with at least 7 days left.
- Browser checks: both demo entry buttons, then the manager work queue at 1280 px and the tenant repair intake at 390 px, with no 5xx responses or page errors.
- `--expect-text <path> <text>` proves that a release reached the site, for example a chunk file that only the new image has. In Git Bash on Windows, add `MSYS_NO_PATHCONV=1`, or Git Bash rewrites `/_next/...` into a Windows path.
- `--write-check` saves one synthetic repair request on the demo. Use it only right after a deploy.
- `.github/workflows/demo-health.yml` runs the HTTP checks every hour with the repository secret `DEMO_ORIGIN` and retries a failed check once a minute later. If the retry also fails, GitHub notifies the user who last changed its cron line. GitHub turns scheduled workflows off in a public repository after 60 days without activity; turn it back on with `gh workflow enable demo-health.yml`.

## Boundaries

All accounts, buildings and reports are synthetic and anyone can change them. PostgreSQL is published on the VM loopback only. Real login, notifications and real personal or property data are out of scope.
