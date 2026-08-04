import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { fetchRecipes } from '@/lib/recipeQuery'
import { expiredRecipeIds, CATALOG_TAG } from '@/lib/promoVisibility'
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
