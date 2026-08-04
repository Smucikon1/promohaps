'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { NAV_DEPTH_KEY } from '@/components/layout/NavDepthTracker'

// Prawdziwe „Wróć": cofa na poprzednią stronę serwisu (ulubione,
// wyniki z filtrami…). Gdy nie ma dokąd cofnąć (wejście z linku/nowa karta),
// używa adresu zapasowego, żeby nie wyrzucić użytkownika poza aplikację.
export function BackLink({
  fallbackHref,
  fallbackLabel,
  className,
}: {
  fallbackHref: string
  fallbackLabel: string
  className?: string
}) {
  const router = useRouter()
  const [canBack, setCanBack] = useState(false)

  useEffect(() => {
    try {
      setCanBack(Number(sessionStorage.getItem(NAV_DEPTH_KEY) || '0') > 1)
    } catch {}
  }, [])

  return (
    <a
      href={fallbackHref}
      onClick={(e) => {
        // nie przechwytujemy otwierania w nowej karcie / środkowym przyciskiem
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        if (canBack) router.back()
        else router.push(fallbackHref)
      }}
      className={className}
    >
      <ArrowLeft className="w-4 h-4" />
      {canBack ? 'Wróć' : fallbackLabel}
    </a>
  )
}
