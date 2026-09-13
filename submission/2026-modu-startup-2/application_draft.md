# Application draft — provisional internal structure

**DRAFT v0.1 / NOT FINAL / NOT SUBMITTED.** Official form fields and limits are **[TO VERIFY]**. The headings below are internal draft sections, not verified official requirements. Personal/team declarations must be completed privately using verified facts.

## 1. 서비스 개요 — [DECISION]

build-manager는 임차인의 모호한 주거 문제를 AI가 대화·사진·영상 등의 입력을 통해 구조화하고, 임대인 또는 임대관리자가 바로 처리할 수 있는 하자·수리 업무로 변환하는 B2B2C 서비스다. 문제 접수부터 처리 결과까지의 흐름을 관리하고, 호실별 유지관리 이력을 축적하는 것을 목표로 한다. 핵심 원칙은 “세입자의 말 한마디를 집주인이 바로 처리할 수 있는 유지관리 업무로 변환한다”이다.

## 2. 해결하려는 문제 — [HYPOTHESIS]

임차인이 증상과 상황을 충분히 설명하기 어렵고, 관리자가 처리에 필요한 정보를 다시 확인해야 하며, 같은 호실의 이전 처리 내용을 찾아보기 어려울 수 있다는 가설에서 출발한다. 실제 발생 빈도와 불편의 크기, 기존 방식으로 잘 해결되는 조건은 임대인·임차인의 최근 사례를 통해 검증할 계획이다. 현재 확보된 인터뷰 결과나 정량 효과를 주장하지 않는다.

## 3. 고객과 사용자 — [DECISION]

초기 고객은 약 10~100호를 관리하는 임대인과 소형·중소 임대관리업체로 설정했다. 주요 사용자는 원룸, 오피스텔, 다가구·다세대 등 임대주택의 임차인이다. 고객의 구매 결정 방식과 지불의사는 아직 검증되지 않았다.

## 4. 초기 MVP — [DECISION]

초기 범위는 AI Guided Issue Intake, AI Triage, Landlord / Manager Dashboard, Property / Unit Maintenance History의 네 기능이다. 임차인의 안전한 관찰 정보를 수집하고 확인 가능한 내용과 불확실한 내용을 구분해 관리 업무로 전달한다. 대시보드는 관리자의 처리와 상태 공유를 지원하고, 호실별 이력은 문제와 처리 결과를 연결하도록 설계한다. 구현 기술과 사진·영상 처리의 정확성·비용은 검증 대상이다.

## 5. AI 안전 경계 — [DECISION]

AI의 역할은 정보수집, 구조화, 문제분류, 위험도 판단, 다음 행동 추천이다. 임대인·임차인의 법적 책임이나 모든 고장의 원인을 확정하지 않으며, 전기·가스·구조안전의 확정 판정과 위험한 DIY 안내를 하지 않는다. 위험 신호는 일반 troubleshooting보다 Safety Gate를 우선하고, 검토된 사람 중심의 대응 경로로 연결하도록 설계한다. 실제 안전 성능을 검증했다는 의미는 아니다.

## 6. 검증과 개발 계획 — [DECISION]

공식 제출 요건을 확인하고, 임대인·임차인의 문제 사례와 반례를 수집하며, 국내 경쟁 서비스와 해외 선례를 원문 근거로 조사한다. 기술적 가능성과 법률·안전 경계를 검토한 뒤 MVP 범위를 확정하고, 가상 데이터 기반 프로토타입과 평가를 거쳐 동의와 운영 준비가 갖춰진 파일럿을 추진한다. 모집·인터뷰·파일럿을 완료했다고 주장하지 않는다.

## 7. 장기 데이터 자산 — [DECISION]

호실 데이터, 하자 데이터, 처리 결과 데이터, 유지관리 이력을 연결하는 것을 지향한다. 정보 수집과 보관은 필요성, 접근 통제, 개인정보 처리 근거와 보관 정책을 먼저 검토해야 한다. 데이터가 이미 확보되었다는 의미는 아니다.

## Evidence and completion gaps

- Market size, price, willingness to pay, interviews, users, and quantified effects: **[TO VERIFY]**; omitted as factual claims.
- Competitor functionality and differentiation: **[TO VERIFY]**; no superiority or uniqueness claim.
- Applicant/team capability, eligibility, official wording/limits, attachments, and actual field-level counts: **[TO VERIFY]**.
- Trace draft statements through [claims checklist](claims_checklist.md); do not promote this file into `final/` until the [final gate](final_gate.md) passes.
