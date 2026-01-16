import React from "react";
import { theme } from "@/lib/theme";

interface InfoCardProps {
  children: React.ReactNode;
  variant?: "default" | "stats" | "action";
  className?: string;
}

export const InfoCard = ({
  children,
  variant = "default",
  className = "",
}: InfoCardProps) => {
  const baseClasses = "rounded-lg border";

  const variantClasses = {
    default: "p-3",
    stats: "p-2",
    action: "p-3 transition-colors duration-200",
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className} backdrop-blur-sm`} style={{ backgroundColor: theme.colors.cardButton, border: `1px solid ${theme.colors.cardButtonBorder}` }}>
      {children}
    </div>
  );
};
