import Image from "next/image";
import { ActionButton } from "@/components/ui";
import { theme } from "@/lib/theme";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  description: string;
}

interface DesktopSidebarProps {
  activeTab: "goals" | "groups" | "leaderboard" | "profile";
  onTabChange: (tab: "goals" | "groups" | "leaderboard" | "profile") => void;
  onQuickSave: () => void;
  onNewGoal: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { id: "goals", label: "Goals", icon: "🎯", description: "Manage your savings goals" },
  { id: "groups", label: "Clan", icon: "👥", description: "Save with friends" },
  { id: "leaderboard", label: "Leaderboard", icon: "🏆", description: "Community rankings" },
  { id: "profile", label: "Profile", icon: "👤", description: "Account & settings" },
];

export function DesktopSidebar({ activeTab, onTabChange, onQuickSave, onNewGoal }: DesktopSidebarProps) {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-72 lg:overflow-y-auto" style={{ backgroundColor: theme.colors.backgroundSecondary, borderRight: `1px solid ${theme.colors.border}` }}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center h-16 px-6" style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
          <div className="flex items-center space-x-3">
            <Image src="/minilend-pwa.png" alt="Minilend" width={32} height={32} className="rounded-lg" />
            <div className="text-xl font-bold" style={{ color: theme.colors.text }}>Minilend</div>
          </div>
        </div>

        <nav className="flex-1 px-6 py-8">
          <div className="space-y-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as typeof activeTab)}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200"
                style={{
                  backgroundColor: activeTab === item.id ? theme.colors.border : 'transparent',
                  color: activeTab === item.id ? theme.colors.text : theme.colors.textLight,
                  border: activeTab === item.id ? `1px solid ${theme.colors.border}` : '1px solid transparent',
                }}
              >
                <span className="text-xl">{item.icon}</span>
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs opacity-75">{item.description}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 pt-8" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
            <div className="space-y-3">
              <ActionButton onClick={onQuickSave} variant="primary" size="lg" className="w-full">
                Quick Save
              </ActionButton>
              <ActionButton onClick={onNewGoal} variant="outline" size="lg" className="w-full">
                ➕ New Goal
              </ActionButton>
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
}
