# build-manager

## AI 작업 시작 전

지시서·기획안·분석·산출물을 만들기 전에 [AGENTS.md](AGENTS.md)와 [필수 작성 전 점검 규칙](governance/ai_delivery_rules.md)을 먼저 읽습니다. 사용자가 별도로 전수점검을 요청할 때까지 기다리지 않습니다.

규칙은 `main`, 제품·구현의 기준은 승인된 작업 브랜치에서 확인합니다. 이 governance 안내는 작업 브랜치의 진행 상태나 기존 제품 명세를 변경하지 않습니다.

임차인의 모호한 주거 문제를 AI가 대화·사진·영상 등의 입력을 통해 구조화하고, 임대인 또는 임대관리자가 바로 처리할 수 있는 하자·수리 업무로 변환하여 해결 과정과 호실별 유지관리 이력을 관리하는 B2B2C 서비스.

> 세입자의 말 한마디를 집주인이 바로 처리할 수 있는 유지관리 업무로 변환한다.

**Stage:** problem validation and submission preparation. No deployed product, customer traction, pricing, or measured AI performance is claimed.

- Paying-customer target: landlords managing approximately 10–100 units and small or medium rental-management firms. This is a targeting decision, not verified willingness to pay.
- End users: tenants in studios, officetels, and multifamily rental housing.
- Initial MVP: AI Guided Issue Intake, AI Triage, Landlord / Manager Dashboard, and Property / Unit Maintenance History.
- Long-term data asset: unit data + issue data + treatment outcomes + maintenance history, subject to consent, minimization, and access controls.

Start with [Project Charter](PROJECT_CHARTER.md), [Status](STATUS.md), [contribution workflow](CONTRIBUTING.md), and [operating policy](governance/project_policy.md). Product definitions live in `product/`, evidence in `research/`, and submission drafts in `submission/2026-modu-startup-2/`.

This repository is public. Publish only reviewed, anonymized summaries and original project documents. Never upload contracts, interview recordings, participant identities, credentials, or third-party files without redistribution rights.

No application stack has been selected. Python 3.11+ runs the repository checks: `python scripts/verify_repository.py`. This does not execute package/config files or prove product behavior.
