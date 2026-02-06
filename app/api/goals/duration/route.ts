import { NextRequest, NextResponse } from "next/server";
import {
  calculateOptimalDuration,
  UserHabit,
  getTargetDateFromDuration,
} from "@/lib/backend/goal-duration-calculator";
import { resolveTargetAmountToken } from "@/lib/backend/utils";
import type { ErrorResponse } from "@/lib/backend/types";

interface DurationRequest {
  targetAmountToken: number;
  userHabit?: UserHabit;
  avgDepositAmount?: number;
}

interface DurationResponse {
  minLockPeriodDays: number;
  suggestedDurationDays: number;
  targetDateTimestamp: number;
  reasoning: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<DurationResponse | ErrorResponse>> {
  try {
    const body: DurationRequest = await request.json();
    const { userHabit, avgDepositAmount } = body;
    const targetAmountToken = resolveTargetAmountToken(body);

    if (!targetAmountToken || targetAmountToken <= 0) {
      return NextResponse.json(
        { error: "targetAmountToken must be greater than 0" },
        { status: 400 }
      );
    }

    if (avgDepositAmount !== undefined && avgDepositAmount <= 0) {
      return NextResponse.json(
        { error: "avgDepositAmount must be greater than 0" },
        { status: 400 }
      );
    }

    const config = calculateOptimalDuration(targetAmountToken, userHabit, avgDepositAmount);
    
    const minLockPeriodDays = Math.floor(config.minLockPeriod / (24 * 60 * 60));
    const suggestedDurationDays = Math.floor(config.suggestedDuration / (24 * 60 * 60));
    
    let reasoning = "Contract minimum (30 days)";
    if (userHabit && avgDepositAmount) {
      const estimatedDeposits = Math.ceil(targetAmountToken / avgDepositAmount);
      reasoning = `${estimatedDeposits} deposits, ${userHabit.avgDepositFrequency}d frequency, ${userHabit.riskTolerance} risk`;
    }

    return NextResponse.json({
      minLockPeriodDays,
      suggestedDurationDays,
      targetDateTimestamp: getTargetDateFromDuration(config.suggestedDuration),
      reasoning
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
