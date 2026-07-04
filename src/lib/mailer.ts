import nodemailer from 'nodemailer'

// Lazy creation so env vars are always read at call time, not at module load
export function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}
