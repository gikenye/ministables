// Common/Complex Components
export { GoalCard } from "./GoalCard";
export { AmountInputModal } from "./AmountInputModal";
export { SaveOptionsModal, type SaveOption } from "./SaveOptionsModal";
export { TabNavigation } from "./TabNavigation";
export { ProfileSection } from "./ProfileSection";
export { StatsCard } from "./StatsCard";

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
