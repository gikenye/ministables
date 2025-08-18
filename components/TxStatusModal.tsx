"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock } from "lucide-react";

export type TxStepStatus = "idle" | "pending" | "success" | "error";

export interface TxStep {
  id: string;
  label: string;
  status: TxStepStatus;
}

interface TxStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: TxStep[];
  title?: string;
}

export function TxStatusModal({ isOpen, onClose, steps, title = "Transaction" }: TxStatusModalProps) {
  const anyPending = steps.some((s) => s.status === "pending");

  const getIcon = (status: TxStepStatus) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "pending":
        return (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
        );
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-xs mx-auto bg-white border-0 shadow-lg">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-medium text-gray-900">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <ul className="space-y-2">
            {steps.map((step) => (
              <li key={step.id} className="flex items-center gap-2 text-sm">
                {getIcon(step.status)}
                <span className={step.status === "error" ? "text-red-700" : "text-gray-800"}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>
          <div className="text-xs text-gray-500">
            {anyPending ? "This may take a few seconds. Please don’t close the app." : "All steps completed."}
          </div>
          <div className="pt-2">
            <Button onClick={onClose} className="w-full h-9 text-sm" variant={anyPending ? "outline" : "default"} disabled={anyPending}>
              {anyPending ? "Processing..." : "Close"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


