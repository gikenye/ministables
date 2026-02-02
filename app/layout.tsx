import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import ClientLayout from "./ClientLayout";

const APP_NAME = "Minilend";
const APP_URL = process.env.NEXT_PUBLIC_URL ?? "https://minilend.xyz";
const APP_DESCRIPTION = "Save for your goals, borrow for your needs";
const inter = { className: "" };

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${APP_NAME} - Save and you will be rewarded`,
    description: APP_DESCRIPTION,
    generator: "hagia sophia",
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: APP_NAME,
      startupImage: "/icons/icon-512x512.png",
    },
    formatDetection: {
      telephone: false,
    },
    icons: {
      icon: [
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [
        { url: "/icons/icon-180x180.png", sizes: "180x180", type: "image/png" },
        { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      ],
      shortcut: "/icons/icon-192x192.png",
    },
    applicationName: APP_NAME,
    other: {
      "fc:miniapp": JSON.stringify({
        version: "next",
        imageUrl: `${APP_URL}/minilend-pwa.png`,
        button: {
          title: "Open Minilend",
          action: {
            type: "launch_miniapp",
            name: APP_NAME,
            url: APP_URL,
            splashImageUrl: `${APP_URL}/icons/icon-512x512.png`,
            splashBackgroundColor: "#162013",
          },
        },
      }),
      "mobile-web-app-capable": "yes",
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-status-bar-style": "black-translucent",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  userScalable: true,
  themeColor: "#0e6037",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} pb-safe`}>
        <ClientLayout>{children}</ClientLayout>
        <Analytics />
      </body>
    </html>
  );
}
