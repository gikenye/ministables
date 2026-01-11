import React from "react";
import { User, Users, BarChart3 } from "lucide-react";
import { theme } from "@/lib/theme";

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
    <footer className="fixed bottom-0 left-0 right-0 z-50" style={{ backgroundColor: theme.colors.backgroundSecondary, borderTop: `1px solid ${theme.colors.border}` }}>
      <div className="flex items-center justify-between px-4 py-1.5 relative">
        {tabs.map((tab, index) => {
          const IconComponent = tab.icon;

          if (index === 1 && centerAction) {
            return (
              <React.Fragment key={`${tab.id}-with-center`}>
                <button
                  onClick={() => onTabChange(tab.id)}
                  className="flex flex-col items-center space-y-0.5 px-1 py-1.5 transition-all duration-200 rounded-lg"
                  style={{
                    backgroundColor: activeTab === tab.id ? theme.colors.border : 'transparent',
                    color: activeTab === tab.id ? theme.colors.text : theme.colors.textLight,
                  }}
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>

                <div className="absolute left-1/2 transform -translate-x-1/2 -top-6">
                  <button
                    onClick={centerAction.onClick}
                    className="w-16 h-16 rounded-full text-sm font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center"
                    style={{ backgroundColor: theme.colors.border, color: theme.colors.text, border: `2px solid ${theme.colors.text}` }}
                  >
                    {centerAction.icon ? <span className="text-base">{centerAction.icon}</span> : centerAction.label}
                  </button>
                </div>
              </React.Fragment>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center space-y-0.5 px-1 py-1.5 transition-all duration-200 rounded-lg"
              style={{
                backgroundColor: activeTab === tab.id ? theme.colors.border : 'transparent',
                color: activeTab === tab.id ? theme.colors.text : theme.colors.textLight,
              }}
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
