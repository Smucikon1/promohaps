'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Sparkles, UtensilsCrossed, Recycle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { hasActivePromo } from '@/lib/utils'
import { formatPrice } from '@/lib/utils'

interface Suggestion {
  id: string
  slug: string
  title: string
  image_url: string | null
  store_name: string | null
  price_total: number | null
  shared: string[] // nazwy produktów wspólnych z Twoją listą
}

// Klucz produktu bez wag/ilości — „Pomidory malinowe 1kg" i „Pomidory malinowe" liczą się jako to samo
const norm = (s: string | null | undefined) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => (({ ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' } as any)[c] ?? c))
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s?(?:kg|g|ml|l|dag|szt\.?|sztuk|op\.?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Sugestie przepisów wykorzystujących te same produkty co Twoja lista zakupów.
// Ekskluduje przepisy już na liście (żeby się nie polecały same do siebie).
export function SuggestedRecipes({
  productNames,
  excludeRecipeIds,
}: {
  productNames: string[]
  excludeRecipeIds: string[]
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)

  const sig = productNames.map(norm).filter(Boolean).sort().join('|')

  useEffect(() => {
    const target = new Set(productNames.map(norm).filter(Boolean))
    if (target.size === 0) {
      setSuggestions([])
      return
    }
    let alive = true
    setLoading(true)
    createClient()
      .from('recipes')
      .select(
        `id, slug, title, image_url, price_total,
         store:stores(name, slug),
         ingredients(name),
         promo_products(valid_to)`
      )
      .eq('is_published', true)
      .gt('price_total', 0)
      .then(({ data }) => {
        if (!alive) return
        const excl = new Set(excludeRecipeIds)
        const out: Suggestion[] = []
        for (const r of (data ?? []) as any[]) {
          if (excl.has(r.id)) continue
          if (!hasActivePromo(r.promo_products)) continue
          const shared = new Map<string, string>()
          for (const ing of r.ingredients ?? []) {
            const k = norm(ing.name)
            if (k && target.has(k) && !shared.has(k)) shared.set(k, ing.name)
          }
          if (shared.size < 1) continue
          const store = Array.isArray(r.store) ? r.store[0] : r.store
          out.push({
            id: r.id,
            slug: r.slug,
            title: r.title,
            image_url: r.image_url,
            store_name: store?.name ?? null,
            price_total: r.price_total,
            shared: [...shared.values()],
          })
        }
        // Najwięcej wspólnych produktów pierwsze, przy remisie tańsze
        out.sort((a, b) => b.shared.length - a.shared.length || (a.price_total ?? 1e9) - (b.price_total ?? 1e9))
        setSuggestions(out.slice(0, 6))
        setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, excludeRecipeIds.join(',')])

  if (loading || suggestions.length === 0) return null

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-[#12b76a]" />
        <h2 className="text-xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>
          Wykorzystaj te same produkty
        </h2>
      </div>
      <p className="text-sm text-stone-500 mb-4">
        Te przepisy korzystają z produktów, które już masz na liście — jedno opakowanie może starczyć na kilka dań.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {suggestions.map((s) => (
          <Link
            key={s.id}
            href={`/przepis/${s.slug}`}
            className="group flex gap-3 bg-white rounded-2xl border border-stone-100 p-3 hover:border-[#12b76a] transition-colors"
          >
            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0">
              {s.image_url ? (
                <Image src={s.image_url} alt={s.title} fill className="object-cover transition-transform group-hover:scale-105" sizes="80px" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-50 to-stone-100">
                  <UtensilsCrossed className="w-6 h-6 text-[#12b76a]" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-stone-800 line-clamp-2 group-hover:text-amber-600 transition-colors">{s.title}</p>
              <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                {s.store_name && <span>{s.store_name}</span>}
                {s.price_total != null && <span className="font-semibold text-amber-600">{formatPrice(s.price_total)}</span>}
              </div>
              <div className="mt-1.5 flex items-start gap-1">
                <Recycle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex flex-wrap gap-1">
                  {s.shared.slice(0, 3).map((n) => (
                    <span key={n} className="text-[11px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">
                      {n}
                    </span>
                  ))}
                  {s.shared.length > 3 && <span className="text-[11px] text-stone-400">+{s.shared.length - 3}</span>}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
