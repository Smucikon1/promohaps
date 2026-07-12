'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback, useTransition } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { track } from '@/lib/analytics'

export function SearchBar() {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(params.get('search') ?? '')
  const [isPending, startTransition] = useTransition()

  const current = params.get('search') ?? ''

  useEffect(() => {
    setValue(params.get('search') ?? '')
  }, [params])

  const submit = useCallback(
    (q: string) => {
      const next = new URLSearchParams(params.toString())
      const trimmed = q.trim()
      if (trimmed) {
        next.set('search', trimmed)
        next.delete('limit')
        track.search(trimmed)
      } else {
        next.delete('search')
      }
      startTransition(() => {
        router.push(`/?${next.toString()}`, { scroll: false })
      })
    },
    [params, router]
  )

  // Live search z debounce — pomija, gdy wartość zgadza się z adresem URL
  useEffect(() => {
    if (value.trim() === current) return
    const t = setTimeout(() => submit(value), 350)
    return () => clearTimeout(t)
  }, [value, current, submit])

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        submit(value)
      }}
      className="relative"
    >
      <button
        type="submit"
        aria-label="Szukaj"
        className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-amber-600 transition-colors"
      >
        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
      </button>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Szukaj przepisu lub składnika"
        placeholder="Szukaj przepisu, składnika..."
        className="w-full pl-12 pr-10 py-3.5 bg-white rounded-2xl border border-stone-200 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-stone-800 placeholder-stone-400 text-sm transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          aria-label="Wyczyść wyszukiwanie"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </form>
  )
}
