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
        relative w-full sm:w-auto sm:min-w-[400px] sm:max-w-lg
        bg-black sm:bg-gray-900 
        rounded-t-xl sm:rounded-xl 
        ${maxHeight}
        overflow-hidden
        animate-in slide-in-from-bottom duration-300 sm:animate-in sm:fade-in sm:slide-in-from-bottom-4
      `}
      >
        {children}
      </div>
    </div>
  );
};
