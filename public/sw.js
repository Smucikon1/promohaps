// v2 — SW nie cache'uje już zasobów zależnych od builda (HTML/RSC/chunki).
// Cache'owanie ich pod stałą nazwą powodowało serwowanie nieaktualnych stron po
// każdej przebudowie → zawieszanie. Ten worker tylko sprząta stare cache i nie
// przechwytuje żadnych żądań (brak handlera 'fetch' = przeglądarka idzie do sieci).
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})
