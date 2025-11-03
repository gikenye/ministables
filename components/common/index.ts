// Common/Complex Components
export { GoalCard } from "./GoalCard";
export { AmountInputModal } from "./AmountInputModal";
export { SaveOptionsModal, type SaveOption } from "./SaveOptionsModal";
export { TabNavigation } from "./TabNavigation";
export { ProfileSection } from "./ProfileSection";
export { StatsCard } from "./StatsCard";

// Profile Card Components (Legacy)
export { ProfileHeaderCard } from "./ProfileHeaderCard";
export { SavingsStatsCard } from "./SavingsStatsCard";
export { InviteFriendsCard } from "./InviteFriendsCard";
export { AccountSettingsCard } from "./AccountSettingsCard";
export { SupportCard } from "./SupportCard";

// New Profile System Components
export { NewProfile } from "./NewProfile";
export { ProfileHero } from "./ProfileHero";
export { StatsBar } from "./StatsBar";
export { SettingsMenu } from "./SettingsMenu";

// Export commonly used types - re-export from the main Goal model
export type { Goal, GoalCategory, GoalStatus } from "@/lib/models/goal";
export type { FrontendGoal } from "@/lib/utils/goalTransforms";
