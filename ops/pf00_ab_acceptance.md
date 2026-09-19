# PF00-A/B accepted execution evidence

This sanitized record accepts the supplied PF00-A/B executor evidence. It does not independently rerun A/B or finalize PF00.

## REMOTE_GIT_EVIDENCE

- POLICY_REF and TARGET_REF for this acceptance record: `067985d07b1f3aba69b46374f567545b734d4b64`.
- Remote `main` was fetched and verified at that exact SHA before this work.
- [PR #22](https://github.com/edward321416-maker/build-manager/pull/22) is merged. Its final head was `cc9f1ca0005e38c5554c5b53a03496f0ef6c5f93`; its merge commit is `067985d07b1f3aba69b46374f567545b734d4b64`.
- `PF00_EXECUTION_BASELINE=067985d07b1f3aba69b46374f567545b734d4b64`.
- Earlier uncommitted A/B ops rows remain preserved in the operator's previous checkout. They are local evidence, not rows already published on this baseline.

## EXECUTOR_RUNTIME_EVIDENCE

Accepted runtime: **Node v24.21.0 / bundled npm 11.19.0**. Private official-distribution toolchains were used without replacing the global installation.

| Lane | Environment | npm ci | build:web | check:deps | Tracked diff |
| --- | --- | --- | --- | --- | --- |
| Windows | Windows 11 x64 | exit 0 | exit 0 | exit 0 | 0 |
| Linux | Ubuntu 26.04 WSL2 x64; Linux Node binary and Linux-linked npm verified | exit 0 | exit 0 | exit 0 | 0 |

Both lanes used the exact execution baseline and unchanged package-lock SHA-256 `26da4247e31862b604a69599bb78bb410a67b569c1d2f89fa7370aec45056f34`.

PF00-A executor outcome: `PF00_A_VERIFIED`.

PF00-B used three independent, previously absent Jest caches per lane, with one immediate warm comparison per cache. The original results were retained.

| Lane | Cold seconds (all PASS) | Warm seconds (all PASS) |
| --- | --- | --- |
| Windows | 18.548 / 18.224 / 18.183 | 7.346 / 7.698 / 6.948 |
| Linux | 18.905 / 11.178 / 10.397 | 3.205 / 3.020 / 2.995 |

Each of the twelve runs reported **13 suites, 133 tests, 0 failures, 0 skipped, 0 todo**.

- PF00-B: `NOT_REPRODUCED_AT_SELECTED_TOOLCHAIN`.
- ROOT_CAUSE_STATUS: `NOT_ESTABLISHED`.
- TIMEOUT_CHANGE: `NONE`.

## NOT_INDEPENDENTLY_RERUN

The prior private receipt was readable and inspected read-only when preparing this record. All 48 entries in its artifact checksum manifest matched. This validates receipt integrity; it is not a new independent execution of the recorded install, build, dependency, or Mobile commands. Runtime and timing claims above remain accepted executor evidence.

## OPEN_LIMITATIONS

- Raw receipts, command logs, and cache locations remain private/local evidence. Absolute local paths are intentionally excluded.
- These Windows and WSL2 results are **not GitHub-hosted runner evidence**. In particular, the Linux lane was not an `ubuntu-24.04` hosted runner.
- No Jest timeout or configuration change was justified. Cold/warm timing differences do not establish a root cause.
- PF00-C was `NOT_RUN` at A/B acceptance. Subsequent PR checks provide separate CI evidence.
- PF00 as a whole was not complete. PF00-D publication/freeze is not authorized in this run; PF01 remains `REVIEW_DRAFT`, and PF02 remains `NOT_AUTHORIZED`.
- Google Sheets/Drive synchronization remains `PENDING`; the existing [pending queue](pending_external_sync.md) covers the acceptance log event.
