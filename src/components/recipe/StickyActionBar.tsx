'use client'

import { useEffect, useState, type ReactNode } from 'react'

// Sticky pasek akcji przepisu. Po rozpoczęciu przewijania kompaktuje się
// do zestawu „primary" (powrót + Do jadłospisu / Dodaj do dnia), reszta znika,
// żeby nie zasłaniać treści. Na górze strony (scrollY = 0) — pełen zestaw.
export function StickyActionBar({ primary, extras }: { primary: ReactNode; extras: ReactNode }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="no-print sticky top-16 z-20 -mx-4 px-4 py-3 mb-6 bg-white/95 backdrop-blur-md border-b border-stone-100">
      <div className="flex flex-wrap items-center gap-3">
        {primary}
        {!scrolled && extras}
      </div>
    </div>
  )
}
