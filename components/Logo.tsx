interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Logo({ size = "md", className = "" }: LogoProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-xl sm:text-2xl",
    lg: "text-3xl sm:text-4xl",
    xl: "text-5xl sm:text-7xl"
  };

  return (
    <h1 className={`font-bold ${sizeClasses[size]} ${className}`}>
      <span className="text-white">Mini</span>
      <span className="text-[#54d22d]">Lend</span>
    </h1>
  );
}