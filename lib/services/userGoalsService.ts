import { getCollection } from '@/lib/mongodb';
import { UserGoal, UserGoalsResponse } from '@/lib/models/userGoal';

const ALLOCATE_API_URL = process.env.ALLOCATE_API_URL;

export class UserGoalsService {
  private static collection = 'userGoals';
  private static syncInProgress = new Map<string, Promise<UserGoal[]>>();

  static async syncUserGoals(userAddress: string): Promise<UserGoal[]> {
    if (!ALLOCATE_API_URL) {
      throw new Error('ALLOCATE_API_URL not configured');
    }

    // Prevent concurrent syncs for the same user
    if (this.syncInProgress.has(userAddress)) {
      return await this.syncInProgress.get(userAddress)!;
    }

    const syncPromise = this._performSync(userAddress);
    this.syncInProgress.set(userAddress, syncPromise);
    
    try {
      const result = await syncPromise;
      return result;
    } finally {
      this.syncInProgress.delete(userAddress);
    }
  }

  private static async _performSync(userAddress: string): Promise<UserGoal[]> {
    try {
      // Fetch goals from ALLOCATE API
      const response = await fetch(`${ALLOCATE_API_URL}/api/user-goals?userAddress=${userAddress}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch goals: ${response.statusText}`);
      }

      const data: UserGoalsResponse = await response.json();
      const collection = await getCollection(this.collection);
      const now = new Date();

      // Upsert each goal
      const upsertPromises = data.goals.map(async (goalData) => {
        const userGoal: UserGoal = {
          userAddress,
          ...goalData,
          lastSyncedAt: now,
        };

        await collection.updateOne(
          { userAddress, goalId: goalData.goalId },
          { $set: userGoal },
          { upsert: true }
        );

        return userGoal;
      });

      return await Promise.all(upsertPromises);
    } catch (error) {
      console.error('Error syncing user goals:', error);
      throw error;
    }
  }

  static async getUserGoals(userAddress: string): Promise<UserGoal[]> {
    const collection = await getCollection(this.collection);
    return await collection
      .find({ userAddress })
      .sort({ createdAt: -1 })
      .toArray() as UserGoal[];
  }

  static async getGoalById(userAddress: string, goalId: string): Promise<UserGoal | null> {
    const collection = await getCollection(this.collection);
    return await collection.findOne({ userAddress, goalId }) as UserGoal | null;
  }
}