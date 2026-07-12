'use client'

import { useEffect, useState } from 'react'
import { getAnalyticsConsent } from '@/lib/analytics'

// Publisher ID (np. ca-pub-XXXXXXXX) ustawiany w env; bez niego slot się nie renderuje.
const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

let scriptLoaded = false
function ensureScript() {
  if (scriptLoaded || typeof document === 'undefined' || !CLIENT) return
  const s = document.createElement('script')
  s.async = true
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`
  s.crossOrigin = 'anonymous'
  document.head.appendChild(s)
  scriptLoaded = true
}

// Reklama displayowa — ładowana WYŁĄCZNIE po zgodzie na cookies/analitykę.
export function AdSlot({ slot, className }: { slot?: string; className?: string }) {
  const [ok, setOk] = useState(false)

  useEffect(() => {
    const allowed = !!CLIENT && getAnalyticsConsent() === 'granted'
    setOk(allowed)
    if (!allowed) return
    ensureScript()
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      /* AdSense niegotowe — zignoruj */
    }
  }, [])

  if (!ok) return null

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
