import React from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { ModalHeader } from "../ui/ModalHeader";
import { InfoCard } from "../ui/InfoCard";
import { ActionButton } from "../ui/ActionButton";
import { LucideIcon } from "lucide-react";

export interface SaveOption {
  id: string;
  title: string;
  icon: LucideIcon;
  description?: string;
}

interface SaveOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOptionSelect: (optionId: string) => void;
  options: SaveOption[];
  title?: string;
  subtitle?: string;
  headerIcon?: string;
}

export const SaveOptionsModal = ({
  isOpen,
  onClose,
  onOptionSelect,
  options,
  title = "Goal Categories",
  subtitle = "Ready for a challenge?",
  headerIcon = "🏆",
}: SaveOptionsModalProps) => {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[90vh]">
      <ModalHeader title={title} onClose={onClose} />

      <div className="bg-black p-4 space-y-6">
        {/* Header Section */}
        <div className="text-center py-2">
          <div className="text-4xl mb-3">{headerIcon}</div>
          <h3 className="text-lg font-semibold text-white mb-2">{subtitle}</h3>
          <p className="text-sm text-gray-400">
            Saving is no easy feat! Elevate your game with our challenges. Pick
            a challenge and let the fun begin!
          </p>
        </div>

        {/* Main Options - Grid Layout for first 4 */}
        {options.length > 4 && (
          <div className="grid grid-cols-2 gap-3">
            {options.slice(0, 4).map((option) => {
              const IconComponent = option.icon;
              return (
                <InfoCard
                  key={option.id}
                  variant="action"
                  className="cursor-pointer hover:border-cyan-400 transition-all duration-200 p-4 min-h-[120px]"
                >
                  <div
                    onClick={() => onOptionSelect(option.id)}
                    className="flex flex-col items-center text-center h-full"
                  >
                    <div className="w-10 h-10 bg-cyan-400/20 rounded-full flex items-center justify-center mb-3">
                      <IconComponent className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h4 className="text-white font-medium text-sm mb-1 leading-tight">
                      {option.title}
                    </h4>
                    {option.description && (
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {option.description}
                      </p>
                    )}
                  </div>
                </InfoCard>
              );
            })}
          </div>
        )}

        {/* Additional Options - Single Column */}
        <div className="space-y-3">
          {(options.length <= 4 ? options : options.slice(4)).map((option) => {
            const IconComponent = option.icon;
            return (
              <InfoCard
                key={option.id}
                variant="action"
                className="cursor-pointer hover:border-cyan-400 transition-all duration-200"
              >
                <div
                  onClick={() => onOptionSelect(option.id)}
                  className="flex items-center space-x-4"
                >
                  <div className="w-10 h-10 bg-cyan-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <IconComponent className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium text-sm mb-1">
                      {option.title}
                    </h4>
                    {option.description && (
                      <p className="text-xs text-gray-400">
                        {option.description}
                      </p>
                    )}
                  </div>
                </div>
              </InfoCard>
            );
          })}
        </div>

        {/* Cancel Button */}
        <ActionButton
          onClick={onClose}
          variant="outline"
          size="lg"
          className="w-full"
        >
          Cancel
        </ActionButton>

        {/* Bottom spacing for safe area */}
        <div className="h-4"></div>
      </div>
    </BottomSheet>
  );
};
