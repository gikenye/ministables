import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import {
  backendApiClient,
  mapTokenSymbolToAsset,
  type CreateGoalRequest,
  type GroupSavingsGoal,
} from "@/lib/services/backendApiService";
import { reportError, reportInfo, reportWarning } from "@/lib/services/errorReportingService";
import { formatUsdFromKes } from "@/lib/utils";
import { type TokenBalance } from "@/lib/services/balanceService";
import { parseUnits } from "viem";
import { activityService } from "@/lib/services/activityService";
import type { MyGroups } from "@/lib/types/shared";

interface UseGoalOperationsProps {
  address?: string;
  chain: any;
  getKESRate: () => number | null;
  setCustomGoalLoading: (loading: boolean) => void;
  setCustomGoalModalOpen: (open: boolean) => void;
  setCustomGoalForm: (form: any) => void;
  setCreateGroupGoalLoading: (loading: boolean) => void;
  setCreateGroupGoalModalOpen: (open: boolean) => void;
  setGroupGoalForm: (form: any) => void;
  setJoinGoalLoading: (loading: boolean) => void;
  setJoinGoalError: (error: string | null) => void;
  fetchUserGoals: () => void;
  fetchGroupGoals: () => void;
  fetchMyGroups: () => void;
  setMyGroups: Dispatch<SetStateAction<MyGroups | null>>;
  refreshUserPortfolio?: (options?: { silent?: boolean }) => void;
  handleWalletDeposit: (
    depositAmount: string,
    onStatus: (status: string) => void,
    onSuccess: (receipt: any, usdAmount: number, token: any) => void,
    onError: (error: Error) => void,
    options?: { depositMethod?: "ONCHAIN" | "MPESA"; token?: TokenBalance }
  ) => Promise<void>;
}

export function useGoalOperations(props: UseGoalOperationsProps) {
  const {
    address,
    chain,
    getKESRate,
    setCustomGoalLoading,
    setCustomGoalModalOpen,
    setCustomGoalForm,
    setCreateGroupGoalLoading,
    setCreateGroupGoalModalOpen,
    setGroupGoalForm,
    setJoinGoalLoading,
    setJoinGoalError,
    fetchUserGoals,
    fetchGroupGoals,
    fetchMyGroups,
    setMyGroups,
    refreshUserPortfolio,
    handleWalletDeposit,
  } = props;

  const createGroupGoalInFlightRef = useRef(false);

  const handleCreateCustomGoal = useCallback(
    async (customGoalForm: any) => {
      if (!customGoalForm.name.trim() || !customGoalForm.amount.trim()) {
        reportWarning("Goal name and amount are required", {
          component: "useGoalOperations",
          operation: "handleCreateCustomGoal",
        });
        return;
      }

      if (!address) {
        reportWarning("Please connect your wallet to create a goal", {
          component: "useGoalOperations",
          operation: "handleCreateCustomGoal",
        });
        return;
      }

      const kesAmount = parseFloat(customGoalForm.amount.replace(/,/g, ""));
      if (kesAmount <= 0) {
        reportWarning("Target amount must be greater than 0", {
          component: "useGoalOperations",
          operation: "handleCreateCustomGoal",
        });
        return;
      }

      const exchangeRate = getKESRate();
      if (!exchangeRate) {
        reportWarning("Exchange rate not available. Please try again.", {
          component: "useGoalOperations",
          operation: "handleCreateCustomGoal",
        });
        return;
      }

      const usdAmount = formatUsdFromKes(kesAmount, exchangeRate);

      const createRequest: CreateGoalRequest = {
        name: customGoalForm.name,
        targetAmountToken: usdAmount,
        targetDate: "0",
        creatorAddress: address,
        vaults: "all",
        isPublic: false,
        chainId: chain?.id,
      };

      setCustomGoalLoading(true);
      try {
        await backendApiClient.createGroupGoal(createRequest);
        
        // Track activity
        activityService.trackGoalCreation(customGoalForm.name, address);
        
        setCustomGoalModalOpen(false);
        setCustomGoalForm({
          name: "",
          amount: "",
          timeline: "3",
          category: customGoalForm.category,
        });
        fetchUserGoals();
        refreshUserPortfolio?.();
        reportInfo("Goal created successfully", {
          component: "useGoalOperations",
          operation: "handleCreateCustomGoal",
        });
      } catch (error) {
        reportError("Failed to create goal", {
          component: "useGoalOperations",
          operation: "handleCreateCustomGoal",
          additional: { error },
        });
      } finally {
        setCustomGoalLoading(false);
      }
    },
    [
      address,
      getKESRate,
      setCustomGoalLoading,
      setCustomGoalModalOpen,
      setCustomGoalForm,
      fetchUserGoals,
      refreshUserPortfolio,
    ]
  );

  const handleCreateGroupGoal = useCallback(
    async (groupGoalForm: any) => {
      if (createGroupGoalInFlightRef.current) {
        return;
      }
      if (!groupGoalForm.name.trim() || !groupGoalForm.amount.trim()) {
        reportWarning("Goal name and amount are required", {
          component: "useGoalOperations",
          operation: "handleCreateGroupGoal",
        });
        return;
      }

      if (!address) {
        reportWarning("Please connect your wallet to create a group goal", {
          component: "useGoalOperations",
          operation: "handleCreateGroupGoal",
        });
        return;
      }

      const kesAmount = parseFloat(groupGoalForm.amount.replace(/,/g, ""));
      if (kesAmount <= 0) {
        reportWarning("Target amount must be greater than 0", {
          component: "useGoalOperations",
          operation: "handleCreateGroupGoal",
        });
        return;
      }

      const exchangeRate = getKESRate();
      if (!exchangeRate) {
        reportWarning("Exchange rate not available. Please try again.", {
          component: "useGoalOperations",
          operation: "handleCreateGroupGoal",
        });
        return;
      }

      const usdAmount = formatUsdFromKes(kesAmount, exchangeRate);

      const createRequest: CreateGoalRequest = {
        name: groupGoalForm.name,
        targetAmountToken: usdAmount,
        targetDate: "0",
        creatorAddress: address,
        vaults: "all",
        isPublic: groupGoalForm.isPublic,
        chainId: chain?.id,
      };

      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticGoal: GroupSavingsGoal = {
        metaGoalId: optimisticId,
        name: groupGoalForm.name,
        targetAmountToken: usdAmount,
        targetDate: "0",
        creatorAddress: address,
        isPublic: Boolean(groupGoalForm.isPublic),
        participantCount: 1,
        createdAt: new Date().toISOString(),
        participants: address ? [address.toLowerCase()] : [],
        invitedUsers: groupGoalForm.isPublic ? undefined : [],
        progressPercent: 0,
        totalProgressUSD: 0,
      };

      setMyGroups((prev) => {
        const base: MyGroups = prev ?? {
          total: 0,
          public: { total: 0, goals: [] },
          private: { total: 0, goals: [] },
        };
        const bucketKey = optimisticGoal.isPublic ? "public" : "private";
        const bucket = base[bucketKey];
        const goals = [
          optimisticGoal,
          ...bucket.goals.filter((goal) => goal.metaGoalId !== optimisticId),
        ];
        const updatedBucket = {
          ...bucket,
          goals,
          total: goals.length,
        };
        const updated = {
          ...base,
          [bucketKey]: updatedBucket,
        } as MyGroups;
        updated.total = updated.public.total + updated.private.total;
        return updated;
      });

      createGroupGoalInFlightRef.current = true;
      setCreateGroupGoalLoading(true);
      try {
        const response = await fetch("/api/user-positions?action=create-group-goal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createRequest),
        });
        if (!response.ok) throw new Error("Failed to create group goal");
        const created = await response.json();

        setMyGroups((prev) => {
          if (!prev) return prev;
          const bucketKey = optimisticGoal.isPublic ? "public" : "private";
          const bucket = prev[bucketKey];
          const nextGoals = bucket.goals.map((goal) => {
            if (goal.metaGoalId !== optimisticId) return goal;
            return {
              ...goal,
              metaGoalId: created?.metaGoalId || goal.metaGoalId,
              onChainGoals: created?.onChainGoals ?? goal.onChainGoals,
              onChainGoalsByChain:
                created?.onChainGoalsByChain ?? goal.onChainGoalsByChain,
            };
          });
          const updatedBucket = {
            ...bucket,
            goals: nextGoals,
            total: nextGoals.length,
          };
          const updated = {
            ...prev,
            [bucketKey]: updatedBucket,
          } as MyGroups;
          updated.total = updated.public.total + updated.private.total;
          return updated;
        });
        
        // Track activity
        activityService.trackGoalCreation(groupGoalForm.name, address);
        
        setCreateGroupGoalModalOpen(false);
        setGroupGoalForm({ name: "", amount: "", timeline: "3", isPublic: true });
        fetchMyGroups();
        fetchGroupGoals();
        refreshUserPortfolio?.();
        reportInfo("Group goal created successfully", {
          component: "useGoalOperations",
          operation: "handleCreateGroupGoal",
        });
      } catch (error) {
        setMyGroups((prev) => {
          if (!prev) return prev;
          const bucketKey = optimisticGoal.isPublic ? "public" : "private";
          const bucket = prev[bucketKey];
          const nextGoals = bucket.goals.filter(
            (goal) => goal.metaGoalId !== optimisticId
          );
          if (nextGoals.length === bucket.goals.length) return prev;
          const updatedBucket = {
            ...bucket,
            goals: nextGoals,
            total: nextGoals.length,
          };
          const updated = {
            ...prev,
            [bucketKey]: updatedBucket,
          } as MyGroups;
          updated.total = updated.public.total + updated.private.total;
          return updated;
        });
        reportError("Failed to create group goal", {
          component: "useGoalOperations",
          operation: "handleCreateGroupGoal",
          additional: { error },
        });
      } finally {
        setCreateGroupGoalLoading(false);
        createGroupGoalInFlightRef.current = false;
      }
    },
    [
      address,
      getKESRate,
      setCreateGroupGoalLoading,
      setCreateGroupGoalModalOpen,
      setGroupGoalForm,
      fetchGroupGoals,
      fetchMyGroups,
      setMyGroups,
      refreshUserPortfolio,
    ]
  );

  const handleJoinGoalWithAmount = useCallback(
    async (
      selectedGoalToJoin: GroupSavingsGoal | null,
      amount: string,
      options?: {
        depositMethod?: "ONCHAIN" | "MPESA";
        token?: TokenBalance;
        context?: "join" | "deposit";
      }
    ) => {
      if (!selectedGoalToJoin || !address) return;
      if (!chain?.id) {
        setJoinGoalError("Network not available");
        return;
      }

      setJoinGoalLoading(true);
      setJoinGoalError(null);
      const errorFallback =
        options?.context === "deposit"
          ? "Deposit failed. Please try again."
          : "Failed to join group goal";
      const resolveErrorMessage = (error: unknown) => {
        if (error instanceof Error && error.message) return error.message;
        if (typeof error === "string" && error.trim()) return error;
        if (error && typeof error === "object") {
          const possibleMessage =
            (error as { message?: string; error?: string; shortMessage?: string; reason?: string })
              .message ||
            (error as { error?: string }).error ||
            (error as { shortMessage?: string }).shortMessage ||
            (error as { reason?: string }).reason;
          if (typeof possibleMessage === "string" && possibleMessage.trim()) {
            return possibleMessage;
          }
        }
        return errorFallback;
      };

      try {
        const depositMethod = options?.depositMethod ?? "MPESA";
        const selectedToken = options?.token || null;

        await handleWalletDeposit(
          amount,
          () => {},
          async (receipt, usdAmount, token) => {
            try {
              const resolvedToken = token || selectedToken;
              const tokenSymbol = resolvedToken?.symbol;
              const mappedAsset = tokenSymbol
                ? mapTokenSymbolToAsset(tokenSymbol)
                : null;

              if (!mappedAsset) {
                throw new Error("Unsupported token for group goal deposit");
              }

              const targetGoalId =
                selectedGoalToJoin.onChainGoals?.[mappedAsset] ||
                selectedGoalToJoin.goalIds?.[mappedAsset];
              if (!targetGoalId) {
                throw new Error("This group goal cannot accept the selected asset");
              }

              const decimals = resolvedToken?.decimals ?? 6;
              const amountWei = parseUnits(usdAmount.toString(), decimals).toString();

              await backendApiClient.joinGoalWithAllocation({
                asset: mappedAsset,
                userAddress: address,
                amount: amountWei,
                txHash: receipt.transactionHash,
                targetGoalId,
                tokenSymbol: tokenSymbol || undefined,
                chainId: chain.id,
              });

              activityService.trackDeposit(
                usdAmount,
                tokenSymbol || "USDC",
                receipt.transactionHash,
                selectedGoalToJoin.name,
                address
              );

              reportInfo("Group goal deposit completed", {
                component: "useGoalOperations",
                operation: "handleJoinGoalWithAmount",
                transactionHash: receipt.transactionHash,
                goalId: selectedGoalToJoin.metaGoalId,
              });

              fetchGroupGoals();
              refreshUserPortfolio?.();
            } catch (allocationError) {
              reportWarning("Deposit completed but allocation failed", {
                component: "useGoalOperations",
                operation: "handleJoinGoalWithAmount",
                additional: { error: allocationError },
              });

              setJoinGoalError(resolveErrorMessage(allocationError));
            } finally {
              setJoinGoalLoading(false);
            }
          },
          (error) => {
            setJoinGoalError(resolveErrorMessage(error));
            setJoinGoalLoading(false);
            reportError(resolveErrorMessage(error), {
              component: "useGoalOperations",
              operation: "handleJoinGoalWithAmount",
              additional: { error },
            });
          },
          {
            depositMethod,
            token: selectedToken || undefined,
          }
        );
      } catch (error) {
        setJoinGoalError(resolveErrorMessage(error));
        setJoinGoalLoading(false);
        reportError(resolveErrorMessage(error), {
          component: "useGoalOperations",
          operation: "handleJoinGoalWithAmount",
          additional: { error },
        });
      }
    },
    [
      address,
      chain,
      fetchGroupGoals,
      handleWalletDeposit,
      refreshUserPortfolio,
      setJoinGoalLoading,
      setJoinGoalError,
    ]
  );

  return {
    handleCreateCustomGoal,
    handleCreateGroupGoal,
    handleJoinGoalWithAmount,
  };
}
