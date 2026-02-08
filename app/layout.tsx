import "./globals.css";
import ClientLayout from "./ClientLayout";
import type { Metadata, Viewport } from "next";

const SITE_URL = "https://ministables.vercel.app";
const OG_IMAGE = `${SITE_URL}/new-logo.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Minilend - Save and you will be rewarded",
    template: "%s | Minilend",
  },
  description:
    "Minilend is a savings protocol for group savings in stablecoins on Celo, Base & Scroll. Save for your goals, borrow for your needs. Compliant DeFi with zkSelf.",
  keywords: [
    "Minilend",
    "savings",
    "stablecoins",
    "DeFi",
    "Celo",
    "Base",
    "Scroll",
    "group savings",
    "savings goals",
    "USDC",
    "lending",
  ],
  authors: [{ name: "Minilend", url: SITE_URL }],
  creator: "Minilend",
  publisher: "Minilend",
  generator: "hagia sophia",
  manifest: "/manifest.json",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Minilend",
    title: "Minilend - Save and you will be rewarded",
    description:
      "Savings protocol for group savings in stablecoins. Save for your goals, borrow for your needs. Celo, Base & Scroll.",
    images: [
      {
        url: OG_IMAGE,
        width: 512,
        height: 512,
        alt: "Minilend - Smart savings vault",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Minilend - Save and you will be rewarded",
    description: "Savings protocol for group savings in stablecoins. Save for your goals, borrow for your needs.",
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
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

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: "Minilend",
      url: SITE_URL,
      logo: `${SITE_URL}/new-logo.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL,
      name: "Minilend",
      description:
        "Savings protocol for group savings in stablecoins on Celo, Base and Scroll. Save for your goals, borrow for your needs.",
      publisher: { "@id": `${SITE_URL}#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ClientLayout>{children}</ClientLayout>
    </>
  );
}
