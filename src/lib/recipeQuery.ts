import { expiredRecipeIds } from '@/lib/promoVisibility'
import { dedupeRecipes } from '@/lib/recipeDedupe'
import { hasActivePromo } from '@/lib/utils'
import { favoriteCounts } from '@/lib/favoriteCounts'

const NO_MATCH = ['00000000-0000-0000-0000-000000000000']

export interface RecipeCriteria {
  storeSlug?: string
  categorySlug?: string
  maxPrice?: number
  maxTime?: number
  difficulty?: string
  sort?: 'new' | 'cheap' | 'fast'
  limit?: number
}

// Wspólne pobieranie przepisów: opublikowane, bez wygasłych promocji, wg kryteriów.
export async function fetchRecipes(supabase: any, c: RecipeCriteria = {}) {
  const hidden = await expiredRecipeIds()

  let query = supabase
    .from('recipes')
    .select(
      `*, store:stores(*), categories:recipe_categories(category:categories(*)), promo_products(*)`,
      { count: 'exact' }
    )
    .eq('is_published', true)
    // Bez ceny przepis nie ma sensu w tej aplikacji — nie pokazujemy niedokończonych
    .gt('price_total', 0)

  if (hidden.length > 0) query = query.not('id', 'in', `(${hidden.join(',')})`)

  if (c.sort === 'cheap') query = query.order('price_total', { ascending: true, nullsFirst: false })
  else if (c.sort === 'fast') query = query.order('prep_time_min', { ascending: true, nullsFirst: false })
  else query = query.order('created_at', { ascending: false })

  if (c.maxPrice) query = query.lte('price_total', c.maxPrice)
  if (c.maxTime) query = query.lte('prep_time_min', c.maxTime)
  if (c.difficulty) query = query.eq('difficulty', c.difficulty)

  if (c.storeSlug) {
    const { data: s } = await supabase.from('stores').select('id').eq('slug', c.storeSlug).maybeSingle()
    query = s ? query.eq('store_id', s.id) : query.in('id', NO_MATCH)
  }

  if (c.categorySlug) {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', c.categorySlug).maybeSingle()
    if (cat) {
      const { data: rc } = await supabase.from('recipe_categories').select('recipe_id').eq('category_id', cat.id)
      const ids = (rc ?? []).map((r: any) => r.recipe_id)
      query = query.in('id', ids.length > 0 ? ids : NO_MATCH)
    } else {
      query = query.in('id', NO_MATCH)
    }
  }

  const lim = c.limit ?? 12
  const [{ data, count }, favEntries] = await Promise.all([
    query.range(0, lim - 1),
    favoriteCounts(),
  ])
  const favCounts = new Map(favEntries)
  const mapped = (data ?? [])
    // Rdzeń serwisu: pokazujemy tylko przepisy z trwającą promocją
    .filter((r: any) => hasActivePromo(r.promo_products))
    .map((r: any) => ({
      ...r,
      categories: r.categories?.map((rc: any) => rc.category).filter(Boolean) ?? [],
      favorite_count: favCounts.get(r.id) ?? 0,
    }))
  // To samo danie w kilku wariantach tytułu pokazujemy raz
  const recipes = dedupeRecipes(mapped)
  const removed = mapped.length - recipes.length
  return { recipes, total: Math.max(0, (count ?? mapped.length) - removed) }
}

