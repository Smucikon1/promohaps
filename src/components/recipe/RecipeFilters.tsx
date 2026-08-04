'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, ArrowDownUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sortByPopularity } from '@/lib/stores'
import { CategoryIcon } from '@/components/recipe/CategoryIcon'
import { AirfryerIcon } from '@/components/recipe/AirfryerIcon'
import { StoreLogo } from '@/components/recipe/StoreLogo'
import { useFilterTransition } from '@/components/recipe/FilterTransition'
import { track } from '@/lib/analytics'
import type { Store, Category } from '@/types'

interface FiltersProps {
  stores: Store[]
  categories: Category[]
}

const SORT_OPTIONS = [
  { value: 'cheap', label: 'Najtańsze' },
  { value: 'new', label: 'Najnowsze' },
  { value: 'fast', label: 'Najszybsze' },
]

const DIFFICULTIES = [
  { value: 'latwy', label: 'Łatwy' },
  { value: 'sredni', label: 'Średni' },
  { value: 'trudny', label: 'Trudny' },
]

// Progi cenowe z kontekstem — użytkownik od razu widzi „do czego to jest":
// szybki posiłek, codzienny obiad, dla rodziny. Chip label pokazuje tylko cenę,
// żeby był krótki; pełny opis widać w dropdownie.
const PRICE_RANGES = [
  { value: '15', short: 'Do 15 zł', hint: 'Ekstra tanio' },
  { value: '25', short: 'Do 25 zł', hint: 'Codzienny obiad' },
  { value: '40', short: 'Do 40 zł', hint: 'Dla rodziny' },
  { value: '60', short: 'Do 60 zł', hint: 'Specjalna okazja' },
]

/**
 * Chip filtra w stylu Uber Eats: płaski przycisk z opcjonalnym dropdownem.
 * - Bez dropdownu → toggle (Airfryer).
 * - Z dropdownem → panel z opcjami (Sortuj, Cena, Kategoria, Trudność) i ptaszkiem przy wybranej.
 * Aktywny = ciemne wypełnienie, białe napisy (spójne z Uber Eats).
 */
function FilterChip({
  label,
  active,
  onClear,
  icon,
  dropdown,
  onClick,
}: {
  label: string
  active: boolean
  onClear?: () => void
  icon?: ReactNode
  dropdown?: (close: () => void) => ReactNode
  onClick?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // Pozycja dropdownu w koordynatach `fixed` — omija `overflow` przodków (chip bar ma overflow-x-auto)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => setMounted(true), [])

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const update = () => {
      const r = btnRef.current!.getBoundingClientRect()
      const menuW = menuRef.current?.offsetWidth ?? 224
      // Trzymamy dropdown w viewport — jeśli by wystawał za prawą krawędź, wyrównujemy do prawej strony przycisku
      const preferredLeft = r.left
      const maxLeft = window.innerWidth - menuW - 8
      const left = Math.max(8, Math.min(preferredLeft, maxLeft))
      setPos({ top: r.bottom + 8, left })
    }
    update()
    const opts: AddEventListenerOptions = { passive: true }
    window.addEventListener('scroll', update, opts)
    window.addEventListener('resize', update, opts)
    return () => {
      window.removeEventListener('scroll', update, opts)
      window.removeEventListener('resize', update, opts)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const trigger = () => {
    if (dropdown) setOpen((o) => !o)
    else onClick?.()
  }

  const menuNode =
    dropdown && open && pos ? (
      <div
        ref={menuRef}
        role="menu"
        style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 1000 }}
        className="min-w-56 bg-white rounded-2xl border border-stone-100 shadow-xl py-1 animate-slide-up"
      >
        {dropdown(() => setOpen(false))}
      </div>
    ) : null

  return (
    <div className="flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={trigger}
        aria-pressed={dropdown ? undefined : active}
        aria-expanded={dropdown ? open : undefined}
        className={cn(
          'inline-flex items-center gap-1.5 h-10 rounded-full text-sm font-medium border transition-colors',
          onClear && active ? 'pl-3.5 pr-1' : 'px-3.5',
          active
            ? 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
            : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
        )}
      >
        {icon}
        <span className="whitespace-nowrap">{label}</span>
        {dropdown && <ChevronDown className={cn('w-4 h-4 -mr-0.5 transition-transform', open && 'rotate-180')} />}
        {onClear && active && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Usuń filtr"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onClear()
              }
            }}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-white/15 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {/* Portal do body, żeby overflow chip bara i stacking context stickyego paska nie ucinały dropdownu */}
      {mounted && menuNode ? createPortal(menuNode, document.body) : null}
    </div>
  )
}

// Wiersz opcji w dropdownie (jak w Uber Eats: radio z ptaszkiem)
function OptionRow({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between gap-3 px-4 min-h-11 text-sm text-left transition-colors',
        active ? 'font-semibold text-stone-900' : 'text-stone-700 hover:bg-stone-50'
      )}
    >
      <span className="flex items-center gap-2">{children}</span>
      {active && <Check className="w-4 h-4 text-[#12b76a] flex-shrink-0" />}
    </button>
  )
}

export function RecipeFilters({ stores, categories }: FiltersProps) {
  const params = useSearchParams()
  const { isPending, navigate } = useFilterTransition()

  const activeStores = new Set((params.get('store') ?? '').split(',').filter(Boolean))
  const activeCategory = params.get('category')
  const activeDifficulty = params.get('difficulty')
  const activeSort = params.get('sort') ?? 'cheap'
  const activeMaxPrice = params.get('maxPrice')
  const activeAirfryer = params.get('airfryer')

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString())
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'limit') next.delete('limit')
      navigate(`/?${next.toString()}`)
    },
    [params, navigate]
  )

  const toggleStore = useCallback(
    (slug: string) => {
      const next = new Set(activeStores)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      setParam('store', next.size > 0 ? [...next].join(',') : null)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [[...activeStores].join(','), setParam]
  )

  const currentSort = SORT_OPTIONS.find((s) => s.value === activeSort) ?? SORT_OPTIONS[0]
  const currentDifficulty = DIFFICULTIES.find((d) => d.value === activeDifficulty)
  const currentCategory = categories.find((c) => c.slug === activeCategory)

  return (
    <div className={cn('space-y-3 transition-opacity', isPending && 'opacity-60')}>
      {/* Sklepy — zawsze widoczne, wg popularności, poziomy scroll na mobile.
          Fade po prawej sygnalizuje, że da się przewinąć palcem/myszką. */}
      <div className="relative -mx-1">
        <div className="flex gap-2 overflow-x-auto no-scrollbar md:flex-wrap px-1 scroll-smooth snap-x">
          {sortByPopularity(stores).map((store) => {
            const active = activeStores.has(store.slug)
            return (
              <button
                key={store.id}
                aria-pressed={active}
                aria-label={store.name}
                onClick={() => {
                  toggleStore(store.slug)
                  track.storeClick(store.id)
                }}
                className={cn(
                  'flex-shrink-0 snap-start inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-all',
                  active
                    ? 'bg-[#e6f9f0] border-[#12b76a] ring-2 ring-[#12b76a]/25 text-[#0c7d49]'
                    : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                )}
              >
                <StoreLogo slug={store.slug} name={store.name} className="h-8 w-auto max-w-[6.5rem] object-contain" />
              </button>
            )
          })}
        </div>
        <div className="md:hidden pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" aria-hidden />
      </div>

      {/* Chip bar w stylu Uber Eats — pojedynczy pasek płaskich chip-ów z dropdownami */}
      <div className="relative -mx-1">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1 scroll-smooth snap-x">
        {/* Sortuj */}
        <FilterChip
          label={currentSort.label}
          active={activeSort !== 'cheap'}
          icon={<ArrowDownUp className="w-4 h-4" />}
          dropdown={(close) => (
            <>
              {SORT_OPTIONS.map((opt) => (
                <OptionRow
                  key={opt.value}
                  active={activeSort === opt.value}
                  onClick={() => {
                    setParam('sort', opt.value === 'cheap' ? null : opt.value)
                    close()
                  }}
                >
                  {opt.label}
                </OptionRow>
              ))}
            </>
          )}
        />

        {/* Cena */}
        <FilterChip
          label={activeMaxPrice ? `Do ${activeMaxPrice} zł` : 'Cena'}
          active={!!activeMaxPrice}
          onClear={activeMaxPrice ? () => setParam('maxPrice', null) : undefined}
          dropdown={(close) => (
            <>
              {PRICE_RANGES.map((r) => (
                <OptionRow
                  key={r.value}
                  active={activeMaxPrice === r.value}
                  onClick={() => {
                    setParam('maxPrice', activeMaxPrice === r.value ? null : r.value)
                    close()
                  }}
                >
                  <span className="flex flex-col items-start leading-tight">
                    <span>{r.short}</span>
                    <span className="text-[11px] text-stone-400 font-normal">{r.hint}</span>
                  </span>
                </OptionRow>
              ))}
            </>
          )}
        />

        {/* Kategoria */}
        <FilterChip
          label={currentCategory?.name ?? 'Kategoria'}
          active={!!activeCategory}
          onClear={activeCategory ? () => setParam('category', null) : undefined}
          dropdown={(close) => (
            <div className="max-h-72 overflow-y-auto">
              {categories.map((cat) => (
                <OptionRow
                  key={cat.id}
                  active={activeCategory === cat.slug}
                  onClick={() => {
                    setParam('category', activeCategory === cat.slug ? null : cat.slug)
                    track.categoryClick(cat.id)
                    close()
                  }}
                >
                  <CategoryIcon slug={cat.slug} className="w-4 h-4 text-[#12b76a]" />
                  {cat.name}
                </OptionRow>
              ))}
            </div>
          )}
        />

        {/* Trudność */}
        <FilterChip
          label={currentDifficulty?.label ?? 'Trudność'}
          active={!!activeDifficulty}
          onClear={activeDifficulty ? () => setParam('difficulty', null) : undefined}
          dropdown={(close) => (
            <>
              {DIFFICULTIES.map((d) => (
                <OptionRow
                  key={d.value}
                  active={activeDifficulty === d.value}
                  onClick={() => {
                    setParam('difficulty', activeDifficulty === d.value ? null : d.value)
                    close()
                  }}
                >
                  {d.label}
                </OptionRow>
              ))}
            </>
          )}
        />

        {/* Airfryer — czysty toggle bez dropdownu */}
        <FilterChip
          label="Airfryer"
          active={!!activeAirfryer}
          icon={<AirfryerIcon className={cn('w-4 h-4', !activeAirfryer && 'text-[#12b76a]')} />}
          onClick={() => setParam('airfryer', activeAirfryer ? null : '1')}
        />
      </div>
      <div className="md:hidden pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" aria-hidden />
      </div>
    </div>
  )
}
