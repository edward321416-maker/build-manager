import type { Metadata } from "next";
import type { ReactNode } from "react";
import { heroMessage, productName } from "@/lib/product-meta";
import "./globals.css";

export const metadata: Metadata = {
  title: productName,
  description: heroMessage,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
