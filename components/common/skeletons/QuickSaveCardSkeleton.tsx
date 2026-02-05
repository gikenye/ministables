import { theme } from "@/lib/theme"

export const QuickSaveCardSkeleton = () => {
  return (
    <div className="relative">
      <div
        className="rounded-[2.5rem] p-6 text-white shadow-2xl border border-white/5 animate-pulse"
        style={{
          backgroundImage: `linear-gradient(to bottom right, ${theme.colors.cardGradientFrom}, ${theme.colors.cardGradientTo})`,
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="space-y-2">
            <div className="bg-white/20 h-3 w-24 rounded"></div>
            <div className="bg-white/30 h-9 w-36 rounded"></div>
          </div>
          <div className="bg-white/10 h-6 w-12 rounded-full border border-white/10"></div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 bg-white/20 h-11 rounded-2xl"></div>
          <div className="flex-1 bg-white/20 h-11 rounded-2xl"></div>
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
          <div className="w-4 h-4 bg-white/20 rounded-full"></div>
          <div className="bg-white/10 h-6 w-20 rounded-full border border-white/10"></div>
        </div>
      </div>
    </div>
  )
}

export default QuickSaveCardSkeleton
