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

class ActivityService {
  private activities: ActivityItem[] = [];

  async fetchUserActivity(userAddress: string, limit = 10): Promise<ActivityItem[]> {
    try {
      // Try to fetch from API first
      const response = await fetch(`/api/activity?userId=${userAddress}&limit=${limit}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.activities || [];
      }
      
      // Fallback to local storage if API fails
      return this.getLocalActivity(userAddress, limit);
    } catch (error) {
      reportError("Failed to fetch user activity", {
        component: "ActivityService",
        operation: "fetchUserActivity",
        userAddress,
        additional: { error }
      });
      
      // Return local activities as fallback
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
    
    // Keep only last 50 activities in memory
    if (this.activities.length > 50) {
      this.activities = this.activities.slice(0, 50);
    }

    // Store in localStorage for persistence
    this.saveToLocalStorage(newActivity);
  }

  private saveToLocalStorage(activity: ActivityItem): void {
    try {
      const normalizedAddress = activity.userAddress?.toLowerCase();
      const storageKey = normalizedAddress
        ? `minilend_activities_${normalizedAddress}`
        : "minilend_activities";
      const stored = localStorage.getItem(storageKey);
      const activities = stored ? JSON.parse(stored) : [];
      
      activities.unshift(activity);
      
      // Keep only last 50 activities
      const trimmed = activities.slice(0, 50);
      
      localStorage.setItem(storageKey, JSON.stringify(trimmed));
    } catch (error) {
      console.warn("Failed to save activity to localStorage:", error);
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
