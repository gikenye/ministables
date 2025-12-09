"use client";

import React, { useState } from 'react';
import { Users, Loader2, AlertCircle } from 'lucide-react';
import { ActionButton, BottomSheet, ModalHeader } from '@/components/ui';
import { GroupSavingsGoal } from '@/lib/services/backendApiService';

interface JoinGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: GroupSavingsGoal | null;
  onJoin: (amount: string) => void;
  isLoading?: boolean;
  error?: string | null;
  exchangeRate?: number;
}

export const JoinGoalModal: React.FC<JoinGoalModalProps> = ({
  isOpen,
  onClose,
  goal,
  onJoin,
  isLoading = false,
  error = null,
  exchangeRate
}) => {
  const [amount, setAmount] = useState('100');

  if (!goal) return null;

  const formatAmount = (usdAmount: number) => {
    if (exchangeRate) {
      const kesAmount = usdAmount * exchangeRate;
      return `KES ${kesAmount.toLocaleString()}`;
    }
    return `$${usdAmount.toLocaleString()}`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'travel': return '✈️';
      case 'education': return '🎓';
      case 'business': return '💼';
      case 'health': return '🏥';
      case 'home': return '🏠';
      case 'emergency': return '🚨';
      default: return '💰';
    }
  };

  const handleJoin = () => {
    if (amount && parseFloat(amount) > 0) {
      onJoin(amount);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[90vh]">
      <ModalHeader title="Join Group Goal" onClose={onClose} />

      <div className="bg-gray-800/20 backdrop-blur-sm p-4 space-y-6">
        {/* Goal Info */}
        <div className="text-center">
          <div className="text-4xl mb-3">{getCategoryIcon(goal.category || 'other')}</div>
          <h3 className="text-lg font-bold text-white mb-2">{goal.name}</h3>
          <div className="text-cyan-400 text-xl font-bold mb-1">
            {formatAmount(goal.targetAmountUSD || 0)}
          </div>
          <div className="text-xs text-gray-400 mb-3">Target Amount</div>
          
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <Users className="w-4 h-4" />
            <span>{goal.participantCount || 0} members</span>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-3">
          <div className="text-center">
            <h4 className="text-white font-medium mb-2">How much to start with?</h4>
            <p className="text-xs text-gray-400 mb-4">
              You can start with any amount to join the group
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-center mb-2">
              <span className="text-lg font-bold text-cyan-400">KES</span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="100"
              className="w-full p-4 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-center text-xl font-bold"
              autoFocus
            />
            {amount && exchangeRate && (
              <div className="text-center mt-2 text-sm text-gray-400">
                ≈ ${(parseFloat(amount) / exchangeRate).toFixed(2)} USD
              </div>
            )}
          </div>

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {['50', '100', '500'].map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => setAmount(quickAmount)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  amount === quickAmount
                    ? 'bg-cyan-400 text-gray-900'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                }`}
              >
                KES {quickAmount}
              </button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <div className="text-center">
            <div className="text-2xl mb-2">🤝</div>
            <h4 className="text-white text-sm font-semibold mb-2">Join the Group</h4>
            <p className="text-blue-200 text-xs leading-relaxed">
              Your deposit will be allocated to this group goal and start earning yield immediately.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <ActionButton
            onClick={onClose}
            variant="outline"
            size="lg"
            className="flex-1"
            disabled={isLoading}
          >
            Cancel
          </ActionButton>
          <ActionButton
            onClick={handleJoin}
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={isLoading || !amount || parseFloat(amount) <= 0}
          >
            {isLoading ? (
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                Joining...
              </div>
            ) : (
              'Join Group'
            )}
          </ActionButton>
        </div>

        {/* Bottom spacing */}
        <div className="h-2"></div>
      </div>
    </BottomSheet>
  );
};

export default JoinGoalModal;