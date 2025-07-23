"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDownLeft, Shield } from "lucide-react"
import { useContract } from "@/lib/contract"
import { formatAmount } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface BorrowMoneyModalProps {
  isOpen: boolean
  onClose: () => void
  onBorrow: (token: string, amount: string, collateralToken: string) => Promise<void>
  onDepositCollateral: (token: string, amount: string) => Promise<void>
  userBalances: Record<string, string>
  userCollaterals: Record<string, string>
  tokenInfos: Record<string, { symbol: string; decimals: number }>
  loading: boolean
}

export function BorrowMoneyModal({
  isOpen,
  onClose,
  onBorrow,
  onDepositCollateral,
  userBalances,
  userCollaterals,
  tokenInfos,
  loading,
}: BorrowMoneyModalProps) {
  const { toast } = useToast()
  const { supportedStablecoins, supportedCollateral } = useContract()

  const [form, setForm] = useState({
    token: "",
    collateralToken: "",
    amount: "",
    collateralAmount: "",
  })

  const hasCollateral = (token: string) => {
    const collateral = userCollaterals[token]
    return collateral && collateral !== "0"
  }

  const handleDepositCollateral = async () => {
    if (!form.collateralToken || !form.collateralAmount) {
      toast({
        title: "Missing Information",
        description: "Please select collateral type and enter amount.",
        variant: "destructive",
      })
      return
    }

    await onDepositCollateral(form.collateralToken, form.collateralAmount)
    setForm((prev) => ({ ...prev, collateralAmount: "" }))
  }

  const handleBorrow = async () => {
    if (!form.token || !form.collateralToken || !form.amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to borrow money.",
        variant: "destructive",
      })
      return
    }

    if (!hasCollateral(form.collateralToken)) {
      toast({
        title: "No Collateral",
        description: "You need to deposit collateral first before borrowing.",
        variant: "destructive",
      })
      return
    }

    await onBorrow(form.token, form.amount, form.collateralToken)
    setForm({ token: "", collateralToken: "", amount: "", collateralAmount: "" })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto bg-white border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center text-gray-900 text-lg font-semibold">
            <ArrowDownLeft className="w-5 h-5 mr-2 text-primary" />
            Borrow Money
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="borrow-token" className="text-sm font-medium text-gray-700">
              Borrow
            </Label>
            <Select value={form.token} onValueChange={(value) => setForm({ ...form, token: value })}>
              <SelectTrigger className="mt-1 min-h-[48px]">
                <SelectValue placeholder="Select money type" />
              </SelectTrigger>
              <SelectContent>
                {supportedStablecoins.map((token) => (
                  <SelectItem key={token} value={token}>
                    {tokenInfos[token]?.symbol || token.slice(0, 6) + "..."}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="collateral-token" className="text-sm font-medium text-gray-700">
              Use as Guarantee
            </Label>
            <Select
              value={form.collateralToken}
              onValueChange={(value) => setForm({ ...form, collateralToken: value })}
            >
              <SelectTrigger className="mt-1 min-h-[48px]">
                <SelectValue placeholder="Select guarantee type" />
              </SelectTrigger>
              <SelectContent>
                {supportedCollateral.map((token) => (
                  <SelectItem key={token} value={token}>
                    {tokenInfos[token]?.symbol || token.slice(0, 6) + "..."}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.collateralToken && hasCollateral(form.collateralToken) && (
              <p className="text-sm text-green-600 mt-1">
                ✓ Deposited:{" "}
                {formatAmount(userCollaterals[form.collateralToken], tokenInfos[form.collateralToken]?.decimals || 6)}{" "}
                {tokenInfos[form.collateralToken]?.symbol}
              </p>
            )}
          </div>

          {/* Collateral Deposit Section */}
          {form.collateralToken && !hasCollateral(form.collateralToken) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center mb-2">
                <Shield className="w-4 h-4 text-yellow-600 mr-2" />
                <span className="text-sm font-medium text-yellow-800">Deposit Collateral First</span>
              </div>
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="Collateral amount"
                  value={form.collateralAmount}
                  onChange={(e) => setForm({ ...form, collateralAmount: e.target.value })}
                  className="min-h-[40px]"
                  min="0.01"
                  step="0.01"
                />
                {form.collateralToken && userBalances[form.collateralToken] && (
                  <p className="text-xs text-gray-600">
                    Available:{" "}
                    {formatAmount(userBalances[form.collateralToken], tokenInfos[form.collateralToken]?.decimals || 6)}{" "}
                    {tokenInfos[form.collateralToken]?.symbol}
                  </p>
                )}
                <Button
                  onClick={handleDepositCollateral}
                  disabled={loading || !form.collateralAmount}
                  variant="outline"
                  className="w-full border-yellow-400 text-yellow-700 hover:bg-yellow-100 min-h-[40px] bg-transparent"
                >
                  {loading ? "Depositing..." : "Deposit Collateral"}
                </Button>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="borrow-amount" className="text-sm font-medium text-gray-700">
              Amount
            </Label>
            <Input
              id="borrow-amount"
              type="number"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="mt-1 min-h-[48px]"
              min="0.01"
              step="0.01"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={onClose} variant="outline" className="flex-1 min-h-[48px] bg-transparent">
              Cancel
            </Button>
            <Button
              onClick={handleBorrow}
              disabled={
                loading || !form.token || !form.collateralToken || !form.amount || !hasCollateral(form.collateralToken)
              }
              className="flex-1 bg-primary hover:bg-secondary text-white min-h-[48px]"
            >
              {loading ? "Borrowing..." : "Borrow Now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
