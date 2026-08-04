'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Heart, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { readFavorites, pruneFavorites, FAVORITES_EVENT } from '@/lib/favorites'
import { hasActivePromo } from '@/lib/utils'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import type { Recipe } from '@/types'

// Ulubione — pełne kafelki jak na stronie przepisów (RecipeCard).
// Dane przepisu (składniki, promocje, ceny) dociągamy z bazy po id z localStorage.
export default function FavoritesPage() {
  const [ids, setIds] = useState<string[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loaded, setLoaded] = useState(false)

  const sync = useCallback(() => {
    setIds(readFavorites().map((r) => r.id))
    setLoaded(true)
  }, [])

  useEffect(() => {
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    return () => window.removeEventListener(FAVORITES_EVENT, sync)
  }, [sync])

  const idsSig = ids.join(',')
  useEffect(() => {
    if (ids.length === 0) {
      setRecipes([])
      return
    }
    let alive = true
    createClient()
      .from('recipes')
      .select(
        `id, slug, title, description, image_url, prep_time_min, difficulty, price_total,
         store:stores(id, name, slug),
         categories:recipe_categories(category:categories(id, name, slug)),
         promo_products(*)`
      )
      .in('id', ids)
      .eq('is_published', true)
      .then(({ data }) => {
        if (!alive) return
        const rows = (data ?? []).map((r: any) => ({
          ...r,
          store: Array.isArray(r.store) ? r.store[0] : r.store,
          categories: (r.categories ?? []).map((rc: any) => rc.category).filter(Boolean),
        })) as any[]
        // Pokazujemy tylko przepisy z aktywną promocją (spójnie z resztą serwisu).
        // Wygasłe/wyłączone znikają z ulubionych na stałe.
        const active = rows.filter((r) => hasActivePromo(r.promo_products))
        pruneFavorites(new Set(active.map((r) => r.id)))
        // Zachowaj kolejność z localStorage (najnowsze pierwsze)
        const order = new Map(ids.map((id, i) => [id, i]))
        active.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
        setRecipes(active as Recipe[])
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSig])

  if (!loaded) return null

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-amber-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Wróć do przepisów
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
          <Heart className="w-5 h-5 text-white fill-current" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>
            Ulubione
          </h1>
          {recipes.length > 0 && <p className="text-sm text-stone-500">{recipes.length} zapisanych przepisów</p>}
        </div>
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-stone-100">
          <div className="text-5xl mb-4">❤️</div>
          <h2 className="text-xl font-bold mb-2 text-stone-700">Brak ulubionych</h2>
          <p className="text-stone-400 mb-6">Kliknij serduszko na dowolnym przepisie, aby zapisać go tutaj.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors"
          >
            Przeglądaj przepisy
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recipes.map((r, i) => (
            <RecipeCard key={r.id} recipe={r} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
