import React from "react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string;
}

export const BottomSheet = ({
  isOpen,
  onClose,
  children,
  maxHeight = "max-h-[90vh]",
}: BottomSheetProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`
        relative w-full max-w-md mx-auto sm:max-w-lg
        bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 
        rounded-t-xl sm:rounded-xl 
        overflow-hidden
        transform transition-transform duration-300 ease-out
        ${maxHeight}
        `}
        style={{
          maxHeight:
            "min(85vh, 100% - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
        }}
      >
        <div className="w-full h-full overflow-hidden">{children}</div>
      </div>
    </div>
  );
};
