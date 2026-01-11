export const GoalCardSkeleton = () => {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="bg-muted h-6 w-36 rounded"></div>
        <div className="bg-muted h-6 w-24 rounded"></div>
      </div>

      {/* Amount */}
      <div className="mb-6">
        <div className="bg-muted h-12 w-48 rounded mb-3"></div>
        <div className="bg-muted h-5 w-28 rounded"></div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="bg-muted/50 h-3 w-full rounded-full">
          <div className="bg-muted h-3 w-1/3 rounded-full"></div>
        </div>
        <div className="flex justify-between mt-3">
          <div className="bg-muted h-5 w-24 rounded"></div>
          <div className="bg-muted h-5 w-28 rounded"></div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <div className="flex-1 bg-muted h-12 rounded-2xl"></div>
        <div className="flex-1 bg-muted h-12 rounded-2xl"></div>
      </div>
    </div>
  )
}

export default GoalCardSkeleton
