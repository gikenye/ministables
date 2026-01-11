import { theme } from "@/lib/theme"

export const QuickSaveCardSkeleton = () => {
  return (
    <div className="relative">
      <div className="rounded-2xl p-6 text-white shadow-lg animate-pulse" style={{ backgroundImage: `linear-gradient(to bottom right, ${theme.colors.cardGradientFrom}, ${theme.colors.cardGradientTo})` }}>
        {/* Header Section */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="bg-white/20 h-5 w-32 rounded mb-3"></div>
            <div className="bg-white/30 h-9 w-40 rounded mb-2"></div>
            <div className="bg-white/20 h-5 w-32 rounded"></div>
          </div>

          {/* Currency Toggle Skeleton - larger */}
          <div className="flex flex-col items-end gap-2">
            <div className="bg-white/10 rounded-full px-4 py-2 flex items-center gap-3 min-h-[48px]">
              <div className="bg-white/20 h-4 w-10 rounded"></div>
              <div className="w-12 h-6 bg-white/20 rounded-full"></div>
              <div className="bg-white/20 h-4 w-10 rounded"></div>
            </div>
          </div>
        </div>

        {/* Action Buttons - larger touch targets */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 bg-white/20 h-12 rounded-2xl"></div>
          <div className="flex-1 bg-white/20 h-12 rounded-2xl"></div>
        </div>

        {/* Balance visibility toggle - larger */}
        <div className="flex justify-end">
          <div className="w-6 h-6 bg-white/20 rounded"></div>
        </div>
      </div>

      {/* Expand/Collapse Button - larger */}
      <div className="flex justify-center mt-4">
        <div className="bg-muted rounded-full shadow-lg w-14 h-14"></div>
      </div>
      {/* </CHANGE> */}
    </div>
  )
}

export default QuickSaveCardSkeleton
