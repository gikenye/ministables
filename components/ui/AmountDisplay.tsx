import React from "react";
import { theme } from "@/lib/theme";

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
    <div className={`font-bold ${className}`} style={{ color: theme.colors.text }}>
      <span style={{ color: theme.colors.border }}>{currency} </span>
      <span className={sizeClasses[size]}>{amount}</span>
    </div>
  );
};
