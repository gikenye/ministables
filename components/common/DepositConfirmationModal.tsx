"use client";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ActionButton } from "@/components/ui/ActionButton";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { theme } from "@/lib/theme";

interface DepositConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  onDeposit: () => void;
  isLoading?: boolean;
  error?: string | null;
  transactionStatus?: string | null;
  tokenSymbol?: string;
  depositSuccess?: { amount: string; transactionHash?: string } | null;
  account?: any;
  tokens?: any[];
  tokenInfos?: any;
  supportedStablecoins?: string[];
  copied?: boolean;
  setCopied?: (value: boolean) => void;
  setSelectedTokenForOnramp?: (value: string) => void;
  setShowOnrampModal?: (value: boolean) => void;
  goalTitle?: string;
}

export const DepositConfirmationModal = ({
  isOpen,
  onClose,
  amount,
  onDeposit,
  isLoading = false,
  error = null,
  transactionStatus = null,
  tokenSymbol = "USDC",
  depositSuccess = null,
  account = null,
  tokens = [],
  tokenInfos = {},
  supportedStablecoins = [],
  copied = false,
  setCopied = () => {},
  setSelectedTokenForOnramp = () => {},
  setShowOnrampModal = () => {},
  goalTitle = "Quick Save",
}: DepositConfirmationModalProps) => {
  if (depositSuccess) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[90vh]">
        <ModalHeader title="Deposit" onClose={onClose} />
        <div className="p-4 space-y-4">
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: theme.colors.cardText }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: theme.colors.cardText }}>
              Deposit Successful
            </h3>
            <p className="text-sm" style={{ color: theme.colors.cardTextSecondary }}>
              KES {depositSuccess.amount} deposited to {goalTitle}
            </p>
          </div>
          <ActionButton onClick={onClose} variant="primary" size="md" className="w-full">
            Done
          </ActionButton>
        </div>
      </BottomSheet>
    );
  }

  const hasZeroBalance = error?.includes("You have KES 0") || error?.includes("You have $0");

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[90vh]">
      <ModalHeader title="Confirm Deposit" onClose={onClose} />

      <div className="p-4 space-y-4">
        {error && (
          <div className="backdrop-blur-sm p-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: theme.colors.cardText }} />
              <span style={{ color: theme.colors.cardText }}>{error}</span>
            </div>

            {hasZeroBalance && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    if (account?.address) {
                      navigator.clipboard.writeText(account.address);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  className="flex-1 py-3 px-3 rounded-xl text-xs font-medium transition-all"
                  style={{
                    backgroundColor: theme.colors.cardButton,
                    border: `1px solid ${theme.colors.cardButtonBorder}`,
                    color: theme.colors.cardText,
                  }}
                >
                  {copied ? "✓ Copied" : "Copy Address"}
                </button>
                <button
                  onClick={() => {
                    const usdcToken = tokens.find(
                      (t) => tokenInfos[t.address]?.symbol?.toUpperCase() === "USDC"
                    );
                    const tokenForOnramp = usdcToken?.address || supportedStablecoins[0] || "";
                    setSelectedTokenForOnramp(tokenForOnramp);
                    setShowOnrampModal(true);
                    onClose();
                  }}
                  className="flex-1 py-3 px-3 rounded-xl text-xs font-medium transition-all"
                  style={{
                    backgroundColor: theme.colors.cardButton,
                    border: `1px solid ${theme.colors.cardButtonBorder}`,
                    color: theme.colors.cardText,
                  }}
                >
                  Mobile Money
                </button>
              </div>
            )}
          </div>
        )}

        {transactionStatus && (
          <div className="backdrop-blur-sm p-3 rounded-xl text-sm flex items-start gap-2" style={{ backgroundColor: theme.colors.cardButton, border: `1px solid ${theme.colors.cardButtonBorder}` }}>
            <Loader2 className="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin" style={{ color: theme.colors.cardText }} />
            <span style={{ color: theme.colors.cardText }}>{transactionStatus}</span>
          </div>
        )}

        {!hasZeroBalance && !error && (
          <>
            <div className="text-center py-6">
              <div className="text-3xl font-bold mb-2" style={{ color: theme.colors.cardText }}>
                KES {amount}
              </div>
              <div className="text-sm" style={{ color: theme.colors.cardTextSecondary }}>
                to {goalTitle}
              </div>
            </div>

            <ActionButton
              onClick={onDeposit}
              variant="primary"
              size="md"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                "Confirm Deposit"
              )}
            </ActionButton>
          </>
        )}

        {error && !hasZeroBalance && (
          <ActionButton
            onClick={onClose}
            variant="primary"
            size="md"
            className="w-full"
          >
            Close
          </ActionButton>
        )}
      </div>
    </BottomSheet>
  );
};
