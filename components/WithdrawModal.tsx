"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { BottomSheet, ModalHeader, ActionButton } from "@/components/ui";
import { theme } from "@/lib/theme";

interface WithdrawableDeposit {
  depositId: number;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  withdrawableAmount: string;
  lockTier: number;
  depositTime: number;
  unlockTime: number;
}

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWithdraw: (tokenSymbol: string, depositIds: number[], sponsorGas?: boolean) => Promise<void>;
  vaultPositions: WithdrawableDeposit[];
  loading: boolean;
  userAddress?: string;
}

export const WithdrawModal = ({
  isOpen,
  onClose,
  onWithdraw,
  vaultPositions,
  loading,
}: WithdrawModalProps) => {
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setWithdrawAmount("");
      setError(null);
      const tokens = getTokenBalances();
      if (tokens.length > 0) {
        setSelectedToken(tokens[0].symbol);
      }
    }
  }, [isOpen, vaultPositions]);

  const getTokenBalances = () => {
    const balancesBySymbol: Record<string, { symbol: string; total: number; positions: WithdrawableDeposit[] }> = {};
    vaultPositions
      .filter((p) => parseFloat(p.withdrawableAmount || "0") > 0)
      .forEach((position) => {
        const symbol = position.tokenSymbol;
        if (!balancesBySymbol[symbol]) {
          balancesBySymbol[symbol] = { symbol, total: 0, positions: [] };
        }
        balancesBySymbol[symbol].total += parseFloat(position.withdrawableAmount);
        balancesBySymbol[symbol].positions.push(position);
      });
    return Object.values(balancesBySymbol);
  };

  const selectPositionsForAmount = (amount: number, tokenSymbol: string): number[] => {
    const tokenData = getTokenBalances().find((t) => t.symbol === tokenSymbol);
    if (!tokenData) return [];
    const sortedPositions = [...tokenData.positions].sort(
      (a, b) => parseFloat(b.withdrawableAmount) - parseFloat(a.withdrawableAmount)
    );
    const selectedIds: number[] = [];
    let remaining = amount;
    for (const position of sortedPositions) {
      if (remaining <= 0) break;
      const positionAmount = parseFloat(position.withdrawableAmount);
      if (positionAmount > 0) {
        selectedIds.push(position.depositId);
        remaining -= positionAmount;
      }
    }
    return selectedIds;
  };

  const handlePercentageClick = (percentage: number) => {
    const tokenData = getTokenBalances().find((t) => t.symbol === selectedToken);
    if (!tokenData) return;
    const amount = (tokenData.total * percentage / 100).toFixed(4);
    setWithdrawAmount(amount);
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    const tokenData = getTokenBalances().find((t) => t.symbol === selectedToken);
    if (!tokenData) {
      setError("Token not found");
      return;
    }
    if (amount > tokenData.total) {
      setError(`Amount exceeds available balance`);
      return;
    }
    setError(null);
    setIsWithdrawing(true);
    try {
      const depositIds = selectPositionsForAmount(amount, selectedToken);
      await onWithdraw(selectedToken, depositIds, true);
      setWithdrawAmount("");
      onClose();
    } catch (error: any) {
      setError(error.message || "Withdrawal failed. Please try again.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const tokenBalances = getTokenBalances();

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[90vh]">
      <ModalHeader title="Withdraw" onClose={onClose} />

      <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 60px)' }}>
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: theme.colors.cardText }}></div>
          </div>
        )}

        {!loading && tokenBalances.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: theme.colors.cardTextSecondary }}>
              No funds available for withdrawal
            </p>
          </div>
        )}

        {!loading && tokenBalances.length > 0 && (
          <div className="space-y-4">
            {tokenBalances.length > 1 && (
              <div className="flex gap-2">
                {tokenBalances.map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => setSelectedToken(token.symbol)}
                    className="flex-1 p-3 rounded-xl transition-all"
                    style={{
                      backgroundColor: selectedToken === token.symbol ? theme.colors.cardButton : 'transparent',
                      border: `1px solid ${theme.colors.cardButtonBorder}`,
                    }}
                  >
                    <div className="text-sm font-medium" style={{ color: theme.colors.cardText }}>{token.symbol}</div>
                    <div className="text-xs" style={{ color: theme.colors.cardTextSecondary }}>{token.total.toFixed(4)}</div>
                  </button>
                ))}
              </div>
            )}

            <div className="text-center backdrop-blur-sm rounded-xl p-4" style={{ backgroundColor: theme.colors.cardButton, border: `1px solid ${theme.colors.cardButtonBorder}` }}>
              <div className="text-xs mb-1" style={{ color: theme.colors.cardTextSecondary }}>Available</div>
              <div className="text-2xl font-bold" style={{ color: theme.colors.cardText }}>
                {tokenBalances.find((t) => t.symbol === selectedToken)?.total.toFixed(4) || "0.0000"}
              </div>
              <div className="text-sm" style={{ color: theme.colors.cardTextSecondary }}>{selectedToken}</div>
            </div>

            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 backdrop-blur-sm rounded-xl text-lg text-center focus:outline-none"
              style={{
                backgroundColor: theme.colors.cardButton,
                border: `1px solid ${theme.colors.cardButtonBorder}`,
                color: theme.colors.cardText,
              }}
              step="0.0001"
            />

            <div className="grid grid-cols-3 gap-2">
              {[25, 50, 100].map((percentage) => (
                <button
                  key={percentage}
                  onClick={() => handlePercentageClick(percentage)}
                  className="py-2 px-4 backdrop-blur-sm rounded-xl text-sm font-medium transition-all"
                  style={{
                    backgroundColor: theme.colors.cardButton,
                    border: `1px solid ${theme.colors.cardButtonBorder}`,
                    color: theme.colors.cardText,
                  }}
                >
                  {percentage}%
                </button>
              ))}
            </div>

            {error && (
              <p className="text-sm text-center" style={{ color: theme.colors.cardText }}>{error}</p>
            )}

            <ActionButton
              onClick={handleWithdraw}
              variant="primary"
              size="md"
              className="w-full"
              disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || isWithdrawing}
            >
              {isWithdrawing ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                `Withdraw ${withdrawAmount || "0"} ${selectedToken}`
              )}
            </ActionButton>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
