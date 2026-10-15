import Link from "next/link";
import type { ReactNode } from "react";
import { parseApplicationMode } from "../runtime/application-mode";
import { demoEntryMode } from "../runtime/demo-entry-mode";
import { HomePair, ManagerWindow, RecordPanel, TenantPhone, VendorPhone } from "./landing/drawings";
import { HeroScene, RecordScene, StepScene, type Step } from "./landing/scenes";
import { ScrollScenes } from "./landing/scroll-scenes";
import styles from "./home.module.css";
export const dynamic = "force-dynamic";

// First-visitor page (spec docs/superpowers/specs/2026-10-15-landing-scroll-scenes-design.md). The layout follows the
// reference site the operator picked on 2026-10-15 (design rules §1, Toss), told in the order the app handles a request.
// The scenes move with the scroll only where rules 9.1 allow it; still, the page shows everything in the same order.

const TITLE: [string, string] = ["세입자 수리 요청,", "문자 대신 여기서 받아요"];
const LEAD = "세입자가 사진과 함께 접수하면 건물 정보에 맞춘 질문으로 필요한 내용이 채워져요. 관리자는 확인하고 업체에 방문을 맡기고, 처리 과정은 세입자도 함께 봐요.";

const TENANT_STEPS: readonly Step[] = [
  { title: "문제를 고르고 사진과 함께 접수해요", detail: "난방과 누수 중에서 고르고, 사진은 최대 3장까지 함께 보내요." },
  { title: "위험한 신호부터 확인해요", detail: "가스 냄새나 연기가 있으면 일반 접수를 멈추고 안전 안내부터 보여 줘요." },
  { title: "건물에 맞춘 질문에 답하고 보내요", detail: "중앙난방인지 개별난방인지에 따라 묻는 내용이 달라요. 다 답하면 수리 요청을 제출해요." },
];
const MANAGER_STEPS: readonly Step[] = [
  { title: "할 일은 알림에 모여요", detail: "긴급 확인, 처리 방법 결정, 업체 확인처럼 지금 해야 할 일만 순서대로 보여요." },
  { title: "부족하면 다시 묻고, 처리 방법을 정해요", detail: "다시 확인할 질문을 골라 세입자에게 보내고, 답이 오면 처리 방법을 정해요." },
  { title: "업체에 보안 링크를 보내요", detail: "공유할 사진을 고르고 링크를 발급해 업체에 직접 전달해요." },
];
const VENDOR_STEPS: readonly Step[] = [
  { title: "링크로 작업을 열고 수락해요", detail: "접수 요약과 관리자가 고른 사진만 보여요. 수락하거나 사유를 골라 거절해요." },
  { title: "세입자가 보낸 시간 안에서 방문을 정해요", detail: "세입자가 가능한 시간을 보내면 그 안에서 방문 일정이 확정돼요." },
  { title: "방문하고 사진과 함께 보고해요", detail: "방문을 시작하고, 작업 내용과 사진을 보고하면 관리자가 검토해요." },
];

// The way in for the page mode: the top bar button, the buttons under the first scene's explanation, and the closing entry.
type Entry = { cta: { label: string; href: string }; title: string; text: string; actions: ReactNode; note?: ReactNode };

function Landing({ entry }: { entry: Entry }) {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <div className={`${styles.container} ${styles.barInner}`}>
          <p className={styles.wordmark}>자취사무소</p>
          <nav className={styles.nav} aria-label="페이지 안내">
            <a href="#tenant">세입자</a>
            <a href="#manager">관리자</a>
            <a href="#vendor">업체</a>
            <a href="#record">수리 기록</a>
          </nav>
          <a className={styles.secondary} href={entry.cta.href}>{entry.cta.label}</a>
        </div>
      </header>
      <ScrollScenes>
        <HeroScene title={TITLE} lead={LEAD} actions={entry.actions} drawing={<HomePair />} />
        <StepScene id="tenant" eyebrow="세입자" title={["사진과 몇 가지 답이면", "접수가 끝나요"]} steps={TENANT_STEPS} drawing={<TenantPhone />} />
        <StepScene id="manager" eyebrow="관리자" title={["확인부터 업체 연결까지", "이어서 처리해요"]} steps={MANAGER_STEPS} drawing={<ManagerWindow />} reverse />
        <StepScene id="vendor" eyebrow="업체" title={["업체는 로그인 없이", "링크 하나로 일해요"]} steps={VENDOR_STEPS} drawing={<VendorPhone />} />
        <RecordScene drawing={<RecordPanel />} />
        <section className={styles.closing} aria-labelledby="closing-title">
          <div className={`${styles.container} ${styles.closingInner}`}>
            <h2 id="closing-title" className={styles.headline}>오늘 들어온 수리 요청부터<br />{" "}여기서 받아 보세요</h2>
            <div id="entry" className={styles.entry}>
              <h3 id="entry-title" className={styles.entryTitle}>{entry.title}</h3>
              <p>{entry.text}</p>
              {entry.actions}
              {entry.note}
            </div>
          </div>
        </section>
      </ScrollScenes>
      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <p className={styles.wordmark}>자취사무소</p>
          <p className={styles.caption}>이 페이지의 화면 예시는 모두 체험용 가짜 건물·세대 데이터예요.</p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  const mode=parseApplicationMode(process.env.BUILD_MANAGER_MODE);
  if(mode==='B1'&&demoEntryMode())return <Landing entry={{
    cta:{label:"체험하기",href:"#entry"}, title:"로그인 없이 바로 써 보기", text:"체험용 가짜 건물·세대 데이터로 들어가요. 누구나 바꿀 수 있어요.",
    actions:<div className={styles.actions}>
      <form action="/api/v2/session/demo" method="post"><input type="hidden" name="role" value="manager"/><button className={styles.primary} type="submit">관리자로 체험하기</button></form>
      <form action="/api/v2/session/demo" method="post"><input type="hidden" name="role" value="tenant"/><button className={styles.secondary} type="submit">세입자로 체험하기</button></form>
    </div>,
    note:<p className={styles.caption}>지금 접수할 수 있는 문제는 난방과 누수 두 가지예요. 업체 화면은 관리자가 업체에 방문을 맡길 때 만들어지는 링크로 열려요.</p>,
  }}/>;
  if(mode==='B1')return <Landing entry={{
    cta:{label:"로그인하기",href:"/auth/login"}, title:"내 조직으로 들어가기", text:"로그인하면 내 조직의 건물과 접수 내용을 볼 수 있어요.",
    actions:<div className={styles.actions}>
      <a className={styles.primary} href="/auth/login">로그인하기</a>
      <Link className={styles.textLink} href="/workspace">내 조직으로 이동</Link>
    </div>,
  }}/>;
  if(mode!=='DEMO')return <div className={styles.page}><main className={`${styles.container} ${styles.hero}`}><h1 className={styles.heroTitle}>서비스를 준비하고 있어요.</h1></main></div>;
  return <Landing entry={{
    cta:{label:"데모 시작하기",href:"#entry"}, title:"데모 시작하기",
    text:"합성 데이터로 만든 데모예요. 실제 인증과 업체 배정은 하지 않아요. 안전 진단을 대신하지 않으며, 위험 신호가 보이면 일반 절차를 중단해요.",
    actions:<div className={styles.actions}>
      <Link className={styles.primary} href="/demo/tenant">세입자 데모 시작</Link>
      <Link className={styles.secondary} href="/demo/landlord">임대인 데모 시작</Link>
    </div>,
    note:process.env.CORE_FLOW_MODE === "SYNTHETIC_LOCAL" ? <p><Link className={styles.textLink} href="/core">RC1 수리 접수·처리 시작</Link></p> : null,
  }}/>;
}
