"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  BottomSheet,
  ModalHeader,
  InfoCard,
  ActionButton,
} from "@/components/ui";
import { getBestStablecoinForDeposit } from "@/lib/services/balanceService";
import { useChain } from "@/components/ChainProvider";

// SaveMoneyModal using the exact QuickSaveConfirmationModal flow
const SaveMoneyModal = ({
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
  goal = null,
}: {
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
  goal?: any;
}) => {
  const { chain } = useChain();
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  // Check for best stablecoin when modal opens
  useEffect(() => {
    if (isOpen && account?.address && chain?.id && !depositSuccess) {
      setCheckingBalance(true);
      getBestStablecoinForDeposit(account.address, chain.id)
        .then((bestToken) => {
          console.log("Selected token for deposit:", bestToken);
          setSelectedToken(bestToken);
        })
        .catch((error) => {
          console.error("Failed to get best stablecoin:", error);
          // Fallback to default token
          setSelectedToken({ symbol: tokenSymbol, address: "", balance: 0 });
        })
        .finally(() => {
          setCheckingBalance(false);
        });
    }
  }, [isOpen, account?.address, chain?.id, tokenSymbol, depositSuccess]);
  // Show success state if deposit is successful
  if (depositSuccess) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[90vh]">
        <ModalHeader title="Deposit Successful!" onClose={onClose} />

        <div className="bg-gray-800/20 backdrop-blur-sm p-3 space-y-4">
          <div className="text-center py-3">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">✓</span>
            </div>
            <h3 className="text-white text-base font-medium mb-1.5">
              Deposit Successful!
            </h3>
            <p className="text-gray-400 text-xs mb-3">
              Your KES {depositSuccess.amount} has been deposited to your{" "}
              {goal ? goal.title : "Quick Save goal"}.
            </p>

            {depositSuccess.transactionHash && (
              <div className="text-xs text-cyan-400 break-all">
                Transaction: {depositSuccess.transactionHash.substring(0, 20)}
                ...
              </div>
            )}
          </div>

          <InfoCard>
            <div className="text-center">
              <div className="text-2xl mb-2">🎉</div>
              <p className="text-gray-300 text-xs">
                Your funds are now earning yield in the vault!
              </p>
            </div>
          </InfoCard>
        </div>
      </BottomSheet>
    );
  }

  const displayTokenSymbol = selectedToken?.symbol || tokenSymbol;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[90vh]">
      <ModalHeader title="Confirm Deposit" onClose={onClose} />

      <div className="bg-gray-800/20 backdrop-blur-sm p-4 space-y-6">
        {/* Balance Check Loading */}
        {checkingBalance && (
          <div className="bg-blue-900/20 border border-blue-700 text-blue-300 p-3 rounded-xl text-sm flex items-start gap-2">
            <Loader2 className="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin" />
            <span>Checking your wallet balance...</span>
          </div>
        )}
        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-300 p-3 rounded-xl text-sm">
            <div className="flex items-start gap-2 mb-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>

            {/* Show funding options if user has zero balance */}
            {error.includes("You have $0") && (
              <div className="mt-3 space-y-3">
                <p className="text-red-200 text-xs text-center">
                  Choose how to add {displayTokenSymbol} funds:
                </p>

                {/* Compact Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (account?.address) {
                        navigator.clipboard.writeText(account.address);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-3 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <span>{copied ? "✓ Copied!" : "📋 Copy Address"}</span>
                  </button>
                  <button
                    onClick={() => {
                      const usdcToken = tokens.find(
                        (t) =>
                          tokenInfos[t.address]?.symbol?.toUpperCase() ===
                          "USDC"
                      );
                      const tokenForOnramp =
                        usdcToken?.address || supportedStablecoins[0] || "";

                      setSelectedTokenForOnramp(tokenForOnramp);
                      setShowOnrampModal(true);
                    }}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs py-3 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    📱 Mobile Money
                  </button>
                </div>

                <p className="text-gray-400 text-xs text-center mt-3">
                  Once you add funds, you can proceed with your KES {amount}{" "}
                  deposit using {displayTokenSymbol}.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Transaction Status */}
        {transactionStatus && (
          <div className="bg-blue-900/20 border border-blue-700 text-blue-300 p-3 rounded-xl text-sm flex items-start gap-2">
            <Loader2 className="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin" />
            <span>{transactionStatus}</span>
          </div>
        )}

        {/* Only show confirmation details if there's no zero balance error */}
        {!error?.includes("You have KES 0") && (
          <>
            {/* Confirmation Details */}
            <div className="text-center py-3">
              <div className="text-xs text-cyan-400 mb-3">
                deposit{" "}
                <div className="text-2xl font-bold text-cyan-400 mb-1.5">
                  KES {amount}
                </div>
              </div>
              <div className="text-gray-400 mb-1.5 text-xs">to your</div>
              <div className="text-base font-bold text-cyan-400">
                {goal ? goal.title : "Quick Save Goal"}
              </div>
            </div>

            {/* Remember Info Card */}
            <InfoCard>
              <div className="text-center">
                <div className="text-2xl mb-2">🐷</div>
                <h4 className="text-white text-base font-semibold mb-2">
                  Remember
                </h4>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Your funds will be safely deposited and start earning yield
                  immediately.
                </p>
              </div>
            </InfoCard>

            {/* Action Button */}
            <ActionButton
              onClick={onDeposit}
              variant="primary"
              size="md"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing...
                </div>
              ) : (
                "DEPOSIT"
              )}
            </ActionButton>
          </>
        )}

        {/* Bottom spacing */}
        <div className="h-2"></div>
      </div>
    </BottomSheet>
  );
};

export default SaveMoneyModal;
