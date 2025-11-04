"use client";

import { useState, useEffect } from "react";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import {
  BottomSheet,
  ModalHeader,
  InfoCard,
  ActionButton,
} from "@/components/ui";

interface VaultPosition {
  depositId: number;
  tokenAddress: string;
  amount: string;
  withdrawableAmount: string;
  lockTier: number;
  depositTime: string;
  unlockTime?: string;
}

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWithdraw: (tokenSymbol: string, depositIds: number[]) => Promise<void>;
  vaultPositions: VaultPosition[];
  tokenInfos: Record<
    string,
    { symbol: string; decimals: number; icon?: string }
  >;
  loading: boolean;
}

export const WithdrawModal = ({
  isOpen,
  onClose,
  onWithdraw,
  vaultPositions,
  tokenInfos,
  loading,
}: WithdrawModalProps) => {
  const [selectedPositions, setSelectedPositions] = useState<VaultPosition[]>(
    []
  );
  const [error, setError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedPositions([]);
      setError(null);
    }
  }, [isOpen]);

  const handlePositionToggle = (position: VaultPosition) => {
    setSelectedPositions((prev) => {
      const isSelected = prev.some((p) => p.depositId === position.depositId);
      if (isSelected) {
        return prev.filter((p) => p.depositId !== position.depositId);
      } else {
        return [...prev, position];
      }
    });
  };

  const handleWithdraw = async () => {
    if (selectedPositions.length === 0) return;

    setError(null);
    setIsWithdrawing(true);

    try {
      // Group selected positions by token symbol
      const positionsByToken = selectedPositions.reduce(
        (acc, position) => {
          const tokenSymbol =
            tokenInfos[position.tokenAddress]?.symbol || position.tokenAddress;
          if (!acc[tokenSymbol]) {
            acc[tokenSymbol] = [];
          }
          acc[tokenSymbol].push(position.depositId);
          return acc;
        },
        {} as Record<string, number[]>
      );

      // Process withdrawals for each token
      for (const [tokenSymbol, depositIds] of Object.entries(
        positionsByToken
      )) {
        await onWithdraw(tokenSymbol, depositIds);
      }

      setSelectedPositions([]);
      onClose();
    } catch (error: any) {
      setError(error.message || "Withdrawal failed. Please try again.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const getTokenBalancesBySymbol = () => {
    const balancesBySymbol: Record<
      string,
      {
        positions: VaultPosition[];
        totalBalance: number;
        symbol: string;
      }
    > = {};

    vaultPositions.forEach((position) => {
      const tokenSymbol =
        tokenInfos[position.tokenAddress]?.symbol || position.tokenAddress;
      if (!balancesBySymbol[tokenSymbol]) {
        balancesBySymbol[tokenSymbol] = {
          positions: [],
          totalBalance: 0,
          symbol: tokenSymbol,
        };
      }
      balancesBySymbol[tokenSymbol].positions.push(position);
      balancesBySymbol[tokenSymbol].totalBalance += parseFloat(
        position.withdrawableAmount || "0"
      );
    });

    return balancesBySymbol;
  };

  const formatBalance = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    // Always show 4 decimal places for better precision with tiny deposits
    return num.toFixed(4);
  };

  const totalSelectedAmount = selectedPositions.reduce(
    (sum, position) => sum + parseFloat(position.withdrawableAmount || "0"),
    0
  );

  const tokenBalances = getTokenBalancesBySymbol();
  const availableTokens = Object.keys(tokenBalances).filter(
    (symbol) => tokenBalances[symbol].positions.length > 0
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[90vh]">
      <ModalHeader title="Withdraw Funds" onClose={onClose} />

      <div className="bg-gray-800/20 backdrop-blur-sm p-3 space-y-3 overflow-y-auto">
        {/* Header */}
        <div className="text-center py-0.5">
          <div className="text-2xl mb-1.5">💰</div>
          <h3 className="text-base font-semibold text-white mb-0.5">
            Choose Positions to Withdraw
          </h3>
          <p className="text-xs text-gray-400">
            Select multiple positions from any token to withdraw
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-3"></div>
            <p className="text-gray-400 text-sm">Loading your positions...</p>
          </div>
        )}

        {/* Available Tokens and Positions */}
        {!loading && availableTokens.length > 0 && (
          <div className="space-y-3">
            {availableTokens.map((tokenSymbol) => {
              const tokenData = tokenBalances[tokenSymbol];

              return (
                <div key={tokenSymbol} className="space-y-2">
                  {/* Token Header */}
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-cyan-400/20 rounded-full flex items-center justify-center">
                        <span className="text-cyan-400 text-xs font-bold">
                          {tokenSymbol.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {tokenSymbol}
                        </div>
                        <div className="text-xs text-gray-400">
                          {tokenData.positions.length} position
                          {tokenData.positions.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-cyan-400">
                        {formatBalance(tokenData.totalBalance)}
                      </div>
                      <div className="text-xs text-gray-400">
                        Total Available
                      </div>
                    </div>
                  </div>

                  {/* Token Positions */}
                  <div className="space-y-1.5 pl-2">
                    {tokenData.positions.map((position) => {
                      const isSelected = selectedPositions.some(
                        (p) => p.depositId === position.depositId
                      );
                      const withdrawableAmount = parseFloat(
                        position.withdrawableAmount || "0"
                      );

                      return (
                        <InfoCard
                          key={position.depositId}
                          variant="action"
                          className={`cursor-pointer transition-all duration-200 ${
                            isSelected
                              ? "border-cyan-400 bg-cyan-400/5"
                              : "hover:border-cyan-400"
                          }`}
                        >
                          <button
                            onClick={() => handlePositionToggle(position)}
                            className="w-full flex items-center justify-between p-1"
                          >
                            <div className="flex items-center space-x-3">
                              <div
                                className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${
                                  isSelected
                                    ? "bg-cyan-400 border-cyan-400"
                                    : "border-gray-400"
                                }`}
                              >
                                {isSelected && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                              <div className="text-left">
                                <div className="text-xs font-medium text-white">
                                  Position #{position.depositId}
                                </div>
                                <div className="text-xs text-gray-400">
                                  Deposited: {formatBalance(position.amount)}{" "}
                                  {tokenSymbol}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-semibold text-cyan-400">
                                {formatBalance(withdrawableAmount)}
                              </div>
                              <div className="text-xs text-gray-400">
                                Withdrawable
                              </div>
                            </div>
                          </button>
                        </InfoCard>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && availableTokens.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">😴</div>
            <h3 className="text-white font-medium mb-2">No Funds Available</h3>
            <p className="text-gray-400 text-sm">
              You don't have any funds available for withdrawal at the moment.
            </p>
          </div>
        )}

        {/* Selection Summary */}
        {selectedPositions.length > 0 && (
          <InfoCard variant="stats">
            <div className="space-y-2">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Total Selected</div>
                <div className="text-lg font-bold text-cyan-400">
                  {formatBalance(totalSelectedAmount)}
                </div>
                <div className="text-xs text-gray-400">
                  {selectedPositions.length} position
                  {selectedPositions.length !== 1 ? "s" : ""} selected
                </div>
              </div>

              {/* Breakdown by token */}
              <div className="grid grid-cols-1 gap-2 pt-2 border-t border-gray-700/30">
                {Object.entries(
                  selectedPositions.reduce(
                    (acc, position) => {
                      const tokenSymbol =
                        tokenInfos[position.tokenAddress]?.symbol ||
                        position.tokenAddress;
                      if (!acc[tokenSymbol]) {
                        acc[tokenSymbol] = { count: 0, amount: 0 };
                      }
                      acc[tokenSymbol].count += 1;
                      acc[tokenSymbol].amount += parseFloat(
                        position.withdrawableAmount || "0"
                      );
                      return acc;
                    },
                    {} as Record<string, { count: number; amount: number }>
                  )
                ).map(([symbol, data]) => (
                  <div
                    key={symbol}
                    className="flex justify-between items-center"
                  >
                    <div className="text-xs text-gray-400">
                      {data.count} {symbol} position
                      {data.count !== 1 ? "s" : ""}
                    </div>
                    <div className="text-xs font-semibold text-white">
                      {formatBalance(data.amount)} {symbol}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </InfoCard>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <ActionButton
            onClick={handleWithdraw}
            variant="primary"
            size="md"
            className="w-full"
            disabled={selectedPositions.length === 0 || isWithdrawing}
          >
            {isWithdrawing ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing Withdrawal...
              </div>
            ) : selectedPositions.length === 0 ? (
              "Select positions to withdraw"
            ) : (
              `Withdraw ${formatBalance(totalSelectedAmount)} from ${selectedPositions.length} position${selectedPositions.length !== 1 ? "s" : ""}`
            )}
          </ActionButton>

          {selectedPositions.length > 0 && (
            <ActionButton
              onClick={() => setSelectedPositions([])}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Clear Selection
            </ActionButton>
          )}
        </div>

        {/* Important Notice */}
        <InfoCard>
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 text-yellow-400 flex-shrink-0" />
            <div className="text-xs text-gray-300">
              <div className="font-medium text-yellow-400 mb-1">Important</div>
              <p>
                Withdrawals cannot be undone. Funds will be transferred to your
                connected wallet.
              </p>
            </div>
          </div>
        </InfoCard>

        {/* Bottom spacing for safe area */}
        <div className="h-2"></div>
      </div>
    </BottomSheet>
  );
};
