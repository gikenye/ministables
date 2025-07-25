import { ObjectId } from "mongodb";
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
    const normalizedUserData = {
      ...userData,
      address: userData.address.toLowerCase(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(normalizedUserData);

    return {
      _id: result.insertedId,
      ...normalizedUserData,
    };
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
      { returnDocument: "after" },
    );

    return result as User;
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
      },
    );

    if (!result) {
      throw new Error(`Failed to upsert user with address ${address}`);
    }

    return result as User;
  },

  /**
   * Check if a username is available
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const user = await this.findByUsername(username);
    return user === null;
  },
};
