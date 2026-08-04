'use client'

import { useEffect } from 'react'

// PWA/Service Worker wyłączony na czas rozwoju — cache'owanie zasobów zależnych
// od builda serwowało nieaktualne strony po każdej przebudowie i skrzynkowo
// „psuło" działające funkcje. Ten komponent AKTYWNIE wyrejestrowuje każdego SW
// i czyści wszystkie cache, żeby przeglądarki same się naprawiły.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {})

    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {})
    }
  }, [])

  return null
}
