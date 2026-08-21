import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { fetchRecipes } from '@/lib/recipeQuery'
import { expiredRecipeIds, CATALOG_TAG } from '@/lib/promoVisibility'
import { soonestPromoEnd } from '@/lib/savings'
import { promoDaysLeft } from '@/lib/utils'
import { dishOfTitle } from '@/lib/popularDishes'
import type { Store, Category } from '@/types'

// Dane, które NIE zależą od filtrów: sklepy, kategorie, przepis na afiszu,
// najtańsze, liczniki per sklep. Bez cache każdy klik w filtr odpytywał
// Supabase o to wszystko od nowa — stąd wrażenie przeładowywania całej strony.
export { CATALOG_TAG }
const OPTS = { revalidate: 300, tags: [CATALOG_TAG] }

export const cachedStores = unstable_cache(
  async (): Promise<Store[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase.from('stores').select('*').eq('is_active', true).order('sort_order')
    return (data ?? []) as Store[]
  },
  ['katalog-sklepy'],
  OPTS
)

export const cachedCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const supabase = createPublicClient()
    const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order')
    return (data ?? []) as Category[]
  },
  ['katalog-kategorie'],
  OPTS
)

// Jedno zapytanie obsługuje i afisz, i sekcję „Najtańsze” — bez duplikatu.
export const cachedCheapest = unstable_cache(
  async (): Promise<any[]> => {
    const supabase = createPublicClient()
    const { recipes } = await fetchRecipes(supabase, { sort: 'cheap', limit: 7 })
    return recipes
  },
  ['katalog-najtansze'],
  OPTS
)

// „Ostatnia szansa" — przepisy, których promocja kończy się dziś lub jutro.
// Wygaśnięcie ukrywa przepis z serwisu, więc to realnie ostatni moment na ugotowanie.
export const ENDING_SOON_DAYS = 1

export const cachedEndingSoon = unstable_cache(
  async (): Promise<any[]> => {
    const supabase = createPublicClient()
    // Szersze okno niż wynik: filtrujemy po dacie dopiero w JS, bo najbliższy koniec
    // promocji trzeba policzyć z listy promo_products, a nie z kolumny przepisu.
    const { recipes } = await fetchRecipes(supabase, { sort: 'cheap', limit: 100 })
    return recipes
      .map((r: any) => ({ recipe: r, end: soonestPromoEnd(r.promo_products) }))
      .filter((x) => x.end != null && promoDaysLeft(x.end!) <= ENDING_SOON_DAYS)
      .sort((a, b) => a.end!.localeCompare(b.end!))
      .slice(0, 6)
      .map((x) => x.recipe)
  },
  ['katalog-konczace-sie'],
  OPTS
)

export const cachedStoreCounts = unstable_cache(
  async (): Promise<[string, number][]> => {
    const supabase = createPublicClient()
    const hidden = new Set(await expiredRecipeIds())
    const { data } = await supabase.from('recipes').select('id, store_id').eq('is_published', true)
    const counts = new Map<string, number>()
    for (const r of data ?? []) {
      if (!r.store_id || hidden.has(r.id)) continue
      counts.set(r.store_id, (counts.get(r.store_id) ?? 0) + 1)
    }
    return Array.from(counts.entries())
  },
  ['katalog-liczniki'],
  OPTS
)

// Karuzela klasykow na stronie glownej.
// Pokazujemy tylko te z najpopularniejszych polskich dan, ktore realnie udalo sie
// odtworzyc z gazetek. Ponizej progu modul sie nie renderuje - trzy przypadkowe
// pozycje pod naglowkiem "Najpopularniejsze dania" wygladaja jak bledna strona,
// a nie jak wybor redakcji.
export const MIN_POPULAR_DISHES = 4

export const cachedPopularDishes = unstable_cache(
  async (): Promise<any[]> => {
    const supabase = createPublicClient()
    const { recipes } = await fetchRecipes(supabase, { sort: 'cheap', limit: 120 })

    // Jeden przepis na danie. Piec schabowych obok siebie to nie karuzela klasykow,
    // tylko lista schabowych - a fetchRecipes sortuje po cenie, wiec pierwszy
    // napotkany wariant kazdego dania jest zarazem najtanszy.
    const best = new Map<string, { recipe: any; ranga: number }>()
    for (const r of recipes) {
      const dish = dishOfTitle(r.title ?? '')
      if (!dish || best.has(dish.nazwa)) continue
      best.set(dish.nazwa, { recipe: r, ranga: dish.ranga })
    }

    return [...best.values()]
      .sort((a, b) => b.ranga - a.ranga)
      .slice(0, 12)
      .map((x) => x.recipe)
  },
  ['katalog-popularne-dania'],
  OPTS
)
