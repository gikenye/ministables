import React from "react";

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
    default: "bg-gray-800 border-gray-700 p-3",
    stats: "bg-gray-800 border-gray-700 p-2",
    action:
      "bg-gray-800 border-gray-700 p-3 hover:bg-gray-750 transition-colors duration-200",
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
};
