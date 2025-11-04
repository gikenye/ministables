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
        bg-gray-800/20 backdrop-blur-sm border-t border-gray-700/30
      "
    >
      <div className="flex items-center justify-between px-3 py-1 relative">
        {/* Render tabs with center action in the middle */}
        {tabs.map((tab, index) => {
          const IconComponent = tab.icon;

          // Insert center action after the first 2 tabs
          if (index === 2 && centerAction) {
            return (
              <React.Fragment key={`${tab.id}-with-center`}>
                {/* Center Action Button */}
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-4">
                  <button
                    onClick={centerAction.onClick}
                    className="w-12 h-12 bg-cyan-400 hover:bg-cyan-500 text-black rounded-full text-xs font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border-2 border-black flex items-center justify-center"
                  >
                    {centerAction.icon ? (
                      <span className="text-base">{centerAction.icon}</span>
                    ) : (
                      centerAction.label
                    )}
                  </button>
                </div>

                {/* Current tab */}
                <button
                  onClick={() => onTabChange(tab.id)}
                  className={`flex flex-col items-center space-y-0.5 px-1.5 py-1 min-w-[40px] transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-cyan-400/15 text-cyan-400"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span className="text-xs">{tab.label}</span>
                </button>
              </React.Fragment>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center space-y-0.5 px-1.5 py-1 min-w-[40px] rounded-lg transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-cyan-400/15 text-cyan-400"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <IconComponent className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </footer>
  );
};
