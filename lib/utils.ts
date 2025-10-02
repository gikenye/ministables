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

/**
 * Get the appropriate base URL for API calls and webhooks
 * Supports multiple URLs based on environment and deployment
 */
export function getBaseUrl(): string {
  // In client-side, use window.location.origin if available
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  // Check for supported base URLs from environment
  const supportedUrls = process.env.SUPPORTED_BASE_URLS?.split(',').map(url => url.trim()) || []
  
  // Determine which URL to use based on environment
  if (process.env.NODE_ENV === 'production') {
    // In production, prefer the production URLs
    const productionUrl = supportedUrls.find(url => 
      url.includes('app.minilend.xyz') || 
      url.includes('ministables.vercel.app')
    )
    if (productionUrl) return productionUrl
  }
  
  // Default to NEXTAUTH_URL or first supported URL
  return process.env.NEXTAUTH_URL || supportedUrls[0] || 'http://localhost:3000'
}

/**
 * Get the webhook callback base URL - always use production URL for webhooks
 */
export function getWebhookBaseUrl(): string {
  const supportedUrls = process.env.SUPPORTED_BASE_URLS?.split(',').map(url => url.trim()) || []
  
  // For webhooks, always prefer the production URL (app.minilend.xyz)
  const webhookUrl = supportedUrls.find(url => url.includes('app.minilend.xyz'))
  if (webhookUrl) return webhookUrl
  
  // Fallback to other production URLs
  const productionUrl = supportedUrls.find(url => 
    url.includes('ministables.vercel.app') || 
    url.startsWith('https://')
  )
  if (productionUrl) return productionUrl
  
  // Last resort - use base URL
  return getBaseUrl()
}
