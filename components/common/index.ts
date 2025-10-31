// Common/Complex Components
export { GoalCard } from "./GoalCard";
export { AmountInputModal } from "./AmountInputModal";
export { SaveOptionsModal, type SaveOption } from "./SaveOptionsModal";
export { TabNavigation } from "./TabNavigation";
export { ProfileSection } from "./ProfileSection";
export { StatsCard } from "./StatsCard";

// Profile Card Components
export { ProfileHeaderCard } from "./ProfileHeaderCard";
export { SavingsStatsCard } from "./SavingsStatsCard";
export { InviteFriendsCard } from "./InviteFriendsCard";
export { AccountSettingsCard } from "./AccountSettingsCard";
export { SupportCard } from "./SupportCard";

// Export commonly used types
export interface Goal {
  id: string;
  title: string;
  description?: string;
  amount: string;
  targetAmount: string;
  progress: number;
  icon?: string;
  category: "personal" | "retirement" | "quick";
}
