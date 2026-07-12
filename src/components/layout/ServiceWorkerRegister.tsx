'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      // W dev: usuń ewentualnego starego SW i cache, by nie serwował nieaktualnego bundla
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister())
      }).catch(() => {})
      if (typeof caches !== 'undefined') {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {})
      }
      return
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  return null
}
