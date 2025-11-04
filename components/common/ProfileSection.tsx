import React from "react";
import { LucideIcon } from "lucide-react";

interface ProfileSectionProps {
  title: string;
  items: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
    onClick?: () => void;
    rightElement?: React.ReactNode;
    variant?: "default" | "danger";
  }>;
}

export const ProfileSection = ({ title, items }: ProfileSectionProps) => {
  return (
    <div className="space-y-0">
      {/* Section Header */}
      <div className="px-3 py-2.5 border-b border-gray-700/30 bg-gray-800/20 backdrop-blur-sm">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {title}
        </h3>
      </div>

      {/* Section Items */}
      {items.map((item, index) => {
        const IconComponent = item.icon;
        const isLast = index === items.length - 1;

        return (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`
              w-full px-3 py-2.5 bg-gray-800/20 backdrop-blur-sm hover:bg-gray-700/30 transition-colors
              ${!isLast ? "border-b border-gray-700/30" : ""}
              ${item.variant === "danger" ? "text-red-400 hover:text-red-300" : "text-white"}
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <IconComponent className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {item.rightElement || (
                <div className="w-4 h-4 flex items-center justify-center">
                  <svg
                    className="w-3.5 h-3.5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
