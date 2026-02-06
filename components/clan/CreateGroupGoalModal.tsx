"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/ui";
import { theme } from "@/lib/theme";

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

export const CreateGroupGoalModal: React.FC<CreateGroupGoalModalProps> = ({
  isOpen,
  onClose,
  onCreateGroupGoal,
  groupGoalForm,
  setGroupGoalForm,
  isLoading,
  error,
  exchangeRate,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const submitLockRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    {
      key: "name",
      label: "Clan Name",
      subLabel: "Give your clan a short, clear name.",
      placeholder: "e.g. Family Fund",
      required: true,
    },
    {
      key: "amount",
      label: "Target Amount",
      subLabel: "How much will you raise together?",
      placeholder: "0",
      required: true,
    },
    {
      key: "timeline",
      label: "Timeline",
      subLabel: "Pick how long you want to save.",
      required: true,
    },
    {
      key: "visibility",
      label: "Visibility",
      subLabel: "Decide who can join this clan.",
      required: true,
    },
  ] as const;

  const currentField = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isDisabled = !!isLoading || isSubmitting;

  const amountValue = Number(groupGoalForm.amount || 0);
  const amountUsd =
    exchangeRate && amountValue > 0 ? (amountValue / exchangeRate).toFixed(2) : null;

  const handleNext = () => {
    if (isDisabled) return;
    const value = groupGoalForm[currentField.key as keyof typeof groupGoalForm];
    const isMissing =
      currentField.key === "amount"
        ? !value || Number(value) <= 0
        : currentField.key === "name"
        ? !value || value.trim() === ""
        : currentField.key === "timeline"
        ? !value
        : false;

    if (currentField.required && isMissing) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
      return;
    }

    if (isLastStep) {
      if (submitLockRef.current) return;
      submitLockRef.current = true;
      setIsSubmitting(true);
      onCreateGroupGoal();
      return;
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (currentStep === 0) {
      onClose();
      return;
    }
    setCurrentStep((prev) => prev - 1);
  };

  useEffect(() => {
    if (!isLoading) {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isOpen) {
      submitLockRef.current = false;
      setIsSubmitting(false);
      setCurrentStep(0);
      setIsShaking(false);
    }
  }, [isOpen]);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={isDisabled ? () => {} : onClose}
      maxHeight="max-h-[560px]"
    >
      <div className="p-4">
        <div
          className="rounded-[2rem] p-6 text-white shadow-2xl border border-white/10"
          style={{
            backgroundImage: `linear-gradient(to bottom right, ${theme.colors.cardGradientFrom}, ${theme.colors.cardGradientTo})`,
          }}
        >
          <div className="flex gap-1.5 mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  index <= currentStep ? "bg-[#4ade80]" : "bg-white/10"
                }`}
              />
            ))}
          </div>

          <header className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4ade80] mb-1">
              {currentField.label}
            </p>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              {currentField.subLabel}
            </h2>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentField.key}
              initial={{ x: 10, opacity: 0 }}
              animate={isShaking ? { x: [-4, 4, -4, 4, 0] } : { x: 0, opacity: 1 }}
              exit={{ x: -10, opacity: 0 }}
              className="w-full"
            >
              {currentField.key === "amount" ? (
                <div className="space-y-3">
                  <div className="relative flex items-center bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-3 focus-within:border-[#4ade80]/40 transition-all">
                    <span className="text-xs font-bold text-[#4ade80] mr-3">KES</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      disabled={isDisabled}
                      value={groupGoalForm.amount}
                      onChange={(e) =>
                        setGroupGoalForm({
                          ...groupGoalForm,
                          amount: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      className="w-full bg-transparent text-2xl font-bold text-white focus:outline-none disabled:opacity-50"
                      placeholder={currentField.placeholder}
                    />
                  </div>
                  {amountUsd && (
                    <p className="text-xs text-white/40 ml-1">
                      Value: <span className="text-white/70">${amountUsd} USD</span>
                    </p>
                  )}
                </div>
              ) : currentField.key === "timeline" ? (
                <div className="relative">
                  <select
                    disabled={isDisabled}
                    value={groupGoalForm.timeline}
                    onChange={(e) =>
                      setGroupGoalForm({ ...groupGoalForm, timeline: e.target.value })
                    }
                    className="w-full bg-white/[0.04] border border-white/10 p-4 rounded-2xl text-sm text-white appearance-none outline-none focus:border-[#4ade80]/40"
                  >
                    <option value="3" className="bg-black">
                      3 Months
                    </option>
                    <option value="6" className="bg-black">
                      6 Months
                    </option>
                    <option value="12" className="bg-black">
                      12 Months
                    </option>
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
                  />
                </div>
              ) : currentField.key === "visibility" ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    disabled={isDisabled}
                    onClick={() => setGroupGoalForm({ ...groupGoalForm, isPublic: true })}
                    className={`py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                      groupGoalForm.isPublic
                        ? "bg-white text-black"
                        : "bg-white/10 border border-white/10 text-white/60"
                    }`}
                  >
                    Public
                  </button>
                  <button
                    disabled={isDisabled}
                    onClick={() => setGroupGoalForm({ ...groupGoalForm, isPublic: false })}
                    className={`py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                      !groupGoalForm.isPublic
                        ? "bg-white text-black"
                        : "bg-white/10 border border-white/10 text-white/60"
                    }`}
                  >
                    Private
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  disabled={isDisabled}
                  value={groupGoalForm.name}
                  onChange={(e) =>
                    setGroupGoalForm({ ...groupGoalForm, name: e.target.value })
                  }
                  className="w-full bg-white/[0.04] border border-white/10 p-4 rounded-2xl text-sm font-medium text-white transition-all focus:outline-none focus:border-[#4ade80]/40 placeholder:text-white/20"
                  placeholder={currentField.placeholder}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <div className="mt-4 text-[10px] font-bold uppercase tracking-widest text-red-300/80">
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-8">
            <button
              disabled={isDisabled}
              onClick={handleBack}
              className="flex-1 py-2.5 bg-white/10 text-white/70 rounded-xl text-[11px] font-bold uppercase tracking-widest transition active:scale-95 disabled:opacity-40"
            >
              {currentStep === 0 ? "Cancel" : "Back"}
            </button>
            <button
              disabled={isDisabled}
              onClick={handleNext}
              className="flex-[1.5] py-2.5 bg-[#4ade80] text-black rounded-xl text-[11px] font-black uppercase tracking-widest transition active:scale-95 disabled:opacity-50"
            >
              {isLoading || isSubmitting ? (
                <Loader2 className="animate-spin mx-auto" size={18} />
              ) : isLastStep ? (
                "Create Clan"
              ) : (
                "Continue"
              )}
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};

export default CreateGroupGoalModal;
