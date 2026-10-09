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

`sudo docker build` refreshes the image; existing values and the database volume are kept. Logs: `sudo docker compose -f deploy/vm/compose.yml logs -f web`.

## Boundaries

All accounts, buildings and reports are synthetic and anyone can change them. PostgreSQL is published on the VM loopback only. Real login, notifications and real personal or property data are out of scope.
