"use client"

import { Users, Calendar, TrendingUp, Loader2, Shield } from "lucide-react"
import { ActionButton } from "@/components/ui"
import { ConnectWallet } from "@/components/ConnectWallet"
import type { GroupSavingsGoal } from "@/lib/services/backendApiService"

interface GoalInviteViewProps {
  goal: GroupSavingsGoal
  isAuthenticated: boolean
  inviterAddress?: string
}

export const GoalInviteView = ({ goal, isAuthenticated, inviterAddress }: GoalInviteViewProps) => {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/african-safari-scene-2005.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"></div>
      <div className="relative z-10 flex items-center justify-center min-h-screen p-5">
        <div className="max-w-lg w-full bg-card/95 backdrop-blur-sm border border-border rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-8 text-white text-center">
            <p className="text-white/90 text-base leading-relaxed">
              Join this group savings goal and start building wealth together
            </p>
          </div>

          <div className="p-6 space-y-5">
            {goal.targetAmountToken && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 backdrop-blur-sm border border-border rounded-xl p-5">
                    <div className="text-muted-foreground text-sm mb-2">Target</div>
                    <div className="text-foreground text-2xl font-bold">${goal.targetAmountToken.toLocaleString()}</div>
                  </div>
                  <div className="bg-muted/50 backdrop-blur-sm border border-border rounded-xl p-5">
                    <div className="text-muted-foreground text-sm mb-2">Progress</div>
                    <div className="text-emerald-500 text-2xl font-bold">{(goal.progressPercent || 0).toFixed(1)}%</div>
                  </div>
                </div>

                <div className="bg-muted/50 backdrop-blur-sm border border-border rounded-xl p-5">
                  <div className="w-full bg-muted rounded-full h-3 mb-3">
                    <div
                      className="bg-emerald-500 h-3 rounded-full transition-all"
                      style={{ width: `${Math.min(goal.progressPercent || 0, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground font-medium">
                    <span>${(goal.totalProgressUSD || 0).toLocaleString()} raised</span>
                    <span>{goal.participants?.length || 0} participants</span>
                  </div>
                </div>

                <div className="bg-muted/50 backdrop-blur-sm border border-border rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-3 text-foreground">
                    <Users className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm font-medium">{goal.isPublic ? "Public Goal" : "Private Goal"}</span>
                  </div>
                  {goal.targetDate && goal.targetDate !== "0" && (
                    <div className="flex items-center gap-3 text-foreground">
                      <Calendar className="w-5 h-5 text-emerald-500" />
                      <span className="text-sm font-medium">
                        Target: {new Date(goal.targetDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {goal.createdAt && (
                    <div className="flex items-center gap-3 text-foreground">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                      <span className="text-sm font-medium">
                        Created: {new Date(goal.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            {!isAuthenticated && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-8 text-center">
                <Shield className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-foreground font-semibold text-xl mb-3">Sign In to Join</h3>
                <p className="text-muted-foreground text-base mb-6 leading-relaxed">
                  Click the "Sign In" button below to connect your wallet and join this savings goal
                </p>
                <ConnectWallet className="w-full" />
              </div>
            )}
          </div>
        </div>
      </div>
      {/* </CHANGE> */}
    </div>
  )
}

interface LoadingViewProps {
  message?: string
}

export const LoadingView = ({ message = "Loading..." }: LoadingViewProps) => (
  <div
    className="min-h-screen relative overflow-hidden bg-cover bg-center bg-no-repeat"
    style={{ backgroundImage: "url('/african-safari-scene-2005.jpg')" }}
  >
    <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"></div>
    <div className="relative z-10 flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
        <p className="text-white text-base">{message}</p>
      </div>
    </div>
    {/* </CHANGE> */}
  </div>
)

interface ProcessingViewProps {
  title: string
  message: string
}

export const ProcessingView = ({ title, message }: ProcessingViewProps) => (
  <div
    className="min-h-screen relative overflow-hidden bg-cover bg-center bg-no-repeat"
    style={{ backgroundImage: "url('/african-safari-scene-2005.jpg')" }}
  >
    <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"></div>
    <div className="relative z-10 flex items-center justify-center min-h-screen p-5">
      <div className="max-w-md w-full bg-card/95 backdrop-blur-sm border border-border rounded-2xl p-8 text-center shadow-2xl">
        <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-foreground mb-3">{title}</h2>
        <p className="text-muted-foreground text-base leading-relaxed">{message}</p>
      </div>
    </div>
    {/* </CHANGE> */}
  </div>
)

interface ErrorViewProps {
  title: string
  message: string
  onAction: () => void
  actionLabel?: string
}

export const ErrorView = ({ title, message, onAction, actionLabel = "Go to Home" }: ErrorViewProps) => (
  <div
    className="min-h-screen relative overflow-hidden bg-cover bg-center bg-no-repeat"
    style={{ backgroundImage: "url('/african-safari-scene-2005.jpg')" }}
  >
    <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"></div>
    <div className="relative z-10 flex items-center justify-center min-h-screen p-5">
      <div className="max-w-md w-full bg-card/95 backdrop-blur-sm border border-border rounded-2xl p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-bold text-foreground mb-4">{title}</h1>
        <p className="text-muted-foreground text-base mb-6 leading-relaxed">{message}</p>
        <ActionButton onClick={onAction} variant="primary" size="lg">
          {actionLabel}
        </ActionButton>
      </div>
    </div>
    {/* </CHANGE> */}
  </div>
)
