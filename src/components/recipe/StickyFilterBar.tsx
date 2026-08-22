'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Pasek filtrów przyklejany pod headerem.
 *
 * Zaokrąglone narożniki wyglądają dobrze, dopóki panel stoi na tle strony — ale
 * gdy wsunie się pod header, białe łuki po bokach odcinają się od paska i widać,
 * że to pływająca karta, a nie element nawigacji. Po przyklejeniu prostujemy rogi.
 *
 * CSS nie ma jeszcze selektora na „element jest przyklejony", więc wykrywamy to
 * wartownikiem: pusty element nad paskiem znika z widoku dokładnie w momencie,
 * w którym pasek zaczyna się kleić. IntersectionObserver jest do tego tańszy niż
 * nasłuch scrolla, bo nie odpala się przy każdym pikselu przewijania.
 */
export function StickyFilterBar({ children }: { children: ReactNode }) {
  const [przyklejony, setPrzyklejony] = useState(false)
  const wartownik = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wartownik.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const io = new IntersectionObserver(([wpis]) => setPrzyklejony(!wpis.isIntersecting), {
      // 64 px to wysokość headera (h-16) — wartownik „znika" dokładnie wtedy,
      // gdy pasek dochodzi do swojej pozycji top-16.
      rootMargin: '-64px 0px 0px 0px',
      threshold: 0,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <>
      <div ref={wartownik} aria-hidden className="h-px" />
      <div
        data-przyklejony={przyklejony ? '' : undefined}
        className={cn(
          'mb-8 bg-white p-3 sm:p-5 border border-stone-100 sticky top-16 z-40',
          'transition-[border-radius] duration-150',
          przyklejony ? 'rounded-none' : 'rounded-2xl'
        )}
      >
        {children}
      </div>
    </>
  )
}
