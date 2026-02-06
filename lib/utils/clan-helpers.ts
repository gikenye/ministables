import type { EnhancedGroupSavingsGoal, GroupActivity } from "@/lib/types/clan"

/**
 * Helper function to format currency based on exchange rate
 */
export function formatCurrency(usdAmount: number, exchangeRate?: number, locale = "en-US"): string {
  if (exchangeRate) {
    return `Ksh${(usdAmount * exchangeRate).toLocaleString("en-KE", {
      maximumFractionDigits: 0,
    })}`
  }
  return `$${usdAmount.toLocaleString(locale, { maximumFractionDigits: 2 })}`
}

/**
 * Calculate progress percentage for a group
 */
export function calculateProgress(goal: EnhancedGroupSavingsGoal): number {
  if (goal.targetAmountToken <= 0) return 0
  return Math.min((goal.totalProgressUSD / goal.targetAmountToken) * 100, 100)
}

/**
 * Check if user is admin of a group
 */
export function isAdmin(goal: EnhancedGroupSavingsGoal, userAddress?: string): boolean {
  if (!userAddress) return false
  const member = goal.members?.find((m) => m.address === userAddress)
  return member?.role === "admin"
}

/**
 * Check if user is member of a group
 */
export function isMember(goal: EnhancedGroupSavingsGoal, userAddress?: string): boolean {
  if (!userAddress) return false
  return (
    goal.members?.some((m) => m.address === userAddress) ||
    goal.participants?.some((p) => p.address === userAddress) ||
    false
  )
}

/**
 * Convert activity type to human readable string
 */
export function formatActivityType(type: GroupActivity["type"]): string {
  const typeMap: Record<GroupActivity["type"], string> = {
    contribution: "Made a contribution",
    member_joined: "Joined the group",
    milestone: "Reached a milestone",
    goal_created: "Created the goal",
    goal_updated: "Updated the goal",
  }
  return typeMap[type]
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

/**
 * Generate a sample group for demo purposes
 */
export function generateSampleGroup(overrides?: Partial<EnhancedGroupSavingsGoal>): EnhancedGroupSavingsGoal {
  return {
    metaGoalId: `group-${Date.now()}`,
    name: "Kenya Adventure Fund",
    description: "Saving together for our annual trip to Kenya",
    targetAmountToken: 5000,
    totalProgressUSD: 2800,
    creatorAddress: "0x123...",
    creatorName: "Alex",
    participants: [
      {
        address: "0x123...",
        role: "admin",
        joinedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        contribution: 800,
        displayName: "Alex",
      },
      {
        address: "0x456...",
        role: "member",
        joinedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        contribution: 1000,
        displayName: "Jordan",
      },
      {
        address: "0x789...",
        role: "member",
        joinedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        contribution: 1000,
        displayName: "Sam",
      },
    ],
    members: [],
    isPublic: true,
    isPrivate: false,
    targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    category: "travel",
    visibility: "public",
    memberCount: 3,
    bannerColor: "#0a1a2e",
    accentColor: "#0096ff",
    messages: [
      {
        id: "msg-1",
        senderAddress: "0x123...",
        senderName: "Alex",
        content: "Let's make this trip happen!",
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        type: "text",
      },
    ],
    activities: [
      {
        id: "act-1",
        type: "member_joined",
        userId: "0x789...",
        userName: "Sam",
        description: "joined the group",
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    ...overrides,
  }
}
