# 건물·호실 관리 화면 (P6 + C1 2단계 PR 2) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- 작성 시점: PR 1(#170, `32f8e15`) 병합 뒤, 화면 구현 전에 썼다(DEV-04 2단계).
- 2026-10-16 운영자 결정 "메뉴만 바꾸기 (추천)": `/workspace` 주소는 이번 PR에서 그대로 둔다. 설계서의 "`/workspace` 아래 모든 주소를 새 화면으로 보낸다"는 따로 설계한다. `/workspace`는 로그인 직후 도착 화면이고, FROZEN B1~B4 화면 자동 시험(`apps/web/tests/b1-e2e/b1·b2·b3·b4.spec.ts`)과 로그인 시험(`core-login-e2e/session.ts`의 `B1_FIXED_COMPLETION_REDIRECT_CHANGED`)이 이 주소로 확인한다.

**Goal:** 조직 관리자가 `/core`의 '더 보기 › 건물·호실 관리'에서 건물 목록을 보고, 건물을 추가하고, 건물 정보(이름·업체에 알려 줄 주소·난방 방식·관리 방식)를 고치고, 호실을 추가한다. 공개 체험은 보기만 한다.

**Architecture:** 메뉴 행을 `/workspace` 링크에서 `/core` 안의 화면(`view: "buildings"`)으로 바꾼다. 화면 안의 위치(목록·건물·정보 고치기·건물 추가·호실 추가)는 같은 주소의 기록 항목 상태(`history.state.building`)에 두어 브라우저 뒤로 가기가 한 단계씩 돌아가게 한다. 건물 정보는 PR 1의 Core API(`/api/v2/core/buildings`), 건물·호실 만들기는 기존 B3 API를 부른다. 호실 목록은 화면이 이미 읽는 Core 호실 목록(`core_flow.units`, 0026: 건물 이름·호실 이름·id 순, 모두)을 건물로 걸러 쓴다.

**Tech Stack:** Next.js 16 클라이언트 컴포넌트, React 19, CSS 모듈, zod 4 계약, vitest(jsdom), Playwright(`test:e2e:sdk`), `scripts/design-audit.mjs`.

## Global Constraints

- 설계: `docs/superpowers/specs/2026-10-15-building-setup-p6-design.md`(운영자 2026-10-15 "승인 (추천)", 2026-10-16 "메뉴만 바꾸기 (추천)")
- 위험 등급: 고위험(FROZEN RC1 `/core` 화면, 세입자 질문·추천에 쓰이는 사실을 저장하는 화면). 실패 시험부터, 새 문맥 독립 리뷰, `ops/` 수락 기록
- 디자인 규칙 v1을 따른다(`design/DESIGN_RULES.md`): 토큰만, 해요체, 한 화면 채운 파랑 버튼 하나, 휴대폰 하위 화면은 탭바 없이 상단 바 뒤로 버튼과 하단 고정 주요 버튼, 넓은 화면(1120px 이상) 목록과 상세 나란히, 상태는 글자+색, 토스트는 가벼운 성공만(8.9), 오류는 안내 상자(8.11)
- 값 이름은 공유 이름표를 쓴다(`apps/web/src/components/status-names.ts`): 난방 `개별난방`·`중앙·공용난방`, 관리 `건물주 직접 관리`·`관리사무소`(P3 이름 표, 규칙 8.7 "같은 상태는 같은 이름")
- 입력 기준은 PR 1 계약 그대로: 이름 `CoreBuildingInfoSaveSchema.shape.displayName`(1–50자, `\p{Cc}\p{Cf}` 없음), 주소 같은 규칙 1–200자 또는 빈 칸(`null`), 호실 이름은 B3 기준(1–80자)에 업체 전달 기준(`\p{Cc}\p{Cf}` 없음)을 더해 화면에서 검사
- 체험 세션·체험용 건물은 `editable:false`(PR 1 서버). 화면은 버튼 자리에 "체험에서는 바꿀 수 없어요."를 보인다
- 서버·마이그레이션·B3 도메인과 `/workspace` 화면은 바꾸지 않는다. 패키지 추가 없음
- 시험 데이터는 합성만. 한국어 정렬 순서를 시험에 하드코딩하지 않는다

## 파일

| 파일 | 할 일 |
| --- | --- |
| `packages/api-client/src/core-building.ts`(새), `core-flow.ts`, `core-building.test.ts`(새) | `client.buildings`: 목록·읽기·저장(Core), 건물·호실 만들기(B3) |
| `apps/web/src/app/core/nav/nav-config.ts`, `.test.ts`, `core-nav.tsx`, `core-nav.test.tsx`, `nav-screens.tsx` | `buildings` 화면 행, 쓰지 않게 된 `href` 행 종류 제거 |
| `apps/web/src/app/core/buildings/building-place.ts`(새), `.test.ts` | 화면 안 위치, 제목, 기록 항목 |
| `apps/web/src/app/core/buildings/building-views.tsx`(새), `.test.tsx` | 목록, 건물 화면 |
| `apps/web/src/app/core/buildings/building-forms.tsx`(새), `.test.tsx` | 정보 고치기, 건물 추가, 호실 추가 |
| `apps/web/src/app/core/buildings/buildings-screen.tsx`(새), `.test.tsx` | 읽기·저장 흐름, 상태 |
| `apps/web/src/app/core/buildings/buildings.module.css`(새) | 배치(두 칸, 하단 고정 버튼, 타일, 사실 행) |
| `apps/web/src/app/core/core-screen.tsx` | 화면 연결, 상단 바 제목·뒤로 |
| `apps/web/tests/core-login-e2e/buildings.spec.ts`(새), `navigation.spec.ts` | 관리자 흐름, 메뉴 행 주소 |
| `scripts/design-audit.mjs`, `scripts/vendor-handoff-dev.mjs` | 건물 화면들 점검(체험 관리자 + 체험 아닌 관리자) |
| 설계서, 시각 페이지, `ops/` 수락 기록, `STATUS.md`, 실행 로그, 대기 동기화, `design/DESIGN_STATUS.md` | 기록 |

---

### Task 1: API 클라이언트 `client.buildings`

**Files:** Create `packages/api-client/src/core-building.ts`, `packages/api-client/src/core-building.test.ts`; Modify `packages/api-client/src/core-flow.ts`

**Interfaces:**
- Produces: `client.buildings.list(): Promise<CoreBuildingListDto>`, `read(id): Promise<CoreBuildingInfoDto>`, `save(id, input: CoreBuildingInfoSave): Promise<CoreBuildingInfoDto>`, `create(orgId, name): Promise<B1Property>`, `addUnit(orgId, buildingId, label): Promise<B3Unit>`

- [ ] **Step 1: 실패 시험**

```ts
import { it,expect,vi } from "vitest";
import { createCoreFlowClient } from "./core-flow";
const id="00000000-0000-4000-8000-000000000001",org="00000000-0000-4000-8000-000000000002";
const info={buildingId:id,displayName:"합성 건물",serviceAddress:null,heatingType:"INDIVIDUAL",managementMode:null,demo:false,version:1,unitCount:0,editable:true};
it("reads, saves and creates through the Core and B3 paths with checked bodies",async()=>{
  const transport=vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({editable:true,items:[{buildingId:id,displayName:null,unitCount:0,needsInfo:true}]}))
    .mockResolvedValueOnce(Response.json(info)).mockResolvedValueOnce(Response.json(info))
    .mockResolvedValueOnce(Response.json({id,orgId:org,addressReference:"합성 건물"},{status:201}))
    .mockResolvedValueOnce(Response.json({id,orgId:org,propertyId:id,label:"101호"},{status:201}));
  const c=createCoreFlowClient({baseUrl:"",fetchImpl:transport});
  expect((await c.buildings.list()).items).toHaveLength(1);
  expect(await c.buildings.read(id)).toEqual(info);
  await c.buildings.save(id,{expectedVersion:0,displayName:"합성 건물",serviceAddress:null,heatingType:"INDIVIDUAL",managementMode:null});
  expect((await c.buildings.create(org,"합성 건물")).id).toBe(id);
  expect((await c.buildings.addUnit(org,id,"101호")).label).toBe("101호");
  const calls=transport.mock.calls.map(([url,init])=>[init?.method,url,init?.body]);
  expect(calls).toEqual([
    ["GET","/api/v2/core/buildings",undefined],["GET",`/api/v2/core/buildings/${id}`,undefined],
    ["POST",`/api/v2/core/buildings/${id}`,JSON.stringify({expectedVersion:0,displayName:"합성 건물",serviceAddress:null,heatingType:"INDIVIDUAL",managementMode:null})],
    ["POST",`/api/v2/organizations/${org}/properties`,JSON.stringify({addressReference:"합성 건물"})],
    ["POST",`/api/v2/organizations/${org}/properties/${id}/units`,JSON.stringify({label:"101호"})],
  ]);
});
it("refuses bodies the contracts refuse before sending, and keeps the status of a refused response",async()=>{
  const transport=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({error:"CONFLICT"}),{status:409}));
  const c=createCoreFlowClient({baseUrl:"",fetchImpl:transport});
  expect(()=>c.buildings.create(org," 앞 공백")).toThrow();
  expect(()=>c.buildings.save(id,{expectedVersion:0,displayName:"이름"+String.fromCodePoint(0x200b),serviceAddress:null,heatingType:null,managementMode:null})).toThrow();
  await expect(c.buildings.addUnit(org,id,"101호")).rejects.toMatchObject({status:409});
  expect(transport).toHaveBeenCalledTimes(1);
});
```

(폭 없는 공백 U+200B는 시험 파일에서도 이렇게 코드 번호로 만든다. 편집 도구가 \u 이스케이프를 실제 보이지 않는 글자로 바꾸기 때문이다.)

- [ ] **Step 2:** `npx vitest run --config vitest.shared.config.ts packages/api-client/src/core-building.test.ts` → `c.buildings` 없음으로 실패
- [ ] **Step 3: 구현**

```ts
import { B1PropertySchema,B3PropertyCreateSchema,B3UnitCreateSchema,B3UnitSchema,CoreBuildingInfoSaveSchema,CoreBuildingInfoSchema,CoreBuildingListSchema,
  type B1Property,type B3Unit,type CoreBuildingInfoDto,type CoreBuildingInfoSave,type CoreBuildingListDto } from "@build-manager/api-contracts";
import { sendRequest,type FetchLike } from "./http";

/** P6 + C1 step 2: organisation admins' building screen. Info goes through Core; creating a building or unit uses the
 * existing B3 registration API unchanged (cookie session and x-b1-csrf, which the Web caller's fetch adds). */
export function coreBuildings(fetcher:FetchLike,baseUrl:string){
  const path=(id:string)=>`/api/v2/core/buildings/${encodeURIComponent(id)}`;
  const properties=(orgId:string)=>`/api/v2/organizations/${encodeURIComponent(orgId)}/properties`;
  return {
    list:()=>sendRequest<CoreBuildingListDto>(fetcher,baseUrl,{method:"GET",path:"/api/v2/core/buildings",schema:CoreBuildingListSchema}),
    read:(id:string)=>sendRequest<CoreBuildingInfoDto>(fetcher,baseUrl,{method:"GET",path:path(id),schema:CoreBuildingInfoSchema}),
    save:(id:string,input:CoreBuildingInfoSave)=>sendRequest<CoreBuildingInfoDto>(fetcher,baseUrl,{method:"POST",path:path(id),body:CoreBuildingInfoSaveSchema.parse(input),schema:CoreBuildingInfoSchema}),
    create:(orgId:string,name:string)=>sendRequest<B1Property>(fetcher,baseUrl,{method:"POST",path:properties(orgId),body:B3PropertyCreateSchema.parse({addressReference:name}),schema:B1PropertySchema}),
    addUnit:(orgId:string,buildingId:string,label:string)=>sendRequest<B3Unit>(fetcher,baseUrl,{method:"POST",path:`${properties(orgId)}/${encodeURIComponent(buildingId)}/units`,body:B3UnitCreateSchema.parse({label}),schema:B3UnitSchema}),
  };
}
```

`core-flow.ts`의 반환 객체에 `buildings:coreBuildings(fetcher,options.baseUrl),`를 더한다. `api-contracts`가 `B1PropertySchema`·`B3*`를 내보내지 않으면 `index.ts`를 확인해 이미 있는 내보내기를 쓴다.

- [ ] **Step 4:** 같은 명령으로 통과
- [ ] **Step 5:** 커밋 `feat(api-client): building info and registration calls for the building screen`

### Task 2: 메뉴 행과 화면 안 위치

**Files:** Modify `nav-config.ts`(+test), `core-nav.tsx`(+test), `nav-screens.tsx`; Create `apps/web/src/app/core/buildings/building-place.ts`(+test)

**Interfaces:**
- Produces: `ViewId`에 `"buildings"`, `VIEW_LABELS.buildings="건물·호실 관리"`
- Produces: `type BuildingPlace={kind:"list"}|{kind:"building";id:string}|{kind:"edit";id:string}|{kind:"add"}|{kind:"addUnit";id:string}`, `LIST_PLACE`, `parseBuildingPlace(value:unknown):BuildingPlace`, `parentPlace(place)`, `placeTitle(place,name:string|null):string|null`, `placeKey(place):string`, `useBuildingPlace(active:boolean):{place;open(next);replace(next);back();reset()}`

- [ ] **Step 1: 실패 시험**
  - `nav-config.test.ts`: 조직 관리자(B1)의 '더 보기' 행이 `["호실 정비 이력","입주 연결","건물·호실 관리","MY"]`이고 세 번째 행이 `{kind:"view",to:{tab:"more",view:"buildings"},icon:"layout-grid"}`. `allowedViews`에 `buildings`가 조직 관리자(B1)에게만 있다(건물 담당자·세입자·B1 아님에는 없음). `inLeftMenu(ctx,"buildings")`가 참.
  - `core-nav.test.tsx`: 넓은 화면 메뉴의 세 번째 행 주소가 `/core?tab=more&amp;view=buildings`, 아이콘 `layout-grid`, 위치가 그 화면이면 `aria-current="page"`. `/workspace` 문자열이 없다.
  - `building-place.test.ts`(jsdom):
    - `parseBuildingPlace`: 다섯 모양은 그대로, 모르는 `kind`, 형식이 아닌 id(`"x"`), `null`, 숫자는 `LIST_PLACE`
    - `parentPlace`: building→list, edit·addUnit→같은 id의 building, add→list
    - `placeTitle`: list→`null`, building→이름 또는 `"건물"`, edit→`"건물 정보"`, add→`"건물 추가"`, addUnit→`"호실 추가"`
    - 훅: `open(building)` 뒤 `history.state`가 `{coreNav:true,building:{kind:"building",id}}`이고 주소는 그대로; `open(edit)` 뒤 `back()`이 `history.back()`으로 building에 돌아감(`popstate` 대기); 표시 없는 항목에서 `back()`은 새 항목 없이 부모로 바꿈(`history.length` 그대로); `replace(building)`은 항목 수를 늘리지 않음; `reset()`은 표시를 지워 list; `active:false`면 늘 list
- [ ] **Step 2:** `npx vitest run --config apps/web/vitest.config.ts src/app/core/nav src/app/core/buildings`(apps/web에서 `npx vitest run src/app/core/nav src/app/core/buildings`) → 실패
- [ ] **Step 3: 구현**
  - `nav-config.ts`: `ViewId`에 `"buildings"`, `VIEW_LABELS`에 `buildings:"건물·호실 관리"`, `moreRows`의 href 행을 `{kind:"view",label:VIEW_LABELS.buildings,to:{tab:"more",view:"buildings"},icon:"layout-grid"}`로. `MenuRow`의 `href` 종류를 지우고 `core-nav.tsx`·`nav-screens.tsx`의 해당 분기를 지운다.
  - `building-place.ts`

```ts
"use client";
import { useCallback,useMemo,useSyncExternalStore } from "react";

// P6 PR 2: the place inside 건물·호실 관리 lives in the history entry's state, not the address (P5 keeps the address to
// tab and view). Each step down is one entry, so browser back walks up one step; a reload keeps the entry's place.
export type BuildingPlace={kind:"list"}|{kind:"building";id:string}|{kind:"edit";id:string}|{kind:"add"}|{kind:"addUnit";id:string};
export const LIST_PLACE:BuildingPlace={kind:"list"};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseBuildingPlace(value:unknown):BuildingPlace{
  if(!value||typeof value!=="object")return LIST_PLACE;
  const {kind,id}=value as {kind?:unknown;id?:unknown};
  if(kind==="add")return {kind};
  if((kind==="building"||kind==="edit"||kind==="addUnit")&&typeof id==="string"&&ID.test(id))return {kind,id};
  return LIST_PLACE;
}
export function parentPlace(place:BuildingPlace):BuildingPlace{
  return place.kind==="edit"||place.kind==="addUnit"?{kind:"building",id:place.id}:LIST_PLACE;
}
/** The top bar's name for a place below the list; the list keeps the menu name. */
export function placeTitle(place:BuildingPlace,name:string|null):string|null{
  switch(place.kind){case "list":return null;case "building":return name??"건물";case "edit":return "건물 정보";case "add":return "건물 추가";case "addUnit":return "호실 추가";}
}
export const placeKey=(place:BuildingPlace)=>place.kind+("id" in place?":"+place.id:"");
const EVENT="core-building-place";
const stateOf=():Record<string,unknown>=>{const s:unknown=window.history.state;return s!==null&&typeof s==="object"?s as Record<string,unknown>:{};};
const here=()=>window.location.pathname+window.location.search;
function write(mode:"push"|"replace",place:BuildingPlace){
  const {building:_drop,...rest}=stateOf();
  const state=place.kind==="list"?{...rest,coreNav:true}:{...rest,coreNav:true,building:place};
  if(mode==="push")window.history.pushState(state,"",here());else window.history.replaceState(state,"",here());
  window.dispatchEvent(new Event(EVENT));
}
const subscribe=(notify:()=>void)=>{window.addEventListener("popstate",notify);window.addEventListener(EVENT,notify);return()=>{window.removeEventListener("popstate",notify);window.removeEventListener(EVENT,notify);};};
const snapshot=()=>JSON.stringify(stateOf().building??null);
export function useBuildingPlace(active:boolean){
  const raw=useSyncExternalStore(subscribe,snapshot,()=>"null");
  const place=useMemo(()=>active?parseBuildingPlace(JSON.parse(raw)):LIST_PLACE,[active,raw]);
  const open=useCallback((next:BuildingPlace)=>write("push",next),[]);
  const replace=useCallback((next:BuildingPlace)=>write("replace",next),[]);
  /** One step up: history back when this entry is a step this screen pushed, else the parent in place. */
  const back=useCallback(()=>{if(parseBuildingPlace(stateOf().building).kind!=="list")window.history.back();else write("replace",parentPlace(place));},[place]);
  const reset=useCallback(()=>write("replace",LIST_PLACE),[]);
  return useMemo(()=>({place,open,replace,back,reset}),[place,open,replace,back,reset]);
}
```

  (`stateOf()`에 다른 층의 표시(`coreNav`, Next의 표시)가 있어도 그대로 둔다. `detail` 표시는 이 화면에서 생기지 않는다.)
- [ ] **Step 4:** 같은 명령으로 통과
- [ ] **Step 5:** 커밋 `feat(core): 건물·호실 관리 opens a /core screen with its own history steps`

### Task 3: 목록·건물 화면과 입력 화면(보여 주기)

**Files:** Create `building-views.tsx`, `building-forms.tsx`, `buildings.module.css` and their tests

**Interfaces:**
- Consumes: `CoreBuildingListDto`, `CoreBuildingInfoDto`, `CoreUnitDto`, `HEATING_TYPE_NAMES`, `MANAGEMENT_MODE_NAMES`
- Produces:
  - `BuildingList({list,selectedId,disabled,onOpen(id),onAdd()})`: 제목 `건물 {n}곳`(h2), 행(버튼, `data-building-row`) = 이름 또는 `건물`, 보조 줄 `호실 {n}개` 또는 `이름 없음 · 호실 {n}개`, `needsInfo`면 대기 색 상태 라벨 `정보 입력 필요`, 고른 행 `aria-current="true"`. `list.editable`이면 주요 버튼 `건물 추가하기`, 아니면 안내 `체험에서는 바꿀 수 없어요.` 빈 목록은 `아직 건물이 없어요. 건물을 추가해 주세요.`(보기만이면 `아직 건물이 없어요.`)
  - `BuildingDetail({info,units,notice,onEdit(),onAddUnit()})`: `건물 정보`(h2)와 사실 행 넷(`건물 이름`, `업체에 알려 줄 주소`, `난방 방식`, `관리 방식`). 값이 없으면 `version`이 0이면 `입력 전`(대기 색 글자), 저장한 적 있으면 난방·관리는 `모름`, 이름·주소는 `입력 전`. 편집 가능하면 `고치기`(보조). `호실 {n}개`(h2)와 호실 이름 행(이 건물의 호실, 받은 순서 그대로), 편집 가능하면 `호실 추가하기`(휴대폰·태블릿 주요, 1120px 이상 두 칸일 때 보조), 아니면 `체험에서는 바꿀 수 없어요.`. 빈 호실은 `아직 호실이 없어요. 호실을 추가해 주세요.`(보기만이면 `아직 호실이 없어요.`). `notice`가 있으면 맨 위 안내 상자(`role="alert"`).
  - `BuildingInfoForm({info,busy,error,onSave(input),onReload()})`: 이름(필수, 도움말 `세입자와 업체에게 보이는 이름이에요.`), 업체에 알려 줄 주소(선택, 안내 글자 `예: 서울시 예시구 예시로 12`, 도움말 `업체에 수리를 맡길 때만 보내요. 호수는 적지 않아요.`), 난방 방식 타일(`개별난방`/`집마다 보일러`, `중앙·공용난방`/`건물 공용 설비`, `모름`/`세입자에게 물어요`), 관리 방식 타일(`건물주 직접 관리`/`건물주가 처리`, `관리사무소`/`사무소가 처리`, `모름`/`관리자가 검토`), 아래 안내 `고른 값은 세입자 질문과 처리 경로 추천에 쓰여요. 추천은 늘 관리자가 확인해요.`, 주요 버튼 `저장하기`. 칸 오류는 칸 아래(`aria-invalid`, `aria-describedby`): 이름 `건물 이름을 1~50자로 적어 주세요. 줄바꿈이나 보이지 않는 글자는 쓸 수 없어요.`, 주소 `주소는 200자 안으로 적어 주세요. 줄바꿈이나 보이지 않는 글자는 쓸 수 없어요.` 검사를 통과하면 `onSave({expectedVersion:info.version,displayName,serviceAddress:빈 칸이면 null,heatingType,managementMode})`. `error`가 `"conflict"`면 `다른 관리자가 먼저 고쳤어요. 새로 불러온 내용을 확인하고 다시 저장해 주세요.` + `새로 불러오기`, `"uncertain"`이면 `저장 결과를 확인하지 못했어요. 새로 불러와 저장됐는지 확인해 주세요.` + `새로 불러오기`, `"missing"`이면 `이 건물을 열 수 없어요. 목록을 새로고침하고 다시 골라 주세요.` `info`가 바뀌면(새로 불러오기) 칸을 새 값으로 채운다.
  - `AddBuildingForm({busy,error,onSubmit(name),onReload()})`: 제목 `어떤 건물인가요?`(h2), 건물 이름(안내 글자 `예: 햇살빌라`, 도움말 `추가한 뒤 건물 화면에서 주소와 난방·관리 방식을 넣어요.`), 주요 버튼 `건물 추가하기`. `error` `"uncertain"`: `건물을 추가했는지 확인하지 못했어요. 목록을 새로 불러와 확인한 뒤 필요하면 다시 추가해 주세요.` + `목록 새로 불러오기`. `"invalid"`: 이름 칸 오류.
  - `AddUnitForm({busy,error,onSubmit(label),onReload()})`: 제목 `어떤 호실인가요?`, 호실 이름(안내 글자 `예: 101호`, 도움말 `세입자와 업체에게 보이는 이름이에요.`), 주요 버튼 `호실 추가하기`. 오류: 이름 `호실 이름을 1~80자로 적어 주세요. 줄바꿈이나 보이지 않는 글자는 쓸 수 없어요.`, `"duplicate"` `이 건물에 같은 이름의 호실이 있어요. 다른 이름을 적어 주세요.`(칸 오류), `"uncertain"` `호실을 추가했는지 확인하지 못했어요. 호실 목록을 새로 불러와 확인한 뒤 필요하면 다시 추가해 주세요.` + `새로 불러오기`.
  - `unitLabelValid(label)`: `B3UnitCreateSchema.safeParse({label}).success && !/[\p{Cc}\p{Cf}]/u.test(label)`
- [ ] **Step 1: 실패 시험**(`building-views.test.tsx`는 `renderToStaticMarkup`, `building-forms.test.tsx`는 jsdom `createRoot`+`act`)
  - 목록: 행 셋(이름 있음/정보 부족/이름 없음)의 글자와 라벨, `editable:false`면 버튼 없이 안내, 빈 목록 문장 두 가지, `selectedId` 행만 `aria-current`
  - 건물 화면: 사실 행 값(`개별난방`, `입력 전`, 저장한 적 있는 건물의 `모름`), 다른 건물의 호실은 안 보임, 보기만이면 `고치기`·`호실 추가하기` 없음과 안내, `notice` 안내 상자
  - 정보 고치기: 처음 값이 `info`에서 옴, 빈 주소는 `null`, 이름 앞뒤 공백은 잘라 보냄, 폭 없는 공백(`String.fromCodePoint(0x200b)`)이 든 이름은 칸 오류이고 `onSave`를 부르지 않음, `모름` 타일은 `null`, 충돌·저장 불확실 문장과 `새로 불러오기`, 새 `info`가 오면 칸이 바뀜
  - 건물 추가·호실 추가: 검사, 오류 문장, 제출 값
  - 문구 검사: `apps/web/src/app/core/haeyo-copy.test.ts`가 새 파일도 읽는지 확인하고, 읽지 않으면 대상에 `buildings/`를 더한다
- [ ] **Step 2:** apps/web에서 `npx vitest run src/app/core/buildings` → 실패
- [ ] **Step 3: 구현**
  - 컴포넌트는 위 인터페이스대로. 버튼은 `core-design.module.css`의 `.root button`·`button.primary` 모양을 쓰고(`styles.primary` 클래스), 목록 행은 `nav/core-nav.module.css`의 행 규칙과 같은 값(위아래 15px, 최소 50px, `subheading`)을 `buildings.module.css`에 둔다.
  - `buildings.module.css`
    - `.workspace`: 한 칸. `@media (min-width:1120px)`에서 `[data-detail="true"]`이면 `grid-template-columns: 380px minmax(0,1fr)`, 목록 칸 오른쪽 `border` 1px. 1120px 미만에서 건물 화면이면 목록 칸을 숨김
    - 화면 여백: 휴대폰 20px, 768px부터 30px, 1440px부터 40px(규칙 7)
    - `.bar`(하단 고정 버튼): 767px 이하에서 `position: fixed; left:0; right:0; bottom:0; z-index:10; padding: .625rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom,0px)); background: var(--color-surface); box-shadow: inset 0 1px 0 var(--color-border)`, 버튼 폭 100%. 이 막대가 있는 화면은 내용 아래에 `5rem + 안전 영역` 여백. `:global(html):has([data-building-bar])`에 `--toast-bottom: calc(5.625rem + env(safe-area-inset-bottom,0px))`, `scroll-padding-bottom: calc(6.25rem + env(safe-area-inset-bottom,0px))`. 768px부터 막대는 제자리, 버튼은 글자 길이
    - 사실 행: 위아래 15px, 이름 `text-secondary`, 값 600, 행 사이 `border`. 값 없음은 `--status-wait-text`
    - 타일: `evidenceTiles`와 같은 격자(최소 `max(9rem, (100% - 1.25rem)/3)`), 안쪽 15px, 테두리 `border-control`, 모서리 10px, 고름 `primary` 2px + `primary-soft`, 이름 `subheading` 가운데, 설명 `caption` `text-secondary` 가운데, `data-tile`
    - 상태 라벨: `.reasonBadge`와 같은 값(대기 색 짝, `label`, 5/10px, 모서리 5px)
    - `고치기`: 767px 이하 글자 버튼(규칙 3.4, `primary` 밑줄 5px), 768px부터 보조 버튼
    - 1120px 이상 두 칸에서 `호실 추가하기`는 보조 버튼 모양(목록 칸의 `건물 추가하기`가 그 화면의 주요 버튼)
- [ ] **Step 4:** 같은 명령으로 통과
- [ ] **Step 5:** 커밋 `feat(core): building list, building screen and info forms`

### Task 4: 읽기·저장 흐름과 `/core` 연결

**Files:** Create `buildings-screen.tsx`(+test); Modify `core-screen.tsx`

**Interfaces:**
- Consumes: Task 1–3
- Produces: `BuildingsScreen({client,orgId,units,place,revision,disabled,onOpen,onReplace,onBack,onName,onUnitsChanged})`

- [ ] **Step 1: 실패 시험**(`buildings-screen.test.tsx`, 가짜 `client.buildings`)
  - 목록을 읽고, 행을 누르면 `onOpen({kind:"building",id})`
  - `place`가 building이면 그 건물 정보를 읽어 보이고, `onName`에 이름(정보가 오기 전에는 목록 이름)
  - 정보 저장 성공: `save` 값, `onUnitsChanged`, 목록 다시 읽기, `onBack()`, 토스트 `저장했어요`
  - 저장 409: 충돌 문장, `새로 불러오기`가 다시 읽고 칸을 새 값으로 채움. 네트워크 실패: 저장 불확실 문장
  - 건물 추가 성공: `create(orgId,name)` 다음 `save(id,{expectedVersion:0,displayName:name,serviceAddress:null,heatingType:null,managementMode:null})`, `onReplace({kind:"building",id})`, 토스트 `건물을 추가했어요`
  - 건물 추가 두 번째 실패: `onReplace({kind:"building",id})`와 건물 화면 안내 `건물은 추가했어요. 이름을 저장하지 못했어요. 건물 정보에서 다시 저장해 주세요.`
  - 건물 추가 첫 번째 결과 모름(네트워크): 저장을 부르지 않고 불확실 문장, `목록 새로 불러오기`가 목록을 다시 읽음
  - 호실 추가 성공: `addUnit(orgId,id,label)`, `onUnitsChanged`, `onBack()`, 토스트 `호실을 추가했어요`. 409: 같은 이름 칸 오류
  - 목록 읽기 실패: 안내 상자 `건물 목록을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.` + `다시 시도하기`
  - 보기만(`editable:false`): edit·add·addUnit 위치여도 입력 칸 없이 `체험에서는 바꿀 수 없어요.`
  - `revision`이 바뀌면 목록과 정보를 다시 읽음
- [ ] **Step 2:** apps/web에서 `npx vitest run src/app/core/buildings/buildings-screen.test.tsx` → 실패
- [ ] **Step 3: 구현**
  - `buildings-screen.tsx`: 위 흐름. 늦게 온 응답은 지금 고른 건물이 아니면 버린다. 저장·추가 중에는 같은 버튼을 다시 누를 수 없다. 오류 상태 코드: 409 → conflict/duplicate, 404 → missing, 400 → invalid, 그 밖과 네트워크 → uncertain(401·403은 화면의 기존 접근 처리 `checkedFetch`가 화면을 비운다).
  - `core-screen.tsx`
    - `const buildingNav=useBuildingPlace(view==="buildings")`, `const [buildingName,setBuildingName]=useState<string|null>(null)`, `const buildingTitle=view==="buildings"?placeTitle(buildingNav.place,buildingName):null`
    - 제목: 지금 식의 마지막 `navTitle(session.role,location)`을 `buildingTitle??navTitle(session.role,location)`로
    - 뒤로 버튼: `selected`이 아니고 `buildingTitle`이 있으면 `<BackButton wide onClick={buildingNav.back}/>`(모든 폭), 아니면 지금처럼. `data-menu-screen`은 `buildingTitle`이 있으면 붙이지 않는다(하위 화면 제목 모양)
    - 초점: `place` 열쇠에 `view==="buildings"?placeKey(buildingNav.place):""`를 더한다
    - `navigate`: `next.view==="buildings"&&view==="buildings"`면 `buildingNav.reset()`(같은 메뉴를 다시 누르면 목록 맨 위, 규칙 8.14)
    - 그리기: `{!tenant&&!selected&&view==="buildings"&&b1?<BuildingsScreen client={client} orgId={b1.orgId} units={units} place={buildingNav.place} revision={revision} disabled={busy} onOpen={buildingNav.open} onReplace={buildingNav.replace} onBack={buildingNav.back} onName={setBuildingName} onUnitsChanged={async()=>setUnits(await client.units())}/>:null}`
- [ ] **Step 4:** 같은 명령과 `npx vitest run src/app/core` 통과
- [ ] **Step 5:** 커밋 `feat(core): wire the building screen into /core`

### Task 5: 화면 자동 시험과 디자인 점검

**Files:** Create `apps/web/tests/core-login-e2e/buildings.spec.ts`; Modify `navigation.spec.ts`, `scripts/design-audit.mjs`, `scripts/vendor-handoff-dev.mjs`

- [ ] **Step 1: 시험**
  - `buildings.spec.ts`(합성 SDK 세션): 새 관리자 계정과 새 조직(조직 관리자 소속)을 만든다(`onboarding.spec.ts`의 `setup`과 같은 방식, 기존 조직 A의 호실 수를 늘리지 않는다).
    - 390px: `/core?tab=more&view=buildings` → 빈 목록 문장 → `건물 추가하기` → 상단 바 `건물 추가` → 이름 `합성 건물 {짧은 id}` → `건물 추가하기` → 상단 바가 그 이름 → `고치기` → 주소 `합성 주소 1`, `개별난방` → `저장하기` → 건물 화면에 `개별난방`과 주소 → `호실 추가하기` → `101호` → 호실 행 `101호`, `호실 1개` → 브라우저 뒤로 → 목록(행에 그 이름, `정보 입력 필요` 없음)
    - API로 확인: 그 조직 머리글로 `GET /api/v2/core/units`에 `{buildingName:이름,label:"101호"}`, `GET /api/v2/core/buildings/{id}`가 `heatingType:"INDIVIDUAL"`, `managementMode:null`
    - 1280px: 같은 조직에서 목록과 건물 화면이 나란히(행 `aria-current`, 건물 화면 사실 행이 함께 보임), 화면 가로 스크롤 없음
    - 화면 캡처(합성): `~/.build-manager-rc1-private/buildings-sdk/` 390·1280
  - `navigation.spec.ts`: `건물·호실 관리`를 누르면 `/core?tab=more&view=buildings`, `aria-current="page"`, 제목 `건물·호실 관리`
  - `vendor-handoff-dev.mjs`: `export async function freshAccountSession(state, who)` — 계정의 `subject`로 새 손잡이·CSRF·쿠키를 만들어 돌려준다(완료 단계는 60초 안에 발급한 것만 받는다)
  - `design-audit.mjs`: 넓이마다 `manager-buildings`(체험 관리자, 보기만 목록)와 `manager-building`(첫 행), 그리고 체험이 아닌 조직 관리자(`otherManager`)로 첫 엔진에서 건물 하나를 화면으로 추가한 뒤 넓이마다 `admin-buildings`, `admin-building-add`, `admin-building`, `admin-building-edit`, `admin-unit-add`
- [ ] **Step 2:** 실행(무거움, 다른 세션에 먼저 알림): `npm run build:web`, `npm run test:e2e:sdk -- buildings.spec.ts navigation.spec.ts`, `node --experimental-transform-types scripts/design-audit.mjs <private 폴더>`(크롬·WebKit). 발견 0건까지 고친다(오탐이면 PR에 이유)
- [ ] **Step 3:** 커밋 `test(core): building screen browser flow and design audit screens`

### Task 6: 기록과 검사

- [ ] 설계서: 2026-10-16 결정 줄, PR 2 절을 구현에 맞춤(`/workspace` 그대로, 호실 목록은 Core 목록, 값 이름은 공유 이름표, 자동 시험은 `test:e2e:sdk`), 남은 위험에 "옛 `/workspace` 화면이 로그인 도착 화면에 남음"
- [ ] 시각 페이지 다시 올리기(같은 주소)와 `~/.build-manager-rc1-private/spec-pages/` 사본
- [ ] `ops/building_setup_screen_20261016_acceptance.md`, `STATUS.md` 35행 갱신, 실행 로그 한 줄, 대기 동기화 한 줄, `design/DESIGN_STATUS.md`(건물·호실 관리가 `/core`로 옴, `/workspace`는 그대로 남음)
- [ ] DEV-06·DEV-04: `test:shared`, `test:web`, `lint`, `typecheck`, `build:web`, `check:deps`, `test:e2e:core`, `test:e2e:sdk`, 디자인 점검, `verify_repository.py --history`(필요하면 이 브랜치만 복제)
- [ ] 새 문맥 독립 리뷰(읽기만) → 고침 → PR 본문 → CI → 병합. 데모 배포는 운영자 확인 뒤 따로
