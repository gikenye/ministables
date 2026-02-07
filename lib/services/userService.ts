import type { Db } from "mongodb";
import { getCollection, getDatabase } from "../mongodb";
import { reportWarning } from "@/lib/services/errorReportingService";
import { User, UserUpdate, NewUser } from "../models/user";

const COLLECTION_NAME = "users";

const DEFAULT_GOAL_PREFERENCES = {
  autoCreateQuickSave: false,
  goalCreationReminders: true,
  interestCalculationFrequency: "weekly" as const,
  notifications: {
    goalProgress: true,
    interestEarned: true,
    goalCompleted: true,
    lowBalance: true,
    autoSaveReminders: true,
  },
  privacy: {
    showGoalsToFriends: false,
    allowGoalContributions: true,
    showProgressPublicly: true,
  },
};

const DEFAULT_SAVINGS_STATS = {
  totalSaved: "0",
  totalInterestEarned: "0",
  totalGoals: 0,
  activeGoals: 0,
  completedGoals: 0,
  averageGoalSize: "0",
  savingsStreak: 0,
  longestSavingsStreak: 0,
  achievements: {
    firstGoal: false,
    firstDeposit: false,
    goalCompleted: false,
    savingsStreak30: false,
    savingsStreak100: false,
    interestMilestone: false,
    groupGoalCreated: false,
    referralMade: false,
  },
};

const DEFAULT_COMPLIANCE_FLAGS = {
  sanctionsCheck: false,
  pepCheck: false,
  amlCleared: false,
};

const DEFAULT_SETTINGS = {
  currency: "USD",
  language: "en",
  timezone: "UTC",
  theme: "auto" as const,
};

function filterUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function buildUserDefaults(now: Date) {
  return {
    verified: false,
    goalPreferences: DEFAULT_GOAL_PREFERENCES,
    savingsStats: DEFAULT_SAVINGS_STATS,
    friends: [],
    kycLevel: "none" as const,
    complianceFlags: DEFAULT_COMPLIANCE_FLAGS,
    settings: DEFAULT_SETTINGS,
    lastActiveAt: now,
    loginCount: 1,
    createdAt: now,
    updatedAt: now,
  };
}

type EnsureUserContext = {
  source?: string;
  additional?: Record<string, unknown>;
};

export async function ensureUserInDb(
  db: Db,
  address: string,
  data: Partial<User> = {},
  context: EnsureUserContext = {}
): Promise<{ created: boolean }> {
  const normalizedAddress = address.toLowerCase();
  const now = new Date();
  const updateData = filterUndefined(data);
  const defaults = buildUserDefaults(now);
  const setOnInsert: Record<string, unknown> = {
    address: normalizedAddress,
    ...defaults,
  };

  const update: Record<string, unknown> = {
    $setOnInsert: setOnInsert,
  };

  if (Object.keys(updateData).length > 0) {
    update.$set = { ...updateData, updatedAt: now };
    for (const key of Object.keys(update.$set as Record<string, unknown>)) {
      if (key in setOnInsert) {
        delete setOnInsert[key];
      }
    }
  }

  const result = await db
    .collection(COLLECTION_NAME)
    .updateOne({ address: normalizedAddress }, update, { upsert: true });

  const created = Boolean(result.upsertedId);
  if (created) {
    reportWarning("User record created via ensureUser fallback", {
      component: "ensureUser",
      operation: context.source,
      userId: normalizedAddress,
      additional: context.additional,
    });
  }

  return { created };
}

/**
 * User service for handling user data operations
 */
export const UserService = {
  /**
   * Find a user by wallet address
   */
  async findByAddress(address: string): Promise<User | null> {
    const collection = await getCollection(COLLECTION_NAME);
    return (await collection.findOne({
      address: address.toLowerCase(),
    })) as User | null;
  },

  /**
   * Find a user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const collection = await getCollection(COLLECTION_NAME);
    return (await collection.findOne({ username })) as User | null;
  },

  /**
   * Create a new user
   */
  async createUser(userData: NewUser): Promise<User> {
    const collection = await getCollection(COLLECTION_NAME);

    // Ensure address is lowercase for consistency
    const normalizedUserData = {
      ...userData,
      address: userData.address.toLowerCase(),
      createdAt: new Date(),
      updatedAt: new Date(),
      // Initialize default values for required fields
      savingsStats: {
        totalSaved: "0",
        totalInterestEarned: "0",
        totalGoals: 0,
        activeGoals: 0,
        completedGoals: 0,
        averageGoalSize: "0",
        savingsStreak: 0,
        longestSavingsStreak: 0,
        achievements: {
          firstGoal: false,
          firstDeposit: false,
          goalCompleted: false,
          savingsStreak30: false,
          savingsStreak100: false,
          interestMilestone: false,
          groupGoalCreated: false,
          referralMade: false,
        },
      },
      friends: [],
      lastActiveAt: new Date(),
      loginCount: 1,
    } as User;

    await collection.insertOne(
      normalizedUserData as unknown as Record<string, unknown>
    );

    return normalizedUserData;
  },

  /**
   * Update a user by address
   */
  async updateUser(address: string, update: UserUpdate): Promise<User | null> {
    const collection = await getCollection(COLLECTION_NAME);

    // Add updatedAt timestamp
    const updateData = {
      ...update,
      updatedAt: new Date(),
    };

    const result = await collection.findOneAndUpdate(
      { address: address.toLowerCase() },
      { $set: updateData },
      { returnDocument: "after" }
    );

    return result as unknown as User;
  },

  /**
   * Update or create a user (upsert)
   */
  async upsertUser(address: string, userData: Partial<User>): Promise<User> {
    const collection = await getCollection(COLLECTION_NAME);

    const now = new Date();

    // Prepare the update data
    const updateData = {
      ...userData,
      address: address.toLowerCase(),
      updatedAt: now,
    };

    // Set createdAt only if it's a new document
    const result = await collection.findOneAndUpdate(
      { address: address.toLowerCase() },
      [
        {
          $set: {
            ...updateData,
            createdAt: { $ifNull: ["$createdAt", now] },
          },
        },
      ],
      {
        upsert: true,
        returnDocument: "after",
      }
    );

    if (!result) {
      throw new Error(`Failed to upsert user with address ${address}`);
    }

    return result as unknown as User;
  },

  /**
   * Check if a username is available
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const user = await this.findByUsername(username);
    return user === null;
  },

  /**
   * Ensure a user record exists for the address without mutating existing data.
   */
  async ensureUser(address: string, userData: Partial<User> = {}) {
    const db = (await getDatabase()) as Db;
    return ensureUserInDb(db, address, userData);
  },
};
