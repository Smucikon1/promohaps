'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { getAnalyticsConsent, grantAnalyticsConsent, denyAnalyticsConsent } from '@/lib/analytics'

export function AnalyticsBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Pokaż tylko, gdy użytkownik nie podjął jeszcze decyzji
    if (getAnalyticsConsent() === null) setVisible(true)
  }, [])

  const accept = () => {
    grantAnalyticsConsent()
    setVisible(false)
  }

  const decline = () => {
    denyAnalyticsConsent()
    setVisible(false)
  }

  if (!visible) return null

  return (
    // Kontener przepuszcza kliknięcia (pointer-events-none) — blokuje tylko sama karta,
    // żeby baner nie zasłaniał przycisków strony pod sobą.
    <div className="no-print pointer-events-none fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50">
      <div className="pointer-events-auto bg-stone-800 text-white rounded-2xl p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="text-lg">🍪</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-1">Anonimowa analityka</p>
            <p className="text-xs text-stone-300 leading-relaxed">
              Za Twoją zgodą zbieramy anonimowe dane o kliknięciach, by poprawiać aplikację.
              Nie zapisujemy danych osobowych. Bez zgody nie śledzimy niczego.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={accept}
                className="text-xs bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                Akceptuję
              </button>
              <button
                onClick={decline}
                className="text-xs text-stone-300 hover:text-white px-3 py-1.5 rounded-lg border border-stone-600 hover:border-stone-500 transition-colors"
              >
                Odrzuć
              </button>
            </div>
          </div>
          <button
            onClick={decline}
            aria-label="Zamknij i odrzuć"
            className="text-stone-400 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
