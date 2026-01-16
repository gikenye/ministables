// "use client";
// import React from "react";
// import { motion } from "framer-motion";
// import { theme } from "@/lib/theme";
// import { TrendingUp, MoreHorizontal, Target } from "lucide-react";

// interface GoalCardProps {
//   goal: any;
//   showBalance?: boolean;
//   onCardClick?: () => void;
//   exchangeRate?: number;
// }

// export const GoalCard = ({
//   goal,
//   showBalance = true,
//   onCardClick,
//   exchangeRate,
// }: GoalCardProps) => {
//   const currentAmount = Number(goal.currentAmount) || 0;
//   const targetAmount = Number(goal.targetAmount) || 0;
//   const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;

//   // Nudges based on progress %
//   const getNudge = () => {
//     if (progress >= 100) return { msg: "Goal Achieved! 🎉", color: "#4ade80" };
//     if (progress > 80) return { msg: "Almost there! Keep pushing.", color: "#4ade80" };
//     if (progress > 50) return { msg: "Over halfway! Great momentum.", color: "#3b82f6" };
//     if (progress > 20) return { msg: "Building up! Every bit counts.", color: "#fbbf24" };
//     return { msg: "Ready to make your first deposit?", color: "#94a3b8" };
//   };

//   const nudge = getNudge();

//   return (
//     <div className="flex flex-col gap-3 w-full">
//       <motion.div
//         whileTap={{ scale: 0.96 }}
//         className="relative rounded-[32px] p-6 cursor-pointer border border-white/10 overflow-hidden shadow-xl"
//         style={{
//           backgroundImage: `linear-gradient(135deg, ${theme.colors.cardGradientFrom}, ${theme.colors.cardGradientTo})`,
//         }}
//         onClick={onCardClick}
//       >
//         <div className="absolute inset-0 bg-white/5 pointer-events-none" />
        
//         <div className="relative z-10 space-y-4">
//           <div className="flex justify-between items-center">
//             <span className="text-xs font-bold uppercase tracking-widest text-white/60">
//               {goal.title}
//             </span>
//             <span className="bg-white/10 px-2.5 py-1 rounded-full text-[10px] font-bold text-white">
//               {progress.toFixed(0)}%
//             </span>
//           </div>
          
//           <div className="text-3xl font-black text-white">
//             <span className="text-lg font-medium opacity-60 mr-1">{exchangeRate ? "KES" : "$"}</span>
//             {showBalance ? currentAmount.toLocaleString() : "••••"}
//           </div>

//           <div className="space-y-2">
//             <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden">
//               <motion.div 
//                 initial={{ width: 0 }}
//                 animate={{ width: `${progress}%` }}
//                 className="h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]"
//               />
//             </div>
//           </div>
//         </div>
//       </motion.div>

//       {/* Progressive Nudge */}
//       <motion.div 
//         initial={{ opacity: 0, y: 5 }}
//         animate={{ opacity: 1, y: 0 }}
//         className="mx-2 flex items-center gap-3 py-2.5 px-4 rounded-2xl bg-white/[0.03] border border-white/5"
//       >
//         <TrendingUp size={14} style={{ color: nudge.color }} />
//         <span className="text-[11px] font-medium text-white/70">{nudge.msg}</span>
//       </motion.div>
//     </div>
//   );
// };

"use client";
import React from "react";
import { motion } from "framer-motion";
import { theme } from "@/lib/theme";
import { TrendingUp, Target } from "lucide-react";

export const GoalCard = ({ goal, showBalance = true, onCardClick, exchangeRate }: any) => {
  const current = Number(goal.currentAmount) || 0;
  const target = Number(goal.targetAmount) || 0;
  const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  const getNudge = () => {
    if (progress >= 100) return { msg: "Goal Achieved! 🎉", color: "#4ade80" };
    if (progress > 80) return { msg: "So close! Keep it up.", color: "#4ade80" };
    if (progress > 50) return { msg: "Over halfway! Great momentum.", color: "#3b82f6" };
    if (progress > 0) return { msg: "Building up! Every bit counts.", color: "#fbbf24" };
    return { msg: "Ready for your first deposit?", color: "#94a3b8" };
  };

  const nudge = getNudge();

  return (
    <div className="flex flex-col gap-3 w-full">
      <motion.div
        whileTap={{ scale: 0.96 }}
        className="relative rounded-[32px] p-6 cursor-pointer border border-white/10 overflow-hidden shadow-xl"
        style={{ backgroundImage: `linear-gradient(135deg, ${theme.colors.cardGradientFrom}, ${theme.colors.cardGradientTo})` }}
        onClick={onCardClick}
      >
        <div className="absolute inset-0 bg-white/5 pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-widest text-white/60 flex items-center gap-2">
              <Target size={14} /> {goal.title}
            </span>
            <span className="bg-white/10 px-2.5 py-1 rounded-full text-[10px] font-bold text-white">
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="text-3xl font-black text-white">
            <span className="text-lg font-medium opacity-60 mr-1">{exchangeRate ? "KES" : "$"}</span>
            {showBalance ? current.toLocaleString() : "••••"}
          </div>
          <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]"
            />
          </div>
        </div>
      </motion.div>
      <motion.div className="mx-2 flex items-center gap-3 py-2 px-4 rounded-2xl bg-white/[0.03] border border-white/5">
        <TrendingUp size={14} style={{ color: nudge.color }} />
        <span className="text-[11px] font-medium text-white/70">{nudge.msg}</span>
      </motion.div>
    </div>
  );
};