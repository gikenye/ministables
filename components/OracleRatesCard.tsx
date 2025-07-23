"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, TrendingUp, Clock } from "lucide-react"
import { useContract } from "@/lib/contract"
import { formatUnits } from "viem"

interface OracleRate {
  token: string
  symbol: string
  rate: string
  timestamp: number
  usdValue: string
}

export function OracleRatesCard() {
  const { supportedStablecoins, allTokens, getOracleRate } = useContract()
  const [rates, setRates] = useState<OracleRate[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const loadOracleRates = async () => {
    setLoading(true)
    try {
      const ratePromises = supportedStablecoins.slice(0, 6).map(async (tokenAddress) => {
        const tokenInfo = Object.values(allTokens).find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase())

        if (!tokenInfo) return null

        const { rate, timestamp } = await getOracleRate(tokenAddress)

        // Convert rate to USD value (assuming CELO rate as base)
        const rateInCelo = Number(formatUnits(BigInt(rate), 18))
        const usdValue = (rateInCelo * 0.7).toFixed(4) // Assuming 1 CELO ≈ $0.7

        return {
          token: tokenAddress,
          symbol: tokenInfo.symbol,
          rate,
          timestamp,
          usdValue,
        }
      })

      const resolvedRates = (await Promise.all(ratePromises)).filter(Boolean) as OracleRate[]
      setRates(resolvedRates)
      setLastUpdate(new Date())
    } catch (error) {
      console.error("Error loading oracle rates:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (supportedStablecoins.length > 0) {
      loadOracleRates()
    }
  }, [supportedStablecoins])

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString()
  }

  const getTokenFlag = (symbol: string) => {
    const flags: Record<string, string> = {
      cKES: "🇰🇪",
      cUSD: "🇺🇸",
      cEUR: "🇪🇺",
      cREAL: "🇧🇷",
      eXOF: "🌍",
      PUSO: "🇵🇭",
      cCOP: "🇨🇴",
      cGHS: "🇬🇭",
      USDT: "🇺🇸",
      USDC: "🇺🇸",
      USDGLO: "🌍",
    }
    return flags[symbol] || "💱"
  }

  return (
    <Card className="bg-white border-secondary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-primary">
            <TrendingUp className="w-5 h-5 mr-2" />
            Live Exchange Rates
          </CardTitle>
          <Button onClick={loadOracleRates} disabled={loading} variant="outline" size="sm" className="bg-transparent">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {lastUpdate && (
          <div className="flex items-center text-xs text-gray-500">
            <Clock className="w-3 h-3 mr-1" />
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Loading rates...</p>
          </div>
        ) : rates.length > 0 ? (
          rates.map((rate) => (
            <div key={rate.token} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <span className="text-lg mr-2">{getTokenFlag(rate.symbol)}</span>
                <div>
                  <span className="font-medium text-gray-900">{rate.symbol}</span>
                  <div className="text-xs text-gray-500">Updated: {formatTimestamp(rate.timestamp)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-primary">≈ ${rate.usdValue}</div>
                <div className="text-xs text-gray-500">
                  {Number(formatUnits(BigInt(rate.rate), 18)).toFixed(4)} CELO
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center py-4">No rates available</p>
        )}
      </CardContent>
    </Card>
  )
}
