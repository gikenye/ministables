// Common/Complex Components
export { GoalCard } from "./GoalCard";
export { AmountInputModal } from "./AmountInputModal";
export { SaveOptionsModal, type SaveOption } from "./SaveOptionsModal";
export { TabNavigation } from "./TabNavigation";
export { ProfileSection } from "./ProfileSection";
export { StatsCard } from "./StatsCard";
export { default as SaveActionsModal } from "./SaveActionsModal";
export { default as WithdrawActionsModal } from "./WithdrawActionsModal";
export { default as QuickSaveDetailsModal } from "./QuickSaveDetailsModal";
export { CustomGoalModal } from "./CustomGoalModal";
export { GoalDetailsModal } from "./GoalDetailsModal";
export { DepositConfirmationModal } from "./DepositConfirmationModal";
export { default as ExpandableQuickSaveCard } from "./ExpandableQuickSaveCard";

// Layout Components
export { DesktopSidebar } from "./DesktopSidebar";
export { ModalManager } from "./ModalManager";
export { AppContainer } from "./AppContainer";
export { MobileBottomNav } from "./MobileBottomNav";

// Skeleton Components
export * from "./skeletons";

// Goal Invite Components
export {
  GoalInviteView,
  LoadingView,
  ProcessingView,
  ErrorView,
} from "./GoalInviteView";

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
