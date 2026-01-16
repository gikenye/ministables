import React from "react";
import { Target, Users, Flag, User, PlusCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MobileBottomNavProps {
  activeTab: "goals" | "groups" | "leaderboard" | "profile";
  onTabChange: (tab: "goals" | "groups" | "leaderboard" | "profile") => void;
  onSaveClick: () => void;
  setAnnouncements: (announcements: string[]) => void;
}

export function MobileBottomNav({ 
  activeTab, 
  onTabChange, 
  onSaveClick, 
  setAnnouncements 
}: MobileBottomNavProps) {
  
  const tabs = [
    { id: "goals", label: "Goals", icon: Target },
    { id: "groups", label: "Clan", icon: Users },
    { id: "leaderboard", label: "Board", icon: Flag },
    { id: "profile", label: "Profile", icon: User },
  ] as const;

  return (
    <div className="fixed bottom-2 left-0 right-0 flex justify-center px-3 pointer-events-none lg:hidden z-50">
      <nav 
        className="flex items-center gap-2 p-1.5 bg-[#1a1a1a]/80 backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl pointer-events-auto"
        role="navigation"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                setAnnouncements([`Switched to ${tab.label} tab`]);
              }}
              className="relative flex items-center h-8 px-3 rounded-full transition-all duration-300 ease-out"
            >
              {/* Sliding Background Pill */}
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-white/10 rounded-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}

              <div className="relative z-10 flex items-center gap-2">
                <Icon
                  size={18}
                  className={`transition-colors duration-300 ${
                    isActive ? "text-white" : "text-white/40"
                  }`}
                />
                
                {/* Animate Presence for the Label */}
                <AnimatePresence mode="popLayout">
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, x: -10, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -5, scale: 0.95 }}
                      className="text-sm font-small text-white whitespace-nowrap"
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </button>
          );
        })}

        {/* Separator */}
        <div className="w-[1px] h-6 bg-white/10 mx-1" />

        {/* Save/Action Button */}
        <button
          onClick={() => {
            onSaveClick();
            setAnnouncements(["Save options opened"]);
          }}
          className="flex items-center justify-center w-10 h-8 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all active:scale-90"
          aria-label="Save"
        >
          <PlusCircle size={20} />
        </button>
      </nav>
    </div>
  );
}