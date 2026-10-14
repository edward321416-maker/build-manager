import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./tokens.css";

export const metadata: Metadata = {
  title: "자취사무소",
  description: "세입자 수리 접수부터 관리자 처리, 업체 방문까지 이어지는 수리 관리 데모",
};

// Pretendard (design rules §3.1), dynamic subset: browsers download only the glyph ranges a page uses.
// This stylesheet declares every face as font-family:'Pretendard Variable' (checked 2026-10-14, all 92 rules), so the
// stacks in tokens.css/globals.css must name that face first — plain `Pretendard` alone never matched it.
const PRETENDARD = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD} crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
