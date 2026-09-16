import { HERO_MESSAGE, PRODUCT_NAME } from "@build-manager/api-contracts";
import Link from "next/link";

export default function Home() {
  return (
    <main className="page-shell">
      <section aria-labelledby="product-title" className="hero">
        <p className="eyebrow">BUILDING-AWARE REPAIR ROUTER</p>
        <h1 id="product-title">{PRODUCT_NAME}</h1>
        <p className="hero-message">{HERO_MESSAGE}</p>
      </section>

      <section aria-labelledby="role-entry-title" className="role-entry">
        <h2 id="role-entry-title">데모 시작하기</h2>

        <p className="role-entry-note">
          합성 데이터 기반 데모입니다. 실제 인증·업체 배정 기능이 아니며, 안전
          진단·인증 대신 위험 신호가 확인되면 일반 절차를 중단합니다.
        </p>

        <ul className="role-entry-links">
          <li>
            <Link href="/demo/tenant">세입자 데모 시작</Link>
          </li>
          <li>
            <Link href="/demo/landlord">임대인 데모 시작</Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
