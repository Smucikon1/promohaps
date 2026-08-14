'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { NAV_DEPTH_KEY } from '@/components/layout/NavDepthTracker'

// Pływający przycisk „Wróć" — pod logotypem w każdej podstronie.
// Ukryty na stronie głównej i w panelu admina.
export function FloatingBack() {
  const pathname = usePathname()
  const router = useRouter()
  const [canBack, setCanBack] = useState(false)

  useEffect(() => {
    try {
      setCanBack(Number(sessionStorage.getItem(NAV_DEPTH_KEY) || '0') > 1)
    } catch {}
  }, [pathname])

  if (pathname === '/' || pathname.startsWith('/admin')) return null

  const onClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    if (canBack) router.back()
    else router.push('/')
  }

  return (
    <>
      {/* Przycisk jest pozycjonowany na sztywno, więc sam z siebie nie zajmuje miejsca
          w układzie i kładł się na treści pod nagłówkiem — na wąskich ekranach zasłaniał
          tagi kategorii. Ten odstęp rezerwuje dokładnie tyle wysokości, ile zajmuje. */}
      <div aria-hidden="true" className="no-print h-14" />

      <a
        href="/"
        onClick={onClick}
        aria-label="Wróć"
        className="no-print fixed top-20 left-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-md border border-stone-200 shadow-sm px-4 py-2 text-sm font-semibold text-stone-700 hover:border-stone-300 hover:bg-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Wróć
      </a>
    </>
  )
}
