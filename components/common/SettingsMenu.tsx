import React from "react";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Globe,
  Moon,
  HelpCircle,
  Mail,
  ExternalLink,
  LogOut,
  ChevronRight,
  Download,
} from "lucide-react";

interface SettingsMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  rightElement?: React.ReactNode;
  variant?: "default" | "danger";
  external?: boolean;
}

interface SettingsSectionProps {
  title: string;
  items: SettingsMenuItem[];
}

const SettingsSection = ({ title, items }: SettingsSectionProps) => (
  <div className="mb-6">
    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 px-4">
      {title}
    </h3>
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
      {items.map((item, index) => {
        const IconComponent = item.icon;
        const isLast = index === items.length - 1;

        return (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`
              w-full px-4 py-4 flex items-center justify-between text-left
              hover:bg-gray-700/50 transition-colors
              ${!isLast ? "border-b border-gray-700/50" : ""}
              ${item.variant === "danger" ? "text-red-400 hover:text-red-300" : "text-white"}
            `}
          >
            <div className="flex items-center gap-3">
              <IconComponent className="w-5 h-5 text-gray-400" />
              <span className="font-medium">{item.label}</span>
              {item.external && (
                <ExternalLink className="w-3 h-3 text-gray-500" />
              )}
            </div>
            {item.rightElement || (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        );
      })}
    </div>
  </div>
);

interface SettingsMenuProps {
  onEditProfile?: () => void;
  onNotifications?: () => void;
  onSecurity?: () => void;
  onPayment?: () => void;
  onLanguage?: () => void;
  onTheme?: () => void;
  onHelp?: () => void;
  onSupport?: () => void;
  onPrivacy?: () => void;
  onTerms?: () => void;
  onExportData?: () => void;
  onLogout?: () => void;
  className?: string;
}

export const SettingsMenu = ({
  onEditProfile,
  onNotifications,
  onSecurity,
  onPayment,
  onLanguage,
  onTheme,
  onHelp,
  onSupport,
  onPrivacy,
  onTerms,
  onExportData,
  onLogout,
  className = "",
}: SettingsMenuProps) => {
  const accountItems: SettingsMenuItem[] = [
    {
      id: "edit-profile",
      label: "Edit Profile",
      icon: User,
      onClick: onEditProfile,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      onClick: onNotifications,
    },
    {
      id: "security",
      label: "Security & Privacy",
      icon: Shield,
      onClick: onSecurity,
    },
    {
      id: "payment",
      label: "Payment Methods",
      icon: CreditCard,
      onClick: onPayment,
    },
  ];

  const appItems: SettingsMenuItem[] = [
    {
      id: "language",
      label: "Language",
      icon: Globe,
      onClick: onLanguage,
      rightElement: <span className="text-sm text-gray-400">English</span>,
    },
    {
      id: "theme",
      label: "Dark Mode",
      icon: Moon,
      onClick: onTheme,
      rightElement: (
        <div className="w-10 h-6 bg-blue-600 rounded-full relative">
          <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full" />
        </div>
      ),
    },
  ];

  const supportItems: SettingsMenuItem[] = [
    {
      id: "help",
      label: "Help Center",
      icon: HelpCircle,
      onClick: onHelp,
      external: true,
    },
    {
      id: "support",
      label: "Contact Support",
      icon: Mail,
      onClick: onSupport,
    },
    {
      id: "privacy",
      label: "Privacy Policy",
      icon: Shield,
      onClick: onPrivacy,
      external: true,
    },
    {
      id: "terms",
      label: "Terms of Service",
      icon: ExternalLink,
      onClick: onTerms,
      external: true,
    },
  ];

  const dataItems: SettingsMenuItem[] = [
    {
      id: "export",
      label: "Export My Data",
      icon: Download,
      onClick: onExportData,
    },
    {
      id: "logout",
      label: "Log Out",
      icon: LogOut,
      onClick: onLogout,
      variant: "danger",
    },
  ];

  return (
    <div className={className}>
      <SettingsSection title="Account" items={accountItems} />
      <SettingsSection title="Preferences" items={appItems} />
      <SettingsSection title="Support" items={supportItems} />
      <SettingsSection title="Data" items={dataItems} />
    </div>
  );
};
