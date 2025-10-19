import "./globals.css"
import ClientLayout from "./ClientLayout"
import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "MiniLend - Grow Your Money",
  description: "Save and borrow money on the Celo blockchain",
  generator: '0xth3gho5t0fwint3r',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MiniLend',
    startupImage: '/icons/icon-512x512.png',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
  applicationName: 'MiniLend',
  other: {
    'fc:frame': JSON.stringify({
      "version": "next",
      "imageUrl": "https://minilend.xyz/minilend-logo.png",
      "button": {
        "title": "Start Lending",
        "action": {
          "type": "launch_miniapp",
          "name": "MiniLend",
          "url": "https://minilend.xyz",
          "splashImageUrl": "https://minilend.xyz/minilend-logo.png",
          "splashBackgroundColor": "#162013"
        }
      }
    })
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  userScalable: true,
  themeColor: "#0e6037"
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ClientLayout>{children}</ClientLayout>
}
