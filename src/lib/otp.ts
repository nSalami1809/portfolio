import { randomInt } from 'crypto'
import { getDb } from './mongodb'

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

export async function storeOTP(email: string, otp: string): Promise<void> {
  const [db] = await Promise.all([getDb(), getOtpIndex()])
  await db.collection('otps').updateOne(
    { email },
    { $set: { email, otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000), attempts: 0 } },
    { upsert: true },
  )
}

export async function consumeOTP(email: string, otp: string): Promise<boolean> {
  const db = await getDb()
  const doc = await db.collection('otps').findOne({ email })

  if (!doc) return false
  if (doc.attempts >= 5) return false
  if (new Date() > new Date(doc.expiresAt)) return false

  await db.collection('otps').updateOne({ email }, { $inc: { attempts: 1 } })

  if (doc.otp !== otp) return false

  await db.collection('otps').deleteOne({ email })
  return true
}
