'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { ChefHat, ChevronLeft, ChevronRight } from 'lucide-react'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import { cn } from '@/lib/utils'
import type { Recipe } from '@/types'

/**
 * Pozioma karuzela najpopularniejszych dań, które udało się odtworzyć z gazetek.
 *
 * Przewijanie jest natywne (scroll-snap), więc na telefonie działa gestem bez
 * jednej linii JS. Strzałki dokładamy tylko dla myszy — na dotyku byłyby zbędnym
 * elementem zasłaniającym karty.
 */
export function PopularDishesCarousel({ recipes }: { recipes: Recipe[] }) {
  const track = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const sync = useCallback(() => {
    const el = track.current
    if (!el) return
    setAtStart(el.scrollLeft <= 4)
    // Tolerancja 4 px: przy skalowaniu strony scrollLeft bywa ułamkowy i koniec
    // listy nigdy nie wypadłby dokładnie równo.
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    sync()
    const el = track.current
    if (!el) return
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [sync])

  const nudge = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    // Przewijamy o szerokość widocznego okna minus zakładka, żeby użytkownik
    // widział, że lista jest ciągła, a nie skacze do zupełnie nowego zestawu.
    el.scrollBy({ left: dir * (el.clientWidth * 0.85), behavior: 'smooth' })
  }

  if (recipes.length === 0) return null

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-[#12b76a]" />
          <h2 className="text-xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>
            Klasyczne dania
          </h2>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <CarouselButton label="Poprzednie" onClick={() => nudge(-1)} disabled={atStart}>
            <ChevronLeft className="w-5 h-5" />
          </CarouselButton>
          <CarouselButton label="Następne" onClick={() => nudge(1)} disabled={atEnd}>
            <ChevronRight className="w-5 h-5" />
          </CarouselButton>
        </div>
      </div>

      <div
        ref={track}
        onScroll={sync}
        className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {recipes.map((r, i) => (
          <div key={r.id} className="snap-start shrink-0 w-[17rem] sm:w-[19rem]">
            <RecipeCard recipe={r} index={i} />
          </div>
        ))}
      </div>
    </section>
  )
}

function CarouselButton({
  label, onClick, disabled, children,
}: {
  label: string
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'w-9 h-9 rounded-full border flex items-center justify-center transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12b76a]',
        disabled
          ? 'border-stone-100 text-stone-300 cursor-default'
          : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
      )}
    >
      {children}
    </button>
  )
}
