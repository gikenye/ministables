import React from "react";
import { theme } from "@/lib/theme";

interface NumberKeypadProps {
  onNumberPress: (value: string) => void;
  className?: string;
}

export const NumberKeypad = ({
  onNumberPress,
  className = "",
}: NumberKeypadProps) => {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"];

  return (
    <div className={`grid grid-cols-3 gap-4 max-w-xs mx-auto ${className}`}>
      {keys.map((key) => (
        <button
          key={key}
          onClick={() => onNumberPress(key)}
          className="w-14 h-14 text-xl font-medium rounded-full transition-colors duration-200 flex items-center justify-center"
          style={{ color: theme.colors.text, border: `1px solid ${theme.colors.border}`, backgroundColor: 'transparent' }}
        >
          {key === "⌫" ? "⌫" : key}
        </button>
      ))}
    </div>
  );
};
