import React from "react";

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
          className="w-14 h-14 text-white text-xl font-medium hover:bg-gray-800 rounded-full transition-colors duration-200 flex items-center justify-center border border-gray-700 hover:border-cyan-400"
        >
          {key === "⌫" ? "⌫" : key}
        </button>
      ))}
    </div>
  );
};
