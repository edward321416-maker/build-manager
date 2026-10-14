# P5 PR 2: 알림에 요청별 처리할 일 이유 다섯 가지 더하기, 수락 기록

기준일: **2026-10-14 KST**. 저장소: `edward321416-maker/build-manager`.

판정: **ACCEPTED_FOR_DEVELOPMENT_MAIN** (병합은 이 PR의 정확한 head에서 CI가 통과한 뒤). P5 묶음의 두 번째 PR이다. 첫 번째(PR 1a #136·#139, PR 1b #143)는 main에 있고 데모에도 올라가 있다. 이 PR은 아직 데모에 올리지 않았고, 데모 배포는 운영자에게 따로 묻는다.

## 권한과 기준

| 항목 | 값 |
| --- | --- |
| 위험 등급 | 고위험(DEV-04): FROZEN `/core` 화면과 그 시험이 바뀐다 |
| 운영자 결정 | 2026-10-13: 스펙 승인 "전수점검하고 통과하면 승인할게"(앞선 수락 기록 `ops/navigation_shell_p5_20261013_acceptance.md`에 있음). 2026-10-14: PR 2 계획 작성 요청 "그래 계획 작성해봐". 2026-10-14: 계획과 새 문구 세 가지를 실제 크기 그림으로 보고 "이대로 진행 (추천)", 구현 방식은 "도우미에게 나눠 맡기기 (추천)"(스펙 D13). 2026-10-14: 아직 올리지 않은 계획 커밋의 이메일 모양 공동 작성자 줄 때문에 `verify_repository.py --history`가 막혀, 일회성 히스토리 재작성 예외를 "지금 다시 만들기 (추천)"로 승인. 2026-10-14: 최종 리뷰가 계획 수준의 문제 두 가지를 찾았고 "이번 PR에서 고치기 (추천)"로 승인 |
| 스펙과 계획 | `docs/superpowers/specs/2026-10-13-navigation-shell-p5-design.md`(5절, D13 포함), `docs/superpowers/plans/2026-10-14-navigation-shell-p5-reasons.md` |
| POLICY_REF | main `0f5f48d`. 읽은 규칙: `AGENTS.md`, `governance/ai_delivery_rules.md`, `governance/project_policy.md`, `development/DEVELOPMENT_RULES.md`(1.0.3), `design/DESIGN_RULES.md`. 이 워크트리의 파일이 `0f5f48d`와, 그리고 병합 시점의 `origin/main` `1289a67`과 같다는 것을 `git diff`로 확인했다(차이 없음) |
| 기준 커밋 | main `060950d`에서 갈라졌다 |
| TARGET_REF | 구현 head `f2383d1`(main 병합 전). main `1289a67`을 병합한 `2f8a919`에서 마지막 검사를 했다. PR의 마지막 head와 그 head의 CI는 PR에 기록한다 |
| PR | PR 자체에 기록 |

## 바뀐 것

알림 목록에 이유 다섯 가지가 더해졌다. 모두 이미 불러온 목록 위에 요청마다 한 번씩 더 읽어서 만든다.

| 이유 | 대상 | 언제 | 읽는 것 |
| --- | --- | --- | --- |
| 방문 시간 확정 필요 | 세입자 | 업체 일정이 세입자를 기다릴 때 | 처리 중인 요청의 업체 일정 |
| 결과 확인 필요 | 세입자 | 결과가 아직 확인 전일 때 | 최근 끝난 요청 20건의 결과 |
| 업체 확인 필요 | 관리자 | 업체 전달이 관리자를 기다리거나, 지금 배정이 업체 거절로 끝났을 때 | 업체 처리 대상이면서 처리 완료 전인 요청의 업체 전달 |
| 기한 지남 | 관리자 | 기한이 지난 업무 | 업무 목록 1회 |
| 연결 요청 확인 필요 | 조직 관리자 | 연결 요청이 `REQUESTED`일 때 | 연결 요청 목록 최대 5쪽(100건) |

- **새로 정한 문구 세 가지**(운영자가 실제 크기 그림으로 승인)
  - 연결 요청 행 제목: `입주 연결 · <호실 이름>`. 누르면 더 보기의 입주 연결이 열린다.
  - 읽는 중 안내: `처리할 일을 더 확인하고 있어요.`
  - 연결 요청 100건 안내: `연결 요청은 100건까지만 확인했어요. 입주 연결에서 모두 볼 수 있어요.`
  - 끝난 요청이 20건을 넘을 때만 "최근 끝난 요청 20건만 확인해요."가 보인다(스펙 D13).
- **읽기 규칙**
  - 요청마다 읽는 것은 한 화면에서 동시에 4개까지다. 앞선 읽기 묶음이 끝나지 않았어도 새 묶음과 합쳐 4개를 넘지 않는다.
  - 읽는 때는 요청 목록을 불러온 직후, 목록이 바뀐 뒤, 요청을 닫은 뒤, 새로고침·다시 불러오기·알림 탭 누르기다. 사진 올리기나 화면 다시 그리기로는 읽지 않는다. 주기적으로 읽지도 않는다.
  - 새 읽기가 시작되거나 화면이 사라지면 이전 읽기의 남은 요청은 보내지 않고, 이전 결과도 화면에 올라오지 않는다. 로그아웃하거나 소속을 바꾸면 이전 결과를 버린다.
  - 방문 시간은 처리 중인 요청만, 업체 전달은 업체 처리 대상이면서 처리 완료 전인 요청만 읽는다. 끝난 요청에서는 결과 확인만 남기고 다른 이유는 버린다.
  - 요청마다 읽는 것은 403을 로그아웃으로 보지 않는 클라이언트(`checkedFetch(true)`)를 쓴다. 403·404는 "배정 없음"이고 실패로 세지 않는다. 401은 로그인 흐름으로 보낸다. 목록 단위로 읽는 것(요청 목록, 대화 요약, 업무 목록, 연결 요청 목록)은 지금처럼 401·403에서 화면을 비운다.
- **일부를 읽지 못했을 때**: 읽은 것만 보이고 위에 "일부를 확인하지 못했어요"와 "다시 불러오기"가 뜬다. 배지는 확인된 행만 센다. 읽는 중에는 목록이 `aria-busy`이고, 홈의 다음 할 일 한 줄도 이 읽기가 끝나기를 기다린다.
- **정렬**: 긴급 확인, 기한 지남, 내 답변·관리자 답변·처리 방법 결정, 나머지 순이다.
- **알려진 빈틈(문구 규칙에 따라 PR 본문에도 적는다)**: 업체 확인 필요는 업체 처리 대상 요청만 읽는다. 그래서 경로를 바꾼 뒤나 안전 확인으로 올라간 뒤에 관리자를 기다리게 된 업체 전달은 알림에 뜨지 않는다.

## 계획과 다른 점, 그리고 이유

| 계획 | 실제 | 이유 |
| --- | --- | --- |
| 아직 올리지 않은 계획 커밋 `c2fa32b` | `1fc5751`로 다시 만듦(8줄이 `<작업 환경이 정한 주소>`로 바뀜). 뒤의 5개 커밋은 그대로 다시 얹음 | `verify_repository.py --history`가 이메일 모양 줄을 막았다. 운영자가 일회성 예외로 승인했다. `git range-diff`가 5개 모두 "="였고 옛 head와 새 head의 tree 차이는 계획 파일뿐이다. 아무것도 push하지 않은 상태였다 |
| Task 6 커밋의 공동 작성자 줄이 계획의 고정 문구 | `71de7f4`는 실제로 쓴 모델 이름(Claude Haiku 5.5)을 적었다 | 정확한 기록이므로 그대로 둔다. 고치려면 히스토리 재작성이라 운영자 승인이 필요하다 |
| P5-T01의 마지막 확인이 `not.toContainText` | `방문 시간 확정 필요`가 적힌 행이 하나도 없는지, 일부 확인 실패 안내가 없는지, 그리고 주 메뉴가 그대로 보이는지 확인 | 세입자가 답한 뒤 행이 사라지는 것이 올바른 동작인데, Playwright의 `not.toContainText`는 대상이 사라지면 실패한다. 계획의 의도는 지키고 확인 방법만 바꿨다(책임자 판단) |
| 계획의 읽기 제한 코드와 화면의 일반 `revision` 카운터 사용 | 새 `createReadLimiter`(취소 확인 포함), 새로고침 때만 올리는 `todoRevision`, 새로고침이 목록과 열린 요청을 한 번에 갱신 | 최종 리뷰가 찾은 두 문제를 고치면서 바뀌었다(운영자 승인 "이번 PR에서 고치기"). 새로고침을 한 번에 갱신하는 것은 지적 범위를 조금 넘는다. 요청이 열려 있을 때 읽기가 두 번 돌던 것을 한 번으로 줄이고, 끝 상태는 같다 |

## FROZEN 시험 변경

기존 시험은 고치지 않았다.

- 계산 시험(vitest) `todo-list.test.ts`, `core-nav.test.tsx`: 목록 값이 새 필드를 갖게 되어 시험 값만 따라 고쳤다(타입이 강제한 수정). 어떤 단언도 약하게 하거나 지우지 않았다. 새 시험 파일 `todo-extras.test.ts`, `use-todo-extras.test.tsx`를 더했다.
- 브라우저 시험은 새 시험만 더했다: `core-e2e/todo-extras.spec.ts`(3개), `core-login-e2e/navigation.spec.ts`와 `core-login-e2e/onboarding.spec.ts`에 각 1개, `vendor-e2e/vendor-job.spec.ts`에 P5-T01·P5-T02.

## 위협

| 위협 | 통제 | 증거 |
| --- | --- | --- |
| 알림을 열 때마다 요청 수만큼 읽어 서버에 부담을 줌 | 동시 4개, 읽는 때를 정해진 순간으로 한정, 끝난 요청은 20건, 연결 요청은 5쪽 | `todo-extras.test.ts`, `use-todo-extras.test.tsx`, `todo-extras.spec.ts` |
| 앞선 읽기의 늦은 결과나 이전 계정의 결과가 새 화면에 보임 | 읽기마다 취소 신호, 로그아웃 때 결과 버림, 소속을 바꾸면 화면 전체를 새로 만듦(스펙 6절) | `use-todo-extras.test.tsx`의 "lets only the latest read land", "forgets the last result once signed out" |
| 권한 없음(403)을 로그아웃으로 처리하거나, 반대로 목록의 권한 오류를 숨김 | 요청마다 읽기만 403·404를 "배정 없음"으로 보고 목록 읽기는 401·403에서 화면을 비움 | `todo-extras.test.ts`, `core-login-e2e/navigation.spec.ts` 새 시험 |
| 읽지 못한 것을 확인한 것처럼 보이거나 건수를 부풀림 | 일부 실패 안내와 다시 불러오기, 배지는 확인된 행만 셈, 100건·20건 한도 안내 | `core-nav.test.tsx`, `todo-extras.spec.ts` |

서버, 데이터베이스, API 계약, 패키지는 바뀌지 않았다.

## 리뷰

- 작업별 리뷰(작성 맥락과 분리된 새 맥락): Task 1~6 모두 승인. Task 3은 고칠 것이 한 번 있었다(읽는 시점의 전제를 문서로 적고 시험으로 고정).
- 전체 브랜치 최종 독립 리뷰(`71de7f4`, 새 맥락, 가장 능력 있는 모델): "고칠 것이 있음".
  - 중요 1: 새 읽기가 시작되거나 화면이 사라져도 이전 읽기 묶음이 취소되지 않아 "한 번에 4개" 한도가 깨진다.
  - 중요 2: 화면 다시 그리기 카운터가 오를 때마다(사진 한 장 올릴 때마다 포함) 읽기가 돈다.
  - 사소한 것 3~8, 그리고 앞선 작업에서 미뤄 둔 항목은 선별해 대부분 미룸으로 기록했다.
- 고침 한 번(`21357df`, `77d8762`, `8d0521c`, `f2383d1`): 중요 1·2, 사소한 3(끝난 요청에 남은 이유)·4(로그아웃 뒤 남은 결과), 한 줄짜리 14·17·18, 그리고 7a가 찾은 "잡히지 않은 변형".
- 고친 부분만 다시 본 범위 리뷰(가장 능력 있는 모델): 지적 8개 모두 해결, 새 치명·중요 문제 없음. 새로고침을 한 번에 갱신하는 변경은 읽기를 순간마다 한 번으로 만드는 데 필요하고 끝 상태가 같다고 판단했다.

## 검증

로컬 단위·타입·린트는 Node 24.14.0(운영자 PC)에서 돌렸고, 브라우저 시험은 CI와 같은 고정 버전 24.21.0에서 돌렸다(DEV-10). 버전 차이가 의심되는 결과는 CI가 판정한다.

### main 병합 뒤(`2f8a919`)

| 명령 | 종료 코드 | 요약 |
| --- | --- | --- |
| `npm run typecheck` | 0 | 패키지, 시험, 웹, 모바일 `tsc --noEmit` 통과 |
| `npm run lint` | 0 | 웹 0 오류·경고 7, 모바일 0 오류·경고 1. 경고는 이 브랜치가 건드리지 않은 파일에 있다 |
| `npm --workspace @build-manager/web run test` | 0 | 89개 파일, 1050개 시험 통과. `f2383d1`에서는 1047개였고, 병합으로 들어온 main의 `presenters.test.ts` 시험 3개가 더해졌다 |
| `python scripts/verify_repository.py --history` | 0 | `{"mode": "full", "files": 886, "internal_links": 805, "history_blobs": 3525, "findings": [], "result": "PASS"}` (이 기록 파일을 더하기 전). 기록을 더한 뒤의 결과는 PR 본문에 적는다 |

병합은 충돌 없이 끝났다. 병합으로 들어온 것은 main의 마이그레이션 0025·0026과 그 시험, 관련 문서·기록이다. 이 브랜치는 서버 코드를 건드리지 않았다.

이 head에서 `test:shared`, `test:postgres`, `build:web`, `check:deps`, 브라우저 시험은 돌리지 않았다. CI가 새 데이터베이스에서 정확한 head로 돌린다.

### 전체 검사(`71de7f4`, Node 24.21.0)

| 명령 | 종료 코드 | 요약 |
| --- | --- | --- |
| `python scripts/verify_repository.py --history` | 0 | PASS(파일 875, 내부 링크 769, 히스토리 blob 3492, 발견 0) |
| `npm run test:shared` | 1 | 656개 중 653개 통과, 3개 실패: 모두 경계 그래프 시험의 5초 시간 초과(#119). `tests/architecture`만 따로 돌리면 13개 파일, 236개 모두 통과 |
| `npm run test:web` | 0 | 89개 파일, 1040개 통과 |
| `npm run lint` | 0 | 웹 0 오류·경고 7, 모바일 0 오류·경고 1 |
| `npm run typecheck` | 0 | 통과 |
| `npm run build:web` | 0 | 통과 |
| `npm run check:deps` | 0 | 통과 |
| `npm run test:postgres` | 0 | 46개 파일, 633개 통과 |
| `npm run test:e2e:core` | 1 | 63개 중 56개 통과, 7개 실패(아래 알려진 로컬 실패). 새 `todo-extras.spec.ts` 3개 통과 |
| `npm run test:e2e:sdk` | 1 | 43개 중 38개 통과, 5개 실패(아래). 새 `navigation.spec.ts:129`, `onboarding.spec.ts:102` 통과 |
| `npm run test:e2e:vendor` | 0 | 20개 통과. P5-T01·P5-T02 통과 |
| `tests/test_verify_repository.py`, `scripts/tests/test_verify_repository.py` | 0 | 3개, 14개 통과 |
| `node --experimental-transform-types scripts/design-audit.mjs` | 0 | 231 화면, 발견 0 |

### 고침 뒤(`f2383d1`)

| 명령 | 종료 코드 | 요약 |
| --- | --- | --- |
| 웹 단위 시험 | 0 | 89개 파일, 1047개 통과 |
| `npm run typecheck`, `npm run lint` | 0, 0 | 통과, 0 오류 |
| `test:e2e:core -- todo-extras.spec.ts home.spec.ts navigation.spec.ts` | 0 | 17개 통과 |
| `test:e2e:sdk -- navigation.spec.ts onboarding.spec.ts` | 0 | 14개 통과 |
| `test:e2e:vendor -- vendor-job.spec.ts` | 0 | 19개 통과 |
| core `core.spec.ts`, `ticket-communication.spec.ts`, `usability.spec.ts` (새로고침을 누르는 시험) | 1 | 15개 중 14개 통과, 1개 실패(`ticket-communication.spec.ts:27`, 알려진 시간 초과). 한 번 다시 돌려도 같은 시험이 같은 종류로 실패 |
| `python scripts/verify_repository.py --history` | 0 | PASS(파일 875, 내부 링크 769, 히스토리 blob 3525, 발견 0) |

### 망가뜨려 보기

한 번에 한 곳만 망가뜨리고, 이름 붙인 시험이 실패하는 것을 확인한 뒤 되돌렸다. 되돌린 뒤 작업 트리가 깨끗한 것을 확인했다.

| # | 망가뜨린 곳 | 잡은 시험 |
| --- | --- | --- |
| 1 | `READ_LIMIT` 4를 5로 | `todo-extras.test.ts` "never has more than four per-request reads in flight" 등 4개 |
| 2 | 끝난 요청 20건 자르기 제거 | `todo-extras.test.ts` 방문·결과 읽기 범위(21개가 나옴) |
| 3 | 요청마다 읽기의 403·404를 실패로 셈 | `todo-extras.test.ts` "nothing for 403 or 404" |
| 4 | 403이 요청마다 읽기에서도 세션을 끝냄 | `todo-extras.test.ts` 세션 시험, 그리고 `core-login-e2e/navigation.spec.ts:129` |
| 5 | 연결 요청 쪽수 한도 5를 50으로 | `todo-extras.test.ts` "at most five pages" |
| 6 | 기한 지남의 정렬 무리를 1에서 3으로 | `todo-list.test.ts` 정렬 시험 |
| 7 | 늦은 이전 결과를 막는 검사 제거 | 처음에는 못 잡았다(`toMatchObject`가 느슨했다). 시험을 `toEqual`로 고친 뒤 잡음: `use-todo-extras.test.tsx` "lets only the latest read land" |
| 8 | 읽는 중 안내의 조건 제거 | `core-nav.test.tsx` "says while the rest is still being read" |
| N1 | 취소된 읽기의 남은 요청을 거르지 않음 | `todo-extras.test.ts`, `use-todo-extras.test.tsx` 4개 |
| N2 | 연결 요청 쪽마다 취소 확인 제거 | `todo-extras.test.ts` "stops paging link requests once the run is cancelled" |
| N3 | 세션이 끝나도 읽기를 멈추지 않음 | `todo-extras.test.ts` "starts no more per-request reads after one finds the session ended" |
| N4 | 훅이 공유 제한기를 쓰지 않음 | `use-todo-extras.test.tsx` "drops a superseded read's unstarted reads and keeps four in flight" |
| N5 | 화면이 사라져도 읽기를 취소하지 않음 | `use-todo-extras.test.tsx` 3개 |
| N6 | 로그아웃 때 결과 버리기 제거 | `use-todo-extras.test.tsx` "forgets the last result once signed out" |
| N7 | 끝난 요청의 이유 거르기 제거 | `todo-list.test.ts` "keeps only 결과 확인 from the reads for a finished request" |

- 최종 결과: 고침 뒤 1·2·3·5·6·7·N1~N7 13개를 다시 돌려 13개 모두 잡혔다. 4번과 8번은 그 코드를 고치지 않아 다시 돌리지 않았고, 처음 돌렸을 때 잡혔다.
- 7번은 첫 실행에서 잡히지 않았고, 그 약점을 시험에서 고쳤다. 같은 단언을 같은 모양의 시험 세 곳에도 더했다.
- 새로고침이 열린 요청과 목록을 한 번에 갱신하는 변경과 "사진을 올려도 읽지 않는다"는 화면 배선은 단위 시험으로 고정할 수 없다(`CoreFlowPage`에는 단위 시험 틀이 없다). 코드를 읽어 확인했고, 브라우저 시험은 더하지 않았다.

### 디자인 점검

231 화면, 발견 0건(`71de7f4`). 점검 데이터에는 새 이유가 하나도 나오지 않는다(관리자는 빈 화면, 세입자는 제출 전 초안 두 줄). 그래서 새 행의 `center` 검사는 점검으로 돌지 않았다. 책임자가 390px 세입자와 1280px 관리자 알림 캡처를 열어 보았고 배치 문제는 없었다. 새 행은 브라우저 시험과 운영자가 승인한 실제 크기 그림으로 확인했다. 고침 뒤에는 화면 모양이나 문구가 바뀌지 않았다.

## 알려진 로컬 실패

공용 로컬 시험 데이터(요청 2,000건 넘음, 호실 200개 넘음)가 계속 커져서 생긴다. CI는 새 데이터베이스를 쓴다. 정리는 데이터 삭제라 운영자 승인이 필요하다. 이 PR의 새 시험은 실패한 것이 없다.

- core(`71de7f4`, 7개): 이름 붙은 알려진 것 3개(`manager-next-step.spec.ts:114`, `manager-work.spec.ts:13`, `ticket-communication.spec.ts:27`)와 목록이 "불러오는 중…"에서 멈춘 4개(`photo-evidence.spec.ts:43`, `ticket-outcome.spec.ts:67`, `:79`, `usability.spec.ts:92`). 이 6개 파일만 한 번 다시 돌리면 30개 중 11개가 실패했다. 처음 7개가 다시 실패했고, 처음에 통과한 `manager-next-step.spec.ts:31`, `:63`, `:81`과 `ticket-outcome.spec.ts:79`(UNRESOLVED)가 더 실패했다. 시험이 요청을 더하므로 돌릴수록 데이터가 커지는 것과 맞는다. `ticket-communication.spec.ts:27`은 알려진 실패이고, 고치기 전 커밋 `71de7f4`에서도 같은 단계에서 실패했다.
- sdk(5개): `login.spec.ts:35`(3번), `design.spec.ts:53`, `design.spec.ts:107`.
- 전체 `test:shared`: 경계 그래프 시험 3개의 5초 시간 초과(#119). 따로 돌리면 통과한다.

## 롤백

PR을 되돌리면 된다. 데이터베이스와 API가 바뀌지 않았다. 이전 알림은 PR 1 이유만 보인다.

## 검증하지 못한 것, 남은 일

- 데모에는 올리지 않았다. P5 묶음(PR 1a, 1b, 2)이 모두 병합되므로 데모 배포를 할지 운영자에게 따로 묻는다.
- 처리 중 문구 차이: 홈 행은 "처리 중이에요.", 요청 상세는 "관리자가 확인하고 있어요."로 다르다(PR 1b부터 있던 것). 운영자에게 묻는다.
- 홈의 대화 요약 읽기가 실패했을 때의 상태가 스펙에 없다.
- 관리자 대화 요약을 업무함과 같이 읽는 일(계획이 남은 일로 적었고 이 PR에서는 하지 않았다).
- 공용 로컬 시험 데이터 정리(운영자 승인 필요).
- 리뷰에서 나온 다음 일(고치지 않음)
  - 같은 요청 묶음을 다시 읽을 때 읽는 중 표시가 없다.
  - `role="status"` 줄이 화면 읽기에서 읽히지 않을 수 있다.
  - `todo-extras.ts:38-39`와 스펙 5절은 "요청 화면에서처럼" 403을 "배정 없음"으로 본다고 적었는데, 그 화면들은 403에서 화면을 비우는 보호된 클라이언트를 쓴다. 이 PR의 동작(요청마다 읽기의 403은 로그아웃이 아님)은 그대로이고, 이유 설명만 정확하지 않다.
  - `manager-work.tsx:42`의 "기한 지남"이 글자 그대로 들어 있고 색도 따로다(규칙 8.7).
  - 새로고침의 `.catch`가 보호된 401·403 뒤에 목록을 되살린다. 보이는 영향은 없고 방어를 더 단단히 할 여지다.
  - 기한 변경, 결과 확인, 세입자 업체 일정 잡기 뒤에는 읽기가 다시 돌지 않아, 다음 읽는 때까지 기한 지남·결과 확인 필요·방문 시간 확정 필요가 낡은 채로 남는다(이 PR 이전부터).
  - 리뷰 장부에 적은 그 밖의 사소한 항목.
- 홈의 다음 할 일 한 줄은 끝난 요청의 결과 읽기(최대 20건)까지 기다린다. 홈 줄에는 영향이 없는 읽기다.
- 화면 읽기 이름과 실제 기기에서의 확인은 하지 않았다.
