// v3 — minimalny worker, którego jedynym zadaniem jest awaryjna strona offline.
//
// Historia tego pliku jest ważna: v2 nie miał handlera 'fetch' i nie był nawet
// rejestrowany, bo cache'owanie zasobów zależnych od builda serwowało nieaktualne
// strony po każdej przebudowie. Problem był prawdziwy — ale skutkiem ubocznym było
// to, że Chrome nie uznawał serwisu za instalowalny (wymaga zarejestrowanego workera
// z obsługą 'fetch'), więc nigdy nie proponował dodania aplikacji.
//
// Rozwiązanie: handler 'fetch' istnieje, ale działa NETWORK-FIRST i przechwytuje
// wyłącznie nawigacje. Dopóki jest internet, każda strona leci prosto z sieci —
// czyli nieaktualne treści nie mają jak się pojawić. Cache wchodzi do gry dopiero,
// gdy fetch rzuci wyjątkiem, czyli przy braku połączenia.

const CACHE = 'zgazetki-offline-v3'
const FALLBACK = '/'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(FALLBACK))
      .catch(() => {}) // brak sieci przy instalacji nie może wywalić workera
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Kasujemy cache poprzednich wersji, żeby nie zostawiać po sobie śmieci
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request

  // Tylko nawigacje. Chunki, obrazki, API i wszystko inne idzie do sieci bez
  // naszego udziału — im mniej worker dotyka, tym mniej może zepsuć.
  if (req.method !== 'GET' || req.mode !== 'navigate') return

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req)
        // Świeża strona główna staje się nową kopią awaryjną
        if (res.ok && new URL(req.url).pathname === FALLBACK) {
          const cache = await caches.open(CACHE)
          cache.put(FALLBACK, res.clone()).catch(() => {})
        }
        return res
      } catch {
        const cache = await caches.open(CACHE)
        const zapas = await cache.match(FALLBACK)
        if (zapas) return zapas
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Brak połączenia</title>' +
            '<body style="font-family:system-ui;padding:2rem;text-align:center">' +
            '<h1>Brak połączenia</h1><p>Sprawdź internet i odśwież stronę.</p></body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
        )
      }
    })()
  )
})
