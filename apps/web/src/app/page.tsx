import Link from "next/link";
import type { ReactNode } from "react";
import { parseApplicationMode } from '../runtime/application-mode';
import { demoEntryMode } from '../runtime/demo-entry-mode';
import { INTAKE_STATUS_NAMES, WORK_STATUS_NAMES } from "../components/status-names";
import styles from "./home.module.css";
export const dynamic = "force-dynamic";

// First-visitor page. The layout follows the reference site the operator picked on 2026-10-13 (design rules §1):
// a two-column opening, one wide panel of drawn screens, then sections of heading, text and panels. Every value is a
// design-rules token, and every drawn screen uses the app's own wording on synthetic data.

// The example ticket is the page's one real-looking record; it stays readable to screen readers.
function ExampleTicket() {
  return (
    <figure className={styles.ticket} aria-labelledby="example-ticket-caption">
      <figcaption id="example-ticket-caption" className={styles.caption}>예시 접수 한 건 · 체험용 데이터</figcaption>
      <div className={styles.ticketHead}>
        <p className={styles.unit}>101동 1203호 · 난방</p>
        <span className={styles.status} data-state="progress">{WORK_STATUS_NAMES.IN_PROGRESS}</span>
      </div>
      <p className={styles.quote}>거실 보일러가 켜지지 않아요. 온수도 미지근해요.</p>
      <ol className={styles.timeline} aria-label="처리 과정">
        <li data-state="done"><time>10월 8일 (목) 오전 9:12</time><span>세입자 접수 · 사진 2장</span></li>
        <li data-state="done"><time>오전 9:40</time><span>관리자 확인 · 업체에 방문 요청</span></li>
        <li data-state="current"><time>오후 1:05</time><span>방문 일정 확정 · 10월 9일 (금) 오후 2:00–4:00</span></li>
        <li data-state="next"><span>처리 결과 기록 기다리는 중</span></li>
      </ol>
    </figure>
  );
}

// Drawn screens below are pictures: their parts are hidden from screen readers and the panel carries one name.
function IntakePhone() {
  return (
    <div className={styles.phone} aria-hidden="true">
      <p className={styles.phoneTitle}>어떤 문제가 있나요?</p>
      <div className={styles.tiles}><span data-selected="true">난방</span><span>누수</span></div>
      <p className={styles.fieldLabel}>문제 설명</p>
      <p className={styles.field}>거실 보일러가 켜지지 않아요. 온수도 미지근해요.</p>
      <p className={styles.caption}>사진 2장</p>
      <span className={styles.fakeButton}>접수하기</span>
    </div>
  );
}

function QueueWindow() {
  return (
    <div className={styles.window}>
      <p className={styles.windowBar} aria-hidden="true">업무함 · 체험용 데이터</p>
      <div className={styles.windowBody}>
        <ul className={styles.queue} aria-hidden="true">
          <li><span className={styles.rowTitle}>101동 1203호 · 난방</span><span className={styles.rowMeta}>10월 8일 (목) 오전 9:12 접수</span><span className={styles.status} data-state="progress">{WORK_STATUS_NAMES.IN_PROGRESS}</span></li>
          <li><span className={styles.rowTitle}>102동 803호 · 누수</span><span className={styles.rowMeta}>10월 8일 (목) 오전 10:20 접수</span><span className={styles.status} data-state="open">{WORK_STATUS_NAMES.OPEN}</span></li>
          <li><span className={styles.rowTitle}>101동 402호 · 누수</span><span className={styles.rowMeta}>10월 6일 (화) 오후 3:30 접수</span><span className={styles.status} data-state="done">{WORK_STATUS_NAMES.COMPLETED}</span></li>
        </ul>
        <ExampleTicket />
      </div>
    </div>
  );
}

function Showcase() {
  return (
    <figure className={styles.showcase} aria-label="세입자 접수 화면과 관리자 업무함 예시 · 체험용 데이터">
      <IntakePhone />
      <QueueWindow />
    </figure>
  );
}

function Steps() {
  return (
    <section className={styles.steps} aria-labelledby="steps-title">
      <div className={styles.container}>
        <h2 id="steps-title" className={styles.stepsTitle}>이렇게 진행돼요</h2>
        <ol>
          <li><span>세입자가 문제 종류를 고르고 사진과 함께 접수해요.</span></li>
          <li><span>중앙난방인지 개별난방인지 같은 건물 정보에 따라 묻는 질문이 달라져요. 가스 냄새처럼 위험한 신호가 보이면 일반 접수를 멈추고 안전 안내부터 보여 줘요.</span></li>
          <li><span>관리자가 내용을 확인하고 업체에 방문을 맡겨요. 업체는 로그인 없이 받은 링크로 방문 일정을 정해요.</span></li>
          <li><span>방문 결과와 수리 이력이 세대마다 남아서, 다음에 같은 문제가 생기면 지난 기록부터 볼 수 있어요.</span></li>
        </ol>
      </div>
    </section>
  );
}

function SectionHead({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className={styles.sectionHead}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 id={id} className={styles.headline}>{title}</h2>
      </div>
      <p className={styles.sectionLead}>{children}</p>
    </div>
  );
}

function TenantSection() {
  return (
    <section id="tenant" className={styles.section} aria-labelledby="tenant-title">
      <div className={styles.container}>
        <div className={styles.split}>
          <div className={styles.splitText}>
            <p className={styles.eyebrow}>세입자</p>
            <h2 id="tenant-title" className={styles.headline}>사진과 몇 가지 답이면 접수가 끝나요</h2>
            <p className={styles.sectionLead}>문제 종류를 고르고 사진을 올리면 건물 정보에 맞춘 질문이 이어져요. 중앙난방인지 개별난방인지에 따라 묻는 내용이 달라요.</p>
          </div>
          <figure className={styles.panel} aria-label="건물 정보에 맞춘 질문 화면 예시 · 체험용 데이터">
            <div className={styles.phone} aria-hidden="true">
              <p className={styles.chip}>난방 방식: 개별난방 · 건물 확인</p>
              <p className={styles.phoneTitle}>보일러 또는 조절기 전원이 켜져 있나요?</p>
              <div className={styles.tiles}><span>예</span><span data-selected="true">아니오</span></div>
              <span className={styles.fakeButton}>다음</span>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}

function ManagerSection() {
  return (
    <section id="manager" className={styles.section} aria-labelledby="manager-title">
      <div className={styles.container}>
        <SectionHead id="manager-title" eyebrow="관리자" title="접수 확인부터 업체 방문까지 이어서 챙겨요">
          가스 냄새처럼 위험한 신호가 보이면 일반 접수를 멈추고 안전 안내부터 보여 줘요. 업체는 로그인 없이 받은 링크로 방문 일정을 정해요.
        </SectionHead>
        <ul className={styles.cards}>
          <li className={styles.card}>
            <div className={styles.cardVisual} aria-hidden="true">
              <div className={styles.mini}>
                <span className={styles.status} data-state="urgent">{INTAKE_STATUS_NAMES.SAFETY_ESCALATED}</span>
                <p>안전 위험 신호가 있어 일반 추천을 중단했어요. 사람이 직접 확인해야 해요.</p>
              </div>
            </div>
            <h3>위험하면 먼저 멈춰요</h3>
            <p>위험 신호가 있으면 일반 추천을 멈추고 사람이 직접 확인하게 해요.</p>
          </li>
          <li className={styles.card}>
            <div className={styles.cardVisual} aria-hidden="true">
              <div className={styles.mini}>
                <span className={styles.status} data-state="wait">{INTAKE_STATUS_NAMES.NEEDS_MORE_INFO}</span>
                <p className={styles.miniTitle}>온수도 나오지 않나요?</p>
                <div className={styles.tiles}><span>예</span><span>아니오</span></div>
              </div>
            </div>
            <h3>부족한 정보는 다시 물어봐요</h3>
            <p>답이 비어 있거나 서로 맞지 않으면 세입자에게 한 번 더 확인해요.</p>
          </li>
          <li className={styles.card}>
            <div className={styles.cardVisual} aria-hidden="true">
              <div className={styles.mini}>
                <p className={styles.fieldLabel}>제안한 방문 시간</p>
                <p className={styles.miniTitle}>10월 9일 (금) 오후 2:00–4:00</p>
                <p className={styles.caption}>세입자가 있을 때만 방문</p>
              </div>
            </div>
            <h3>업체는 링크로 일정을 정해요</h3>
            <p>업체는 로그인 없이 받은 링크에서 방문 시간을 제안해요.</p>
          </li>
        </ul>
      </div>
    </section>
  );
}

function RecordSection() {
  return (
    <section id="record" className={styles.section} aria-labelledby="record-title">
      <div className={styles.container}>
        <SectionHead id="record-title" eyebrow="수리 기록" title="세대마다 수리 이력이 남아요">
          방문 결과와 수리 이력이 세대마다 쌓여요. 같은 문제가 다시 생기면 지난 기록부터 볼 수 있어요.
        </SectionHead>
        <figure className={styles.panel} aria-label="101동 1203호 정비 이력 예시 · 체험용 데이터">
          <div className={styles.history} aria-hidden="true">
            <p className={styles.historyHead}>101동 1203호 정비 이력</p>
            <ul>
              <li><span className={styles.rowTitle}>난방 · 업체 방문</span><span className={styles.rowMeta}>10월 9일 (금) 오후 2:00–4:00</span><span className={styles.status} data-state="done">{WORK_STATUS_NAMES.COMPLETED}</span></li>
              <li><span className={styles.rowTitle}>누수 · 관리사무소 처리</span><span className={styles.rowMeta}>8월 12일 (수)</span><span className={styles.status} data-state="done">{WORK_STATUS_NAMES.COMPLETED}</span></li>
              <li><span className={styles.rowTitle}>난방 · 업체 방문</span><span className={styles.rowMeta}>3월 4일 (수)</span><span className={styles.status} data-state="done">{WORK_STATUS_NAMES.COMPLETED}</span></li>
            </ul>
          </div>
        </figure>
      </div>
    </section>
  );
}

// The top bar repeats the way in: demo modes scroll to the entry beside the title, sign-in mode goes to sign-in.
function Landing({ title, lead, entry, cta }: { title: [string, string]; lead: string; entry: ReactNode; cta: { label: string; href: string } }) {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <div className={`${styles.container} ${styles.barInner}`}>
          <p className={styles.wordmark}>자취사무소</p>
          <nav className={styles.nav} aria-label="페이지 안내">
            <a href="#tenant">세입자</a>
            <a href="#manager">관리자</a>
            <a href="#record">수리 기록</a>
          </nav>
          <a className={styles.primary} href={cta.href}>{cta.label}</a>
        </div>
      </header>
      <main>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.container}>
            <div className={styles.heroGrid}>
              <h1 id="home-title" className={styles.heroTitle}>{title[0]}<br />{" "}{title[1]}</h1>
              <div id="entry" className={styles.heroSide}>
                <p className={styles.lead}>{lead}</p>
                <section className={styles.entry} aria-labelledby="entry-title">{entry}</section>
              </div>
            </div>
            <Showcase />
          </div>
        </section>
        <Steps />
        <TenantSection />
        <ManagerSection />
        <RecordSection />
      </main>
      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <p className={styles.wordmark}>자취사무소</p>
          <p className={styles.caption}>이 페이지의 화면 예시는 모두 체험용 가짜 건물·세대 데이터예요.</p>
        </div>
      </footer>
    </div>
  );
}

const TITLE: [string, string] = ["세입자 수리 요청,", "문자 대신 여기서 받아요"];
const LEAD = "세입자가 사진과 함께 접수하면 건물 정보에 맞춘 질문으로 필요한 내용이 채워져요. 관리자는 확인하고 업체에 방문을 맡기고, 처리 과정은 세입자도 함께 봐요.";

export default function Home() {
  const mode=parseApplicationMode(process.env.BUILD_MANAGER_MODE);
  if(mode==='B1'&&demoEntryMode())return <Landing title={TITLE} lead={LEAD} cta={{label:"체험하기",href:"#entry"}} entry={<>
    <h2 id="entry-title" className={styles.entryTitle}>로그인 없이 바로 써 보기</h2>
    <p>체험용 가짜 건물·세대 데이터로 들어가요. 누구나 바꿀 수 있어요.</p>
    <div className={styles.actions}>
      <form action="/api/v2/session/demo" method="post"><input type="hidden" name="role" value="manager"/><button className={styles.primary} type="submit">관리자로 체험하기</button></form>
      <form action="/api/v2/session/demo" method="post"><input type="hidden" name="role" value="tenant"/><button className={styles.secondary} type="submit">세입자로 체험하기</button></form>
    </div>
    <p className={styles.caption}>지금 접수할 수 있는 문제는 난방과 누수 두 가지예요. 업체 화면은 관리자가 업체에 방문을 맡길 때 만들어지는 링크로 열려요.</p>
  </>}/>;
  if(mode==='B1')return <Landing title={TITLE} lead={LEAD} cta={{label:"로그인하기",href:"/auth/login"}} entry={<>
    <h2 id="entry-title" className={styles.entryTitle}>내 조직으로 들어가기</h2>
    <p>로그인하면 내 조직의 건물과 접수 내용을 볼 수 있어요.</p>
    <div className={styles.actions}>
      <a className={styles.primary} href="/auth/login">로그인하기</a>
      <Link className={styles.textLink} href="/workspace">내 조직으로 이동</Link>
    </div>
  </>}/>;
  if(mode!=='DEMO')return <div className={styles.page}><main className={styles.container}><h1 className={styles.heroTitle}>서비스를 준비하고 있어요.</h1></main></div>;
  return <Landing title={TITLE} lead={LEAD} cta={{label:"데모 시작하기",href:"#entry"}} entry={<>
    <h2 id="entry-title" className={styles.entryTitle}>데모 시작하기</h2>
    <p>합성 데이터로 만든 데모예요. 실제 인증과 업체 배정은 하지 않아요. 안전 진단을 대신하지 않으며, 위험 신호가 보이면 일반 절차를 중단해요.</p>
    <div className={styles.actions}>
      <Link className={styles.primary} href="/demo/tenant">세입자 데모 시작</Link>
      <Link className={styles.secondary} href="/demo/landlord">임대인 데모 시작</Link>
    </div>
    {process.env.CORE_FLOW_MODE === "SYNTHETIC_LOCAL" ? <p><Link className={styles.textLink} href="/core">RC1 수리 접수·처리 시작</Link></p> : null}
  </>}/>;
}
