import { Users, BarChart3, User } from "lucide-react";
import { TabNavigation } from "@/components/common";

interface MobileBottomNavProps {
  activeTab: "goals" | "groups" | "leaderboard" | "profile";
  onTabChange: (tab: "goals" | "groups" | "leaderboard" | "profile") => void;
  onSaveClick: () => void;
  setAnnouncements: (announcements: string[]) => void;
}

export function MobileBottomNav({ activeTab, onTabChange, onSaveClick, setAnnouncements }: MobileBottomNavProps) {
  return (
    <nav className="lg:hidden" role="navigation" aria-label="Main navigation">
      <TabNavigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          onTabChange(tab as typeof activeTab);
          setAnnouncements([`Switched to ${tab} tab`]);
        }}
        tabs={[
          {
            id: "goals",
            label: "Goals",
            icon: ({ className }) => (
              <div className={`w-5 h-5 flex items-center justify-center ${className}`} aria-hidden="true">
                <div className="w-3 h-3 border-2 border-current rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-current rounded-full"></div>
                </div>
              </div>
            ),
          },
          { id: "groups", label: "Clan", icon: Users },
          { id: "leaderboard", label: "Board", icon: BarChart3 },
          { id: "profile", label: "Profile", icon: User },
        ]}
        centerAction={{
          label: "SAVE",
          onClick: () => {
            onSaveClick();
            setAnnouncements(["Save options opened"]);
          },
        }}
      />
    </nav>
  );
}
