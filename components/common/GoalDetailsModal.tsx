"use client"

import { BottomSheet, ModalHeader, ActionButton } from "@/components/ui"
import { theme } from "@/lib/theme"

interface GoalDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveNow: () => void
  goal?: any
  showBalance?: boolean
  exchangeRate?: number
}

export const GoalDetailsModal = ({
  isOpen,
  onClose,
  onSaveNow,
  goal,
  showBalance = true,
  exchangeRate,
}: GoalDetailsModalProps) => {
  if (!goal) return null

  const formatAmount = (amount: string) => {
    if (!showBalance) return "••••"
    const usdAmount = Number(amount) || 0
    if (isNaN(usdAmount)) return "0"
    if (exchangeRate && exchangeRate > 0) {
      const kesAmount = usdAmount * exchangeRate
      return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(kesAmount)
    }
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(usdAmount)
  }

  const currentAmount = Number(goal.currentAmount) || 0
  const targetAmount = Number(goal.targetAmount) || 0
  const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0
  const remaining = targetAmount > 0 ? Math.max(targetAmount - currentAmount, 0) : 0

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[85vh]">
      <ModalHeader title={goal.title} onClose={onClose} />

      <div className="p-6 space-y-6">
        <div className="text-center space-y-4">
          <div className="text-sm" style={{ color: theme.colors.cardTextSecondary }}>
            Current Balance
          </div>
          <div className="text-4xl font-bold" style={{ color: theme.colors.cardText }}>
            {exchangeRate ? "KES" : "$"} {formatAmount(goal.currentAmount)}
          </div>

          {targetAmount > 0 && (
            <>
              <div className="w-full rounded-full h-2" style={{ backgroundColor: theme.colors.cardButton }}>
                <div 
                  className="h-2 rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${progress}%`,
                    backgroundColor: theme.colors.cardText,
                  }}
                />
              </div>
              
              <div className="text-sm" style={{ color: theme.colors.cardTextSecondary }}>
                {remaining > 0 ? (
                  <>{exchangeRate ? "KES" : "$"} {formatAmount(remaining.toString())} to go</>
                ) : (
                  "Goal reached!"
                )}
              </div>
            </>
          )}
        </div>

        <ActionButton onClick={onSaveNow} variant="primary" size="md" className="w-full">
          Deposit Money
        </ActionButton>
      </div>
    </BottomSheet>
  )
}
