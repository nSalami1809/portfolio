import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

declare global {
  var _mailTransporter: Transporter | undefined
}

// A fresh transport per email meant a fresh TCP connect + TLS handshake +
// SMTP AUTH for every single send — roughly 700ms, and the OTP login mail in
// auth.ts pays it on the request path. A pooled singleton, kept alive by the
// module cache across invocations (same trick as mongodb.ts), reuses one
// authenticated connection instead.
//
// Still created lazily so the env vars are read at call time rather than at
// module load, and so importing this file never opens a socket.
export function getTransporter(): Transporter {
  if (!global._mailTransporter) {
    global._mailTransporter = nodemailer.createTransport({
      service: 'gmail',
      pool: true,
      // Gmail is strict about concurrent sessions, and nothing here sends fast
      // enough to need more than one.
      maxConnections: 1,
      maxMessages: 100,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  }
  return global._mailTransporter
}
