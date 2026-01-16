"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BottomSheet } from "@/components/ui";
import { theme } from "@/lib/theme";
import { Loader2, ChevronLeft, ChevronDown } from "lucide-react";

export const CustomGoalModal = ({
  isOpen, onClose, onCreateGoal, form, setForm, isLoading, error, exchangeRate
}: any) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isShaking, setIsShaking] = useState(false);

  const steps = [
    { key: "name", label: "Goal Name", subLabel: "What are you saving for?", placeholder: "e.g. Vacation Fund", required: true },
    { key: "amount", label: "Target Amount", subLabel: "How much do you need?", placeholder: "0", required: true },
    { key: "timeline", label: "Timeline", subLabel: "When do you need it?", required: true },
  ];

  const currentField = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isDisabled = isLoading;

  const handleNext = () => {
    if (isDisabled) return;
    const value = form[currentField.key];
    if (currentField.required && (!value || value.trim() === "" || value === "0")) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
      return;
    }
    if (isLastStep) onCreateGoal();
    else setCurrentStep(s => s + 1);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={isDisabled ? () => {} : onClose} maxHeight="max-h-[500px]">
      {/* Removed the background gradient here to prevent mirroring */}
      <div className="p-6 flex flex-col h-full bg-transparent">
        
        {/* Step Indicator */}
        <div className="flex gap-1.5 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= currentStep ? 'bg-[#4ade80]' : 'bg-white/5'}`} />
          ))}
        </div>

        <div className="flex-1">
          <header className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4ade80] mb-1">{currentField.label}</p>
            <h2 className="text-xl font-semibold text-white tracking-tight">{currentField.subLabel}</h2>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ x: 10, opacity: 0 }}
              animate={isShaking ? { x: [-4, 4, -4, 4, 0] } : { x: 0, opacity: 1 }}
              exit={{ x: -10, opacity: 0 }}
              className="w-full"
            >
              {currentField.key === "amount" ? (
                <div className="space-y-4">
                  <div className="relative flex items-center bg-white/[0.03] border border-white/10 rounded-2xl px-3 py-3 focus-within:border-[#4ade80]/40 transition-all">
                    <span className="text-sm font-bold text-[#4ade80] mr-3">KES</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      disabled={isDisabled}
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/\D/g, '') })}
                      className="w-full bg-transparent text-2xl font-bold text-white focus:outline-none disabled:opacity-50"
                      placeholder="0"
                    />
                  </div>
                  {exchangeRate && form.amount && (
                    <p className="text-xs text-white/40 ml-1">
                      Value: <span className="text-white/60">${(Number(form.amount) / exchangeRate).toFixed(2)} USD</span>
                    </p>
                  )}
                </div>
              ) : currentField.key === "timeline" ? (
                <div className="relative">
                  <select
                    disabled={isDisabled}
                    value={form[currentField.key]}
                    onChange={(e) => setForm({ ...form, [currentField.key]: e.target.value })}
                    className="w-full bg-white/[0.03] border border-white/10 p-4 rounded-2xl text-base text-white appearance-none outline-none focus:border-[#4ade80]/40"
                  >
                    <option value="3" className="bg-black">3 Months</option>
                    <option value="6" className="bg-black">6 Months</option>
                    <option value="12" className="bg-black">12 Months</option>
                  </select>
                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
              ) : (
                <input
                  type="text"
                  disabled={isDisabled}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white/[0.03] border border-white/10 p-4 rounded-2xl text-base font-medium text-white transition-all focus:outline-none focus:border-[#4ade80]/40 placeholder:text-white/20"
                  placeholder={currentField.placeholder}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-10">
          <button 
            disabled={isDisabled}
            onClick={() => currentStep === 0 ? onClose() : setCurrentStep(s => s - 1)} 
            className="flex-1 py-2 bg-white/5 text-white/60 rounded-xl text-xs font-bold uppercase tracking-widest transition active:scale-95 disabled:opacity-30"
          >
            {currentStep === 0 ? "Cancel" : "Back"}
          </button>
          
          <button 
            disabled={isDisabled}
            onClick={handleNext} 
            className="flex-[1.5] py-2 bg-[#4ade80] text-black rounded-xl text-xs font-black uppercase tracking-widest transition active:scale-95 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin mx-auto" size={18} /> : (isLastStep ? "Create Goal" : "Continue")}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};