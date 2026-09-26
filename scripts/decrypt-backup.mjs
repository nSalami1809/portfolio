#!/usr/bin/env node
// Decrypts a database backup downloaded from the admin ("Sauvegardes") and
// writes one JSON file per collection (MongoDB Extended JSON, ready for
// `mongoimport --jsonArray`).
//
//   BACKUP_ENCRYPTION_KEY="your passphrase" node scripts/decrypt-backup.mjs backup-2026-03-01.nsb [output-dir]
//
// The file layout is defined in src/lib/backup-crypto.ts — keep them in sync.
import { createDecipheriv, scryptSync } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const MAGIC = Buffer.from('NSB1')
const SALT_LEN = 16
const IV_LEN = 12
const TAG_LEN = 16

export function decryptBackup(data, secret) {
  const header = MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN
  if (data.length < header || !data.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Not a backup file')
  const salt = data.subarray(MAGIC.length, MAGIC.length + SALT_LEN)
  const iv = data.subarray(MAGIC.length + SALT_LEN, MAGIC.length + SALT_LEN + IV_LEN)
  const tag = data.subarray(MAGIC.length + SALT_LEN + IV_LEN, header)
  const decipher = createDecipheriv('aes-256-gcm', scryptSync(secret, salt, 32), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data.subarray(header)), decipher.final()])
}

function main() {
  const [file, outDir = 'backup-restored'] = process.argv.slice(2)
  const secret = process.env.BACKUP_ENCRYPTION_KEY
  if (!file || !secret) {
    console.error('Usage: BACKUP_ENCRYPTION_KEY="passphrase" node scripts/decrypt-backup.mjs <file.nsb> [output-dir]')
    process.exit(1)
  }

  let dump
  try {
    dump = JSON.parse(gunzipSync(decryptBackup(readFileSync(file), secret)).toString('utf8'))
  } catch (e) {
    console.error(`Cannot decrypt "${file}": wrong passphrase or corrupted file (${e.message}).`)
    process.exit(1)
  }

  mkdirSync(outDir, { recursive: true })
  for (const [name, docs] of Object.entries(dump.collections)) {
    writeFileSync(join(outDir, `${name}.json`), JSON.stringify(docs, null, 2))
    console.log(`${name}: ${docs.length} document(s)`)
  }
  console.log(`\nBackup of ${dump.createdAt} written to ${outDir}/`)
  console.log('Restore one collection with: mongoimport --uri "$MONGODB_URI" --collection <name> --file <name>.json --jsonArray')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
