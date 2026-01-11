import {
  AmountInputModal,
  CustomGoalModal,
  DepositConfirmationModal,
  GoalDetailsModal,
  QuickSaveDetailsModal,
  SaveActionsModal,
} from "@/components/common";
import { CreateGroupGoalModal } from "@/components/clan/CreateGroupGoalModal";
import { JoinGoalModal } from "@/components/clan/JoinGoalModal";
import { OnrampDepositModal } from "@/components/OnrampDepositModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import type { GroupSavingsGoal } from "@/lib/services/backendApiService";

interface ModalManagerProps {
  // Save Actions Modal
  saveActionsModalOpen: boolean;
  onSaveActionsClose: () => void;
  onSaveActionSelect: (actionId: string) => void;

  // Quick Save Modals
  quickSaveDetailsOpen: boolean;
  quickSaveAmountOpen: boolean;
  quickSaveConfirmationOpen: boolean;
  quickSaveAmount: string;
  onQuickSaveClose: () => void;
  onQuickSaveSaveNow: () => void;
  onQuickSaveAmountContinue: (amount: string) => void;
  onQuickSaveDeposit: () => void;

  // Goal Modals
  goalDetailsOpen: boolean;
  goalAmountOpen: boolean;
  goalConfirmationOpen: boolean;
  selectedGoal: any;
  goalAmount: string;
  onGoalClose: () => void;
  onGoalSaveNow: () => void;
  onGoalAmountContinue: (amount: string) => void;
  showBalances: boolean;
  exchangeRate?: number;

  // Custom Goal Modal
  customGoalModalOpen: boolean;
  customGoalForm: any;
  customGoalLoading: boolean;
  onCustomGoalClose: () => void;
  onCreateCustomGoal: () => void;
  setCustomGoalForm: (form: any) => void;

  // Group Goal Modal
  createGroupGoalModalOpen: boolean;
  groupGoalForm: any;
  createGroupGoalLoading: boolean;
  onGroupGoalClose: () => void;
  onCreateGroupGoal: () => void;
  setGroupGoalForm: (form: any) => void;

  // Join Goal Modal
  joinGoalModalOpen: boolean;
  selectedGoalToJoin: GroupSavingsGoal | null;
  joinGoalLoading: boolean;
  joinGoalError: string | null;
  onJoinGoalClose: () => void;
  onJoinGoal: (amount: string) => void;

  // Withdrawal Modal
  withdrawalModalOpen: boolean;
  vaultPositions: any[];
  vaultPositionsLoading: boolean;
  onWithdrawalClose: () => void;
  onWithdraw: (tokenSymbol: string, depositIds: number[], sponsorGas?: boolean) => void;
  // Onramp Modal
  showOnrampModal: boolean;
  selectedTokenForOnramp: string;
  tokenInfos: any;
  onOnrampClose: () => void;
  onOnrampSuccess: () => void;

  // Deposit Confirmation Props
  isDepositLoading: boolean;
  depositError: string | null;
  transactionStatus: string | null;
  depositSuccess: any;
  defaultToken: any;
  account: any;
  tokens: any[];
  supportedStablecoins: string[];
  copied: boolean;
  setCopied: (copied: boolean) => void;
  setSelectedTokenForOnramp: (token: string) => void;
  setShowOnrampModal: (show: boolean) => void;
}

export function ModalManager(props: ModalManagerProps) {
  const {
    saveActionsModalOpen,
    onSaveActionsClose,
    onSaveActionSelect,
    quickSaveDetailsOpen,
    quickSaveAmountOpen,
    quickSaveConfirmationOpen,
    quickSaveAmount,
    onQuickSaveClose,
    onQuickSaveSaveNow,
    onQuickSaveAmountContinue,
    onQuickSaveDeposit,
    goalDetailsOpen,
    goalAmountOpen,
    goalConfirmationOpen,
    selectedGoal,
    goalAmount,
    onGoalClose,
    onGoalSaveNow,
    onGoalAmountContinue,
    showBalances,
    exchangeRate,
    customGoalModalOpen,
    customGoalForm,
    customGoalLoading,
    onCustomGoalClose,
    onCreateCustomGoal,
    setCustomGoalForm,
    createGroupGoalModalOpen,
    groupGoalForm,
    createGroupGoalLoading,
    onGroupGoalClose,
    onCreateGroupGoal,
    setGroupGoalForm,
    joinGoalModalOpen,
    selectedGoalToJoin,
    joinGoalLoading,
    joinGoalError,
    onJoinGoalClose,
    onJoinGoal,
    withdrawalModalOpen,
    vaultPositions,
    vaultPositionsLoading,
    onWithdrawalClose,
    onWithdraw,
    showOnrampModal,
    selectedTokenForOnramp,
    tokenInfos,
    onOnrampClose,
    onOnrampSuccess,
    isDepositLoading,
    depositError,
    transactionStatus,
    depositSuccess,
    defaultToken,
    account,
    tokens,
    supportedStablecoins,
    copied,
    setCopied,
    setSelectedTokenForOnramp,
    setShowOnrampModal,
  } = props;

  const getGoalIcon = (category?: string) => {
    const icons: Record<string, string> = {
      personal: "🎯",
      retirement: "🏦",
      emergency: "🚨",
      travel: "✈️",
      education: "🎓",
      business: "💼",
      health: "🏥",
      home: "🏠",
    };
    return icons[category || ""] || "💰";
  };

  return (
    <>
      <SaveActionsModal
        isOpen={saveActionsModalOpen}
        onClose={onSaveActionsClose}
        onActionSelect={onSaveActionSelect}
      />

      <QuickSaveDetailsModal
        isOpen={quickSaveDetailsOpen}
        onClose={onQuickSaveClose}
        onSaveNow={onQuickSaveSaveNow}
      />

      <AmountInputModal
        isOpen={quickSaveAmountOpen}
        onClose={onQuickSaveClose}
        onContinue={onQuickSaveAmountContinue}
        title="How much do you want to save?"
        initialAmount="100"
        currency="KES"
        icon="🐷"
      />

      <DepositConfirmationModal
        isOpen={quickSaveConfirmationOpen}
        onClose={onQuickSaveClose}
        amount={quickSaveAmount}
        onDeposit={onQuickSaveDeposit}
        isLoading={isDepositLoading}
        error={depositError}
        transactionStatus={transactionStatus}
        tokenSymbol={defaultToken?.symbol || "USDC"}
        depositSuccess={depositSuccess}
        account={account}
        tokens={tokens}
        tokenInfos={tokenInfos}
        supportedStablecoins={supportedStablecoins}
        copied={copied}
        setCopied={setCopied}
        setSelectedTokenForOnramp={setSelectedTokenForOnramp}
        setShowOnrampModal={setShowOnrampModal}
        goalTitle="Quick Save Goal"
        goalIcon="🐷"
      />

      <GoalDetailsModal
        isOpen={goalDetailsOpen}
        onClose={onGoalClose}
        onSaveNow={onGoalSaveNow}
        goal={selectedGoal}
        showBalance={showBalances}
        exchangeRate={exchangeRate}
      />

      <AmountInputModal
        isOpen={goalAmountOpen}
        onClose={onGoalClose}
        onContinue={onGoalAmountContinue}
        title={`Save to ${selectedGoal?.title || "Goal"}`}
        initialAmount="100"
        currency="KES"
        icon={getGoalIcon(selectedGoal?.category)}
      />

      <DepositConfirmationModal
        isOpen={goalConfirmationOpen}
        onClose={onGoalClose}
        amount={goalAmount}
        onDeposit={onQuickSaveDeposit}
        isLoading={isDepositLoading}
        error={depositError}
        transactionStatus={transactionStatus}
        tokenSymbol={defaultToken?.symbol || "USDC"}
        depositSuccess={depositSuccess}
        account={account}
        tokens={tokens}
        tokenInfos={tokenInfos}
        supportedStablecoins={supportedStablecoins}
        copied={copied}
        setCopied={setCopied}
        setSelectedTokenForOnramp={setSelectedTokenForOnramp}
        setShowOnrampModal={setShowOnrampModal}
        goalTitle={selectedGoal?.title || "Goal"}
        goalIcon={getGoalIcon(selectedGoal?.category)}
      />

      <CustomGoalModal
        isOpen={customGoalModalOpen}
        onClose={onCustomGoalClose}
        onCreateGoal={onCreateCustomGoal}
        form={customGoalForm}
        setForm={setCustomGoalForm}
        isLoading={customGoalLoading}
        error={null}
        exchangeRate={exchangeRate}
      />

      <CreateGroupGoalModal
        isOpen={createGroupGoalModalOpen}
        onClose={onGroupGoalClose}
        onCreateGroupGoal={onCreateGroupGoal}
        groupGoalForm={groupGoalForm}
        setGroupGoalForm={setGroupGoalForm}
        isLoading={createGroupGoalLoading}
        error={null}
        exchangeRate={exchangeRate}
      />

      <JoinGoalModal
        isOpen={joinGoalModalOpen}
        onClose={onJoinGoalClose}
        goal={selectedGoalToJoin}
        onJoin={onJoinGoal}
        isLoading={joinGoalLoading}
        error={joinGoalError}
        exchangeRate={exchangeRate}
      />

      <WithdrawModal
        isOpen={withdrawalModalOpen}
        onClose={onWithdrawalClose}
        onWithdraw={onWithdraw}
        vaultPositions={vaultPositions}
        loading={vaultPositionsLoading}
        userAddress={account?.address}
      />

      <OnrampDepositModal
        isOpen={showOnrampModal}
        onClose={onOnrampClose}
        selectedAsset={tokenInfos[selectedTokenForOnramp]?.symbol || "USDC"}
        assetSymbol={tokenInfos[selectedTokenForOnramp]?.symbol || "USDC"}
        onSuccess={onOnrampSuccess}
      />
    </>
  );
}
