# Security policy

build-manager is an early-stage public project run by one operator. Its only running instance is a hosted demo that uses synthetic data. We still want to hear about every vulnerability, and we handle every report privately.

## Supported versions

We support the latest `main` branch and the hosted synthetic demo. There are no versioned releases, so older commits are not maintained.

## Reporting a vulnerability

Report privately at <https://github.com/edward321416-maker/build-manager/security/advisories/new>. This uses GitHub private vulnerability reporting, and you can also reach it from the **Security** tab via **Report a vulnerability**. Do not report, discuss or describe a vulnerability in a public issue, pull request or discussion.

Please include:

- a short description of the problem and where it is (component, file or URL path)
- steps to reproduce or a minimal proof of concept
- the commit or date you tested against
- the impact you observed
- a suggested fix, if you have one

If you used AI tools to find or write up the issue, say which ones, and confirm that you reproduced the issue yourself. Reports that look like unverified AI output may be closed without further response.

The report becomes a private draft security advisory. Only the maintainers and you can see it.

## What to expect

- We aim to acknowledge a report within 7 days. That is longer than larger teams promise, because one operator reads the reports.
- We tell you whether we can reproduce the issue and how we plan to fix it. Updates go in the advisory.
- This project follows a 90-day disclosure timeline. We aim to fix and publish the advisory within 90 days of the report, and we agree the disclosure date with you in the advisory. Please do not disclose before that date.
- With your permission, we credit you in the advisory.
- We do not operate a bug bounty program.

## Threat model

A report counts as a vulnerability in build-manager only if it does not first require compromising something we trust.

We do not trust:

- any request that reaches the hosted demo, or another deployment, over the network
- content submitted by tenants, managers or vendors, including text, photos and links
- data returned by third-party services

We trust:

- the people who operate and deploy build-manager, and their machines and CI
- the configuration and secrets they set
- dependencies installed from the lockfile. Report a flaw in a dependency to its maintainers, and tell us if our use of it makes the flaw exploitable here.

Examples of vulnerabilities:

- reading or changing another organization's tickets, units or photos
- bypassing role checks, for example a tenant performing a manager action
- using a vendor handoff link outside the access it was issued for
- injection such as SQL injection or cross-site scripting
- secrets or personal data committed to this public repository

Not vulnerabilities:

- changing synthetic data through the demo's login-free entry. Anyone may change demo data by design.
- the demo having no real login. It uses a synthetic identity provider by design.
- denial of service, load or availability problems of the demo
- missing security headers or other findings without a demonstrated impact
- issues that require a compromised operator machine, CI or cloud account

## Testing rules

- Use only the synthetic demo data. Do not try to access, change or delete data that belongs to other users of the demo.
- If you find you can reach data you should not, stop and report it. Do not keep collecting it.
- Do not run destructive tests, automated high-volume scans or tests that degrade the demo for others.
- Do not use social engineering, phishing or physical attacks.

## 한국어 안내

취약점은 공개 이슈로 올리지 마세요. <https://github.com/edward321416-maker/build-manager/security/advisories/new>(GitHub 비공개 취약점 신고)로 알려 주세요.

- **접수**: 신고는 운영자와 신고자만 볼 수 있는 비공개 보안 권고 초안(draft advisory)으로 접수됩니다.
- **응답**: 7일 안에 접수를 확인하는 것을 목표로 합니다. 신고 후 90일 안에 수정과 공개를 목표로 하며, 공개일은 신고자와 함께 정합니다.
- **신고 내용**: AI 도구를 썼다면 어떤 도구인지 밝히고, 직접 재현했는지 확인해 주세요. 포상금 제도는 없습니다.
- **대상**: 최신 `main`과 합성 데이터만 쓰는 데모입니다. 데모에서 누구나 합성 데이터를 바꿀 수 있는 것과 실제 로그인이 없는 것은 의도된 동작입니다.
- **금지**: 데모에 부하를 주는 시험, 다른 사용자 데이터에 대한 접근, 사회공학은 하지 마세요.
