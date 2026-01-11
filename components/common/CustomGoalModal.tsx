"use client";
import { useState } from "react";
import { BottomSheet, ActionButton } from "@/components/ui";

interface CustomGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGoal: () => void;
  form: {
    name: string;
    amount: string;
    timeline: string;
    category: string;
  };
  setForm: (form: any) => void;
  isLoading?: boolean;
  error?: string | null;
  exchangeRate?: number | null;
}

export const CustomGoalModal = ({
  isOpen,
  onClose,
  onCreateGoal,
  form,
  setForm,
  isLoading = false,
  error = null,
  exchangeRate = null,
}: CustomGoalModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { key: "name", label: "Goal Name", required: true },
    { key: "amount", label: "Target Amount", required: true },
    { key: "timeline", label: "Timeline", required: false },
    { key: "category", label: "Category", required: false },
  ];

  const currentField = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const canProceed =
    !currentField.required ||
    (form[currentField.key as keyof typeof form] &&
      form[currentField.key as keyof typeof form].trim() !== "");

  // Convert KES amount to USD for contract
  const convertKESToUSD = (kesAmount: string): string => {
    if (!exchangeRate || !kesAmount) return "0";
    const kesValue = parseFloat(kesAmount);
    const usdValue = kesValue / exchangeRate;
    return usdValue.toFixed(2);
  };

  const handleNext = () => {
    if (isLastStep) {
      onCreateGoal();
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

  const handleInputChange = (field: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[95vh]">
      <div className="bg-gray-800/20 backdrop-blur-sm min-h-full p-2 space-y-3 overflow-y-auto">
        {/* Progress Indicator */}
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

        {/* Step Header */}
        <div className="text-center py-2">
          <div className="text-2xl mb-2">🎯</div>
          <h2 className="text-lg font-bold text-white mb-1">
            {currentField.label}
          </h2>
          <p className="text-sm text-gray-400">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>

        {/* Dynamic Form Field */}
        <div className="space-y-2">
          {currentField.key === "name" && (
            <div>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., New Car, Vacation"
                className="w-full p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-base font-medium"
                maxLength={50}
                autoFocus
              />
              <div className="text-xs text-gray-500 text-right mt-1">
                {form.name.length}/50
              </div>
            </div>
          )}

          {currentField.key === "amount" && (
            <div>
              <div className="text-center mb-2">
                <span className="text-2xl font-bold text-cyan-400">KES</span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={form.amount}
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
              {form.amount && exchangeRate && (
                <div className="text-center mt-2 text-sm text-gray-400">
                  ≈ ${convertKESToUSD(form.amount)} USD
                </div>
              )}
            </div>
          )}

          {currentField.key === "timeline" && (
            <select
              value={form.timeline}
              onChange={(e) => handleInputChange("timeline", e.target.value)}
              className="w-full p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white focus:outline-none focus:border-cyan-400 text-base"
            >
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">12 months</option>
            </select>
          )}

          {currentField.key === "category" && (
            <select
              value={form.category}
              onChange={(e) => handleInputChange("category", e.target.value)}
              className="w-full p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white focus:outline-none focus:border-cyan-400 text-base"
            >
              <option value="personal">Personal</option>
              <option value="emergency">Emergency Fund</option>
              <option value="travel">Travel</option>
              <option value="education">Education</option>
              <option value="business">Business</option>
              <option value="health">Health</option>
              <option value="home">Home</option>
              <option value="other">Other</option>
            </select>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-2 pt-2">
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

        {currentField.key === "amount" && !exchangeRate && (
          <div className="text-center mt-2">
            <p className="text-xs text-yellow-400">Loading exchange rate...</p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
