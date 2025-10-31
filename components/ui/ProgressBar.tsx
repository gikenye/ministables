import React from "react";

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

  const colorClasses = {
    cyan: "bg-cyan-400",
    green: "bg-green-400",
    blue: "bg-blue-400",
    purple: "bg-purple-400",
  };

  return (
    <div
      className={`w-full bg-gray-600 rounded-full ${heightClasses[height]} ${className}`}
    >
      <div
        className={`${colorClasses[color]} ${heightClasses[height]} rounded-full transition-all duration-300`}
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );
};
