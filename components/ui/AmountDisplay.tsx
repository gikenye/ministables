import React from "react";

interface AmountDisplayProps {
  amount: string;
  currency?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const AmountDisplay = ({
  amount,
  currency = "KES",
  size = "lg",
  className = "",
}: AmountDisplayProps) => {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
    xl: "text-6xl",
  };

  return (
    <div className={`font-bold text-white ${className}`}>
      <span className="text-cyan-400">{currency} </span>
      <span className={sizeClasses[size]}>{amount}</span>
    </div>
  );
};
