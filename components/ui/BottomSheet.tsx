import React, { useEffect } from "react";
import { theme } from "@/lib/theme";

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
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div
        className={`relative w-full max-w-md mx-auto sm:max-w-lg rounded-t-3xl sm:rounded-xl overflow-hidden transform transition-transform duration-300 ease-out ${maxHeight}`}
        style={{ 
          backgroundImage: `linear-gradient(to bottom right, ${theme.colors.cardGradientFrom}, ${theme.colors.cardGradientTo})`,
        }}
      >
        <div className="w-full h-full overflow-hidden">{children}</div>
      </div>
    </div>
  );
};
