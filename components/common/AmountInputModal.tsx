import React, { useState, useEffect } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { ModalHeader } from "../ui/ModalHeader";
import { AmountDisplay } from "../ui/AmountDisplay";
import { NumberKeypad } from "../ui/NumberKeypad";
import { ActionButton } from "../ui/ActionButton";
import { theme } from "@/lib/theme";

interface AmountInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (amount: string) => void;
  title?: string;
  initialAmount?: string;
  currency?: string;
  icon?: string;
}

export const AmountInputModal = ({
  isOpen,
  onClose,
  onContinue,
  title = "Enter Amount",
  initialAmount = "100",
  currency = "KES",
  icon = "🐷",
}: AmountInputModalProps) => {
  const [amount, setAmount] = useState(initialAmount);

  // Reset amount when modal opens or initialAmount changes
  useEffect(() => {
    if (isOpen) {
      setAmount(initialAmount);
    }
  }, [isOpen, initialAmount]);

  const handleNumberPress = (num: string) => {
    if (num === "00") {
      setAmount((prev) => prev + "00");
    } else if (num === "⌫") {
      setAmount((prev) => prev.slice(0, -1) || "0");
    } else {
      setAmount((prev) => (prev === "0" ? num : prev + num));
    }
  };

  const handleContinue = () => {
    onContinue(amount);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[85vh]">
      <ModalHeader title={title} onClose={onClose} />

      <div className="p-3 space-y-3 overflow-y-auto pb-6" style={{ backgroundColor: theme.colors.backgroundSecondary }}>
        <div className="text-center py-3">
          <div className="text-3xl mb-3">{icon}</div>
          <AmountDisplay amount={amount} currency={currency} size="lg" />
        </div>

        <ActionButton onClick={handleContinue} variant="primary" size="md" className="w-full">
          CONTINUE
        </ActionButton>

        <NumberKeypad onNumberPress={handleNumberPress} className="pb-3" />
      </div>
    </BottomSheet>
  );
};
