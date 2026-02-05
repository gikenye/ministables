import React from "react";
import { cn } from "@/lib/utils";

type CardActionVariant = "primary" | "secondary";
type CardActionSize = "sm" | "md";

interface CardActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CardActionVariant;
  size?: CardActionSize;
}

const baseClasses =
  "inline-flex items-center justify-center gap-2 font-bold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";

const sizeClasses: Record<CardActionSize, string> = {
  sm: "px-3 py-2 text-xs rounded-xl",
  md: "px-4 py-3 text-sm rounded-2xl",
};

const variantClasses: Record<CardActionVariant, string> = {
  primary:
    "bg-white text-black shadow-lg border border-white/10 hover:bg-white/90",
  secondary:
    "bg-white/10 text-white border border-white/10 hover:bg-white/15",
};

export function CardActionButton({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: CardActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
      {...props}
    />
  );
}
