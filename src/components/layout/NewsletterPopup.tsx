'use client'

import { useState, useEffect } from 'react'
import { X, Mail, Check } from 'lucide-react'

const DISMISS_KEY = 'promohaps:newsletter-dismissed'
const SUBBED_KEY = 'promohaps:newsletter-subbed'

// Popup zapisu na newsletter. Pokazuje się po 30s pobytu na stronie
// LUB po scrollu > 50%, o ile nie został wcześniej odrzucony/zapisany.
export function NewsletterPopup() {
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (localStorage.getItem(DISMISS_KEY) || localStorage.getItem(SUBBED_KEY)) return
    } catch {
      return
    }

    let timer: number | undefined
    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight
      const doc = document.documentElement.scrollHeight
      if (doc > 0 && scrolled / doc > 0.5) show()
    }
    const show = () => {
      setVisible(true)
      window.removeEventListener('scroll', onScroll)
      if (timer) window.clearTimeout(timer)
    }

    timer = window.setTimeout(show, 30000)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (timer) window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
    setVisible(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'loading') return
    setStatus('loading')
    setError('')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const isJson = res.headers.get('content-type')?.includes('application/json')
      const data = isJson ? await res.json().catch(() => ({})) : {}
      if (res.status === 501) {
        setStatus('error')
        setError('Newsletter wystartuje wkrótce — spróbuj za kilka dni.')
        return
      }
      if (!res.ok) {
        setStatus('error')
        setError(data.error ?? 'Coś poszło nie tak.')
        return
      }
      try { localStorage.setItem(SUBBED_KEY, '1') } catch {}
      setStatus('success')
    } catch {
      setStatus('error')
      setError('Brak połączenia. Spróbuj ponownie.')
    }
  }

  if (!visible) return null

  return (
    <div className="no-print fixed inset-x-0 bottom-24 md:bottom-6 md:right-6 md:left-auto md:max-w-sm z-40 pointer-events-none">
      <div className="pointer-events-auto mx-4 md:mx-0 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden">
        <button
          onClick={dismiss}
          aria-label="Zamknij"
          className="absolute top-3 right-3 text-stone-400 hover:text-stone-600 z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {status === 'success' ? (
          <div className="p-6 text-center">
            <div className="inline-flex w-12 h-12 rounded-full bg-green-100 items-center justify-center mb-3">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-bold text-stone-900 mb-1">Zapisano!</h3>
            <p className="text-sm text-stone-600">Sprawdź skrzynkę — powitalny mail leci do Ciebie.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-5 h-5 text-[#12b76a]" />
              <h3 className="font-bold text-stone-900">Co tydzień oszczędne przepisy</h3>
            </div>
            <p className="text-sm text-stone-600 mb-4">
              5 najlepszych propozycji z tygodniowych promocji — prosto na maila. Bez spamu.
            </p>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="twoj@email.pl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'loading'}
              className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:border-[#12b76a] focus:outline-none focus:ring-2 focus:ring-[#12b76a]/20"
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="mt-3 w-full btn-primary py-2.5 text-sm disabled:opacity-60"
            >
              {status === 'loading' ? 'Zapisuję…' : 'Zapisz się'}
            </button>
            <p className="mt-2 text-[11px] text-stone-400">
              W każdej chwili możesz się wypisać. Zgadzasz się na przetwarzanie danych zgodnie z{' '}
              <a href="/polityka-prywatnosci" className="underline hover:text-stone-600">polityką prywatności</a>.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
