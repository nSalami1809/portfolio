import { describe, expect, it } from 'vitest'
import { gzipSync, gunzipSync } from 'zlib'
import { decryptBackup, encryptBackup } from '@/lib/backup-crypto'
// The standalone restore script must read what the app writes.
import { decryptBackup as decryptWithScript } from '../scripts/decrypt-backup.mjs'

const SECRET = 'a long enough passphrase'

describe('backup encryption', () => {
  it('round-trips, and the restore script reads the same format', () => {
    const plain = gzipSync(Buffer.from(JSON.stringify({ collections: { quotes: [{ numero: 'DEV-2026-001' }] } })))
    const file = encryptBackup(plain, SECRET)
    expect(decryptBackup(file, SECRET).equals(plain)).toBe(true)
    expect(JSON.parse(gunzipSync(decryptWithScript(file, SECRET)).toString()).collections.quotes[0].numero).toBe('DEV-2026-001')
  })

  it('never stores the data in clear, and differs on every run', () => {
    const plain = Buffer.from('DEV-2026-001 client@example.com')
    const a = encryptBackup(plain, SECRET)
    expect(a.includes(Buffer.from('client@example.com'))).toBe(false)
    expect(a.equals(encryptBackup(plain, SECRET))).toBe(false)
  })

  it('rejects a wrong passphrase, a tampered file and a weak passphrase', () => {
    const file = encryptBackup(Buffer.from('secret data'), SECRET)
    expect(() => decryptBackup(file, 'another passphrase!!')).toThrow()
    const tampered = Buffer.from(file)
    tampered[tampered.length - 1] ^= 1
    expect(() => decryptBackup(tampered, SECRET)).toThrow()
    expect(() => decryptBackup(Buffer.from('not a backup at all, definitely'), SECRET)).toThrow('Not a backup file')
    expect(() => encryptBackup(Buffer.from('x'), 'short')).toThrow()
  })
})
