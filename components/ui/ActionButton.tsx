import React from "react";
import { Button } from "@/components/ui/button";
import { theme } from "@/lib/theme";

interface ActionButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}

export const ActionButton = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
}: ActionButtonProps) => {
  const baseClasses =
    "font-medium rounded-xl transition-all duration-200 min-h-[44px] flex items-center justify-center";

  const sizeClasses = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base font-semibold",
  };

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses[size]} ${className} ${disabled ? 'opacity-50' : ''}`}
      style={{
        backgroundColor: theme.colors.cardButton,
        border: `1px solid ${theme.colors.cardButtonBorder}`,
        color: theme.colors.cardText,
      }}
    >
      {children}
    </Button>
  );
};
