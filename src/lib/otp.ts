import { createHash, randomInt, timingSafeEqual } from 'crypto'
import { getDb } from './mongodb'

const MAX_ATTEMPTS = 5
const OTP_TTL_MS = 60 * 1000

let otpIndexReady: Promise<void> | null = null
async function ensureOtpIndex() {
  const db = await getDb()
  await db.collection('otps').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}
function getOtpIndex() {
  if (!otpIndexReady) otpIndexReady = ensureOtpIndex().catch(() => {})
  return otpIndexReady
}

export function generateOTP(): string {
  return String(randomInt(100000, 999999))
}

// Only a hash of the code is stored: a read of the database must not hand out a
// live login code.
const hashOtp = (email: string, otp: string) => createHash('sha256').update(`${email}:${otp}`).digest('hex')

function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export async function storeOTP(email: string, otp: string): Promise<void> {
  const [db] = await Promise.all([getDb(), getOtpIndex()])
  await db.collection('otps').updateOne(
    { email },
    { $set: { email, otpHash: hashOtp(email, otp), expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 }, $unset: { otp: '' } },
    { upsert: true },
  )
}

export async function consumeOTP(email: string, otp: string): Promise<boolean> {
  const db = await getDb()
  const otps = db.collection('otps')

  // Counting the try and checking the limit are ONE atomic operation. Reading the
  // counter first and incrementing afterwards let a burst of parallel guesses all
  // see "fewer than 5 attempts" and all be checked.
  const doc = await otps.findOneAndUpdate(
    { email, attempts: { $lt: MAX_ATTEMPTS }, expiresAt: { $gt: new Date() } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' },
  )
  if (!doc) return false

  const matches = typeof doc.otpHash === 'string'
    ? sameHex(doc.otpHash, hashOtp(email, otp))
    : typeof doc.otp === 'string' && sameHex(doc.otp, otp) // a code stored before the hash change (valid for 60 s at most)
  if (!matches) return false

  // Single use: only the request that actually deletes the code succeeds.
  const removed = await otps.deleteOne({ _id: doc._id })
  return removed.deletedCount === 1
}
