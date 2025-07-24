"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ExternalLink } from "lucide-react";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "success" | "error";
  message: string;
  txHash?: string;
}

export function TransactionModal({
  isOpen,
  onClose,
  type,
  message,
  txHash,
}: TransactionModalProps) {
  const handleViewOnCeloScan = () => {
    if (txHash) {
      window.open(`https://celoscan.io/tx/${txHash}`, "_blank");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto bg-white border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center">
            {type === "success" ? (
              <CheckCircle className="w-8 h-8 text-green-500 mr-2" />
            ) : (
              <XCircle className="w-8 h-8 text-red-500 mr-2" />
            )}
            {type === "success" ? "Success!" : "Error"}
          </DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-4">
          <p className="text-gray-700 font-medium">{message}</p>

          {type === "success" && txHash && (
            <Button
              onClick={handleViewOnCeloScan}
              variant="outline"
              className="w-full border-secondary text-primary hover:bg-secondary hover:text-white bg-transparent"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View on CeloScan
            </Button>
          )}

          <Button
            onClick={onClose}
            className={`w-full ${
              type === "success"
                ? "bg-primary hover:bg-secondary"
                : "bg-red-500 hover:bg-red-600"
            } text-white`}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
