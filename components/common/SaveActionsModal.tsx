"use client";
import { FC } from "react";
import { Wallet, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ModalHeader,
  InfoCard,
  ActionButton,
  BottomSheet,
} from "@/components/ui";
import { theme } from "@/lib/theme";

interface SaveActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActionSelect: (actionId: string) => void;
}

const SaveActionsModal: FC<SaveActionsModalProps> = ({
  isOpen,
  onClose,
  onActionSelect,
}) => {
  const saveActions = [
    {
      id: "quick",
      title: "Quick Save",
      icon: Wallet,
      description: "Save without a specific goal",
    },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[50vh]">
      <ModalHeader title="Where to Save?" onClose={onClose} />

      <div className="p-3 space-y-3" style={{ backgroundColor: theme.colors.backgroundSecondary }}>
        <div className="text-center py-0.5">
          <div className="text-2xl mb-1.5">🐷</div>
          <h3 className="text-sm font-semibold mb-0.5" style={{ color: theme.colors.text }}>
            Choose your save option
          </h3>
          <p className="text-xs" style={{ color: theme.colors.textLight }}>
            Select where you'd like to save your money
          </p>
        </div>

        <div className="space-y-1.5">
          {saveActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <InfoCard key={action.id} variant="action" className="cursor-pointer transition-all duration-200">
                <button onClick={() => onActionSelect(action.id)} className="w-full flex items-center space-x-2 p-1">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: theme.colors.border }}>
                    <IconComponent className="w-3.5 h-3.5" style={{ color: theme.colors.text }} />
                  </div>

                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium" style={{ color: theme.colors.text }}>
                      {action.title}
                    </div>
                    <div className="text-xs" style={{ color: theme.colors.textLight }}>
                      {action.description}
                    </div>
                  </div>

                  <ChevronRight className="w-3.5 h-3.5" style={{ color: theme.colors.border }} />
                </button>
              </InfoCard>
            );
          })}
        </div>

        <ActionButton onClick={onClose} variant="outline" size="sm" className="w-full">
          Cancel
        </ActionButton>

        <div className="h-1"></div>
      </div>
    </BottomSheet>
  );
};

export default SaveActionsModal;
