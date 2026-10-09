# Security policy

build-manager is an early-stage public project. Its only running instance is a hosted demo that uses synthetic data. We still want to hear about every vulnerability, and we handle every report privately.

## Report a vulnerability

Please report privately. Do not open a public issue, pull request or discussion about a vulnerability.

1. Open this repository's **Security** tab.
2. Choose **Report a vulnerability**. This uses GitHub private vulnerability reporting.
3. Describe the problem:
   - the affected component or path
   - steps to reproduce
   - the impact you observed
   - a suggested fix, if you have one

The report becomes a private draft security advisory. Only the maintainers and you can see it.

## What to expect

- We aim to acknowledge a report within 7 days.
- We will tell you whether we can reproduce it and how we plan to fix it. Updates go in the advisory.
- Please give us reasonable time to release a fix before any public disclosure. We agree the disclosure date with you in the advisory.
- With your permission, we credit you in the advisory.

## Scope

We support the latest `main` branch and the hosted synthetic demo. There are no versioned releases, so older commits are not maintained.

In scope:

- Code in this repository: `apps/web`, `apps/mobile`, `packages/*`, `scripts/`, `deploy/`, `.github/workflows/` and `.claude/hooks/`.
- The hosted demo. Examples: access-control flaws, injection, or ways to reach data that should not be reachable.
- Secrets or personal data accidentally committed to this public repository.

Out of scope:

- Denial-of-service or load tests against the demo, and automated high-volume scanning.
- Social engineering, phishing and physical attacks.
- Vulnerabilities in third-party platforms we use, such as GitHub, the cloud host or npm packages. Report those to their owners. If our configuration makes such a problem exploitable here, tell us.
- Reports from automated scanners that do not show an impact.

## Testing rules

- Use only the synthetic demo data. Do not try to access, change or delete data that belongs to other users of the demo.
- If you find you can reach data you should not, stop and report it. Do not keep collecting it.
- Do not run destructive tests or tests that degrade the demo for others.

## 한국어 안내

취약점은 공개 이슈로 올리지 마세요. 이 저장소 Security 탭의 **Report a vulnerability**(GitHub 비공개 취약점 신고)로 알려 주세요.

- 신고는 운영자와 신고자만 볼 수 있는 비공개 보안 권고 초안(draft advisory)으로 접수됩니다.
- 7일 안에 접수를 확인하는 것을 목표로 합니다. 수정이 나오기 전까지는 공개를 미뤄 주세요.
- 대상은 최신 `main`과 합성 데이터만 쓰는 데모입니다.
- 데모에 부하를 주는 시험, 다른 사용자 데이터에 대한 접근, 사회공학은 하지 마세요.
