import { expiredRecipeIds } from '@/lib/promoVisibility'

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
  const hidden = await expiredRecipeIds(supabase)

  let query = supabase
    .from('recipes')
    .select(
      `*, store:stores(*), categories:recipe_categories(category:categories(*)), promo_products(*)`,
      { count: 'exact' }
    )
    .eq('is_published', true)

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
  const { data, count } = await query.range(0, lim - 1)
  const recipes = (data ?? []).map((r: any) => ({
    ...r,
    categories: r.categories?.map((rc: any) => rc.category).filter(Boolean) ?? [],
  }))
  return { recipes, total: count ?? recipes.length }
}

// Liczba opublikowanych (nie wygasłych) przepisów per sklep
export async function storeRecipeCounts(supabase: any): Promise<Map<string, number>> {
  const hidden = new Set(await expiredRecipeIds(supabase))
  const { data } = await supabase.from('recipes').select('id, store_id').eq('is_published', true)
  const counts = new Map<string, number>()
  for (const r of data ?? []) {
    if (!r.store_id || hidden.has(r.id)) continue
    counts.set(r.store_id, (counts.get(r.store_id) ?? 0) + 1)
  }
  return counts
}
