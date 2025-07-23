import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatUnits } from "viem"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAddress(address: string): string {
  if (!address) return ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatAmount(amount: string, decimals = 6): string {
  if (!amount || amount === "0") return "0.00"

  try {
    const formatted = formatUnits(BigInt(amount), decimals)
    const num = Number.parseFloat(formatted)

    // For large numbers, show with commas and appropriate decimal places
    if (num >= 1000000) {
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    } else if (num >= 1000) {
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    } else {
      return num.toFixed(2)
    }
  } catch (error) {
    console.error("Error formatting amount:", error)
    return "0.00"
  }
}
