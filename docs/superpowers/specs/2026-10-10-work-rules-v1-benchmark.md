# 작업 규칙 v1 — 외부 기준 비교 점검

날짜: 2026-10-10 (Asia/Seoul). 기준: main `f73e3c32d3fb39ade98d02d9fedfb27b01525c01`. 작성: Claude Code 세션. 검토: 운영자 검토 전. 성격: 설계 근거 문서이며 제품·시장 근거가 아니다.

## 왜 했나

- [DECISION] 2026-10-10 운영자: "개발자들이 진행할 때 사용하는 규칙들이랑 비교 분석 전수점검을 진행해서 부족한 부분들을 개선해주고 추가할 내용 추가해줘".
- 점검 대상은 [작업 규칙 v1 설계](2026-10-10-work-rules-v1-design.md)의 초안이다. 초안은 개발·연구·레퍼런스 규칙집과 "읽기 전 편집 차단" 게이트로 이루어져 있었다.

## 방법과 한계

- 네 갈래로 비교했다. AG는 AI 에이전트 규칙 파일, DV는 개발, RS는 연구, RF는 레퍼런스다. IN은 저장소 내부 일관성 점검이다.
- 공식 문서·표준·저자 원문(1차)을 먼저 봤다. 법령은 국가법령정보센터 페이지가 자동 조회되지 않았다. 그래서 법령 미러, 법무법인 자료, 언론 보도(2차)로 확인했고 출처표에 2차로 표시했다.
- 판정 기준: **충족** · **부분** · **부족** · **의도적 차이**.
- 이 문서는 법률 자문이 아니다. 해석이 필요한 법령 항목은 [TO VERIFY]로 남긴다.

## AG. AI 에이전트 규칙 파일 관행

| # | 외부 기준 | 출처 | 초안 | 판정 | 설계 반영 |
| --- | --- | --- | --- | --- | --- |
| AG1 | 지시 파일은 강제가 아니라 문맥이다. 반드시 막아야 하는 행동은 PreToolUse hook으로 막는다. | S01, S03 | 읽기 전 편집 차단 hook | 충족 | 유지 |
| AG2 | 항상 읽히는 지시는 짧게 쓴다. CLAUDE.md는 200줄 이하, Copilot 지시는 2쪽 이하다. 길수록 준수율이 떨어진다. | S01, S03, S06 | 길이 기준 없음 | 부족 | 규칙집 본문 목표는 250줄 이하다. 한 번의 Read로 전체가 읽히도록 크기 상한을 테스트로 고정한다. |
| AG3 | 코드에서 알 수 있는 것과 일반 상식은 빼고, 추측할 수 없는 명령·관례·함정만 쓴다. | S03 | 일반론이 섞일 위험 | 부분 | 작성 기준을 "이 줄을 지우면 실수가 생기는가"로 정한다. |
| AG4 | 강조(IMPORTANT)는 꼭 필요한 한두 줄에만 쓴다. | S03 | 기준 없음 | 부족 | 문서당 강조는 최대 2개 |
| AG5 | 지시끼리 모순되면 모델이 임의로 하나를 따른다. 그러니 주기적으로 점검한다. | S01 | 변경 절차만 있음 | 부분 | 우선순위 목록과 주제별 소유 표를 둔다. 같은 내용은 한 곳에만 쓴다. |
| AG6 | 경로별 규칙(`paths`·`globs`·`applyTo`)은 필요한 파일에서만 적용한다. | S01, S06, S07 | 게이트 설정의 경로 패턴 | 충족 | 유지. `.claude/rules/` 자동 로드는 차단이 아니고 본문 중복이 생기므로 쓰지 않는다. |
| AG7 | CLAUDE.md가 있으면 Claude Code는 AGENTS.md를 자동으로 읽지 않는다. | S01 | 안내를 AGENTS.md 중심으로 | 부족 | CLAUDE.md에도 같은 작업별 규칙 표를 둔다. |
| AG8 | Codex는 루트부터 작업 폴더까지의 AGENTS.md를 합쳐 32 KiB까지만 읽는다. | S05 | 표 추가 | 부분 | AGENTS.md에는 포인터만 두고 규칙 본문은 복사하지 않는다. |
| AG9 | 하위 폴더 AGENTS.md는 가까운 것이 우선한다. | S04, S06 | — | 의도적 차이 | 하위 폴더 지시 파일을 만들지 않는다. 루트 규칙이 가려질 수 있기 때문이다. |
| AG10 | 규칙이 행동을 실제로 바꾸는지 관찰로 시험한다. | S03 | 새 세션 실측 | 충족 | 규칙 파일이 바뀐 뒤 다시 차단되는지도 실측한다. |
| AG11 | 프로젝트 hook은 작업 공간 신뢰가 필요하고, 사용자 hook은 항상 실행된다. worktree에 들어가면 hook 입력의 `cwd`가 worktree 루트가 된다. | S02 | 두 곳에 등록 | 충족 | 문서화한다. |
| AG12 | 실행 가능한 검증 수단과 실행 증거를 남긴다. | S03 | ai_delivery_rules R06·R09 | 충족 | 링크만 건다. |
| AG13 | 한 문장으로 설명되는 작은 수정은 계획 없이 바로 한다. | S03 | 위험도 분류 | 부분 | 일반 등급에서 계획 문서를 생략할 수 있는 조건을 명시한다. |
| AG14 | 리뷰어에게 정확성과 요구사항 위반만 지적하게 해야 과잉 설계를 막을 수 있다. | S03 | 짧은 리뷰 1회 | 부분 | 리뷰 기준 문장을 추가한다. 나머지는 Nit로 표시하고 진행을 막지 않는다. |

## DV. 개발

| # | 외부 기준 | 출처 | 초안 | 판정 | 설계 반영 |
| --- | --- | --- | --- | --- | --- |
| DV1 | 변경 하나에 목적 하나. 100줄 안팎이 적당하고 1000줄은 대개 과하다. 리팩터링은 따로 하고 테스트는 같이 넣으며 빌드를 깨지 않는다. | S09 | 없음 | 부족 | DEV-02 작업 크기 |
| DV2 | 코드 건강을 확실히 개선하면 승인한다. 사소한 의견은 Nit로 남긴다. 사실과 데이터가 의견보다 우선한다. | S08 | 짧은 리뷰 | 부분 | DEV-03 리뷰 기준 |
| DV3 | 단기 브랜치는 이틀 안에 병합한다. | S10 | 없음 | 부족 | DEV-02 (목표치이며 차단 조건은 아님) |
| DV4 | 병합 전에 CI와 자동 테스트를 돌린다. | S14, S17 | 있음 | 충족 | 유지 |
| DV5 | 브랜치 보호와 사람의 리뷰를 필수로 한다. | S14 | 승인 0명(운영자 결정) | 의도적 차이 | 정책은 유지한다. 고위험 작업만 독립 리뷰를 기록한다. |
| DV6 | 의존성을 고정하고, 자동 업데이트 도구를 쓰고, 알려진 취약점을 점검한다(공급망 실패 = OWASP A03). | S11, S14 | 고정만 있음 | 부족 | DEV-10에 정기 취약점 점검과 대응 기준을 넣는다. 자동 업데이트 도구 도입은 후속 결정으로 둔다. |
| DV7 | 워크플로 토큰은 최소 권한으로 주고, 위험한 트리거를 쓰지 않으며, 액션을 고정한다. | S14 | 현행 워크플로는 충족, 명문화는 없음 | 부분 | DEV-10에 새 워크플로 기준으로 명문화 |
| DV8 | 취약점 신고 정책, 저장소 라이선스, 정적 분석을 둔다. | S14 | 없음 | 부족 | 후속 결정 목록. 공개 저장소인데 LICENSE와 SECURITY.md가 없다. |
| DV9 | 보안 요구를 정의하고, 설계를 검토하고, 기본값을 안전하게 둔다. | S13 PO.1·PW.1·PW.2·PW.9 | 고위험 스펙 승인 | 부분 | 고위험 스펙에 위협·남용 사례와 롤백 계획을 필수로 넣는다. |
| DV10 | 취약점을 확인하고, 우선순위를 정해 고치고, 근본원인을 분석한다. | S13 RV.1–RV.3 | 없음 | 부족 | DEV-13 사고·취약점 대응 |
| DV11 | OWASP Top 10:2025의 접근통제, 보안 설정, 공급망, 인젝션, 인증, 로깅·경보, 예외 처리 항목 | S11 | 권한·비밀만 있음 | 부분 | DEV-09를 Top 10 대응표로 만든다. |
| DV12 | 로그에 세션 ID, 토큰, 비밀번호, 연결 문자열, 키, 민감한 개인정보를 남기지 않는다. | S12 | 없음 | 부족 | DEV-09 로그 금지 목록 |
| DV13 | 설정은 환경변수에 두고, 빌드와 실행을 분리하고, 개발·운영 환경을 비슷하게 유지하고, 로그는 이벤트 스트림으로 다룬다. | S18 | 비밀만 저장소 밖에 둠 | 부분 | DEV-12 |
| DV14 | 호환되지 않는 변경은 확장 → 이전 → 축소 3단계로 한다. | S16, S17 | 추가만 허용, 병합 후 수정 금지 | 부분 | DEV-08 |
| DV15 | 배포 자동화와 롤백, 모니터링과 장애 알림을 갖춘다. | S17 | 수동 VM 절차 | 부분 | DEV-12에 롤백 확인을 넣는다. 모니터링은 실서비스 전 필수 항목(후속)으로 둔다. |
| DV16 | 사용자 영향이나 데이터 손실이 생기면 비난 없는 사후 기록(영향·조치·근본원인·재발 방지)을 남긴다. | S19 | 없음 | 부족 | DEV-13 |
| DV17 | 되돌리기 어려운 결정은 맥락·결정·결과로 기록한다(ADR). | S20 | 스펙의 결정 절 | 부분 | DEV-14에서 형식을 지정한다. |
| DV18 | 테스트 데이터를 관리한다. | S17 | 합성 fixture | 충족 | 유지 |

## RS. 연구

| # | 외부 기준 | 출처 | 초안 | 판정 | 설계 반영 |
| --- | --- | --- | --- | --- | --- |
| RS1 | 출처를 확인하는 4단계(SIFT): 멈추기, 출처 조사, 더 나은 보도 찾기, 원문 추적 | S21 | 원문 확인 후 FACT 승격 | 부분 | RES-03에 원문 추적 단계를 넣는다. |
| RS2 | 인터뷰 원칙: 목표와 가이드를 먼저 정하고 파일럿을 한다. 유도 질문을 하지 않고 과거의 구체적 사건을 묻는다. 인터뷰는 보고된 행동일 뿐이라는 한계가 있다. | S22 | 가이드 존재 | 부분 | RES-07 질문 원칙 |
| RS3 | 경쟁 정보를 모을 때 신원과 소속을 밝힌다(위장 금지). | S23 | 없음 | 부족 | RES-05 경쟁 조사 윤리 |
| RS4 | 동의를 받을 때 목적·항목·보유기간·거부권과 거부 시 불이익을 알린다. 필요 없어지면 지체 없이, 복구할 수 없게 파기한다. | S24, S33 | 동의 범위만 언급 | 부분 | RES-07 동의서 4항목과 파기, DEV-11 |
| RS5 | 접근 권한 없이 데이터를 취득하거나 쓰는 것은 부정경쟁행위다. | S26 (카)목 | 없음 | 부족 | RES-05 |
| RS6 | 자동 수집(크롤링)이 정보통신망법, DB 제작자 권리, 업무방해 문제로 다퉈진 대법원 사건이 있다. | S28 | 없음 | 부족 | RES-05: 운영자 결정을 거치고 약관과 robots 규칙을 확인한다. |
| RS7 | AI가 작성한 연구는 작성자와 사람 검토 상태를 밝힌다. | 저장소 사례(2026-10-08 노트) | 없음 | 부족 | RES-06 |
| RS8 | 연구 질문과 연구가 도울 결정을 먼저 정한다. | S22 | RES-01 | 충족 | 유지 |
| RS9 | 반증과 한계를 적고, 관찰과 해석을 분리한다. | research/README.md | 있음 | 충족 | 그대로 옮긴다. |

## RF. 레퍼런스

| # | 외부 기준 | 출처 | 초안 | 판정 | 설계 반영 |
| --- | --- | --- | --- | --- | --- |
| RF1 | 인용은 보도·비평·교육·연구를 위해 정당한 범위에서 공정한 관행에 맞게 해야 한다. 인용한 부분은 보조 역할이어야 하고, 영리 목적이면 허용 범위가 더 좁다. | S25 | "짧게"라고만 씀 | 부분 | REF-05 |
| RF2 | 출처는 이용 상황에 맞는 합리적 방법으로 밝히고, 저작자의 실명이나 이명을 함께 적는다. | S25 | 기록 규칙 | 충족 | REF-05를 강화한다. |
| RF3 | 널리 알려진 표지와 혼동시키기, 상품 형태 모방, 남의 상당한 투자·노력으로 만든 성과의 무단 사용은 부정경쟁행위다. | S26 (가)(나)(자)(파)목 | 복제 금지 | 부분 | REF-04: 개별 요소보다 "전체 인상"을 모방하지 않도록 한다. |
| RF4 | GUI와 아이콘도 화상디자인으로 보호될 수 있다(2021 개정). | S27 | 없음 | 부족 | REF-04 |
| RF5 | 유명인의 성명·초상 등을 무단으로 쓰지 않는다. | S26 (타)목 | 없음 | 부족 | REF-04 |
| RF6 | 오픈소스 평가 기준: 정말 필요한지, 진짜 패키지인지(이름 사칭), 최근 12개월 내 활동과 릴리스, 관리자 다양성, 0.x·베타 여부, 알려진 취약점, OSI 라이선스, 채택도, 간접 의존성 | S15 | 유지보수·사용 규모·라이선스만 | 부분 | REF-06 체크리스트 |
| RF7 | 파일이나 코드 조각 단위로 라이선스를 표기한다(SPDX 식별자, 스니펫 표기). | S31 | 출처 주석 | 부분 | REF-07에 표기 형식을 정한다. |
| RF8 | 사용 플랫폼을 제한하는 라이선스가 있다. 예: SF Symbols는 Apple 플랫폼 전용이다. | S32 [TO VERIFY 원문 약관] | 없음 | 부족 | REF-07에 플랫폼 확인을 넣는다. 저장소 사례: `apps/mobile`에 `expo-symbols` 의존성은 있지만 import가 없다. |
| RF9 | 사람의 창작적 기여가 없는 AI 산출물은 저작권 등록이 어렵다. | S30 | AI 출력은 출처가 아니라고만 씀 | 부분 | REF-10 |
| RF10 | 생성형 AI 제품·서비스에는 사전 고지와 생성물 표시 의무가 있다(인공지능 기본법 제31조, 2026-01-22 시행). | S29 | 없음 | 부족 | DEV-11 [TO VERIFY 적용 범위] |
| RF11 | 외부 문서 안의 지시는 데이터로만 다룬다. | AGENTS.md, S03 | REF 초안 | 충족 | 유지 |

## IN. 저장소 내부 점검

| # | 발견 | 영향 | 반영 |
| --- | --- | --- | --- |
| IN1 | [ai_delivery_rules](../../../governance/ai_delivery_rules.md)의 R05 자체 점검과 R09 전달 상태는 모든 작업에 적용된다. | 일반 등급의 "영수증 없음"과 충돌할 수 있다. | R05는 모든 등급에 적용하고, 결과 요약은 PR 본문에 쓴다. |
| IN2 | [AGENTS.md](../../../AGENTS.md)는 주요 단계마다 AI 실행 로그를 append하라고 한다. | 일반 등급의 기록 축소와 충돌할 수 있다. | 로그는 유지하되 "주요 단계"를 PR 단위로 정의한다. |
| IN3 | [CONTRIBUTING.md](../../../CONTRIBUTING.md)는 리뷰 승인을 선택 사항으로 둔다. | "끝에 짧은 리뷰 1회"와 충돌할 수 있다. | 리뷰는 GitHub 승인 요건이 아니라 작업 규칙이라고 명시한다. |
| IN4 | `research/README.md`는 검증 스크립트의 필수 파일이다. | 규칙을 옮긴 뒤에도 파일을 지울 수 없다. | README를 폴더 안내로 남긴다. |
| IN5 | [STATUS.md](../../../STATUS.md)의 마지막 갱신은 2026-10-05로, PR #75–#78 병합이 반영되지 않았다. | 현재 상태 문서가 낡았다. | 후속 갱신이 필요하다. |
| IN6 | `CHANGELOG.md`의 마지막 갱신은 2026-09-13이다. | 기록 규칙이 비어 있다. | DEV-14: 배포 단위로 한 줄씩 쓴다. |
| IN7 | PR 템플릿에 위험 등급 항목이 없다. | DEV-01 등급 기록이 누락될 수 있다. | 템플릿에 등급 줄을 추가한다. |
| IN8 | 바깥 폴더의 main 체크아웃이 `e8a2b82`에 멈춰 있고 커밋하지 않은 로그 변경이 있다. | 그 폴더에서 시작한 세션은 새 안내를 자동으로 읽지 못한다. | 후속 결정 |
| IN9 | 2026-10-08 국내 경쟁 조사 노트 2건이 바깥 폴더에 미추적 상태로 있다. | RES-09 적용 대상이다. | 후속 결정 |
| IN10 | 디자인 규칙 v1(PR #79)이 410줄, 27 KB다. | 한 번의 Read로 읽힌다. | 크기 상한 테스트에 포함한다. |

## 설계 반영 요약

- **추가된 규칙**
  - 개발: DEV-02 작업 크기, DEV-09 Top 10 대응표와 로그 금지 목록, DEV-10 공급망, DEV-11 개인정보·AI 기능, DEV-12 설정·롤백, DEV-13 사고·취약점, DEV-14 결정 기록 형식
  - 연구: RES-03 원문 추적, RES-05 윤리·데이터·크롤링, RES-06 AI 작성 표시, RES-07 질문 원칙과 동의 4항목
  - 레퍼런스: REF-04 전체 인상·화상디자인·유명인, REF-05 인용, REF-06 오픈소스 평가, REF-07 표기·플랫폼 제한, REF-10 AI 산출물
- **형식**: 길이 목표와 크기 상한, 강조 제한, 우선순위와 소유 표, CLAUDE.md에도 작업별 규칙 표
- **게이트**: 크기 상한 테스트, 규칙 파일이 없으면 해당 규칙을 건너뜀, 셸 명령으로 우회 편집하지 않는다는 서면 규칙
- **후속 결정 목록**: LICENSE, SECURITY.md, 자동 업데이트·정적 분석, `expo-symbols` 정리, STATUS 갱신, 바깥 체크아웃, 미추적 연구 노트, AI 기본법 적용 확인

## 최종 점검 (2026-10-10)

운영자가 "최종점검하고 통과하면 승인할게"라고 해서, 문서의 사실을 근거 자료와 저장소에 다시 대조하고 기존 규칙과의 충돌을 확인했다. 근거와 어긋난 사실은 없었다. 다음 9건은 설계에 반영했다.

1. OWASP 대응표에 A04·A06·A08이 빠져 있었다. 10개 항목을 모두 채웠고, A09에는 보안 이벤트 기록을 더했다.
2. DEV-06이 문서만 바꾼 PR에도 앱 전체 검사를 요구하는 것처럼 읽혔다. ai_delivery_rules R06과 충돌하므로 바꾼 영역 기준으로 고쳤고, scanner 테스트를 추가했다.
3. AI 기능 전체를 고위험으로 분류하면 핵심 제품 작업 대부분이 고위험이 된다. AI의 판단·문구·프롬프트·안전 게이트를 바꾸는 작업으로 좁혔다.
4. 라이브러리는 보통 `npm install`로 추가되므로 `package.json` 편집만 확인하는 게이트로는 REF-06이 강제되지 않는다. 패키지 추가 명령도 확인하도록 보강했다.
5. REF-04의 전체 인상 모방 금지가 디자인 규칙의 브랜드 파랑 결정을 뒤집지 않는다는 점을 명시했다.
6. 개인정보 보호법 제21조 조문(S33)을 확인하고, 복구할 수 없게 파기한다는 요건과 분리 보관 요건을 넣었다.
7. 출처 등급에 동료 심사 학술 논문을 넣었다.
8. 문서만 바꾼 PR은 squash로 병합해도 된다는 현행 관행을 명시했다.
9. AGENTS.md의 "evidence policy" 링크를 PR-2에서 바꾸고, 그 사이에는 README가 안내한다고 정했다.

다시 확인한 사실은 다음과 같다.

- 두 워크플로 모두 `permissions: contents: read`를 쓰고 액션을 SHA로 고정한다. `pull_request_target`은 쓰지 않는다.
- `tests/test_verify_repository.py`가 있다.
- 디자인 규칙 §1의 차용 원칙과 REF-04가 일치한다.
- PR #79는 아직 병합되지 않았다(확인 시점 기준).

## 출처

확인일은 모두 2026-10-10이다. 등급은 1차(공식 문서·표준·저자 원문)와 2차(미러·해설·보도)로 나눴다.

| ID | 자료 | 등급 | 위치 |
| --- | --- | --- | --- |
| S01 | Claude Code 문서 — How Claude remembers your project | 1차 | <https://code.claude.com/docs/en/memory> |
| S02 | Claude Code 문서 — Hooks reference | 1차 | <https://code.claude.com/docs/en/hooks> |
| S03 | Claude Code 문서 — Best practices | 1차 | <https://code.claude.com/docs/en/best-practices> |
| S04 | AGENTS.md 형식 소개 | 1차 | <https://agents.md/> |
| S05 | OpenAI Codex — AGENTS.md 안내 | 1차 | <https://learn.chatgpt.com/docs/agent-configuration/agents-md> |
| S06 | GitHub Docs — Copilot 저장소 맞춤 지시 | 1차 | <https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions> |
| S07 | Cursor 규칙 유형 해설 | 2차 | <https://forum.cursor.com/t/a-deep-dive-into-cursor-rules-0-45/60721> |
| S08 | Google Engineering Practices — The Standard of Code Review | 1차 | <https://google.github.io/eng-practices/review/reviewer/standard.html> |
| S09 | Google Engineering Practices — Small CLs | 1차 | <https://google.github.io/eng-practices/review/developer/small-cls.html> |
| S10 | Trunk Based Development — Short-lived feature branches | 1차 | <https://trunkbaseddevelopment.com/short-lived-feature-branches/> |
| S11 | OWASP Top 10:2025 | 1차 | <https://top10.owasp.org/2025> |
| S12 | OWASP Logging Cheat Sheet | 1차 | <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html> |
| S13 | NIST SP 800-218 SSDF v1.1 실천 목록(원문: csrc.nist.gov SP 800-218) | 2차 | <https://myctrl.tools/frameworks/nist-800-218> |
| S14 | OpenSSF Scorecard checks | 1차 | <https://github.com/ossf/scorecard/blob/main/docs/checks.md> |
| S15 | OpenSSF Concise Guide for Evaluating Open Source Software | 1차 | <https://best.openssf.org/Concise-Guide-for-Evaluating-Open-Source-Software> |
| S16 | Martin Fowler — ParallelChange | 1차 | <https://martinfowler.com/bliki/ParallelChange.html> |
| S17 | DORA capabilities | 1차 | <https://dora.dev/capabilities/> |
| S18 | The Twelve-Factor App | 1차 | <https://12factor.net/> |
| S19 | Google SRE Book — Postmortem Culture | 1차 | <https://sre.google/sre-book/postmortem-culture/> |
| S20 | Architectural Decision Records | 1차 | <https://adr.github.io/> |
| S21 | Mike Caulfield — SIFT (The Four Moves) | 1차 | <https://hapgood.us/2019/06/19/sift-the-four-moves/> |
| S22 | Nielsen Norman Group — User Interviews 101 | 1차 | <https://www.nngroup.com/articles/user-interviews/> |
| S23 | SCIP Code of Ethics (원문 미직접 조회, 검색 결과 인용) | 2차 | <https://www.scip.org/page/CodeOfEthics> |
| S24 | 개인정보 보호법 제15조 (법령 미러) | 2차 | <https://korea.legal/wiki/%ea%b0%9c%ec%9d%b8%ec%a0%95%eb%b3%b4-%eb%b3%b4%ed%98%b8%eb%b2%95-%ec%a0%9c15%ec%a1%b0/> |
| S25 | 저작권법 제28조·제37조 (검색 결과의 조문 인용. law.go.kr 자동 조회 실패) | 2차 | <https://www.nepla.ai/wiki/지식재산/저작권/정당한-범위-안에서의-공정한-인용-0vyn5z6m6nd7> |
| S26 | 부정경쟁방지법 제2조 제1호 (법령 미러, 2024-02-20 개정 반영) | 2차 | <https://korea.legal/wiki/%eb%b6%80%ec%a0%95%ea%b2%bd%ec%9f%81%eb%b0%a9%ec%a7%80-%eb%b0%8f-%ec%98%81%ec%97%85%eb%b9%84%eb%b0%80%eb%b3%b4%ed%98%b8%ec%97%90-%ea%b4%80%ed%95%9c-%eb%b2%95%eb%a5%a0-%ec%a0%9c2/> |
| S27 | 디자인보호법 화상디자인 보호 개정 보도 | 2차 | <https://www.kukinews.com/article/view/kuk202103260004> |
| S28 | 대법원 2022. 5. 12. 선고 2021도1533 해설 | 2차 | <https://www.shinkim.com/kor/media/newsletter/1843> |
| S29 | 인공지능 기본법 제31조·투명성 가이드라인 해설 | 2차 | <https://shinkim.com/kor/media/newsletter/3142> |
| S30 | 문체부·한국저작권위원회 생성형 AI 저작권 안내서 보도 | 2차 | <https://www.newsseoul.co.kr/news/view/1065576023564746> |
| S31 | REUSE Specification 3.3 | 1차 | <https://reuse.software/spec-3.3/> |
| S32 | SF Symbols 라이선스 관련 Apple 개발자 포럼 (원문 약관 미조회) | 2차 | <https://developer.apple.com/forums/thread/739523> |
| S33 | 개인정보 보호법 제21조 (검색 결과의 조문 인용, 2023-03-14 개정 반영) | 2차 | <https://wikidocs.net/230548> |
