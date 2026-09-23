import { HERO_MESSAGE, PRODUCT_NAME } from "@build-manager/api-contracts";
import Link from "next/link";
import { parseApplicationMode } from '../runtime/application-mode';
export const dynamic = "force-dynamic";

export default function Home() {
  const mode=parseApplicationMode(process.env.BUILD_MANAGER_MODE);
  if(mode==='B1')return <main className="page-shell"><h1>자취사무소</h1><p>내 조직과 건물을 확인하세요.</p><a href="/auth/login">로그인</a><p><Link href="/workspace">내 조직으로 이동</Link></p></main>;
  if(mode!=='DEMO')return <main className="page-shell"><h1>서비스를 준비하고 있습니다.</h1></main>;
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
