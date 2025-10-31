import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModalHeaderProps {
  title: string;
  onClose: () => void;
  rightAction?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  };
  showBackButton?: boolean;
  onBack?: () => void;
  backgroundColor?: string;
}

export const ModalHeader = ({
  title,
  onClose,
  rightAction,
  showBackButton = false,
  onBack,
  backgroundColor = "bg-gradient-to-r from-teal-500 to-cyan-500",
}: ModalHeaderProps) => {
  return (
    <div
      className={`${backgroundColor} p-3 sm:p-4 flex items-center justify-between min-h-[56px]`}
    >
      {/* Left side - Close or Back button */}
      <Button
        onClick={showBackButton ? onBack : onClose}
        variant="ghost"
        size="sm"
        className="text-white hover:bg-white/10 rounded-full p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        {showBackButton ? (
          <ArrowLeft className="w-5 h-5" />
        ) : (
          <X className="w-5 h-5" />
        )}
      </Button>

      {/* Center - Title */}
      <h2 className="text-lg sm:text-xl font-semibold text-white text-center flex-1 px-2">
        {title}
      </h2>

      {/* Right side - Action button or spacer */}
      {rightAction ? (
        <Button
          onClick={rightAction.onClick}
          className={`
            ${
              rightAction.variant === "primary"
                ? "bg-white/20 text-white border border-white/30 hover:bg-white hover:text-black"
                : "bg-transparent text-white border border-white/40 hover:bg-white/10"
            } 
            px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 min-w-[44px] min-h-[44px]
          `}
        >
          {rightAction.label}
        </Button>
      ) : (
        <div className="min-w-[44px]" />
      )}
    </div>
  );
};
