'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { X, Store as StoreIcon, SlidersHorizontal, LayoutGrid, Gauge, ArrowDownUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { storeColor } from '@/lib/stores'
import { CategoryIcon } from '@/components/recipe/CategoryIcon'
import { track } from '@/lib/analytics'
import type { Store, Category } from '@/types'

const ICON = 'text-[#1595ff]'

interface FiltersProps {
  stores: Store[]
  categories: Category[]
}

function SectionLabel({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
      <Icon className={cn('w-3.5 h-3.5', ICON)} />
      {children}
    </p>
  )
}

export function RecipeFilters({ stores, categories }: FiltersProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const activeStore = params.get('store')
  const activeCategory = params.get('category')
  const activeDifficulty = params.get('difficulty')
  const activeSort = params.get('sort') ?? 'new'
  const activeMaxPrice = params.get('maxPrice')

  const advancedCount =
    [activeCategory, activeDifficulty].filter(Boolean).length + (activeSort !== 'new' ? 1 : 0)

  // Panel otwarty od razu, jeśli jakiś zaawansowany filtr jest aktywny
  const [open, setOpen] = useState<boolean>(advancedCount > 0)

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString())
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'limit') next.delete('limit')
      startTransition(() => {
        router.push(`/?${next.toString()}`, { scroll: false })
      })
    },
    [params, router]
  )

  const clearAll = () => startTransition(() => router.push('/', { scroll: false }))
  const hasFilters = activeStore || activeCategory || activeDifficulty || activeSort !== 'new' || activeMaxPrice

  return (
    <div className={cn('space-y-4 transition-opacity', isPending && 'opacity-60')}>
      {/* Sklepy — zawsze widoczne */}
      <div>
        <SectionLabel icon={StoreIcon}>Sklep</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {stores.map((store) => {
            const active = activeStore === store.slug
            const color = store.color ?? storeColor(store.slug)
            return (
              <button
                key={store.id}
                aria-pressed={active}
                onClick={() => {
                  setParam('store', active ? null : store.slug)
                  track.storeClick(store.id)
                }}
                className={cn(
                  'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-all',
                  active ? 'text-white border-transparent shadow-sm' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                )}
                style={active ? { backgroundColor: color } : undefined}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: active ? 'rgba(255,255,255,0.9)' : color }}
                />
                {store.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Przycisk „Filtry" + szybkie kwoty (do X zł) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors',
            open || advancedCount > 0
              ? 'border-[#1595ff] text-[#1595ff] bg-[#e8f3ff]'
              : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtry
          {advancedCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-xs font-bold bg-[#1595ff] text-white">
              {advancedCount}
            </span>
          )}
        </button>

        <span className="w-px h-6 bg-stone-200 mx-0.5 hidden sm:block" />

        {[15, 25, 40].map((v) => {
          const active = activeMaxPrice === String(v)
          return (
            <button
              key={v}
              type="button"
              aria-pressed={active}
              onClick={() => setParam('maxPrice', active ? null : String(v))}
              className={cn(
                'px-3 py-2 rounded-xl text-sm font-semibold border transition-colors',
                active ? 'bg-[#1595ff] text-white border-transparent' : 'bg-white text-[#1595ff] border-[#9dc9ff] hover:border-[#1595ff]'
              )}
            >
              do {v} zł
            </button>
          )
        })}
      </div>

      {/* Panel zaawansowany — zawija się (bez chowania za krawędzią) */}
      {open && (
        <div className="space-y-5 border-t border-stone-100 pt-4">
          <div>
            <SectionLabel icon={LayoutGrid}>Kategoria</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const active = activeCategory === cat.slug
                return (
                  <button
                    key={cat.id}
                    aria-pressed={active}
                    onClick={() => {
                      setParam('category', active ? null : cat.slug)
                      track.categoryClick(cat.id)
                    }}
                    className={cn('category-pill', active && 'active')}
                  >
                    <CategoryIcon slug={cat.slug} className={cn('w-3.5 h-3.5', active ? 'text-[#0a4f8c]' : 'text-[#1595ff]')} />
                    {cat.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionLabel icon={Gauge}>Trudność</SectionLabel>
              <div className="flex gap-2">
                {[
                  { value: 'latwy', label: 'Łatwy' },
                  { value: 'sredni', label: 'Średni' },
                  { value: 'trudny', label: 'Trudny' },
                ].map((d) => {
                  const active = activeDifficulty === d.value
                  return (
                    <button
                      key={d.value}
                      aria-pressed={active}
                      onClick={() => setParam('difficulty', active ? null : d.value)}
                      className={cn('category-pill', active && 'active')}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <SectionLabel icon={ArrowDownUp}>Sortuj</SectionLabel>
              <select
                id="sort"
                value={activeSort}
                onChange={(e) => setParam('sort', e.target.value === 'new' ? null : e.target.value)}
                className="text-sm border border-stone-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-[#1595ff]"
              >
                <option value="new">Najnowsze</option>
                <option value="cheap">Najtańsze</option>
                <option value="fast">Najszybsze</option>
              </select>
            </div>
          </div>

          {hasFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
              Wyczyść filtry
            </button>
          )}
        </div>
      )}
    </div>
  )
}
