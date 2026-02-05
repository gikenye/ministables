// Dynamic goal duration calculator based on user habits
export interface UserHabit {
  avgDepositFrequency: number; // days between deposits
  avgGoalDuration: number; // days to complete goals
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  preferredLockPeriod: number; // user's preferred lock period in days
}

export interface GoalDurationConfig {
  minLockPeriod: number; // 30 days from contract
  suggestedDuration: number; // calculated based on habits
  maxRecommendedDuration: number; // upper bound
}

export function calculateOptimalDuration(
  targetAmountUSD: number,
  userHabit?: UserHabit,
  avgDepositAmount?: number
): GoalDurationConfig {
  const MIN_LOCK_PERIOD_DAYS = 30;
  const MIN_LOCK_PERIOD_SECONDS = MIN_LOCK_PERIOD_DAYS * 24 * 60 * 60;

  // Default conservative approach if no user data
  if (!userHabit || !avgDepositAmount) {
    return {
      minLockPeriod: MIN_LOCK_PERIOD_SECONDS,
      suggestedDuration: MIN_LOCK_PERIOD_SECONDS,
      maxRecommendedDuration: MIN_LOCK_PERIOD_SECONDS * 4 // 120 days
    };
  }

  // Calculate based on user habits
  const estimatedDepositsNeeded = Math.ceil(targetAmountUSD / avgDepositAmount);
  const estimatedTimeToComplete = estimatedDepositsNeeded * userHabit.avgDepositFrequency;

  // Risk tolerance multipliers
  const riskMultipliers = {
    conservative: 1.5, // 50% buffer
    moderate: 1.25,    // 25% buffer  
    aggressive: 1.1    // 10% buffer
  };

  const baseCalculation = estimatedTimeToComplete * riskMultipliers[userHabit.riskTolerance];
  
  const suggestedDays = Math.max(MIN_LOCK_PERIOD_DAYS, Math.ceil(baseCalculation));
  const suggestedDuration = suggestedDays * 24 * 60 * 60;

  // Cap at reasonable maximum (1 year)
  const maxRecommendedDuration = Math.min(suggestedDuration * 2, 365 * 24 * 60 * 60);

  return {
    minLockPeriod: MIN_LOCK_PERIOD_SECONDS,
    suggestedDuration,
    maxRecommendedDuration
  };
}

export function getTargetDateFromDuration(durationSeconds: number): number {
  return Math.floor(Date.now() / 1000) + durationSeconds;
}