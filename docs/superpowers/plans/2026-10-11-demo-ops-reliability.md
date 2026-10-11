# 데모 운영 안정화 구현 계획

- 스펙: [데모 운영 안정화 설계](../specs/2026-10-11-demo-ops-reliability-design.md). 운영자 승인 2026-10-11.
- 실행: 이 세션에서 순서대로 한다. 작업마다 실패하는 테스트, 구현, 통과, 커밋 순서를 지킨다(DEV-04).

## 전역 제약

- Node 24.21.0, npm 11.19.0. 새 의존성은 없다.
- 데모 주소는 저장소, PR, 로그에 쓰지 않는다. 테스트는 127.0.0.1의 가짜 서버만 쓴다.
- 워크플로의 액션은 `app-check.yml`과 같은 SHA로 고정한다.
  - checkout: `11d5960a326750d5838078e36cf38b85af677262`
  - setup-node: `49933ea5288caeca8642d1e84afbd3f7d6820020`
- 규칙 대상 파일은 편집 도구로만 고친다(DEV-05).
- 테스트는 `tests/architecture/`에 둔다. 루트 `vitest.config.ts`가 이 폴더를 포함하므로 `test:shared`와 CI `apps` 작업에서 돈다.

## PR A: 점검 스크립트와 정기 확인 (브랜치 `ops/demo-smoke-check`)

### A1 점검 스크립트

- 만들 파일
  - `scripts/demo-smoke.mjs`
  - `scripts/demo-smoke.d.mts`(테스트에서 불러오는 함수의 타입)
  - `tests/architecture/demo-smoke.test.ts`
- 인터페이스
  - `DEMO_ORIGIN=<origin> node scripts/demo-smoke.mjs [--http-only] [--write-check] [--expect-text <경로> <문자열>]...`
  - 출력은 검사마다 `PASS <검사>` 또는 `FAIL <검사> — <내용>` 한 줄이고, 마지막에 `SMOKE PASS` 또는 `SMOKE FAIL (<n> failed)`를 쓴다. 주소는 `<demo>`로 가린다.
  - 종료 코드는 0(통과), 1(검사 실패), 2(사용법 오류)다.
  - `export function certificateCheck(validTo: string, now?: Date): { ok: boolean; days: number }`. 남은 날이 7일 이상이면 `ok`다.
- 테스트(먼저 실패 확인). 가짜 서버로 `--http-only`를 실제로 실행한다.
  1. 정상 데모면 0이고, 출력에 주소가 없다.
  2. `/_next/image`가 400이면 1이고, 그 검사가 FAIL이다.
  3. `/api/v2/core/access`가 200이면 1이다.
  4. 첫 화면에 정적 청크가 없으면 1이다.
  5. `--expect-text`는 문자열이 있으면 0, 없으면 1이다.
  6. 사용법 오류는 요청을 하나도 보내지 않고 2로 끝난다. 주소 없음, `--http-only`와 `--write-check`를 함께 씀, 모르는 옵션, 경로가 붙은 주소가 해당한다.
  7. 닫힌 포트를 가리키면 1이고, 출력에 주소가 없다.
  8. `certificateCheck`: 9일 남으면 통과, 4일 남으면 실패, 날짜를 읽을 수 없으면 실패다.
- 확인 명령: `npx vitest run --config vitest.shared.config.ts tests/architecture/demo-smoke.test.ts`

### A2 정기 확인 워크플로

- 만들 파일
  - `.github/workflows/demo-health.yml`
  - `tests/architecture/demo-health-workflow.test.ts`
- 테스트(먼저 실패 확인)
  - 트리거는 `schedule`과 `workflow_dispatch` 두 개뿐이다.
  - 저장소 이름 조건이 있다.
  - `permissions`는 `contents: read`뿐이고 `write`가 없다.
  - 모든 `uses:`가 40자리 SHA다.
  - `persist-credentials: false`가 있다.
  - 비밀 값은 `secrets.DEMO_ORIGIN` 하나이고 `env`로만 넘긴다.
  - `--http-only`로 실행하고 `--write-check`는 쓰지 않는다.
  - `timeout-minutes`와 `concurrency`가 있다.
- 재시도는 종료 코드 1일 때만 60초 뒤 한 번 한다. 2(설정 오류)는 바로 실패시킨다.

### A3 문서

- `development/DEVELOPMENT_RULES.md` 1.0.3: DEV-12의 배포 후 확인에 스크립트를 적고, 정기 확인 한 줄을 더하고, 변경 이력을 남긴다.
- `deploy/vm/README.md`에 Checks 절을 더한다. 실행 방법, 종료 코드, 선택 옵션, 정기 확인의 비밀 값, 60일 자동 꺼짐과 다시 켜는 방법을 적는다.

### A4 검사와 실제 실행

- 실행할 검사: `npm run test:shared`, `npm run typecheck`, `python scripts/verify_repository.py --history`. 결과는 종료 코드로 판정한다.
- 실제 데모에서 실행
  - 운영자 PC의 비공개 파일에서 주소를 읽어 넘긴다.
  - 전체 검사(브라우저 포함)와 `--http-only`를 각각 한 번 돌린다.
  - 가린 출력을 PR에 적는다.

### A5 PR, 리뷰, 수락

- PR 본문 첫 줄은 `Risk tier: 고위험`이다.
- CI를 통과한 뒤 새 문맥에서 독립 리뷰를 받는다.
- `ops/` 수락 기록을 남기고(수락 문서와 실행 로그 행), 병합한다.
- 병합 뒤 실행 직전에 운영자에게 확인받는다.
  1. `gh secret set DEMO_ORIGIN`으로 비밀 값을 등록한다. 값은 비공개 파일에서 표준 입력으로 넘기고 출력하지 않는다.
  2. `gh workflow run demo-health.yml`로 첫 실행을 하고 결과를 본다.

## PR B: 재배포 스크립트 (브랜치 `ops/vm-redeploy-script`, PR A 병합 뒤)

### B1 재배포 스크립트

- 만들 파일
  - `deploy/vm/redeploy.sh`
  - `tests/architecture/vm-redeploy.test.ts`
- 인터페이스
  - `deploy/vm/redeploy.sh deploy <아카이브> <sha256>`
  - `deploy/vm/redeploy.sh rollback <이미지 ID>`
  - 환경변수(테스트용 대체 지점)
    - `REDEPLOY_DOCKER`: 기본값 `sudo docker`
    - `REDEPLOY_READY_SECONDS`: 기본값 180
    - `REDEPLOY_FREE_KB`: 지정하면 `df` 대신 쓴다
- 테스트(먼저 실패 확인). 가짜 docker로 `bash`에서 실제로 실행한다.
  - 체크섬이 다르면 docker 호출 없이 1이다.
  - 디스크가 모자라면 1이다.
  - 롤백 아카이브가 없으면 불러오기 전에 저장한다.
  - 같은 이미지면 재생성 없이 0이다.
  - 준비되면 0이고, 이전·새 ID와 롤백 명령을 출력한다.
  - 시간 안에 준비되지 않으면 1이고, 롤백 명령을 출력한다.
  - `rollback`은 불러오기, 태그, 재생성, 준비 확인 순서로 실행한다.
  - 비밀 값 파일 내용은 출력에 나오지 않는다.

### B2 문서

- `deploy/vm/README.md`의 Small VM, Update, Rollback 절을 스크립트 기준으로 고친다. 손으로 하는 절차는 대체 수단으로 남긴다.

### B3 PR, 리뷰, 수락, VM 반영

- 흐름은 A5와 같다.
- VM 반영은 다음 배포 때 실행 직전 확인을 받고 한다.
  - VM 저장소 사본을 `git pull --ff-only`로 맞춘다.
  - 새 스크립트로 배포한다.
  - 기존 `~/redeploy.sh`는 새 스크립트가 한 번 성공할 때까지 둔다.
