'use client'

import { useState, useRef, useEffect } from 'react'
import { storeColor } from '@/lib/stores'

// Logotyp sklepu z pliku /public/logos/{slug}.png (albo .svg — patrz `ext`).
// Gdy pliku brak lub się nie wczyta, elegancko wraca do kolorowej kropki + nazwy.
export function StoreLogo({
  slug,
  name,
  className = 'h-5 w-auto max-w-[5rem] object-contain',
  ext = 'png',
}: {
  slug: string
  name: string
  className?: string
  ext?: 'png' | 'svg'
}) {
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  // Gdy obrazek 404-uje przed hydracją, zdarzenie onError bywa zgubione —
  // po zamontowaniu sprawdzamy, czy faktycznie się wczytał.
  useEffect(() => {
    const img = ref.current
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [])

  if (failed) {
    return (
      <>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: storeColor(slug) }} />
        {name}
      </>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={`/logos/${slug}.${ext}`} alt={name} className={className} onError={() => setFailed(true)} />
}
