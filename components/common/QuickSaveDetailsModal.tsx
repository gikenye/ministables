"use client"
import type { FC } from "react"
import { CardActionButton, BottomSheet } from "@/components/ui"
interface QuickSaveDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveNow: () => void
  onWithdraw?: () => void
  balanceUSD?: number
  exchangeRate?: number
  showBalance?: boolean
}

const QuickSaveDetailsModal: FC<QuickSaveDetailsModalProps> = ({
  isOpen,
  onClose,
  onSaveNow,
  onWithdraw,
  balanceUSD = 0,
  exchangeRate,
  showBalance = true,
}) => {
  const hasRate = typeof exchangeRate === "number" && exchangeRate > 0;
  const primaryAmount = hasRate
    ? `Ksh${(balanceUSD * exchangeRate).toLocaleString("en-US", {
        maximumFractionDigits: 0,
      })}`
    : `$${balanceUSD.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
  const secondaryAmount = hasRate
    ? `$${balanceUSD.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : null;

  const handleWithdraw = () => {
    if (!onWithdraw) return;
    onClose();
    onWithdraw();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[85vh]">
      <div className="p-6 flex flex-col h-full bg-transparent">
        <header className="mb-8 flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4ade80] mb-1">
              Savings Vault
            </p>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Quick Save
            </h2>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-white leading-tight">
              {showBalance ? primaryAmount : "••••••"}
            </p>
            {showBalance && secondaryAmount && (
              <p className="text-xs text-white/50">{secondaryAmount}</p>
            )}
            <p className="text-[10px] font-bold text-white/30 uppercase">
              Balance
            </p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <CardActionButton onClick={onSaveNow} className="flex-1">
            Deposit
          </CardActionButton>
          <CardActionButton
            variant="secondary"
            onClick={handleWithdraw}
            disabled={!onWithdraw}
            className="flex-1"
          >
            Withdraw
          </CardActionButton>
        </div>
      </div>
    </BottomSheet>
  )
}

export default QuickSaveDetailsModal
