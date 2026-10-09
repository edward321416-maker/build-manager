# 작업 규칙 v1 — 규칙집 구현 계획 (PR-1a·PR-1b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개발·연구·레퍼런스 규칙집 3개를 만든다. 연구 규칙은 기존 README에서 빠짐없이 옮긴다. 정책·기여 문서와 PR 템플릿을 새 규칙집에 연결한다.

**Architecture:** 규칙 본문은 분야 폴더의 `*_RULES.md` 한 곳에만 두고 다른 문서는 링크만 건다. 게이트(`.claude/**`)와 AGENTS.md·CLAUDE.md는 PR #79와 겹치므로 이 계획에서 다루지 않는다. 이 부분은 PR #79 병합 뒤 별도 계획(PR-2)으로 진행한다.

**Tech Stack:** Markdown, Python 3 저장소 검사기 `scripts/verify_repository.py`(git index를 읽으므로 검사 전에 stage가 필요하다), Git worktree `worktree/build-manager-work-rules-v1`

**Spec:** [작업 규칙 v1 설계](../specs/2026-10-10-work-rules-v1-design.md). 규칙별 내용의 기준이며, 아래 "스펙 §…"은 이 문서의 해당 절을 가리킨다.

## Global Constraints

- **언어·머리말**: 규칙집은 한국어로 쓴다. 첫 줄 아래에 `Version: 1.0.0 | Effective: 2026-10-10 | Owner: 운영자`를 둔다. 규칙 ID는 `DEV-`, `RES-`, `REF-`를 쓴다.
- **분량**: 본문은 250줄 이하를 목표로 한다. 상한은 600줄·48,000바이트다. `IMPORTANT`는 문서당 최대 2개다.
- **쓰는 내용**: 저장소 고유의 명령·경로·결정·함정만 쓴다. 일반 상식 문장은 쓰지 않는다.
- **중복 금지**: 같은 내용은 소유 문서 한 곳에만 쓴다. 작업 절차(R01–R10)는 `governance/ai_delivery_rules.md`에 링크만 건다.
- **공개 검사**: 이메일 주소, 전화번호, 주소 형태 문자열, 비밀 값 대입 형태, `raw`·`private`·`secrets` 경로를 쓰지 않는다. 내부 링크는 모두 유효해야 한다.
- **건드리지 않는 파일**: `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `design/**`, 제품 코드
- **링크 처리**: `design/DESIGN_RULES.md`는 PR #79가 병합되기 전까지 링크가 아닌 코드 표기로 쓴다.
- **브랜치**: PR-1a는 `docs/work-rules-v1-design`, PR-1b는 그 위에 쌓는 `docs/work-rules-v1-rulebooks`다. 다른 세션의 worktree와 브랜치는 건드리지 않는다.

## File Structure

| 파일 | 변경 | 책임 |
| --- | --- | --- |
| `docs/superpowers/specs/2026-10-10-work-rules-v1-design.md` | 수정 | §순서를 PR 3개(1a·1b·2)로 갱신 |
| `docs/superpowers/plans/2026-10-10-work-rules-v1-rulebooks.md` | 생성 | 이 계획 |
| `research/RESEARCH_RULES.md` | 생성 | 연구 규칙 정식 문서 |
| `research/README.md` | 수정 | 폴더 안내와 현재 근거 경계만 남김 |
| `research/interviews/landlord_guide.md`, `research/interviews/tenant_guide.md`, `product/ai_safety_boundary.md` | 수정 | 규칙 링크를 RESEARCH_RULES로 변경 |
| `development/DEVELOPMENT_RULES.md` | 생성 | 개발 규칙 |
| `references/REFERENCE_RULES.md` | 생성 | 레퍼런스 규칙 |
| `governance/project_policy.md` | 수정 | 소유 표 |
| `CONTRIBUTING.md` | 수정 | 규칙집 링크, 리뷰 문구 |
| `.github/pull_request_template.md` | 수정 | 위험 등급 항목 |
| `ops/AI_Execution_Log.csv`, `ops/pending_external_sync.md` | 수정 | 실행 기록(sync pending) |

---

### Task 1: PR-1a 정리와 공개

**Files:**
- Modify: `docs/superpowers/specs/2026-10-10-work-rules-v1-design.md` (§순서)
- Create: `docs/superpowers/plans/2026-10-10-work-rules-v1-rulebooks.md`
- Modify: `ops/AI_Execution_Log.csv`, `ops/pending_external_sync.md`

**Interfaces:**
- Produces: 브랜치 `docs/work-rules-v1-design`. 이 위에 Task 2–6을 쌓는다.

- [ ] **Step 1: 브랜치 이름 변경**(원격에 아직 없음)

```bash
git -C "worktree/build-manager-work-rules-v1" branch -m feat/work-rules-v1 docs/work-rules-v1-design
```

- [ ] **Step 2: 스펙 §순서 갱신**

  1번 항목("PR-1 규칙 문서…")을 다음 두 항목으로 바꾼다. 뒤의 항목은 번호를 이어서 다시 매기고, 본문에서 "PR-1"을 가리키는 부분은 "PR-1a·PR-1b"로 고친다. 스펙 머리말의 브랜치 이름도 고친다.
  - PR-1a 설계: 브랜치 `docs/work-rules-v1-design`. 스펙, 비교 점검 문서, 이 계획
  - PR-1b 규칙집: 브랜치 `docs/work-rules-v1-rulebooks`(PR-1a 위). 규칙집 3개, 연구 규칙 이전, 링크, 정책·기여·PR 템플릿
  - 사유: DEV-02의 1000줄 기준. PR-1 하나로 묶으면 약 1300줄이다.

- [ ] **Step 3: 실행 기록 추가**
  - `ops/AI_Execution_Log.csv`에 행 1개를 추가한다.
    - `event_id=WORK-RULES-V1-PLAN-20261010`
    - `acquired_skill=superpowers:writing-plans`
    - `estimated_tokens_used=unknown`
    - `sync_status=pending`
    - 요약: "최종 점검 9건 반영, 계획 작성, PR 3개 분할"
  - Python `csv.writer`로 append해서 따옴표 처리를 맡긴다.
  - `ops/pending_external_sync.md` 끝에 같은 event_id를 `sync_status=pending`과 `NOT_RUN` 문구로 한 줄 추가한다.

- [ ] **Step 4: 검사**

```bash
git add -- docs/superpowers/specs/2026-10-10-work-rules-v1-design.md docs/superpowers/plans/2026-10-10-work-rules-v1-rulebooks.md ops/AI_Execution_Log.csv ops/pending_external_sync.md
python scripts/verify_repository.py --history
git diff --cached --check
```
  Expected: `"result": "PASS"`, findings `[]`, whitespace 출력 없음

- [ ] **Step 5: 커밋** — `docs: plan the work rulebooks and split delivery into three PRs`

- [ ] **Step 6: 공개(운영자 허가 필요)**
  1. push한다: `git push -u origin docs/work-rules-v1-design`
  2. PR을 만든다: `gh pr create --base main`. 본문 첫 줄은 `Risk tier: 일반(문서)`이다. 본문에는 목적, 검사 결과, 남은 위험을 적는다.
  3. CI 통과를 확인한다: `gh pr checks --watch`
  4. 병합한다: `gh pr merge --merge --match-head-commit <HEAD SHA>`. merge commit으로 병합해야 PR-1b의 쌓인 이력이 그대로 유지된다.

### Task 2: 연구 규칙 이전

**Files:**
- Create: `research/RESEARCH_RULES.md`
- Modify: `research/README.md`, `research/interviews/landlord_guide.md:7`, `research/interviews/tenant_guide.md:5`, `product/ai_safety_boundary.md:31`

**Interfaces:**
- Consumes: Task 1 브랜치
- Produces: `research/RESEARCH_RULES.md`. RES-01~RES-10이고, 소유 표와 CONTRIBUTING이 이 경로를 링크한다.

- [ ] **Step 1: 브랜치 생성**

```bash
git -C "worktree/build-manager-work-rules-v1" switch -c docs/work-rules-v1-rulebooks
```

- [ ] **Step 2: 이전 대응표 고정**

  현재 `research/README.md`의 규칙 문장을 아래 ID로 옮긴다. 확인 키워드는 Step 5 검사에 그대로 쓴다.

| # | README 원문 요지 | 대상 | 확인 키워드 |
| --- | --- | --- | --- |
| M1 | FACT 정의(source_id, 정확한 위치, 범위·날짜, 검증 기록). 출처가 주장했다고 독립적인 사실이 되지는 않음 | RES-02 | `source_id` |
| M2 | HYPOTHESIS는 방법과 반증 조건을 가진 명제이며 결과가 아님 | RES-02 | `반증 조건` |
| M3 | ASSUMPTION은 소유자와 검증 관문이 있는 임시 입력이며 측정값처럼 쓰지 않음 | RES-02 | `검증 관문` |
| M4 | DECISION은 날짜와 근거가 있는 선택이며 시장 수요를 증명하지 않음 | RES-02 | `시장 수요` |
| M5 | TO VERIFY는 사실 주장의 근거로 쓸 수 없음 | RES-02 | `TO VERIFY` |
| M6 | 본문 라벨 표기, CSV `classification`, 별도 필드 `verification_status` | RES-02 | `verification_status` |
| M7 | 출처 레지스트리와 주장 레지스트리의 역할 | RES-04 | `claim_registry.csv` |
| M8 | 안정 ID, 복합 주장 분리, 검증된 주장 없는 출처 허용, 정정은 새 날짜 수정본으로 하고 이전 출처 이력 보존 | RES-04 | `복합 주장` |
| M9 | FACT 승격 전 원문·기준 기간·모집단·분모·한계·정확한 근거 확인, 검토자와 날짜 기록 | RES-03 | `분모` |
| M10 | 공식 통계·업체 마케팅·직접 관찰·참여자 진술 구분 | RES-03 | `업체 마케팅` |
| M11 | 다른 모집단으로 시장 규모를 추론하지 않음. 지표·가격·사용자·인터뷰 결과·지불 의향·경쟁사 기능을 지어내지 않음 | RES-03 | `지불 의향` |
| M12 | 실제 연구가 있을 때만 `YYYY-MM-DD-topic.md` 노트 작성, 필수 항목 10개, 빈 노트 금지 | RES-06 | `YYYY-MM-DD-topic.md` |
| M13 | 인터뷰: 모집 방법, 익명 참여자 코드, 동의 범위, 실제 표본 한계를 적고 모집·연락처는 공개 금지 | RES-07 | `모집 방법` |
| M14 | 원본은 저장소 밖 승인된 비공개 저장소에 둠. 접근 통제된 원본, 체크섬, 수집 시각, 출처, 동의·보관 근거 | RES-08 | `체크섬` |
| M15 | 원본을 덮어쓰지 않고 파생본은 버전을 붙임. 승인된 삭제는 감사 기록을 남기고, 조용히 덮어쓰지 않음 | RES-08 | `덮어쓰지` |
| M16 | 공개 전에 이름·전화·이메일·정확한 주소·동호수·얼굴·목소리·번호판·계정 화면·EXIF를 제거. 이름만 바꾸는 것으로는 부족함. 코드 대응표는 비공개, 집계 요약 우선 | RES-08 | `번호판` |
| M17 | 사용 목적별 동의. 인터뷰 참여가 공개 동의는 아님. 간접 식별자 확인, 인용은 검토 후 공개 | RES-08 | `간접 식별` |
| M18 | 폴더 목적, 현재 근거 경계, 인터뷰·경쟁 색인 안내 | README 유지 | `현재 근거 경계` |

- [ ] **Step 3: `research/RESEARCH_RULES.md` 작성**

  절 구성(정확한 제목):
  - `# 연구 규칙`
  - 머리말 4줄:
    - Version 줄
    - 적용: `research/`·`submission/`·`product/` 편집, 시장·경쟁·사용자·기술 조사
    - 읽는 시점: 연구를 시작하기 전에 전체를 읽는다. 게이트가 설치된 환경에서는 읽지 않으면 편집이 막힌다.
    - 우선순위 줄: 스펙 §공통 형식
    - 근거 링크: 스펙, 비교 점검
  - `## RES-01 시작 전` … `## RES-10 자체 점검`(스펙 §연구 규칙의 10개 항목)
  - `## 규칙 변경`
  - `## 변경 이력`

  내용 기준:
  - 각 RES 절은 스펙 §연구 규칙의 해당 항목과 Step 2 대응표의 원문을 명령형 bullet로 쓴다.
  - RES-05는 경쟁 색인 [`competitors/README.md`](competitors/README.md)를 링크한다. 색인의 [DECISION] 문장은 복사하지 않는다.
  - RES-07은 인터뷰 가이드 2개를 링크한다.
  - RES-10은 체크리스트 형식으로 쓴다:
    - 질문과 결정이 적혀 있는가
    - 모든 주장에 라벨과 출처 ID가 있는가
    - 원문까지 추적했는가
    - 반증과 한계를 적었는가
    - 개인정보·재사용을 검토했는가
    - AI 작성 여부와 검토 상태를 표시했는가
  - 변경 이력 첫 행: `| 1.0.0 | 2026-10-10 | research/README.md의 규칙을 옮기고 비교 점검 결과(★)를 반영 |`

- [ ] **Step 4: README와 링크 3곳 수정**
  - `research/README.md` 전체를 다음 구성으로 바꾼다.
    - 제목 `# 연구 폴더 안내`
    - 목적 문단(원문 Purpose 번역)
    - "연구 작업 규칙은 [연구 규칙](RESEARCH_RULES.md)에 있으며 연구 전에 전체를 읽는다" 한 줄
    - 위치 표: source_registry, claim_registry, provenance_backfill_plan, competitors/README, interviews 2개
    - `## 현재 근거 경계`: 원문 마지막 단락의 번역. 내용을 바꾸지 않는다.
  - `research/interviews/landlord_guide.md`: `[research privacy rules](../README.md)` → `[research privacy rules](../RESEARCH_RULES.md)`
  - `research/interviews/tenant_guide.md`: `[research rules](../README.md)` → `[research rules](../RESEARCH_RULES.md)`
  - `product/ai_safety_boundary.md`: `[research privacy rules](../research/README.md)` → `[research privacy rules](../research/RESEARCH_RULES.md)`

- [ ] **Step 5: 검사**(실패하면 고친 뒤 다시 돌린다)

```bash
git add -- research/RESEARCH_RULES.md research/README.md research/interviews/landlord_guide.md research/interviews/tenant_guide.md product/ai_safety_boundary.md
python - <<'PY'
import pathlib, re
t = pathlib.Path("research/RESEARCH_RULES.md").read_text(encoding="utf-8")
b = len(t.encode("utf-8")); n = t.count("\n") + 1
assert n <= 600 and b <= 48000, (n, b)
assert t.count("IMPORTANT") <= 2
ids = [f"RES-{i:02d}" for i in range(1, 11)]
missing = [i for i in ids if f"## {i}" not in t]
keys = ["source_id","반증 조건","검증 관문","시장 수요","TO VERIFY","verification_status","claim_registry.csv","복합 주장","분모","업체 마케팅","지불 의향","YYYY-MM-DD-topic.md","모집 방법","체크섬","덮어쓰지","번호판","간접 식별"]
absent = [k for k in keys if k not in t]
r = pathlib.Path("research/README.md").read_text(encoding="utf-8")
assert "현재 근거 경계" in r and "RESEARCH_RULES.md" in r
assert not missing and not absent, (missing, absent)
print("lines", n, "bytes", b, "OK")
PY
python scripts/verify_repository.py
git diff --cached --check
```
  Expected: `lines … OK`, `"result": "PASS"`

- [ ] **Step 6: 커밋** — `docs(research): move the research rules into RESEARCH_RULES.md`

### Task 3: 개발 규칙

**Files:**
- Create: `development/DEVELOPMENT_RULES.md`

**Interfaces:**
- Produces: `development/DEVELOPMENT_RULES.md`(DEV-01~DEV-15). PR 템플릿과 소유 표가 링크한다.

- [ ] **Step 1: 사실 수집**(추측하지 않는다)
  - `packages/*/package.json`의 `name`과 `tests/architecture/import-boundaries.ts`를 읽어 DEV-07 워크스페이스 역할 표를 채운다.
  - 의존 방향은 그 파일의 규칙을 요약하고 링크한다.
  - 루트 `package.json`의 scripts 이름을 확인해 DEV-06 명령과 일치시킨다.
  - `deploy/vm/README.md`에서 롤백·smoke 관련 문장을 확인한다. 없는 절차는 "후속"으로 표시한다.

- [ ] **Step 2: 작성**

  절 구성(정확한 제목):
  - `# 개발 규칙`
  - 머리말:
    - 적용: 코드·설정·테스트·스크립트·배포·`docs/` 편집과 패키지 추가 명령
    - 읽는 시점과 게이트 문장: Task 2와 같은 형식
  - `## DEV-01 위험도 분류` … `## DEV-15 완료 정의와 알려진 함정`(스펙 §개발 규칙의 15개 항목)
  - `## 규칙 변경`
  - `## 변경 이력`

  내용 기준:
  - 각 절은 스펙의 해당 항목을 명령형 bullet로 쓴다.
  - DEV-09는 스펙의 A01–A10 표를 그대로 옮긴다.
  - DEV-15 알려진 함정 3가지:
    - (1) `scripts/core-flow-dev.mjs --prepare`가 기존 Postgres fixture를 재사용한다. 이미 적용된 미공개 마이그레이션을 고치면 낡은 SQL 함수 본문이 남는다. 대응: `pg_proc`으로 확인하거나 fixture를 다시 만든다. 컨테이너·볼륨 삭제는 운영자 확인 뒤에 한다.
    - (2) 정리되지 않은 testcontainers와 호스트 부하 때문에 5초 제한 그래프 테스트가 실패할 수 있다. 전체 검사 전에 `docker ps` 수를 확인한다.
    - (3) 호스팅 CI의 일시 실패는 1회 재실행하고 기록한다.
  - 완료 정의 체크리스트:
    - 등급 표기
    - 해당 검사 통과
    - CI 통과
    - 끝 리뷰(고위험은 독립 리뷰)
    - STATUS.md
    - 비밀·개인정보 없음
    - 실행 로그

- [ ] **Step 3: 검사**

```bash
git add -- development/DEVELOPMENT_RULES.md
python - <<'PY'
import pathlib
t = pathlib.Path("development/DEVELOPMENT_RULES.md").read_text(encoding="utf-8")
b = len(t.encode("utf-8")); n = t.count("\n") + 1
assert n <= 600 and b <= 48000, (n, b)
assert t.count("IMPORTANT") <= 2
missing = [f"DEV-{i:02d}" for i in range(1, 16) if f"## DEV-{i:02d}" not in t]
need = ["A01","A02","A03","A04","A05","A06","A07","A08","A09","A10","--match-head-commit","npm audit --omit=dev","pull_request_target","verify_repository.py --history","ai_delivery_rules"]
absent = [k for k in need if k not in t]
assert not missing and not absent, (missing, absent)
print("lines", n, "bytes", b, "OK")
PY
python scripts/verify_repository.py
git diff --cached --check
```
  Expected: `OK`, `PASS`

- [ ] **Step 4: 커밋** — `docs: add the development rules`

### Task 4: 레퍼런스 규칙

**Files:**
- Create: `references/REFERENCE_RULES.md`

**Interfaces:**
- Produces: `references/REFERENCE_RULES.md`(REF-01~REF-11). DEV-10과 RES-03이 REF-06·REF-03을 링크한다.

- [ ] **Step 1: 작성**

  절 구성(정확한 제목):
  - `# 레퍼런스 규칙`
  - 머리말:
    - 적용: 외부 서비스·화면·디자인·폰트·아이콘·코드·라이브러리·문서·데이터·AI 생성물을 보거나 쓰는 모든 작업
    - 게이트 대상: `WebSearch`·`WebFetch`, 패키지 추가 명령, `references/**`·`package.json` 편집
  - `## REF-01 정의와 적용` … `## REF-11 자체 점검`(스펙 §레퍼런스 규칙의 11개 항목)
  - `## 규칙 변경`
  - `## 변경 이력`

  내용 기준:
  - 각 절은 스펙을 명령형 bullet로 쓴다.
  - REF-04에는 브랜드 파랑 결정 문장을 넣는다. 디자인 규칙은 코드 표기로 쓴다.
  - REF-03 기록 양식은 코드 블록으로 넣는다.

```text
참고: <이름> — <URL 또는 위치>, 확인 <YYYY-MM-DD>
가져온 것: <원리·패턴·흐름>
일부러 가져오지 않은 것: <색·문구·아이콘·배치 등>
라이선스: <SPDX 식별자 또는 해당 없음>
```

  REF-07 코드 조각 표기 양식도 코드 블록으로 넣는다.

```ts
// SPDX-SnippetBegin
// SPDX-SnippetCopyrightText: <저작자>
// SPDX-License-Identifier: <SPDX 식별자>
// Source: <URL> (확인 <YYYY-MM-DD>)
// ...가져온 코드...
// SPDX-SnippetEnd
```

- [ ] **Step 2: 검사**

```bash
git add -- references/REFERENCE_RULES.md
python - <<'PY'
import pathlib
t = pathlib.Path("references/REFERENCE_RULES.md").read_text(encoding="utf-8")
b = len(t.encode("utf-8")); n = t.count("\n") + 1
assert n <= 600 and b <= 48000, (n, b)
assert t.count("IMPORTANT") <= 2
missing = [f"REF-{i:02d}" for i in range(1, 12) if f"## REF-{i:02d}" not in t]
need = ["제28조","제37조","(파)","(타)","화상디자인","SPDX-SnippetBegin","OSI","12개월","SF Symbols","#0064FF","WebFetch"]
absent = [k for k in need if k not in t]
assert not missing and not absent, (missing, absent)
print("lines", n, "bytes", b, "OK")
PY
python scripts/verify_repository.py
git diff --cached --check
```
  Expected: `OK`, `PASS`

- [ ] **Step 3: 커밋** — `docs: add the reference rules`

### Task 5: 정책·기여·PR 템플릿 연결

**Files:**
- Modify: `governance/project_policy.md:7-16`(소유 표), `CONTRIBUTING.md:3-4`, `.github/pull_request_template.md:1`

**Interfaces:**
- Consumes: Task 2–4의 세 경로

- [ ] **Step 1: 소유 표**
  - `| Evidence classification and raw handling | [Research rules](../research/README.md) |` 행을 바꾼다: `| Evidence classification, sources, research notes, interviews and raw handling | [Research rules](../research/RESEARCH_RULES.md) |`
  - 표 끝에 3행을 추가한다:
    - `| Code, data, security, dependency conditions and deployment | [Development rules](../development/DEVELOPMENT_RULES.md) |`
    - `| External material: selection, records, borrowing limits, quotation, licenses, AI-output rights | [Reference rules](../references/REFERENCE_RULES.md) |`
    - `| Visual design and UI copy | Design rules, \`design/DESIGN_RULES.md\` (PR #79) |`
  - 표 아래 문단 끝에 한 문장을 추가한다: `Read the matching work rulebook in full before that kind of work; where rulebooks overlap, this table names the owner.`

- [ ] **Step 2: CONTRIBUTING**
  - 3행을 바꾼다: `Read [project policy](governance/project_policy.md) and the work rulebook for your task before starting: [development](development/DEVELOPMENT_RULES.md), [research](research/RESEARCH_RULES.md), [reference](references/REFERENCE_RULES.md), and the design rules (\`design/DESIGN_RULES.md\`) for UI work. This is a public research and product-definition workspace, not a place for participant records.`
  - 2번 항목 끝에 한 문장을 추가한다: `The development rules still ask for one short end-of-work review in a fresh context; it is a working rule, not a GitHub approval requirement.`

- [ ] **Step 3: PR 템플릿** — 맨 앞에 추가한다:

```markdown
## Risk tier

State `일반` or `고위험` per DEV-01 in `development/DEVELOPMENT_RULES.md`. When unsure, choose `고위험`.

```

- [ ] **Step 4: 실행 기록**
  - `ops/AI_Execution_Log.csv`에 행을 추가한다.
    - `event_id=WORK-RULES-V1-RULEBOOKS-20261010`
    - `acquired_skill=superpowers:executing-plans`
    - `estimated_tokens_used=unknown`
    - `sync_status=pending`
  - `ops/pending_external_sync.md`에 한 줄을 추가한다.

- [ ] **Step 5: 전체 검사**

```bash
git add -- governance/project_policy.md CONTRIBUTING.md .github/pull_request_template.md ops/AI_Execution_Log.csv ops/pending_external_sync.md
python scripts/verify_repository.py --history
git diff --cached --check
git diff --stat docs/work-rules-v1-design...HEAD
```
  Expected:
  - `PASS`
  - PR-1b 변경 합계가 1000줄 이하. 넘으면 연구 규칙 이전(Task 2)을 별도 PR로 분리한다.

- [ ] **Step 6: 커밋** — `docs: link the work rulebooks from policy, contribution guide and PR template`

### Task 6: PR-1b 리뷰와 공개

- [ ] **Step 1: 끝 리뷰**(새 문맥)
  - 세 규칙집과 이전 대응표를 스펙에 비추어 검토한다.
  - 정확성·요구사항 위반만 고치고, 나머지는 PR 본문에 Nit로 남긴다.
- [ ] **Step 2: 공개(운영자 허가 필요)**
  1. push한다: `git push -u origin docs/work-rules-v1-rulebooks`
  2. PR을 만든다. PR-1a가 아직 병합되지 않았다면 base는 `docs/work-rules-v1-design`, 병합됐다면 `main`이다.
  3. CI를 확인한다.
  4. PR-1a 병합 뒤 `gh pr merge --merge --match-head-commit <HEAD SHA>`로 병합한다.
- [ ] **Step 3: 후속 안내**
  - PR-2 계획은 PR #79가 병합된 main에서 작성한다. 내용은 게이트 일반화, 테스트, 등록, AGENTS·CLAUDE 표, AGENTS의 evidence policy 링크다.
  - 사용자 설정 사본은 PR-2가 병합된 뒤 교체한다.
