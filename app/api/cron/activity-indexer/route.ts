import { NextRequest, NextResponse } from "next/server";
import { ActivityIndexer } from "@/lib/backend/services/activity-indexer.service";
import { getDatabase } from "@/lib/backend/database";
import { ALL_CHAINS } from "@/lib/backend/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const DEFAULT_LIMIT = Number(process.env.ACTIVITY_INDEXER_LIMIT || 200);
const DEFAULT_CONCURRENCY = Number(process.env.ACTIVITY_INDEXER_CONCURRENCY || 3);

type UserDoc = {
  address?: string;
  lastActiveAt?: Date;
};

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  let cursor = 0;
  const runners = Array.from({ length: limit }).map(async () => {
    while (cursor < items.length) {
      const current = items[cursor];
      cursor += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

export async function GET(request: NextRequest) {
  try {
    const requiredToken = process.env.ACTIVITY_INDEXER_TOKEN;
    if (requiredToken) {
      const tokenFromHeader = request.headers.get("x-cron-token");
      const tokenFromQuery = request.nextUrl.searchParams.get("token");
      if (tokenFromHeader !== requiredToken && tokenFromQuery !== requiredToken) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const limit = parsePositiveInt(
      request.nextUrl.searchParams.get("limit"),
      DEFAULT_LIMIT
    );
    const concurrency = parsePositiveInt(
      request.nextUrl.searchParams.get("concurrency"),
      DEFAULT_CONCURRENCY
    );
    const chainParam = request.nextUrl.searchParams.get("chain");
    const chains = chainParam
      ? [chainParam.toUpperCase()]
      : ALL_CHAINS.map((chain) => chain.toUpperCase());

    const db = await getDatabase();
    const users = (await db
      .collection<UserDoc>("users")
      .find({}, { projection: { address: 1, lastActiveAt: 1 } })
      .sort({ lastActiveAt: -1 })
      .limit(limit)
      .toArray()) as UserDoc[];

    const jobs = users
      .map((user) => user.address)
      .filter((address): address is string => !!address)
      .flatMap((address) => chains.map((chain) => ({ address, chain })));

    if (jobs.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    let processed = 0;
    let failed = 0;
    const failures: Array<{ address: string; chain: string; error: string }> =
      [];

    await runWithConcurrency(jobs, concurrency, async ({ address, chain }) => {
      try {
        await ActivityIndexer.indexUserActivities(address, chain);
        processed += 1;
      } catch (error) {
        failed += 1;
        failures.push({
          address,
          chain,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return NextResponse.json({
      success: true,
      processed,
      failed,
      limit,
      chains,
      failures: failures.slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
