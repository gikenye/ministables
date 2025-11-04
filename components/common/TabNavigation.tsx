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
      <div className="flex items-center justify-between px-4 py-1.5 relative">
        {/* Render each tab individually so justify-between spreads them properly */}
        {tabs.map((tab, index) => {
          const IconComponent = tab.icon;

          // Add center button after the second tab (index 1)
          if (index === 1 && centerAction) {
            return (
              <React.Fragment key={`${tab.id}-with-center`}>
                {/* Current tab */}
                <button
                  onClick={() => onTabChange(tab.id)}
                  className={`flex flex-col items-center space-y-0.5 px-1 py-1.5 transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-cyan-400/15 text-cyan-400 rounded-lg"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>

                {/* Center Action Button - elevated and floating */}
                <div className="absolute left-1/2 transform -translate-x-1/2 -top-6">
                  <button
                    onClick={centerAction.onClick}
                    className="w-16 h-16 bg-cyan-400 hover:bg-cyan-500 text-black rounded-full text-sm font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border-2 border-black flex items-center justify-center"
                  >
                    {centerAction.icon ? (
                      <span className="text-base">{centerAction.icon}</span>
                    ) : (
                      centerAction.label
                    )}
                  </button>
                </div>
              </React.Fragment>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center space-y-0.5 px-1 py-1.5 transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-cyan-400/15 text-cyan-400 rounded-lg"
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
