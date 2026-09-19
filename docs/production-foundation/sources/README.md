# 이번 기획의 근거와 확인 한계

공식 문서는 필요한 절만 확인했다. 스택 버전·보안 인증·제품 런타임 성공을 추정하지 않는다. 기존 연구 출처는 prior_research_sources.json에 보존했지만 이번 턴에 33개를 재열람했다고 주장하지 않는다.

## G01 — 현재 main ref

- 분류: repo
- URL: https://api.github.com/repos/edward321416-maker/build-manager/git/ref/heads/main
- 사용 근거: 6d0eaab3356b901e5ec8627c3a49e8730dd75a79 확인
- 확인 상태: DIRECT_READ

## G02 — 현재 App checks

- 분류: repo
- URL: https://github.com/edward321416-maker/build-manager/blob/6d0eaab3356b901e5ec8627c3a49e8730dd75a79/.github/workflows/app-check.yml
- 사용 근거: Shared/lint/typecheck/build/check:deps만; Mobile/Web 단위/E2E 없음
- 확인 상태: DIRECT_READ

## G03 — 현재 Repository checks

- 분류: repo
- URL: https://github.com/edward321416-maker/build-manager/blob/6d0eaab3356b901e5ec8627c3a49e8730dd75a79/.github/workflows/repository-check.yml
- 사용 근거: history scan/whitespace; scanner unittest 없음
- 확인 상태: DIRECT_READ

## G04 — 루트 scripts/Node 선언

- 분류: repo
- URL: https://github.com/edward321416-maker/build-manager/blob/6d0eaab3356b901e5ec8627c3a49e8730dd75a79/package.json
- 사용 근거: Node >=24 <25; npm workspaces; verify는 전체 시험 아님
- 확인 상태: DIRECT_READ

## G05 — Mobile Jest 설정

- 분류: repo
- URL: https://github.com/edward321416-maker/build-manager/blob/6d0eaab3356b901e5ec8627c3a49e8730dd75a79/apps/mobile/package.json
- 사용 근거: jest-expo preset와 testMatch; 전역 testTimeout 미설정
- 확인 상태: DIRECT_READ

## G06 — 현재 접수 계약

- 분류: repo
- URL: https://github.com/edward321416-maker/build-manager/blob/6d0eaab3356b901e5ec8627c3a49e8730dd75a79/packages/api-contracts/src/commands.ts
- 사용 근거: unit 의도적 제외; rawUserText 상한 없음; production 계약 신규 설계 필요
- 확인 상태: DIRECT_READ

## G07 — 전달 규칙

- 분류: repo
- URL: https://github.com/edward321416-maker/build-manager/blob/6d0eaab3356b901e5ec8627c3a49e8730dd75a79/governance/ai_delivery_rules.md
- 사용 근거: R01~R07 이번 조회; 나머지 같은 고정 blob 이전 턴 열람; remote 쓰기 없음
- 확인 상태: DIRECT_READ_PLUS_PRIOR_FIXED_REF

## G08 — AGENTS/Project policy

- 분류: repo
- URL: https://github.com/edward321416-maker/build-manager/blob/6d0eaab3356b901e5ec8627c3a49e8730dd75a79/governance/project_policy.md
- 사용 근거: 기존 권한과 공개 안전 조건 유지
- 확인 상태: DIRECT_READ

## S01 — Jest 29.7 CLI

- 분류: primary
- URL: https://jestjs.io/docs/29.7/cli
- 사용 근거: --showConfig, cache, runInBand, CLI config, json/outputFile, timeout 의미
- 확인 상태: REVIEWED_RELEVANT_SECTIONS

## S02 — Jest 29.7 configuration

- 분류: primary
- URL: https://jestjs.io/docs/29.7/configuration
- 사용 근거: cacheDirectory/testTimeout 설정, 초기 로딩 진단 구분
- 확인 상태: REVIEWED_RELEVANT_SECTIONS

## S03 — npm 11 npm-ci

- 분류: primary
- URL: https://docs.npmjs.com/cli/v11/commands/npm-ci/
- 사용 근거: locked install, 기존 node_modules 제거, manifest/lock 무변경 의미
- 확인 상태: REVIEWED_RELEVANT_SECTIONS

## S04 — GitHub Actions secure use

- 분류: primary
- URL: https://docs.github.com/en/actions/reference/security/secure-use
- 사용 근거: full SHA pin, untrusted PR와 비밀 분리
- 확인 상태: REVIEWED_RELEVANT_SECTIONS

## S05 — OWASP Authorization Cheat Sheet

- 분류: primary
- URL: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- 사용 근거: default deny, every request, object authorization
- 확인 상태: REVIEWED_RELEVANT_SECTIONS

## S06 — PostgreSQL Row Security

- 분류: primary
- URL: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- 사용 근거: owner/superuser/BYPASSRLS 및 정책과 제약조건의 한계
- 확인 상태: REVIEWED_RELEVANT_SECTIONS

## S07 — PostgreSQL Explicit Locking

- 분류: primary
- URL: https://www.postgresql.org/docs/current/explicit-locking.html
- 사용 근거: FOR SHARE/UPDATE 상충 및 고정 잠금 순서; KEY SHARE의 한계
- 확인 상태: REVIEWED_RELEVANT_SECTIONS

## S08 — PostgreSQL SET

- 분류: primary
- URL: https://www.postgresql.org/docs/current/sql-set.html
- 사용 근거: SET LOCAL은 transaction 종료 시 사라짐; pooled context 경계
- 확인 상태: REVIEWED_RELEVANT_SECTIONS

## S09 — RFC 9700 OAuth Security BCP

- 분류: primary
- URL: https://www.rfc-editor.org/rfc/rfc9700.html
- 사용 근거: PKCE S256, public client refresh rotation/sender constraint
- 확인 상태: REVIEWED_RELEVANT_SECTIONS

## S10 — AWS Transactional Outbox

- 분류: primary
- URL: https://docs.aws.amazon.com/en_en/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html
- 사용 근거: DB/write-outbox 원자성, 중복 소비와 멱등성; AWS 채택 의미 아님
- 확인 상태: REVIEWED_RELEVANT_SECTIONS

## S11 — 개인정보 보호법 제21조

- 분류: legal_locator
- URL: https://www.law.go.kr/법령/개인정보보호법/제21조
- 사용 근거: 이번 도구에서 본문 파싱 실패; 준수 검증 근거로 사용하지 않음
- 확인 상태: BODY_NOT_VERIFIED_THIS_TURN

## S12 — 개인정보 보호법 제29조

- 분류: legal_locator
- URL: https://www.law.go.kr/법령/개인정보보호법/제29조
- 사용 근거: 이번 도구에서 본문 파싱 실패; 준수 검증 근거로 사용하지 않음
- 확인 상태: BODY_NOT_VERIFIED_THIS_TURN
