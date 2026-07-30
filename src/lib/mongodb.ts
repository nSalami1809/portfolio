import { MongoClient, Db } from 'mongodb'

const envUri = process.env.MONGODB_URI
if (!envUri) throw new Error('Missing env: MONGODB_URI')
const uri: string = envUri

const DB_NAME = process.env.MONGODB_DB ?? 'portfolio'

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

function connect(): Promise<MongoClient> {
  const promise = new MongoClient(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
  }).connect()

  // A transient failure (network blip, DNS hiccup) must not permanently wedge
  // every future request behind this one rejected promise — clear the cache
  // so the next getDb() call gets a fresh connection attempt instead of the
  // same dead one forever.
  promise.catch(() => {
    if (global._mongoClientPromise === promise) global._mongoClientPromise = undefined
  })

  return promise
}

// Reuse the same connection across hot-reloads in dev AND across invocations
// in production (module-level singleton kept alive by the Node.js module cache)
if (!global._mongoClientPromise) {
  global._mongoClientPromise = connect()
}

export async function getDb(): Promise<Db> {
  if (!global._mongoClientPromise) global._mongoClientPromise = connect()
  const client = await global._mongoClientPromise
  return client.db(DB_NAME)
}
