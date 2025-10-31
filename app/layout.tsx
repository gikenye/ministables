import "./globals.css";
import ClientLayout from "./ClientLayout";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Minilend - Save and you will be rewarded",
  description: "Save for your goals, borrow for your needs",
  generator: "hagia sophia",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Minilend",
    startupImage: "/icons/icon-512x512.png",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-180x180.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
    ],
    shortcut: "/icons/icon-192x192.png",
  },
  applicationName: "Minilend",
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: "https://minilend.xyz/minilend-logo.png",
      button: {
        title: "Open Minilend",
        action: {
          type: "launch_miniapp",
          name: "Minilend",
          url: "https://minilend.xyz",
          splashImageUrl: "https://minilend.xyz/minilend-logo.png",
          splashBackgroundColor: "#162013",
        },
      },
    }),
  },
};

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
  return <ClientLayout>{children}</ClientLayout>;
}
