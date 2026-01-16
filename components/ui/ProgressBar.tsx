import React from "react";
import { theme } from "@/lib/theme";

interface ProgressBarProps {
  progress: number;
  className?: string;
  height?: "sm" | "md" | "lg";
  color?: "cyan" | "green" | "blue" | "purple";
}

export const ProgressBar = ({
  progress,
  className = "",
  height = "md",
  color = "cyan",
}: ProgressBarProps) => {
  const heightClasses = {
    sm: "h-1",
    md: "h-1.5",
    lg: "h-2",
  };

  return (
    <div className={`w-full rounded-full ${heightClasses[height]} ${className}`} style={{ backgroundColor: theme.colors.backgroundSecondary }}>
      <div
        className={`${heightClasses[height]} rounded-full transition-all duration-300`}
        style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: theme.colors.border }}
      />
    </div>
  );
};
