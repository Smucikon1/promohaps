'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export const NAV_DEPTH_KEY = 'zgazetki:navDepth'

// Liczy nawigacje wewnątrz aplikacji w obrębie karty. Dzięki temu przycisk „Wróć"
// wie, czy jest dokąd cofnąć (poprzednia strona serwisu), czy trzeba użyć zapasowego
// adresu — zamiast wyrzucić użytkownika poza aplikację.
export function NavDepthTracker() {
  const pathname = usePathname()

  useEffect(() => {
    try {
      const d = Number(sessionStorage.getItem(NAV_DEPTH_KEY) || '0')
      sessionStorage.setItem(NAV_DEPTH_KEY, String(d + 1))
    } catch {}
  }, [pathname])

  return null
}
