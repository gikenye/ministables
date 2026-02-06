import { MongoClient, Db, Collection } from "mongodb";
import type { MetaGoal } from "./types";

let client: MongoClient | null = null;
let db: Db | null = null;
let connectionPromise: Promise<Db> | null = null;
let indexesInitialized = false;

function extractDbNameFromUri(uri: string): string | null {
  const match = uri.match(/\/([^/?]+)(\?|$)/);
  return match ? match[1] : null;
}

export async function connectToDatabase(): Promise<Db> {
  if (db && client) {
    try {
      await client.db().admin().ping();
      return db;
    } catch (error) {
      console.log("Connection lost, reconnecting...");
      client = null;
      db = null;
      connectionPromise = null;
    }
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI environment variable is required");
    }

    const dbName = process.env.MONGODB_DB_NAME || extractDbNameFromUri(uri);
    if (!dbName) {
      throw new Error("Database name not found in URI or MONGODB_DB_NAME");
    }

    client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      retryWrites: true,
      retryReads: true,
    });

    await client.connect();
    db = client.db(dbName);

    if (!indexesInitialized) {
      await ensureIndexes(db);
      indexesInitialized = true;
    }

    if (process.env.LOG_DB_CONNECTION === "true") {
      console.log("✅ Connected to MongoDB");
    }

    return db;
  })();

  try {
    return await connectionPromise;
  } catch (error) {
    client = null;
    db = null;
    connectionPromise = null;
    indexesInitialized = false;
    throw error;
  }
}

async function ensureIndexes(database: Db): Promise<void> {
  await database.collection("invite_nonces").createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "expiresAt_ttl" }
  );
  await database.collection("invite_links").createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "expiresAt_ttl" }
  );
}

export async function getMetaGoalsCollection(): Promise<Collection<MetaGoal>> {
  const database = await connectToDatabase();
  return database.collection<MetaGoal>("meta_goals");
}

export async function getUserXPCollection(): Promise<Collection<import("./types").UserXP>> {
  const database = await connectToDatabase();
  return database.collection<import("./types").UserXP>("user_xp");
}

export async function getDatabase(): Promise<Db> {
  return connectToDatabase();
}

export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
