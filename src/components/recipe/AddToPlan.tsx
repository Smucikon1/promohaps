'use client'

import { useState, useRef, useEffect } from 'react'
import { CalendarPlus, Check } from 'lucide-react'
import { DAYS, addToDay, type PlannedRecipe } from '@/lib/mealPlan'

export function AddToPlan({ recipe }: { recipe: PlannedRecipe }) {
  const [open, setOpen] = useState(false)
  const [addedDay, setAddedDay] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (dayKey: string, label: string) => {
    addToDay(dayKey, recipe)
    setAddedDay(label)
    setOpen(false)
    setTimeout(() => setAddedDay(null), 2500)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
      >
        {addedDay ? <Check className="w-4 h-4" /> : <CalendarPlus className="w-4 h-4" />}
        {addedDay ? `Dodano: ${addedDay}` : 'Do jadłospisu'}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-52 bg-white rounded-xl border border-stone-100 shadow-lg py-1 z-20"
        >
          <p className="px-3 py-1.5 text-xs text-stone-400 font-semibold uppercase tracking-wide">Wybierz dzień</p>
          {DAYS.map((d) => (
            <button
              key={d.key}
              role="menuitem"
              onClick={() => pick(d.key, d.label)}
              className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
