// Minimal, conservative service worker: makes the site installable and
// gives navigations an offline fallback page. Deliberately does NOT cache
// /api, /admin, or /_next/* — those must always hit the network so dynamic
// data, auth state, and post-deploy JS/CSS chunks are never served stale.
const CACHE_VERSION = 'v1'
const CACHE_NAME = `ns-portfolio-${CACHE_VERSION}`
const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/_next/')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  // Static assets only (images, icons, fonts) — cache-first with a
  // background refresh so a stale copy never blocks a fresh one for long.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
