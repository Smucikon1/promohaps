'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { SearchBar } from '@/components/recipe/SearchBar'

// Wyszukiwarka nie zajmuje już miejsca u góry strony — chowa się pod ikoną w nawigacji.
export function SearchToggle() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Zamknij po kliknięciu poza panelem i przyciskiem
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    // Fokus na polu zaraz po otwarciu — klik w ikonę ma od razu pozwalać pisać
    panelRef.current?.querySelector('input')?.focus()
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDoc)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDoc)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Szukaj przepisu"
        aria-expanded={open}
        className="w-9 h-9 rounded-full flex items-center justify-center text-stone-600 hover:bg-stone-100 transition-colors"
      >
        {open ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute inset-x-0 top-16 border-b border-stone-100 bg-white/95 backdrop-blur-md shadow-sm"
        >
          <div className="max-w-6xl mx-auto px-4 py-3">
            <SearchBar onSubmitted={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
