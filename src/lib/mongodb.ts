import { MongoClient, Db } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('Missing env: MONGODB_URI')

const DB_NAME = process.env.MONGODB_DB ?? 'portfolio'

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

// Reuse the same connection across hot-reloads in dev AND across invocations
// in production (module-level singleton kept alive by the Node.js module cache)
if (!global._mongoClientPromise) {
  global._mongoClientPromise = new MongoClient(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
  }).connect()
}

const clientPromise: Promise<MongoClient> = global._mongoClientPromise

export async function getDb(): Promise<Db> {
  const client = await clientPromise
  return client.db(DB_NAME)
}
