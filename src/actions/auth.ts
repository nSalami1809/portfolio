'use server'

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { SignJWT } from 'jose'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/mongodb'
import { generateOTP, storeOTP, consumeOTP } from '@/lib/otp'
import { getTransporter } from '@/lib/mailer'
import { otpEmail } from '@/lib/email-templates'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!
const getSecret   = () => new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE      = 'admin-token'

function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(pw, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

function verifyPassword(pw: string, stored: string): boolean {
  if (stored.startsWith('scrypt:')) {
    const parts = stored.split(':')
    if (parts.length !== 3) return false
    const [, salt, hash] = parts
    try {
      const derived = scryptSync(pw, salt, 64)
      const storedBuf = Buffer.from(hash, 'hex')
      if (derived.length !== storedBuf.length) return false
      return timingSafeEqual(derived, storedBuf)
    } catch {
      return false
    }
  }
  // Legacy SHA-256 path (env-var or old DB entries)
  const sha = Buffer.from(createHash('sha256').update(pw).digest('hex'))
  const ref = Buffer.from(stored)
  if (sha.length !== ref.length) return false
  return timingSafeEqual(sha, ref)
}

const LOGIN_RL_MAX = 5
const LOGIN_RL_WINDOW_S = 15 * 60

let loginRlIndexReady: Promise<void> | null = null
function ensureLoginRlIndex() {
  if (!loginRlIndexReady) {
    loginRlIndexReady = getDb()
      .then((db) => db.collection('login_rl').createIndex({ createdAt: 1 }, { expireAfterSeconds: LOGIN_RL_WINDOW_S }))
      .then(() => {})
      .catch(() => {})
  }
  return loginRlIndexReady
}

// ── Step 1 : Credentials → OTP ────────────────────────────────────────────

export type LoginResult = { error: string } | null

export async function loginWithCredentials(
  _: LoginResult,
  formData: FormData,
): Promise<LoginResult> {
  const email    = formData.get('email')?.toString().trim() ?? ''
  const password = formData.get('password')?.toString() ?? ''

  if (email !== ADMIN_EMAIL) return { error: 'Identifiants incorrects.' }

  // Rate-limit by IP before hitting the DB for password check
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0].trim() ?? hdrs.get('x-real-ip') ?? 'unknown'
  await ensureLoginRlIndex()
  const db = await getDb()
  const since = new Date(Date.now() - LOGIN_RL_WINDOW_S * 1000)
  const attempts = await db.collection('login_rl').countDocuments({ ip, createdAt: { $gte: since } })
  if (attempts >= LOGIN_RL_MAX) {
    return { error: 'Trop de tentatives. Réessayez dans 15 minutes.' }
  }

  // Validate password — check MongoDB override first, then env var
  const cfg = await db.collection('admin_config').findOne({ _id: 'password' as unknown as import('mongodb').ObjectId })
  const storedHash = (cfg?.hash as string | undefined) ?? process.env.ADMIN_PASSWORD_HASH ?? ''
  if (!verifyPassword(password, storedHash)) {
    await db.collection('login_rl').insertOne({ ip, createdAt: new Date() })
    return { error: 'Identifiants incorrects.' }
  }

  // Auto-upgrade legacy SHA-256 hash stored in MongoDB to scrypt
  if (cfg && !(storedHash as string).startsWith('scrypt:')) {
    await db.collection('admin_config').updateOne(
      { _id: 'password' as unknown as import('mongodb').ObjectId },
      { $set: { hash: hashPassword(password), updatedAt: new Date() } },
    )
  }

  // Generate + send OTP
  const otp = generateOTP()
  try {
    await storeOTP(ADMIN_EMAIL, otp)
    const { subject, html } = otpEmail(otp)
    await getTransporter().sendMail({
      from: `"Portfolio NS · Admin" <${process.env.GMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject,
      html,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[loginWithCredentials] sendMail error:', msg)
    return { error: `Envoi échoué : ${msg}` }
  }

  // Set pre-auth cookie so /admin/verify is accessible
  const jar = await cookies()
  jar.set('admin-pre', '1', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600, // 10 min — corresponds to OTP TTL
    path: '/',
  })

  redirect('/admin/verify')
}

// ── Step 2 : OTP → JWT ────────────────────────────────────────────────────

export type VerifyOTPResult = { error: string } | null

export async function verifyOTPAction(
  _: VerifyOTPResult,
  formData: FormData,
): Promise<VerifyOTPResult> {
  const otp = formData.get('otp')?.toString().trim() ?? ''
  if (!/^\d{6}$/.test(otp)) return { error: 'Code invalide.' }

  const valid = await consumeOTP(ADMIN_EMAIL, otp)
  if (!valid) return { error: 'Code incorrect ou expiré.' }

  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())

  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  jar.delete('admin-pre')

  redirect('/admin')
}

// ── Change password ────────────────────────────────────────────────────────

export type ChangePasswordResult = { ok: true } | { error: string }

export async function changePassword(
  _: ChangePasswordResult | null,
  formData: FormData,
): Promise<ChangePasswordResult> {
  const current  = formData.get('current')?.toString() ?? ''
  const next     = formData.get('next')?.toString() ?? ''
  const confirm  = formData.get('confirm')?.toString() ?? ''

  // Check current password — MongoDB override takes priority over env var
  const db = await getDb()
  const cfg = await db.collection('admin_config').findOne({ _id: 'password' as unknown as import('mongodb').ObjectId })
  const storedHash = (cfg?.hash as string | undefined) ?? process.env.ADMIN_PASSWORD_HASH ?? ''
  if (!verifyPassword(current, storedHash)) {
    return { error: 'Mot de passe actuel incorrect.' }
  }
  if (next.length < 8) {
    return { error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' }
  }
  if (next !== confirm) {
    return { error: 'Les mots de passe ne correspondent pas.' }
  }

  const newHash = hashPassword(next) // scrypt-based

  await db.collection('admin_config').updateOne(
    { _id: 'password' as unknown as import('mongodb').ObjectId },
    { $set: { hash: newHash, updatedAt: new Date() } },
    { upsert: true },
  )

  return { ok: true }
}

// ── Logout ─────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE)
  jar.delete('admin-pre')
  redirect('/')
}
