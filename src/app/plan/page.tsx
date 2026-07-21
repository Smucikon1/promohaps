'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { CalendarDays, ArrowLeft, X, ShoppingCart, Trash2, Plus } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import {
  DAYS,
  readPlan,
  removeFromDay,
  clearPlan,
  planTotals,
  sharedProducts,
  usageCounts,
  recipeCostInPlan,
  planToShoppingItems,
  MEAL_PLAN_EVENT,
  type MealPlan,
} from '@/lib/mealPlan'
import { SHOPPING_PREFIX, notifyShoppingUpdated } from '@/lib/shopping'

// Kolory kafelków dni (jak „Weekly Schedule" w mockupie)
const DAY_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899']

export default function PlanPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<MealPlan>({})
  const [loaded, setLoaded] = useState(false)

  const sync = useCallback(() => {
    setPlan(readPlan())
    setLoaded(true)
  }, [])

  useEffect(() => {
    sync()
    window.addEventListener(MEAL_PLAN_EVENT, sync)
    return () => window.removeEventListener(MEAL_PLAN_EVENT, sync)
  }, [sync])

  if (!loaded) return null

  const totals = planTotals(plan)
  const shared = sharedProducts(plan)
  const counts = usageCounts(plan)
  const isEmpty = totals.meals === 0

  const generateList = () => {
    const items = planToShoppingItems(plan)
    localStorage.setItem(`${SHOPPING_PREFIX}plan`, JSON.stringify(items))
    notifyShoppingUpdated()
    router.push('/lista-zakupow')
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-amber-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Wróć do przepisów
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>
            Jadłospis na tydzień
          </h1>
          <p className="text-sm text-stone-500">Zaplanuj posiłki i pobierz gotową listę zakupów</p>
        </div>
      </div>

      {isEmpty ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-stone-100">
          <div className="text-5xl mb-4">🗓️</div>
          <h2 className="text-xl font-bold mb-2 text-stone-700">Twój jadłospis jest pusty</h2>
          <p className="text-stone-400 mb-6">
            Otwórz dowolny przepis i kliknij „Do jadłospisu", aby przypisać go do dnia tygodnia.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors"
          >
            Przeglądaj przepisy
          </Link>
        </div>
      ) : (
        <>
          {/* Podsumowanie tygodnia */}
          <div className="bg-white rounded-2xl border border-stone-100 p-5 mb-8">
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <div className="text-2xl font-bold text-stone-800">{totals.meals}</div>
                <div className="text-xs text-stone-500">Posiłków</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-stone-800">{formatPrice(totals.cost)}</div>
                <div className="text-xs text-stone-500">Koszt tygodnia</div>
              </div>
            </div>
            {/* Produkty wykorzystane w kilku przepisach */}
            {shared.length > 0 && (
              <div className="bg-green-50 rounded-xl p-3 mb-5">
                <p className="text-xs font-semibold text-green-800 mb-2">
                  ♻️ Kupujesz raz, gotujesz kilka razy — {shared.length} wspólnych produktów
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {shared.slice(0, 10).map((s) => (
                    <span key={s.name} className="text-xs bg-white text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                      {s.name} <span className="font-bold">×{s.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button onClick={generateList} className="btn-primary flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Wygeneruj listę zakupów
              </button>
              <button
                onClick={() => { if (confirm('Wyczyścić cały jadłospis?')) clearPlan() }}
                className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-red-500 px-3 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Wyczyść plan
              </button>
            </div>
          </div>

          {/* Dni tygodnia */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DAYS.map((day, di) => {
              const recipes = plan[day.key] ?? []
              return (
                <div key={day.key} className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="icon-badge text-white text-xs font-bold" style={{ background: DAY_COLORS[di % DAY_COLORS.length] }}>
                        {day.short}
                      </div>
                      <h3 className="font-semibold text-stone-800">{day.label}</h3>
                    </div>
                    <span className="text-xs text-stone-400">{recipes.length > 0 ? recipes.length : ''}</span>
                  </div>

                  {recipes.length === 0 ? (
                    <Link
                      href="/"
                      className="flex items-center gap-2 px-5 py-4 text-sm text-stone-400 hover:text-amber-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Dodaj przepis
                    </Link>
                  ) : (
                    <ul className="divide-y divide-stone-50">
                      {recipes.map((r) => (
                        <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                          <Link href={`/przepis/${r.slug}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                              {r.image_url ? (
                                <Image src={r.image_url} alt={r.title} fill className="object-cover" sizes="48px" />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-lg bg-gradient-to-br from-amber-50 to-stone-100">🍽️</div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-stone-700 truncate group-hover:text-amber-600 transition-colors">{r.title}</p>
                              <div className="flex items-center gap-2 text-xs">
                                {r.store_name && <span className="text-stone-400">{r.store_name}</span>}
                                <span className="text-amber-600 font-semibold">{formatPrice(recipeCostInPlan(r, counts))}</span>
                                {r.ingredients.some((i) => (counts.get(i.name.trim().toLowerCase()) || 1) > 1) && (
                                  <span className="text-green-600" title="Część opakowań dzielona z innymi przepisami">♻️ dzielone</span>
                                )}
                              </div>
                            </div>
                          </Link>
                          <button
                            onClick={() => removeFromDay(day.key, r.id)}
                            aria-label={`Usuń ${r.title} z dnia ${day.label}`}
                            className="text-stone-300 hover:text-red-500 transition-colors flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
