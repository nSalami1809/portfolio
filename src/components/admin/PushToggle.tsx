'use client'

import { useEffect, useState } from 'react'
import { savePushSubscription, removePushSubscription } from '@/actions/push'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

type State = 'unsupported' | 'blocked' | 'off' | 'on' | 'busy'

// Turns push notifications on/off for *this* browser: the admin gets a system
// notification (new quote, signature, message…) even with the dashboard closed.
export default function PushToggle() {
  const [state, setState] = useState<State>('unsupported')

  useEffect(() => {
    let cancelled = false
    const supported = !!VAPID_PUBLIC && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!supported) return
    if (Notification.permission === 'denied') { setState('blocked'); return } // eslint-disable-line react-hooks/set-state-in-effect
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (!cancelled) setState(sub ? 'on' : 'off') })
      .catch(() => { if (!cancelled) setState('unsupported') })
    return () => { cancelled = true }
  }, [])

  if (state === 'unsupported') return null

  const toggle = async () => {
    const previous = state
    setState('busy')
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        await removePushSubscription(existing.endpoint)
        await existing.unsubscribe()
        setState('off')
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState(permission === 'denied' ? 'blocked' : 'off'); return }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC!) })
      const json = sub.toJSON()
      const result = await savePushSubscription({ endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } })
      if (!result.ok) { await sub.unsubscribe(); setState('off'); return }
      setState('on')
    } catch {
      setState(previous === 'busy' ? 'off' : previous)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={state === 'busy' || state === 'blocked'}
      className="w-full flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-60"
      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-poppins)', borderTop: '1px solid var(--border)' }}
      title={state === 'blocked' ? 'Notifications bloquées dans les réglages du navigateur' : undefined}
    >
      Notifications sur cet appareil
      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: state === 'on' ? 'var(--accent-glow)' : 'var(--bg-secondary)', color: state === 'on' ? 'var(--accent)' : 'var(--text-subtle)' }}>
        {state === 'on' ? 'Activées' : state === 'blocked' ? 'Bloquées' : state === 'busy' ? '…' : 'Désactivées'}
      </span>
    </button>
  )
}
