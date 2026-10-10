# Security policy

build-manager is an early-stage public project run by one operator. Its only running instance is a hosted demo that uses synthetic data. We still want to hear about every vulnerability, and we handle every report privately.

## Supported versions

We support the latest `main` branch and the hosted synthetic demo. There are no versioned releases, so older commits are not maintained.

## Reporting a vulnerability

Report privately at <https://github.com/edward321416-maker/build-manager/security/advisories/new>.

- This uses GitHub private vulnerability reporting and needs a GitHub account.
- The same form opens from the **Report a vulnerability** button on the repository's security page.
- Do not report, discuss or describe a vulnerability in a public issue, pull request or discussion.

Please include:

- a short description of the problem and where it is (component, file or URL path)
- steps to reproduce or a minimal proof of concept
- the commit or date you tested against
- the impact you observed
- a suggested fix, if you have one

If you used AI tools to find or write up the issue, say which ones and confirm that you reproduced it yourself. Reports that look like unverified AI output may be closed without further response.

The report becomes a private draft security advisory. Only the maintainers and you can see it.

## What to expect

- We aim to acknowledge a report within 7 days. That is longer than larger teams promise, because one operator reads the reports.
- For accepted reports, we tell you whether we can reproduce the issue and how we plan to fix it. Updates go in the advisory.
- We aim to fix the issue and publish the advisory within 90 days of the report.
  - We agree the disclosure date with you in the advisory. If we cannot agree on one, the advisory is published at day 90.
  - Please do not disclose before that date.
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
- dependencies installed from the lockfile. Report a flaw in a dependency to its maintainers. Tell us if our use of it makes the flaw exploitable here.

Examples of vulnerabilities:

- reading or changing another organization's tickets, units or photos
- bypassing role checks, for example a tenant performing a manager action
- using a vendor handoff link outside the access it was issued for
- injection such as SQL injection or cross-site scripting
- secrets or personal data committed to this public repository

Not vulnerabilities:

- changing synthetic data through the demo's login-free entry. Visitors share the synthetic accounts, so anyone may change demo data by design.
- the demo having no real login. It uses a synthetic identity provider by design.
- denial of service, load or availability problems of the demo
- missing security headers or other findings without a demonstrated impact
- issues that require a compromised operator machine, CI or cloud account
- vulnerabilities in third-party platforms we use, such as GitHub, the cloud host or npm packages. Report those to their owners.

## Testing rules

- Use only the hosted demo and its synthetic data. Visitors share the same synthetic accounts, so changing demo data through normal use is fine.
- If the demo lets you see or change another synthetic organization's data, touch only as much as you need to prove the access. Then stop and report.
- If you ever reach data that is not synthetic, stop at once and report it. Do not keep collecting it.
- Do not run destructive tests, automated high-volume scans or tests that degrade the demo for others.
- Do not use social engineering, phishing or physical attacks.

## 한국어 안내

- **신고 방법**
  - 취약점은 공개 이슈, PR, 토론에 올리거나 설명하지 마세요.
  - <https://github.com/edward321416-maker/build-manager/security/advisories/new>(GitHub 비공개 취약점 신고, GitHub 계정 필요)로 알려 주세요.
- **신고 내용**
  - 적어 주실 것: 문제와 위치, 재현 절차, 테스트한 커밋이나 날짜, 확인한 영향, 가능하면 수정 제안
  - AI 도구를 썼다면 어떤 도구인지 밝히고, 직접 재현했는지 확인해 주세요. 검증되지 않은 AI 출력으로 보이는 신고는 답변 없이 닫힐 수 있습니다.
- **접수와 응답**
  - 신고는 운영자와 신고자만 볼 수 있는 비공개 보안 권고 초안(draft advisory)으로 접수됩니다.
  - 1인 운영이라 7일 안에 접수를 확인하는 것을 목표로 합니다.
  - 받아들인 신고는 재현 여부와 수정 계획을 권고 안에서 알려 드립니다.
- **공개**
  - 신고 후 90일 안에 수정과 공개를 목표로 합니다.
  - 공개일은 신고자와 함께 정하고, 정하지 못하면 90일째에 공개합니다. 그 전에는 공개하지 마세요.
  - 원하시면 권고에 신고자 이름을 올립니다. 포상금 제도는 없습니다.
- **대상**
  - 최신 `main`과 합성 데이터만 쓰는 데모입니다.
  - 방문자가 합성 계정을 함께 쓰기 때문에 누구나 데모 데이터를 바꿀 수 있습니다. 이것과 실제 로그인이 없는 것은 의도된 동작입니다.
- **범위 밖**
  - 데모의 서비스 거부·부하·가용성 문제
  - 영향이 증명되지 않은 결과(보안 헤더 누락 등)
  - 운영자 PC·CI·클라우드 계정이 먼저 뚫려야 하는 문제
  - 우리가 쓰는 제3자 플랫폼 자체의 취약점(해당 업체에 신고해 주세요)
- **시험 규칙**
  - 다른 합성 조직의 데이터에 접근할 수 있다면, 증명에 필요한 만큼만 다루고 멈춘 뒤 신고하세요.
  - 합성이 아닌 데이터에 닿으면 즉시 멈추고 신고하세요.
  - 파괴적 시험, 대량 자동 스캔, 데모를 느리게 만드는 시험, 사회공학·피싱·물리적 공격은 하지 마세요.
