"use client";

import React, { useState } from "react";
import {
  Users,
  Plus,
  ChevronRight,
  Globe,
  Lock,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { ActionButton, BottomSheet, ModalHeader } from "@/components/ui";
import { formatUsdFromKes } from "@/lib/utils";

interface CreateGroupGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroupGoal: () => void;
  groupGoalForm: {
    name: string;
    amount: string;
    timeline: string;
    isPublic: boolean;
  };
  setGroupGoalForm: (formData: any) => void;
  isLoading?: boolean;
  error?: string | null;
  exchangeRate?: number | null;
}

/**
 * Step-by-step wizard modal for creating group savings goals.
 * Optimized for mobile UX with a focused single-field-per-step approach.
 */
export const CreateGroupGoalModal: React.FC<CreateGroupGoalModalProps> = ({
  isOpen,
  onClose,
  onCreateGroupGoal,
  groupGoalForm,
  setGroupGoalForm,
  isLoading = false,
  error = null,
  exchangeRate,
}) => {
  // Step management
  const [currentStep, setCurrentStep] = useState(0);

  // Define steps of the wizard
  const steps = [
    { key: "name", label: "Group Goal Name", required: true },
    { key: "amount", label: "Target Amount", required: true },
    { key: "timeline", label: "Timeline", required: false },
    { key: "visibility", label: "Privacy", required: false },
  ];

  const currentField = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  // Check if current field is valid to enable/disable "Next" button
  const canProceed =
    !currentField.required ||
    (currentField.key !== "visibility" &&
      groupGoalForm[currentField.key as keyof typeof groupGoalForm] &&
      groupGoalForm[currentField.key as keyof typeof groupGoalForm]
        .toString()
        .trim() !== "");

  // Navigation handlers
  const handleNext = () => {
    if (isLastStep) {
      onCreateGroupGoal();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onClose();
    }
  };

  // Form input handlers
  const handleInputChange = (field: string, value: any) => {
    setGroupGoalForm((prev: any) => ({ ...prev, [field]: value }));
  };

  // Calculate USD amount from KES input if exchange rate is available
  const getUsdEquivalent = () => {
    if (!exchangeRate || !groupGoalForm.amount) return null;
    const kesAmount = parseFloat(groupGoalForm.amount);
    if (isNaN(kesAmount)) return null;
    return formatUsdFromKes(kesAmount, exchangeRate).toFixed(2);
  };

  // Reset step when modal closes
  const handleModalClose = () => {
    setCurrentStep(0);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleModalClose}
      maxHeight="max-h-[80vh]"
    >
      <div className="bg-gray-800/20 backdrop-blur-sm min-h-full flex flex-col">
        {/* Progress Indicator */}
        <div className="px-4 pt-4">
          <div className="flex items-center justify-center space-x-1 py-1">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index <= currentStep ? "bg-cyan-400" : "bg-gray-600"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Header */}
        <div className="text-center py-4">
          <div className="text-2xl mb-2">
            {currentField.key === "name" && "👥"}
            {currentField.key === "amount" && "💰"}
            {currentField.key === "timeline" && "📅"}
            {currentField.key === "visibility" && "🔐"}
          </div>
          <h2 className="text-lg font-bold text-white mb-1">
            {currentField.label}
          </h2>
          <p className="text-sm text-gray-400">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>

        {/* Dynamic Form Field */}
        <div className="px-4 flex-1">
          {/* Name Field */}
          {currentField.key === "name" && (
            <div className="space-y-2">
              <p className="text-sm text-gray-300 text-center mb-4">
                Give your group savings goal a clear, descriptive name
              </p>
              <input
                type="text"
                value={groupGoalForm.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., Family Vacation Fund"
                className="w-full p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-base"
                maxLength={50}
                autoFocus
              />
              <div className="text-xs text-gray-500 text-right mt-1">
                {groupGoalForm.name.length}/50
              </div>
            </div>
          )}

          {/* Amount Field */}
          {currentField.key === "amount" && (
            <div className="space-y-2">
              <p className="text-sm text-gray-300 text-center mb-4">
                How much does your group want to save in total?
              </p>
              <div className="text-center mb-2">
                <span className="text-lg font-bold text-cyan-400">KES</span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={groupGoalForm.amount}
                onChange={(e) =>
                  handleInputChange(
                    "amount",
                    e.target.value.replace(/[^0-9]/g, "")
                  )
                }
                placeholder="0"
                className="w-full p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-center text-xl font-bold"
                autoFocus
              />
              {groupGoalForm.amount && exchangeRate && (
                <div className="text-center mt-2 text-sm text-gray-400">
                  ≈ ${getUsdEquivalent()} USD
                </div>
              )}
            </div>
          )}

          {/* Timeline Field */}
          {currentField.key === "timeline" && (
            <div className="space-y-2">
              <p className="text-sm text-gray-300 text-center mb-4">
                Set a timeframe for reaching your goal
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "3", label: "3 months" },
                  { value: "6", label: "6 months" },
                  { value: "12", label: "1 year" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleInputChange("timeline", option.value)}
                    className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      groupGoalForm.timeline === option.value
                        ? "bg-cyan-400 text-gray-900"
                        : "bg-gray-700/50 text-gray-300 hover:bg-gray-600/50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Visibility Field */}
          {currentField.key === "visibility" && (
            <div className="space-y-6">
              <p className="text-sm text-gray-300 text-center mb-2">
                Choose who can see and join your goal
              </p>

              <div className="space-y-3">
                {/* Public Option */}
                <button
                  onClick={() => handleInputChange("isPublic", true)}
                  className={`w-full flex items-start gap-3 p-4 rounded-lg text-left transition-all ${
                    groupGoalForm.isPublic
                      ? "bg-cyan-400/20 border border-cyan-400/30 text-white"
                      : "bg-gray-700/20 border border-gray-700/30 text-gray-300"
                  }`}
                >
                  <div className="mt-1">
                    <Globe
                      className={`w-5 h-5 ${
                        groupGoalForm.isPublic
                          ? "text-cyan-400"
                          : "text-gray-400"
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Public Goal</div>
                    <div className="text-sm text-gray-400 mt-1">
                      Anyone can discover and join your goal. Best for community
                      initiatives.
                    </div>
                  </div>
                  {groupGoalForm.isPublic && (
                    <div className="w-5 h-5 bg-cyan-400 rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-gray-900 rounded-full"></div>
                    </div>
                  )}
                </button>

                {/* Private Option */}
                <button
                  onClick={() => handleInputChange("isPublic", false)}
                  className={`w-full flex items-start gap-3 p-4 rounded-lg text-left transition-all ${
                    !groupGoalForm.isPublic
                      ? "bg-cyan-400/20 border border-cyan-400/30 text-white"
                      : "bg-gray-700/20 border border-gray-700/30 text-gray-300"
                  }`}
                >
                  <div className="mt-1">
                    <Lock
                      className={`w-5 h-5 ${
                        !groupGoalForm.isPublic
                          ? "text-cyan-400"
                          : "text-gray-400"
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Private Goal</div>
                    <div className="text-sm text-gray-400 mt-1">
                      Only people you invite can join. Better for family and
                      close friends.
                    </div>
                  </div>
                  {!groupGoalForm.isPublic && (
                    <div className="w-5 h-5 bg-cyan-400 rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-gray-900 rounded-full"></div>
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-4 mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="p-4 mt-auto">
          <div className="flex gap-2">
            <ActionButton
              onClick={handleBack}
              variant="outline"
              size="lg"
              className="flex-1"
            >
              {currentStep === 0 ? "Cancel" : "Back"}
            </ActionButton>
            <ActionButton
              onClick={handleNext}
              variant="primary"
              size="lg"
              className="flex-1"
              disabled={
                !canProceed ||
                isLoading ||
                (currentField.key === "amount" && !exchangeRate)
              }
            >
              {isLoading ? "Creating..." : isLastStep ? "Create Goal" : "Next"}
            </ActionButton>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};

export default CreateGroupGoalModal;
