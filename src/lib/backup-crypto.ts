// Encryption of the database backups. A backup holds personal data (clients,
// quotes, payment details) and ends up in a blob store, so it is encrypted with
// a passphrase only the owner knows (BACKUP_ENCRYPTION_KEY) before it leaves the
// server: AES-256-GCM, key derived with scrypt.
//
// File layout: "NSB1" | salt (16) | iv (12) | auth tag (16) | ciphertext.
// scripts/decrypt-backup.mjs reads the same layout — keep them in sync (a test
// checks that they are).
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const MAGIC = Buffer.from('NSB1')
const SALT_LEN = 16
const IV_LEN = 12
const TAG_LEN = 16
export const MIN_SECRET_LENGTH = 16

const deriveKey = (secret: string, salt: Buffer) => scryptSync(secret, salt, 32)

export function encryptBackup(plain: Buffer, secret: string): Buffer {
  if (secret.length < MIN_SECRET_LENGTH) throw new Error('Backup passphrase too short')
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret, salt), iv)
  const body = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body])
}

export function decryptBackup(data: Buffer, secret: string): Buffer {
  const header = MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN
  if (data.length < header || !data.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Not a backup file')
  const salt = data.subarray(MAGIC.length, MAGIC.length + SALT_LEN)
  const iv = data.subarray(MAGIC.length + SALT_LEN, MAGIC.length + SALT_LEN + IV_LEN)
  const tag = data.subarray(MAGIC.length + SALT_LEN + IV_LEN, header)
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret, salt), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data.subarray(header)), decipher.final()])
}
