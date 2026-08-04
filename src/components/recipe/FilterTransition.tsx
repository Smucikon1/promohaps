'use client'

import { createContext, useCallback, useContext, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Jeden wspólny stan przejścia dla filtrów, wyszukiwarki i siatki wyników.
// Dzięki temu klik w filtr od razu przygasza wyniki i pokazuje spinner,
// zamiast zostawiać stronę na sekundę bez żadnej reakcji.
type FilterTransition = { isPending: boolean; navigate: (url: string) => void }

const FilterCtx = createContext<FilterTransition | null>(null)

export function FilterTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const navigate = useCallback(
    (url: string) => startTransition(() => router.push(url, { scroll: false })),
    [router]
  )
  return <FilterCtx.Provider value={{ isPending, navigate }}>{children}</FilterCtx.Provider>
}

// Poza providerem (inne strony) działa jak zwykła nawigacja — hooki lecą zawsze,
// więc kolejność wywołań pozostaje stała.
export function useFilterTransition(): FilterTransition {
  const ctx = useContext(FilterCtx)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const navigate = useCallback(
    (url: string) => startTransition(() => router.push(url, { scroll: false })),
    [router]
  )
  return ctx ?? { isPending, navigate }
}

export function ResultsPending({ children }: { children: ReactNode }) {
  const { isPending } = useFilterTransition()
  return (
    <div className="relative">
      <div className={cn('transition-opacity duration-150', isPending && 'opacity-40')}>{children}</div>
      {isPending && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
          <span className="sticky top-44 inline-flex items-center gap-2 rounded-full border border-stone-100 bg-white px-4 py-2 text-sm font-medium text-stone-600 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-[#12b76a]" />
            Aktualizuję wyniki…
          </span>
        </div>
      )}
    </div>
  )
}
