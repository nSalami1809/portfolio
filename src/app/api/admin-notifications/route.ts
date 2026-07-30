import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { getDb } from '@/lib/mongodb'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('admin-token')?.value
  if (!token) return false
  try {
    await jwtVerify(token, getSecret())
    return true
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const db = await getDb()
  const [unreadContacts, unreadQuotes] = await Promise.all([
    db.collection('contacts').countDocuments({ read: false }),
    db.collection('quotes').countDocuments({ read: false }),
  ])

  return NextResponse.json({ unreadContacts, unreadQuotes })
}
