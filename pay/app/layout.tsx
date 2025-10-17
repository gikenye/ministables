import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pay with Stablecoins - Minilend",
  description: "Convert stablecoins to mobile money",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
