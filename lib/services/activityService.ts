import { reportError } from "./errorReportingService";

export interface ActivityItem {
  id: string;
  type: "deposit" | "withdrawal" | "transfer" | "goal_creation" | "goal_join" | "swap";
  amount: number;
  currency: string;
  timestamp: string;
  status: "completed" | "pending" | "failed";
  description: string;
  userAddress?: string;
  txHash?: string;
  goalName?: string;
  fromGoal?: string;
  toGoal?: string;
}

const ACTIVITY_STORAGE_DEBOUNCE_MS = 400;
const FETCH_ACTIVITY_TIMEOUT_MS = 5000;
const MAX_ACTIVITIES_IN_MEMORY = 50;

class ActivityService {
  private activities: ActivityItem[] = [];
  private pendingByKey = new Map<string, ActivityItem[]>();
  private saveTimeoutId: ReturnType<typeof setTimeout> | null = null;

  async fetchUserActivity(userAddress: string, limit = 10): Promise<ActivityItem[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_ACTIVITY_TIMEOUT_MS);

    try {
      const response = await fetch(
        `/api/activity?userId=${userAddress}&limit=${limit}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return data.activities || [];
      }

      return this.getLocalActivity(userAddress, limit);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name !== "AbortError") {
        reportError("Failed to fetch user activity", {
          component: "ActivityService",
          operation: "fetchUserActivity",
          additional: { error, userAddress },
        });
      }
      return this.getLocalActivity(userAddress, limit);
    }
  }

  trackActivity(activity: Omit<ActivityItem, "id" | "timestamp">): void {
    const newActivity: ActivityItem = {
      ...activity,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    this.activities.unshift(newActivity);
    if (this.activities.length > MAX_ACTIVITIES_IN_MEMORY) {
      this.activities = this.activities.slice(0, MAX_ACTIVITIES_IN_MEMORY);
    }

    const storageKey = this.getStorageKey(newActivity.userAddress);
    const pending = this.pendingByKey.get(storageKey) ?? [];
    pending.unshift(newActivity);
    this.pendingByKey.set(storageKey, pending);

    this.scheduleFlushToStorage();
  }

  private getStorageKey(userAddress?: string): string {
    const normalized = userAddress?.toLowerCase();
    return normalized ? `minilend_activities_${normalized}` : "minilend_activities";
  }

  private scheduleFlushToStorage(): void {
    if (this.saveTimeoutId !== null) return;
    this.saveTimeoutId = setTimeout(() => {
      this.saveTimeoutId = null;
      this.flushToStorage();
    }, ACTIVITY_STORAGE_DEBOUNCE_MS);
  }

  private flushToStorage(): void {
    if (this.pendingByKey.size === 0) return;
    try {
      for (const [storageKey, pending] of this.pendingByKey) {
        const stored = localStorage.getItem(storageKey);
        const activities = stored ? (JSON.parse(stored) as ActivityItem[]) : [];
        for (let i = pending.length - 1; i >= 0; i--) activities.unshift(pending[i]);
        const trimmed = activities.slice(0, MAX_ACTIVITIES_IN_MEMORY);
        localStorage.setItem(storageKey, JSON.stringify(trimmed));
      }
      this.pendingByKey.clear();
    } catch (error) {
      console.warn("Failed to flush activities to localStorage:", error);
    }
  }

  private getLocalActivity(userAddress: string, limit: number): ActivityItem[] {
    try {
      const normalizedAddress = userAddress?.toLowerCase();
      const storageKey = normalizedAddress
        ? `minilend_activities_${normalizedAddress}`
        : "minilend_activities";
      const stored = localStorage.getItem(storageKey);
      if (!stored) return [];
      
      const activities = JSON.parse(stored) as ActivityItem[];
      const filtered = normalizedAddress
        ? activities.filter(
            (activity) => activity.userAddress?.toLowerCase() === normalizedAddress
          )
        : activities;
      return filtered.slice(0, limit);
    } catch (error) {
      console.warn("Failed to load activities from localStorage:", error);
      return [];
    }
  }

  trackDeposit(
    amount: number,
    currency: string,
    txHash?: string,
    goalName?: string,
    userAddress?: string
  ): void {
    this.trackActivity({
      type: "deposit",
      amount,
      currency,
      status: "completed",
      description: goalName ? `Deposited to ${goalName}` : "Quick Save deposit",
      userAddress,
      txHash,
      goalName,
    });
  }

  trackWithdrawal(
    amount: number,
    currency: string,
    txHash?: string,
    goalName?: string,
    userAddress?: string
  ): void {
    this.trackActivity({
      type: "withdrawal",
      amount,
      currency,
      status: "completed",
      description: goalName ? `Withdrew from ${goalName}` : "Vault withdrawal",
      userAddress,
      txHash,
      goalName,
    });
  }

  trackGoalCreation(goalName: string, userAddress?: string): void {
    this.trackActivity({
      type: "goal_creation",
      amount: 0,
      currency: "USDC",
      status: "completed",
      description: "Created new goal",
      userAddress,
      goalName,
    });
  }

  trackGoalJoin(
    goalName: string,
    amount: number,
    currency: string,
    userAddress?: string
  ): void {
    this.trackActivity({
      type: "goal_join",
      amount,
      currency,
      status: "completed",
      description: "Joined group goal",
      userAddress,
      goalName,
    });
  }

  trackTransfer(
    amount: number,
    currency: string,
    fromGoal: string,
    toGoal: string,
    userAddress?: string
  ): void {
    this.trackActivity({
      type: "transfer",
      amount,
      currency,
      status: "completed",
      description: `Transferred from ${fromGoal} to ${toGoal}`,
      fromGoal,
      toGoal,
      userAddress,
    });
  }

  trackSwap(
    fromAmount: number,
    fromCurrency: string,
    toAmount: number,
    toCurrency: string,
    txHash?: string,
    userAddress?: string
  ): void {
    this.trackActivity({
      type: "swap",
      amount: fromAmount,
      currency: fromCurrency,
      status: "completed",
      description: `Swapped ${fromCurrency} to ${toCurrency}`,
      userAddress,
      txHash,
    });
  }
}

export const activityService = new ActivityService();
