import Link from "next/link";
import type { ReactNode } from "react";
import { parseApplicationMode } from '../runtime/application-mode';
import { demoEntryMode } from '../runtime/demo-entry-mode';
import styles from "./home.module.css";
export const dynamic = "force-dynamic";

// First-visitor page on design rules v1 (design/DESIGN_RULES.md). The example ticket is the page's one signature element.
function ExampleTicket() {
  return (
    <figure className={styles.ticket} aria-labelledby="example-ticket-caption">
      <figcaption id="example-ticket-caption" className={styles.caption}>예시 접수 한 건 · 체험용 데이터</figcaption>
      <div className={styles.ticketHead}>
        <p className={styles.unit}>101동 1203호 · 난방</p>
        <span className={styles.status} data-state="progress">처리중</span>
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

function Steps() {
  return (
    <section className={styles.steps} aria-labelledby="steps-title">
      <h2 id="steps-title">이렇게 진행돼요</h2>
      <ol>
        <li><span>세입자가 문제 종류를 고르고 사진과 함께 접수해요.</span></li>
        <li><span>중앙난방인지 개별난방인지 같은 건물 정보에 따라 묻는 질문이 달라져요. 가스 냄새처럼 위험한 신호가 보이면 일반 접수를 멈추고 안전 안내부터 보여 줘요.</span></li>
        <li><span>관리자가 내용을 확인하고 업체에 방문을 맡겨요. 업체는 로그인 없이 받은 링크로 방문 일정을 정해요.</span></li>
        <li><span>방문 결과와 수리 이력이 세대마다 남아서, 다음에 같은 문제가 생기면 지난 기록부터 볼 수 있어요.</span></li>
      </ol>
    </section>
  );
}

function Landing({ title, lead, entry }: { title: string; lead: string; entry: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.bar}><p className={styles.wordmark}>자취사무소</p></header>
      <main className={styles.main}>
        <section className={styles.intro} aria-labelledby="home-title">
          <h1 id="home-title" className={styles.display}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
        </section>
        <section className={styles.entry} aria-labelledby="entry-title">{entry}</section>
        <ExampleTicket />
        <Steps />
      </main>
    </div>
  );
}

const TITLE = "세입자 수리 요청, 문자 대신 여기서 받아요";
const LEAD = "세입자가 사진과 함께 접수하면 건물 정보에 맞춘 질문으로 필요한 내용이 채워져요. 관리자는 확인하고 업체에 방문을 맡기고, 처리 과정은 세입자도 함께 봐요.";

export default function Home() {
  const mode=parseApplicationMode(process.env.BUILD_MANAGER_MODE);
  if(mode==='B1'&&demoEntryMode())return <Landing title={TITLE} lead={LEAD} entry={<>
    <h2 id="entry-title">로그인 없이 바로 써 보기</h2>
    <p>체험용 가짜 건물·세대 데이터로 들어가요. 누구나 바꿀 수 있어요.</p>
    <div className={styles.actions}>
      <form action="/api/v2/session/demo" method="post"><input type="hidden" name="role" value="manager"/><button className={styles.primary} type="submit">관리자로 체험하기</button></form>
      <form action="/api/v2/session/demo" method="post"><input type="hidden" name="role" value="tenant"/><button className={styles.secondary} type="submit">세입자로 체험하기</button></form>
    </div>
    <p className={styles.caption}>지금 접수할 수 있는 문제는 난방과 누수 두 가지예요. 업체 화면은 관리자가 업체에 방문을 맡길 때 만들어지는 링크로 열려요.</p>
  </>}/>;
  if(mode==='B1')return <Landing title={TITLE} lead={LEAD} entry={<>
    <h2 id="entry-title">내 조직으로 들어가기</h2>
    <p>로그인하면 내 조직의 건물과 접수 내용을 볼 수 있어요.</p>
    <div className={styles.actions}>
      <a className={styles.primary} href="/auth/login">로그인하기</a>
      <Link className={styles.textLink} href="/workspace">내 조직으로 이동</Link>
    </div>
  </>}/>;
  if(mode!=='DEMO')return <div className={styles.page}><main className={styles.main}><h1 className={styles.display}>서비스를 준비하고 있어요.</h1></main></div>;
  return <Landing title={TITLE} lead={LEAD} entry={<>
    <h2 id="entry-title">데모 시작하기</h2>
    <p>합성 데이터로 만든 데모예요. 실제 인증과 업체 배정은 하지 않아요. 안전 진단을 대신하지 않으며, 위험 신호가 보이면 일반 절차를 중단해요.</p>
    <div className={styles.actions}>
      <Link className={styles.primary} href="/demo/tenant">세입자 데모 시작</Link>
      <Link className={styles.secondary} href="/demo/landlord">임대인 데모 시작</Link>
    </div>
    {process.env.CORE_FLOW_MODE === "SYNTHETIC_LOCAL" ? <p><Link className={styles.textLink} href="/core">RC1 수리 접수·처리 시작</Link></p> : null}
  </>}/>;
}
