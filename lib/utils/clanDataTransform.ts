import type { GroupSavingsGoal } from "@/lib/services/backendApiService";
import type { EnhancedGroupSavingsGoal, GroupMember } from "@/lib/types/clan";

/**
 * Transform old GroupSavingsGoal to new EnhancedGroupSavingsGoal format
 */
export function transformGroupGoalToEnhanced(goal: GroupSavingsGoal): EnhancedGroupSavingsGoal {
  // Create mock members from participants array
  const members: GroupMember[] = (goal.participants || []).map((address, index) => ({
    address,
    role: index === 0 ? "admin" : "member",
    joinedAt: goal.createdAt,
    contribution: 0, // Will be populated from actual data
    displayName: undefined,
    avatar: undefined,
  }));

  return {
    metaGoalId: goal.metaGoalId,
    name: goal.name,
    description: goal.description,
    targetAmountUSD: goal.targetAmountUSD,
    totalProgressUSD: goal.totalProgressUSD || goal.currentAmountUSD || 0,
    creatorAddress: goal.creatorAddress,
    creatorName: undefined,
    participants: members,
    members,
    isPublic: goal.isPublic,
    isPrivate: !goal.isPublic,
    targetDate: goal.targetDate,
    createdAt: goal.createdAt,
    category: (goal.category as any) || "other",
    visibility: goal.isPublic ? "public" : "private",
    imageUrl: undefined,
    tags: [],
    messages: [],
    activities: [],
    memberCount: goal.participantCount || goal.participants?.length || 0,
    joinRequests: [],
    bannerColor: undefined,
    accentColor: undefined,
  };
}

/**
 * Transform array of GroupSavingsGoal to EnhancedGroupSavingsGoal
 */
export function transformGroupGoalsToEnhanced(goals: GroupSavingsGoal[]): EnhancedGroupSavingsGoal[] {
  return goals.map(transformGroupGoalToEnhanced);
}

/**
 * Transform MyGroups response to EnhancedGroupSavingsGoal array
 */
export function transformMyGroupsToEnhanced(myGroups: {
  public: { goals: GroupSavingsGoal[] };
  private: { goals: GroupSavingsGoal[] };
}): EnhancedGroupSavingsGoal[] {
  const publicGoals = transformGroupGoalsToEnhanced(myGroups.public?.goals || []);
  const privateGoals = transformGroupGoalsToEnhanced(myGroups.private?.goals || []);
  return [...publicGoals, ...privateGoals];
}