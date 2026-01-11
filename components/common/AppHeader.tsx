import Image from "next/image";
import { Bell, ArrowDownLeft } from "lucide-react";
import { ActionButton } from "@/components/ui";
import { theme } from "@/lib/theme";

interface AppHeaderProps {
  activeTab: "goals" | "groups" | "leaderboard" | "profile";
  onRefresh?: () => void;
  onNewGoal?: () => void;
  onNewGroup?: () => void;
}

const TAB_CONFIG = {
  goals: { title: "Goals", subtitle: "Home" },
  groups: { title: "Clan", subtitle: "Save with friends" },
  leaderboard: { title: "Leaderboard", subtitle: "Community rankings" },
  profile: { title: "Profile", subtitle: "Account & Settings" },
};

export function AppHeader({ activeTab, onRefresh, onNewGoal, onNewGroup }: AppHeaderProps) {
  const config = TAB_CONFIG[activeTab];

  return (
    <header
      className="px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-40 relative"
      style={{ backgroundColor: theme.colors.backgroundSecondary, borderBottom: `1px solid ${theme.colors.border}` }}
      role="banner"
      aria-label="Application header"
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="lg:hidden">
            <Image src="/minilend-pwa.png" alt="Minilend - Decentralized Savings Platform" width={24} height={24} className="rounded" priority />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold" style={{ color: theme.colors.text }} id="page-title">
              {config.title}
            </h1>
            <p className="text-sm lg:text-base" style={{ color: theme.colors.textLight }} aria-describedby="page-title">
              {config.subtitle}
            </p>
            <div className="sr-only">
              Keyboard shortcuts: Ctrl+G for Goals, Ctrl+L for Leaderboard, Ctrl+P for Profile
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 lg:space-x-4">
          {activeTab === "goals" && (
            <>
              <ActionButton onClick={onNewGoal} variant="outline" size="sm" className="hidden sm:flex">
                New goal
              </ActionButton>
              <ActionButton onClick={onNewGoal} variant="outline" size="sm" className="sm:hidden">
                +
              </ActionButton>
              <button
                onClick={onRefresh}
                className="p-2 rounded-full transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                style={{ color: theme.colors.text, border: `1px solid ${theme.colors.border}` }}
                title="Refresh goals"
              >
                <ArrowDownLeft className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-full transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: theme.colors.text, border: `1px solid ${theme.colors.border}` }}>
                <Bell className="w-5 h-5" />
              </button>
            </>
          )}

          {activeTab === "groups" && (
            <>
              <ActionButton onClick={onNewGroup} variant="outline" size="sm" className="hidden sm:flex">
                New Group
              </ActionButton>
              <ActionButton onClick={onNewGroup} variant="outline" size="sm" className="sm:hidden">
                +
              </ActionButton>
              <button className="p-2 rounded-full transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: theme.colors.text, border: `1px solid ${theme.colors.border}` }}>
                <Bell className="w-5 h-5" />
              </button>
            </>
          )}

          {activeTab === "leaderboard" && (
            <button className="p-2 rounded-full transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: theme.colors.text, border: `1px solid ${theme.colors.border}` }}>
              <Bell className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
