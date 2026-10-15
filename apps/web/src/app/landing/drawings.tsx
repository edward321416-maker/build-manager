import type { ReactNode } from "react";
import { ACCESS_POLICY_NAMES, TODO_REASON_NAMES, WORK_STATUS_NAMES } from "../../components/status-names";
import styles from "../home.module.css";

// Drawn screens for the landing scenes. They are pictures: each figure carries one name and its parts are hidden from
// screen readers. Every word on them is the app's own (checked against main 1d88457); the data is synthetic.

type State = "progress" | "done" | "wait" | "urgent" | "open";
const DONE = `✓ ${WORK_STATUS_NAMES.COMPLETED}`;

function Status({ state, children }: { state: State; children: ReactNode }) {
  return <span className={styles.status} data-state={state}>{children}</span>;
}

/** One screen of a step scene; the scene shows the screen whose index is its step. */
function Screen({ index, children }: { index: number; children: ReactNode }) {
  return <div className={styles.screen} data-screen={index}>{children}</div>;
}

function Phone({ top, children }: { top: string; children: ReactNode }) {
  return <div className={styles.phone} aria-hidden="true"><p className={styles.phoneTop}>{top}</p>{children}</div>;
}

function Window({ top, children }: { top: string; children: ReactNode }) {
  return <div className={styles.window} aria-hidden="true"><p className={styles.windowTop}>{top}</p>{children}</div>;
}

function Row({ title, meta, state, status, row }: { title: string; meta: string; state: State; status: string; row?: number }) {
  return <li data-row={row}><span className={styles.rowTitle}>{title}</span><span className={styles.rowMeta}>{meta}</span><Status state={state}>{status}</Status></li>;
}

/** First scene: one request as the tenant's 홈 and the manager's 업무함 show it. */
export function HomePair() {
  return (
    <figure className={styles.pair} aria-label="같은 요청을 보는 세입자 홈 화면과 관리자 업무함 예시 · 체험용 데이터">
      <Phone top="홈">
        <div className={styles.screen}>
          <p className={styles.screenTitle}>101동 1203호</p>
          <p className={styles.label}>진행 중인 요청 2건</p>
          <ul className={`${styles.rows} ${styles.homeRows}`}>
            <li><span className={styles.rowTitle}>난방 · 101동 1203호 <Status state="progress">{WORK_STATUS_NAMES.IN_PROGRESS}</Status></span><span className={styles.rowMeta}>관리자가 처리하고 있어요.</span></li>
            <li><span className={styles.rowTitle}>누수 · 101동 1203호 <Status state="open">{WORK_STATUS_NAMES.OPEN}</Status></span><span className={styles.rowMeta}>관리자 확인을 기다리고 있어요.</span></li>
          </ul>
        </div>
      </Phone>
      <Window top="업무함">
        <div className={styles.screen}>
          <ul className={styles.rows}>
            <Row title="난방 · 101동 1203호" meta="10월 8일 (목) 오전 9:12 접수" state="progress" status={WORK_STATUS_NAMES.IN_PROGRESS} />
            <Row title="누수 · 101동 1203호" meta="10월 8일 (목) 오전 10:20 접수" state="open" status={WORK_STATUS_NAMES.OPEN} />
            <Row title="누수 · 102동 803호" meta="10월 6일 (화) 오후 3:30 접수" state="done" status={DONE} />
          </ul>
        </div>
      </Window>
    </figure>
  );
}

export function TenantPhone() {
  return (
    <figure className={styles.device} aria-label="세입자 접수 화면 세 단계 예시 · 체험용 데이터">
      <Phone top="홈">
        <Screen index={0}>
          <p className={styles.screenTitle}>어떤 문제가 있나요?</p>
          <div className={styles.tiles}><span data-selected="">난방</span><span>누수</span></div>
          <p className={styles.label}>문제 설명</p>
          <p className={styles.field}>거실 보일러가 켜지지 않아요. 온수도 미지근해요.</p>
          <div className={styles.thumbs}><span>사진 1</span><span>사진 2</span><span>＋</span></div>
          <p className={styles.label}>사진 2장 선택됨</p>
          <span className={styles.fakeButton}>접수하기</span>
        </Screen>
        <Screen index={1}>
          <p className={styles.label}>지금 할 일</p>
          <p className={styles.screenTitle}>가스 냄새가 나나요?</p>
          <div className={styles.tiles}><span>예</span><span>아니오</span></div>
          <p className={styles.label}>연기나 불꽃이 보이나요?</p>
        </Screen>
        <Screen index={2}>
          <p className={styles.label}>지금 할 일</p>
          <p className={styles.screenTitle}>보일러 또는 조절기 전원이 켜져 있나요?</p>
          <div className={styles.tiles}><span>예</span><span>아니오</span></div>
          <p className={styles.label}>{"질문에 답하고 필요한 사진을 고르면 '수리 요청 제출' 버튼이 나와요."}</p>
          <span className={styles.fakeButton}>수리 요청 제출</span>
        </Screen>
      </Phone>
    </figure>
  );
}

export function ManagerWindow() {
  return (
    <figure className={styles.device} aria-label="관리자 화면 세 단계 예시 · 체험용 데이터">
      <Window top="관리자 · 체험용 데이터">
        <Screen index={0}>
          <p className={styles.screenTitle}>처리할 일</p>
          <ul className={styles.rows}>
            <Row title="누수 · 103동 201호" meta="방금 (오후 1:58)" state="urgent" status={TODO_REASON_NAMES.SAFETY} />
            <Row title="난방 · 101동 1203호" meta="25분 전 (오후 1:33)" state="wait" status={TODO_REASON_NAMES.DECIDE} />
            <Row title="누수 · 102동 803호" meta="10월 13일 (화) 오후 5:40" state="wait" status={TODO_REASON_NAMES.VENDOR} />
          </ul>
        </Screen>
        <Screen index={1}>
          <p className={styles.screenTitle}>난방 · 101동 1203호</p>
          <p className={styles.label}>추가 정보를 요청하는 이유</p>
          <p className={styles.field}>보일러 상태를 한 번 더 확인하고 싶어요.</p>
          <p className={styles.label}>다시 확인할 질문</p>
          <p className={styles.check}>온수도 나오지 않나요?</p>
          <span className={styles.fakeButton} data-kind="secondary">추가 정보 요청</span>
        </Screen>
        <Screen index={2}>
          <p className={styles.screenTitle}>업체 연결 및 작업 요청</p>
          <p className={styles.label}>공유할 원본 사진 선택</p>
          <p className={styles.check}>원본 사진 1</p>
          <p className={styles.label}>사진은 선택한 것만 업체에 공개돼요.</p>
          <p className={styles.note}>보안 링크를 발급했어요. 업체에 직접 전달하세요.</p>
        </Screen>
      </Window>
    </figure>
  );
}

export function VendorPhone() {
  return (
    <figure className={styles.device} aria-label="업체 작업 화면 세 단계 예시 · 체험용 데이터">
      <Phone top="작업 요청">
        <Screen index={0}>
          <p className={styles.screenTitle}>난방 · 101동 1203호</p>
          <p className={styles.label}>접수 요약</p>
          <p className={styles.note}>거실 보일러가 켜지지 않아요. 온수도 미지근해요.</p>
          <div className={styles.thumbs}><span>사진 1</span></div>
          <span className={styles.fakeButton}>작업 수락</span>
          <span className={styles.fakeButton} data-kind="secondary">작업 거절</span>
        </Screen>
        <Screen index={1}>
          <p className={styles.screenTitle}>확정된 방문 일정</p>
          <p className={styles.field}>10월 9일 (금) 오후 2:00–4:00</p>
          <p className={styles.label}>{ACCESS_POLICY_NAMES.TENANT_PRESENT_REQUIRED}</p>
          <span className={styles.fakeButton}>방문 시작</span>
        </Screen>
        <Screen index={2}>
          <p className={styles.screenTitle}>작업 보고</p>
          <p className={styles.label}>작업 내용</p>
          <p className={styles.field}>순환 펌프를 교체했어요.</p>
          <p className={styles.label}>사용한 부품·자재</p>
          <p className={styles.field}>순환 펌프 1개</p>
          <div className={styles.thumbs}><span>사진 1</span><span>사진 2</span></div>
          <p className={styles.note}>작업 보고를 제출했어요.</p>
        </Screen>
      </Phone>
    </figure>
  );
}

/** Result and record: the tenant's result question, then the unit's history rows, arriving one by one. */
export function RecordPanel() {
  return (
    <figure className={styles.record} aria-label="결과 확인과 101동 1203호 정비 이력 예시 · 체험용 데이터">
      <div className={styles.resultCard} data-row={0} aria-hidden="true">
        <Status state="done">{DONE}</Status>
        <p>관리자가 남긴 완료 기록을 확인하고 현재 상태를 알려주세요.</p>
        <div className={styles.tiles}><span>해결됐어요</span><span>아직 문제가 있어요</span></div>
      </div>
      <ul className={`${styles.rows} ${styles.history}`} aria-hidden="true">
        <Row row={1} title="난방 · 부품 교체" meta="10월 9일 (금)" state="done" status={DONE} />
        <Row row={2} title="누수 · 점검" meta="3월 4일 (수)" state="done" status={DONE} />
        <Row row={3} title="난방 · 수리" meta="2025년 12월 2일" state="done" status={DONE} />
      </ul>
    </figure>
  );
}
