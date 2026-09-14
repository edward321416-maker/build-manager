import { heroMessage, productName } from "@/lib/product-meta";

export default function Home() {
  return (
    <main className="home">
      <h1>{productName}</h1>
      <p>{heroMessage}</p>
      <a href="/demo">합성 건물 데모 시작</a>
    </main>
  );
}
