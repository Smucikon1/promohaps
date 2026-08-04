'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'

// Root error boundary — łapie wyjątki podczas SSR/CSR i pokazuje sensowny ekran
// zamiast białego. Musi być komponentem klientowym.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Bez zewnętrznej telemetrii — do konsoli, żeby przy dev / w podglądzie było widać
    console.error('Root error boundary:', error)
  }, [error])

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-5">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold text-stone-900 mb-3" style={{ fontFamily: 'var(--font-serif)' }}>
        Coś poszło nie tak
      </h1>
      <p className="text-stone-600 mb-8">
        Nie udało się załadować tej strony. Spróbuj jeszcze raz — jeśli problem się powtórzy, wróć na stronę główną.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-full bg-[#12b76a] hover:bg-[#0f9d5b] text-white text-sm font-semibold px-5 py-2.5 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Spróbuj ponownie
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-stone-200 text-stone-700 text-sm font-semibold px-5 py-2.5 hover:border-stone-300 transition-colors"
        >
          <Home className="w-4 h-4" />
          Strona główna
        </Link>
      </div>
      {error?.digest && (
        <p className="mt-6 text-xs text-stone-400">Kod błędu: {error.digest}</p>
      )}
    </div>
  )
}
