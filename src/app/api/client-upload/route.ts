import { NextRequest, NextResponse, after } from 'next/server'
import { put } from '@vercel/blob'
import { getAdminEmail } from '@/lib/admin-config'
import { sendMailLogged } from '@/lib/mail-safe'
import { clientActivityAdminEmail } from '@/lib/email-templates'
import { notifyAdmin } from '@/lib/push'
import { quotesCol, checkRateLimit, type QuoteRecordEvent } from '@/lib/quotes-core'
import { checkClientFile, cleanFileName, MAX_CLIENT_FILES } from '@/lib/client-files'

const UPLOAD_RATE_LIMIT_PER_HOUR = 20

// Public: a client sends a file for their project (logo, texts, images…).
// Identified by their tracking code, and only for a signed quote. Rate-limited,
// with a strict allow-list of file types (see lib/client-files.ts).
export async function POST(req: NextRequest) {
  const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status })

  if (!(await checkRateLimit('client-upload', UPLOAD_RATE_LIMIT_PER_HOUR))) return fail('rate', 429)

  let form: FormData
  try { form = await req.formData() } catch { return fail('invalid', 400) }
  const code = String(form.get('code') ?? '').trim().toUpperCase()
  const file = form.get('file')
  if (code.length < 4 || code.length > 20 || !(file instanceof File)) return fail('invalid', 400)

  const checked = checkClientFile(file)
  if (!checked.ok) return fail(checked.error, checked.error === 'toolarge' ? 413 : 400)

  const col = await quotesCol()
  const doc = await col.findOne({ accessCode: code })
  if (!doc) return fail('notfound', 404)
  if (doc.status !== 'accepted' || !doc.signature) return fail('closed', 403)
  if ((doc.files?.length ?? 0) >= MAX_CLIENT_FILES) return fail('limit', 400)

  const name = cleanFileName(file.name)
  let url: string
  if (process.env.E2E_DRY_RUN === '1') {
    url = `dry-run://client-files/${doc._id.toString()}/${name}`
  } else {
    try {
      const blob = await put(`client-files/${doc._id.toString()}/${name}`, Buffer.from(await file.arrayBuffer()), {
        access: 'public', contentType: checked.contentType, addRandomSuffix: true,
      })
      url = blob.url
    } catch (e) {
      console.error('[client-upload] blob error:', e)
      return fail('generic', 500)
    }
  }

  const at = new Date()
  const event: QuoteRecordEvent = { type: 'file_uploaded', at, meta: { name } }
  await col.updateOne({ _id: doc._id }, { $push: { files: { name, url, size: file.size, contentType: checked.contentType, at }, events: event } })

  after(async () => {
    try {
      const mail = clientActivityAdminEmail({ numero: doc.numero, clientNom: doc.clientNom, kind: 'file', text: `${name} (${Math.max(1, Math.round(file.size / 1024))} Ko)` })
      await sendMailLogged({ from: `"Portfolio NS · Client" <${process.env.GMAIL_USER}>`, to: await getAdminEmail(), subject: mail.subject, html: mail.html }, { kind: 'admin', quoteId: doc._id.toString() })
      await notifyAdmin({ title: `Fichier reçu — ${doc.numero}`, body: `${doc.clientNom} : ${name}`, url: `/admin/quotes?q=${encodeURIComponent(doc.numero)}` })
    } catch (e) {
      console.error('[client-upload] notify error:', e)
    }
  })

  return NextResponse.json({ ok: true, file: { name, size: file.size, at: at.toISOString() } })
}
