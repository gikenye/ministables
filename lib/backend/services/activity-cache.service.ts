import { getDatabase } from "../database";

export interface CachedActivity {
  userAddress: string;
  chain: string;
  activities: any[];
  lastBlock: number;
  updatedAt: string;
}

export class ActivityCacheService {
  private static COLLECTION_NAME = "user_activities";
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  static async getActivities(userAddress: string, chain: string): Promise<CachedActivity | null> {
    const db = await getDatabase();
    const collection = db.collection<CachedActivity>(this.COLLECTION_NAME);
    
    const cached = await collection.findOne({
      userAddress: userAddress.toLowerCase(),
      chain,
    });

    if (!cached) return null;

    const age = Date.now() - new Date(cached.updatedAt).getTime();
    if (age > this.CACHE_TTL_MS) return null;

    return cached;
  }

  static async saveActivities(
    userAddress: string,
    chain: string,
    activities: any[],
    lastBlock: number
  ): Promise<void> {
    const db = await getDatabase();
    const collection = db.collection<CachedActivity>(this.COLLECTION_NAME);

    await collection.updateOne(
      { userAddress: userAddress.toLowerCase(), chain },
      {
        $set: {
          activities,
          lastBlock,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );
  }
}
