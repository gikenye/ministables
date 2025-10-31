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
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-900">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
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
              w-full px-4 py-3 bg-gray-800 hover:bg-gray-750 transition-colors
              ${!isLast ? "border-b border-gray-700" : ""}
              ${item.variant === "danger" ? "text-red-400 hover:text-red-300" : "text-white"}
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <IconComponent className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {item.rightElement || (
                <div className="w-5 h-5 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-gray-400"
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
