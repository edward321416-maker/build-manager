# VM redeploy and rollback script acceptance

Snapshot: **2026-10-11 KST**. Repository: `edward321416-maker/build-manager`.

Disposition: **ACCEPTED_FOR_DEVELOPMENT_MAIN**. This PR adds a script, its tests and documentation. Nothing on the VM changes. The script is first used at the next deploy, after the operator confirms right before it runs.

## Authority and refs

| Reference | Value |
| --- | --- |
| Risk tier | High-risk: deployment and infrastructure (DEV-01) |
| Operator decisions | 2026-10-11, in session: "1번 진행하자" (demo operations reliability). The spec was approved with "승인 (추천)": PR A, then PR B, and no automatic rollback (decision D3). |
| Spec and plan | `docs/superpowers/specs/2026-10-11-demo-ops-reliability-design.md` and `docs/superpowers/plans/2026-10-11-demo-ops-reliability.md`, PR B. PR A is #114 (`e9f0e16`). |
| Base | main `e9f0e16` |
| Reviewed candidate | `ceaab20` |
| Independent review | Fresh context, on `0260bd1`: REQUEST_CHANGES (MEDIUM 4, LOW 3, Nit 6), fixed in `4b0d669`. A delta re-review gave APPROVE with three LOWs and three Nits, which were fixed in `ceaab20` and confirmed. |
| PR | #115. The PR records its final head and that head's CI. |

## Change

`deploy/vm/redeploy.sh` runs as the VM user inside the clone. It calls `sudo docker` itself and refuses to run as root.

`deploy <archive> <sha256>`, in order:

1. The checksum must match.
2. The archive must be gzip.
3. The emptier of the home folder and Docker's data folder must have twice the unpacked image plus the archive free.
4. It keeps the running image as `~/demo-web-<id>.tar.gz`, unless a valid archive with that name exists.
5. It loads the new image. Only `build-manager-demo-web:latest`, or an archive saved by image ID (which it tags), is accepted.
6. It recreates only the web container.
7. It waits for `HOSTED_DEMO_ENSURED` and `Ready in`, then checks that the container runs the new image and has not restarted.

`rollback <id>` uses the image if it is still loaded, or else its kept archive. It then tags it, recreates only the web container and waits the same way.

The script never rolls back by itself (decision D3). A failed run prints the reason and the rollback command:

- compose failed
- not ready in time
- runs another image
- restarted

Other behaviour:

- It never reads the env files and prints only the two readiness lines.
- A lock in the home folder allows one run at a time.
- Exit codes: 0 means done or nothing to change, 1 means stopped or not ready, 2 means a usage error.

`deploy/vm/README.md`:

- The new "Update a small VM" section builds elsewhere, names the upload after its image ID and runs `redeploy.sh deploy`.
- Rollback now starts with `redeploy.sh rollback`, and the manual steps stay as the fallback.
- New notes say to run as the VM user inside `tmux`, explain the lock, how long the unpack checks take and when to clean up.

## Threats

| Threat | Control | Evidence |
| --- | --- | --- |
| A tampered or broken archive | The checksum and gzip checks stop the run before any docker call. | Tests for a checksum mismatch and for a non-gzip file with a matching checksum make no docker call. |
| A deploy that cannot be undone | The script keeps or re-saves a valid archive of the running image before loading. A low disk stops it before any change. | Tests: `save` comes before `load`; a broken archive is saved again; the unpacked-size disk test. |
| The wrong image starts, or nothing changes while the output says so | Only the demo's `latest` tag or an image ID is accepted. Readiness needs both log lines, the new image ID and zero restarts. | One test per guard. Removing the readiness, image or restart check, or tagging the wrong name, makes its test fail. |
| A secret printed to the terminal | The env files are passed by path and never read. | Every test checks that two synthetic secrets stay out of the output; making the script print the env file fails at least five tests. |
| Two runs at once, or a run under sudo | A lock directory with `ALREADY_RUNNING`; root is refused. | The lock test confirms a foreign lock is left alone and the script's own lock is removed. The root guard has no unit test. |
| A hang | Whole-number readiness timeout; the test spawn has its own timeout. | A non-numeric wait exits 2. |

## Verification

- RED, then GREEN: 14/14 tests failed before the script existed. In the review rounds, 13 and then 3 new cases failed before their fixes. Now 28/28 pass.
- Mutations: the reviewer's eleven mutations (M1 to M11) each fail their targeted test, and so do mine.
- `bash -n`, the test typecheck and `python scripts/verify_repository.py --history` all exit 0.
- `npm run test:shared` passed 612/612 at `0260bd1`.
- CI: every required check passed on `0260bd1` and `4b0d669`.

## Rollback

- Revert the PR. The VM keeps its own `~/redeploy.sh` and the manual steps in the README, and the running demo is not affected.

## Not verified

- The script has not run against real Docker on the VM. Its first use is the next deploy, with the operator's confirmation right before.
  - The fake docker follows the real output formats: `Loaded image: …`, `Loaded image ID: …` and the "already exists, renaming" line.
- The `RUN_WITHOUT_SUDO` guard has no unit test.
- A stale lock can remain:
  - SIGHUP or SIGTERM, for example from a dropped SSH session, can leave the lock behind. That fails safe, and the README says how to remove it.
