import { getCollection } from "../mongodb";
import { User, UserUpdate, NewUser } from "../models/user";

const COLLECTION_NAME = "users";

/**
 * User service for handling user data operations
 */
export const UserService = {
  /**
   * Find a user by wallet address
   */
  async findByAddress(address: string): Promise<User | null> {
    const collection = await getCollection(COLLECTION_NAME);
    return collection.findOne<User>({ address: address.toLowerCase() });
  },

  /**
   * Find a user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const collection = await getCollection(COLLECTION_NAME);
    return collection.findOne<User>({ username });
  },

  /**
   * Create a new user
   */
  async createUser(userData: NewUser): Promise<User> {
    const collection = await getCollection(COLLECTION_NAME);

    // Ensure address is lowercase for consistency
    const normalizedUserData: User = {
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
    };

    await collection.insertOne(normalizedUserData);

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
};
