import { HERO_MESSAGE, PRODUCT_NAME } from "@build-manager/api-contracts";

export default function Home() {
  return (
    <main className="page-shell">
      <section aria-labelledby="product-title" className="hero">
        <p className="eyebrow">BUILDING-AWARE REPAIR ROUTER</p>
        <h1 id="product-title">{PRODUCT_NAME}</h1>
        <p className="hero-message">{HERO_MESSAGE}</p>
      </section>
    </main>
  );
}
