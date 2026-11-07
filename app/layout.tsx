import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "ShopDesk · Glow & Co support",
  description: "A read-only AI support agent for a fictional skincare shop. Try it: ask about an order or a policy.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
