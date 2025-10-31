import React, { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { ModalHeader } from "../ui/ModalHeader";
import { AmountDisplay } from "../ui/AmountDisplay";
import { NumberKeypad } from "../ui/NumberKeypad";
import { ActionButton } from "../ui/ActionButton";

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
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[95vh]">
      <ModalHeader title={title} onClose={onClose} />

      <div className="bg-black p-4 space-y-6">
        {/* Amount Display */}
        <div className="text-center py-6">
          <div className="text-6xl mb-6">{icon}</div>
          <AmountDisplay amount={amount} currency={currency} size="xl" />
        </div>

        {/* Continue Button */}
        <ActionButton
          onClick={handleContinue}
          variant="primary"
          size="lg"
          className="w-full"
        >
          CONTINUE
        </ActionButton>

        {/* Number Keypad */}
        <NumberKeypad onNumberPress={handleNumberPress} className="pb-6" />
      </div>
    </BottomSheet>
  );
};
