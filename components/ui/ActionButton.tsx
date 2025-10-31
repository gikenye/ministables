import React from "react";
import { Button } from "@/components/ui/button";

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
    "font-medium rounded-full transition-all duration-200 min-h-[44px] flex items-center justify-center";

  const variantClasses = {
    primary: "bg-cyan-400 hover:bg-cyan-500 text-black",
    secondary: "bg-gray-700 hover:bg-gray-600 text-white",
    outline:
      "bg-transparent border border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black",
  };

  const sizeClasses = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base font-semibold",
  };

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </Button>
  );
};
