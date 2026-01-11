import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { theme } from "@/lib/theme";

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
}: ModalHeaderProps) => {
  return (
    <div className="p-3 sm:p-4 flex items-center justify-between min-h-[56px] border-b" style={{ borderColor: theme.colors.cardButtonBorder }}>
      <Button
        onClick={showBackButton ? onBack : onClose}
        variant="ghost"
        size="sm"
        className="rounded-full p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
        style={{ color: theme.colors.cardText }}
      >
        {showBackButton ? <ArrowLeft className="w-5 h-5" /> : <X className="w-5 h-5" />}
      </Button>

      <h2 className="text-lg sm:text-xl font-semibold text-center flex-1 px-2" style={{ color: theme.colors.cardText }}>
        {title}
      </h2>

      {rightAction ? (
        <Button
          onClick={rightAction.onClick}
          className="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 min-w-[44px] min-h-[44px]"
          style={{
            backgroundColor: theme.colors.cardButton,
            color: theme.colors.cardText,
            border: `1px solid ${theme.colors.cardButtonBorder}`
          }}
        >
          {rightAction.label}
        </Button>
      ) : (
        <div className="min-w-[44px]" />
      )}
    </div>
  );
};
