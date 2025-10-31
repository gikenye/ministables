import React from "react";
import { User, Users, BarChart3 } from "lucide-react";

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
  centerAction?: {
    label: string;
    onClick: () => void;
    icon?: string;
  };
}

export const TabNavigation = ({
  activeTab,
  onTabChange,
  tabs,
  centerAction,
}: TabNavigationProps) => {
  return (
    <footer
      className="
        fixed bottom-0 left-0 right-0 z-50
        bg-black/95 backdrop-blur-md border-t border-gray-700
      "
    >
      <div className="flex items-center justify-between px-4 py-1.5 relative">
        {/* Render tabs with center action in the middle */}
        {tabs.map((tab, index) => {
          const IconComponent = tab.icon;

          // Insert center action after the first 2 tabs
          if (index === 2 && centerAction) {
            return (
              <React.Fragment key={`${tab.id}-with-center`}>
                {/* Center Action Button */}
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-5">
                  <button
                    onClick={centerAction.onClick}
                    className="w-14 h-14 bg-cyan-400 hover:bg-cyan-500 text-black rounded-full text-xs font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border-2 border-black flex items-center justify-center"
                  >
                    {centerAction.icon ? (
                      <span className="text-lg">{centerAction.icon}</span>
                    ) : (
                      centerAction.label
                    )}
                  </button>
                </div>

                {/* Current tab */}
                <button
                  onClick={() => onTabChange(tab.id)}
                  className={`flex flex-col items-center space-y-0.5 px-2 py-1 min-w-[44px] transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-cyan-400/15 text-cyan-400"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                  <span className="text-xs">{tab.label}</span>
                </button>
              </React.Fragment>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center space-y-0.5 px-2 py-1 min-w-[44px] rounded-lg transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-cyan-400/15 text-cyan-400"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <IconComponent className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </footer>
  );
};
