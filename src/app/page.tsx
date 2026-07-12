import { createClient } from '@/lib/supabase/server'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import { RecipeFilters } from '@/components/recipe/RecipeFilters'
import { SearchBar } from '@/components/recipe/SearchBar'
import { RecentlyViewed } from '@/components/recipe/RecentlyViewed'
import { AdSlot } from '@/components/ads/AdSlot'
import Link from 'next/link'
import { Suspense } from 'react'
import type { Store, Category } from '@/types'

const PAGE_SIZE = 12

type SearchParams = { store?: string; category?: string; difficulty?: string; search?: string; limit?: string; sort?: string }

interface HomeProps {
  searchParams: Promise<SearchParams>
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <div className="aspect-[4/3] bg-stone-100 animate-pulse" />
          <div className="p-4 space-y-3">
            <div className="h-3 w-20 rounded-full bg-stone-100 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-stone-100 animate-pulse" />
            <div className="h-3 w-full rounded bg-stone-100 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-stone-100 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

async function Results({ params, stores, categories }: { params: SearchParams; stores: Store[]; categories: Category[] }) {
  const supabase = await createClient()

  const parsedLimit = parseInt(params.limit ?? '', 10)
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 120) : PAGE_SIZE

  const sort = params.sort ?? 'new'
  const noMatch = ['00000000-0000-0000-0000-000000000000']

  let query = supabase
    .from('recipes')
    .select(
      `*, store:stores(*), categories:recipe_categories(category:categories(*)), promo_products(*)`,
      { count: 'exact' }
    )
    .eq('is_published', true)

  if (sort === 'cheap') query = query.order('price_total', { ascending: true, nullsFirst: false })
  else if (sort === 'fast') query = query.order('prep_time_min', { ascending: true, nullsFirst: false })
  else query = query.order('created_at', { ascending: false })

  if (params.store) {
    const store = stores.find((s) => s.slug === params.store)
    if (store) query = query.eq('store_id', store.id)
  }
  if (params.difficulty) query = query.eq('difficulty', params.difficulty)

  // Wyszukiwanie: nazwa + opis przepisu ORAZ nazwy składników (ilike, działa też po polsku)
  if (params.search) {
    const q = params.search.trim().replace(/[,()]/g, ' ').trim()
    if (q) {
      const { data: ingMatch } = await supabase
        .from('ingredients')
        .select('recipe_id')
        .ilike('name', `%${q}%`)
      const ingIds = Array.from(new Set((ingMatch ?? []).map((r) => r.recipe_id).filter(Boolean)))
      const orParts = [`title.ilike.*${q}*`, `description.ilike.*${q}*`]
      if (ingIds.length > 0) orParts.push(`id.in.(${ingIds.join(',')})`)
      query = query.or(orParts.join(','))
    }
  }

  // Filtr kategorii po stronie serwera (przed limitem)
  if (params.category) {
    const cat = categories.find((c) => c.slug === params.category)
    if (cat) {
      const { data: rc } = await supabase.from('recipe_categories').select('recipe_id').eq('category_id', cat.id)
      const ids = (rc ?? []).map((r) => r.recipe_id)
      query = query.in('id', ids.length > 0 ? ids : noMatch)
    } else {
      query = query.in('id', noMatch)
    }
  }

  const { data: rawRecipes, count } = await query.range(0, limit - 1)
  const recipes = (rawRecipes ?? []).map((r: any) => ({
    ...r,
    categories: r.categories?.map((rc: any) => rc.category).filter(Boolean) ?? [],
  }))

  const total = count ?? recipes.length
  const hasMore = recipes.length < total

  const moreParams = new URLSearchParams()
  if (params.store) moreParams.set('store', params.store)
  if (params.category) moreParams.set('category', params.category)
  if (params.difficulty) moreParams.set('difficulty', params.difficulty)
  if (params.search) moreParams.set('search', params.search)
  if (params.sort) moreParams.set('sort', params.sort)
  moreParams.set('limit', String(limit + PAGE_SIZE))

  if (recipes.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#44403c' }}>Brak wyników</h2>
        <p style={{ color: '#78716c' }}>Spróbuj zmienić filtry lub wyszukaj inną frazę.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: '#78716c' }}>
          {`${total} przepis${total === 1 ? '' : total < 5 ? 'y' : 'ów'}`}
          {params.search && <span style={{ color: '#1c1917', fontWeight: 600 }}> dla „{params.search}"</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {recipes.map((recipe: any, i: number) => (
          <RecipeCard key={recipe.id} recipe={recipe} index={i} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-10">
          <Link href={`/?${moreParams.toString()}`} scroll={false} className="btn-outline">
            Pokaż więcej ({total - recipes.length})
          </Link>
        </div>
      )}
    </>
  )
}

export default async function HomePage({ searchParams }: HomeProps) {
  const params = await searchParams
  const supabase = await createClient()

  const [{ data: stores }, { data: categories }] = await Promise.all([
    supabase.from('stores').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
  ])

  const resultsKey = `${params.store ?? ''}|${params.category ?? ''}|${params.difficulty ?? ''}|${params.search ?? ''}|${params.sort ?? ''}|${params.limit ?? ''}`

  return (
    <div>
      {/* Pasek wyszukiwania + lokalizacja */}
      <section style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #faf9f6 100%)' }} className="py-6">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-3"
              style={{ background: '#dbeafe', color: '#1e40af' }}>
              📍 Cała Polska · aktualne promocje
            </div>
            <Suspense>
              <SearchBar />
            </Suspense>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Filtry — przyklejone pod nagłówkiem */}
        <Suspense>
          <div className="mb-8 bg-white/95 backdrop-blur rounded-2xl p-5 border border-stone-100 md:sticky md:top-16 md:z-30">
            <RecipeFilters stores={stores ?? []} categories={categories ?? []} />
          </div>
        </Suspense>

        {/* Wyniki — tylko ten obszar pokazuje skeleton przy filtrowaniu */}
        <Suspense key={resultsKey} fallback={<GridSkeleton />}>
          <Results params={params} stores={stores ?? []} categories={categories ?? []} />
        </Suspense>

        {/* Reklama (nieaktywna do czasu podłączenia AdSense + zgody) */}
        <AdSlot className="mt-10" />

        {/* Linki SEO — przeglądanie wg sklepu i kategorii */}
        <section className="mt-14 pt-8 border-t border-stone-100">
          <h2 className="text-lg font-bold text-stone-800 mb-3" style={{ fontFamily: 'var(--font-serif)' }}>
            Przepisy według sklepu
          </h2>
          <div className="flex flex-wrap gap-2 mb-6">
            {(stores ?? []).map((s) => (
              <Link key={s.id} href={`/sklep/${s.slug}`} className="category-pill">{s.name}</Link>
            ))}
          </div>
          <h2 className="text-lg font-bold text-stone-800 mb-3" style={{ fontFamily: 'var(--font-serif)' }}>
            Przepisy według kategorii
          </h2>
          <div className="flex flex-wrap gap-2">
            {(categories ?? []).map((c) => (
              <Link key={c.id} href={`/kategoria/${c.slug}`} className="category-pill">{c.icon} {c.name}</Link>
            ))}
          </div>
        </section>

        {/* Ostatnio oglądane */}
        <RecentlyViewed />
      </div>
    </div>
  )
}
