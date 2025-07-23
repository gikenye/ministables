import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { WalletProvider } from "@/lib/wallet"
import { ContractProvider } from "@/lib/contract"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "MiniLend - Grow Your Money",
  description: "Save and borrow money on the Celo blockchain",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletProvider>
          <ContractProvider>
            {children}
            <Toaster />
          </ContractProvider>
        </WalletProvider>
      </body>
    </html>
  )
}
