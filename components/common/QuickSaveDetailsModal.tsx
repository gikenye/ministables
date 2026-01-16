"use client"
import type { FC } from "react"
import { ModalHeader, ActionButton, BottomSheet } from "@/components/ui"
import { theme } from "@/lib/theme"

interface QuickSaveDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveNow: () => void
}

const QuickSaveDetailsModal: FC<QuickSaveDetailsModalProps> = ({ isOpen, onClose, onSaveNow }) => {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[85vh]">
      <ModalHeader title="Quick Save" onClose={onClose} />

      <div className="p-6 space-y-6">
        <div className="text-center py-8">
          <div className="text-sm mb-2" style={{ color: theme.colors.cardTextSecondary }}>
            Current Balance
          </div>
          <div className="text-4xl font-bold" style={{ color: theme.colors.cardText }}>
            KES 0
          </div>
        </div>

        <ActionButton onClick={onSaveNow} variant="primary" size="md" className="w-full">
          Deposit Money
        </ActionButton>
      </div>
    </BottomSheet>
  )
}

export default QuickSaveDetailsModal
