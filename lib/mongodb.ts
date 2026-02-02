import { MongoClient, ServerApiVersion } from 'mongodb';

const isBuildTime =
  process.env.npm_lifecycle_event === 'build' ||
  process.env.NEXT_PHASE === 'phase-production-build';

// Replace the placeholder with your MongoDB connection string
const uri = process.env.MONGODB_URI || '';

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
});

let clientPromise: Promise<MongoClient> | null = null;

if (!isBuildTime) {
  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      globalWithMongo._mongoClientPromise = client.connect();
    }
    clientPromise = globalWithMongo._mongoClientPromise;
  } else {
    // In production mode, it's best to not use a global variable.
    clientPromise = client.connect();
  }
}

export default clientPromise;

type MockCursor = {
  sort: () => MockCursor;
  limit: () => MockCursor;
  skip: () => MockCursor;
  project: () => MockCursor;
  toArray: () => Promise<any[]>;
};

const createMockCursor = (): MockCursor => ({
  sort: () => createMockCursor(),
  limit: () => createMockCursor(),
  skip: () => createMockCursor(),
  project: () => createMockCursor(),
  toArray: async () => [],
});

const createMockCollection = () => ({
  find: () => createMockCursor(),
  aggregate: () => createMockCursor(),
  findOne: async () => null,
  findOneAndUpdate: async () => ({ value: null }),
  updateOne: async () => ({ matchedCount: 0, modifiedCount: 0 }),
  updateMany: async () => ({ matchedCount: 0, modifiedCount: 0 }),
  insertOne: async () => ({ insertedId: 'build' }),
  insertMany: async () => ({ insertedCount: 0, insertedIds: {} }),
  deleteOne: async () => ({ deletedCount: 0 }),
  deleteMany: async () => ({ deletedCount: 0 }),
  countDocuments: async () => 0,
  distinct: async () => [],
  createIndex: async () => 'build',
});

const createMockDb = () => ({
  collection: () => createMockCollection(),
});

// Helper function to get the database
export async function getDatabase() {
  if (isBuildTime) {
    return createMockDb();
  }
  if (!clientPromise) {
    throw new Error('Mongo client not initialized');
  }
  const clientInstance = await clientPromise;
  return clientInstance.db(process.env.MONGODB_DB || 'ministables');
}

// Helper function to get a collection
export async function getCollection(collectionName: string) {
  const db = await getDatabase();
  return db.collection(collectionName);
}
