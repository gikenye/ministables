import Image from "next/image";
import Link from "next/link"; // Import Link
import { Flag, Sparkles, Target, User, Users, Plus } from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: typeof Target;
  description: string;
}

interface DesktopSidebarProps {
  activeTab: "goals" | "groups" | "leaderboard" | "profile";
  onTabChange: (tab: "goals" | "groups" | "leaderboard" | "profile") => void;
  onQuickSave: () => void;
  onNewGoal: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { id: "goals", label: "Goals", icon: Target, description: "Manage your savings goals" },
  { id: "groups", label: "Clan", icon: Users, description: "Save with friends" },
  { id: "leaderboard", label: "Leaderboard", icon: Flag, description: "Community rankings" },
  { id: "profile", label: "Profile", icon: User, description: "Account settings" },
];

export function DesktopSidebar({ activeTab, onTabChange, onQuickSave, onNewGoal }: DesktopSidebarProps) {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-80 lg:overflow-y-auto lg:border-r lg:border-white/10 lg:bg-[#0f1114]">
      <div className="relative flex h-full flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_18%_8%,rgba(16,185,129,0.18),transparent_60%),radial-gradient(45%_35%_at_88%_0%,rgba(255,255,255,0.08),transparent_65%)]" />

        {/* BRAND HEADER LINK */}
        <Link 
          href="https://minilend.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex items-center gap-3 px-6 py-5 transition-all duration-200 hover:bg-white/[0.02] group"
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-colors group-hover:border-emerald-500/50">
            <Image
              src="/minilend-pwa.png"
              alt="Minilend"
              width={34}
              height={34}
              className="rounded-xl"
            />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
              Minilend
            </div>
            <div className="text-xs text-white/50">Smart savings vault</div>
          </div>
          <div className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Live
          </div>
        </Link>

        <nav className="relative flex-1 px-6 pb-6 pt-4">
          <div className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id as typeof activeTab)}
                  className={`group relative flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                    isActive
                      ? "border-emerald-500/40 bg-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                      : "border-transparent bg-white/0 hover:border-white/10 hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border text-white transition-colors ${
                      isActive
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-white/10 bg-white/5 group-hover:border-white/20"
                    }`}
                  >
                    <Icon size={18} className={isActive ? "text-emerald-200" : "text-white/60"} />
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className={`text-sm font-semibold ${isActive ? "text-white" : "text-white/80"}`}>
                      {item.label}
                    </span>
                    <span className="text-xs text-white/45">{item.description}</span>
                  </div>
                  {isActive && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-200">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Quick actions
            </div>
            <div className="mt-4 space-y-3">
              <button
                onClick={onQuickSave}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-100 transition-all hover:bg-emerald-500/30"
              >
                Quick Save
              </button>
              <button
                onClick={onNewGoal}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/0 px-4 py-3 text-sm font-semibold text-white/80 transition-all hover:border-white/20 hover:bg-white/5 hover:text-white"
              >
                <Plus size={16} />
                New Goal
              </button>
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
}