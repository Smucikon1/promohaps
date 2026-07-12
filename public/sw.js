// Prosty service worker: network-first z fallbackiem do cache (offline).
const CACHE = 'przepisnik-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req)
        // Zapisuj do cache tylko udane odpowiedzi
        if (fresh && fresh.status === 200 && fresh.type === 'basic') {
          const cache = await caches.open(CACHE)
          cache.put(req, fresh.clone())
        }
        return fresh
      } catch {
        const cached = await caches.match(req)
        if (cached) return cached
        if (req.mode === 'navigate') {
          const home = await caches.match('/')
          if (home) return home
        }
        return Response.error()
      }
    })()
  )
})
