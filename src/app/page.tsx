import { createClient } from '@/lib/supabase/server'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import { RecipeFilters } from '@/components/recipe/RecipeFilters'
import { SearchBar } from '@/components/recipe/SearchBar'
import { RecentlyViewed } from '@/components/recipe/RecentlyViewed'
import { CategoryIcon } from '@/components/recipe/CategoryIcon'
import { expiredRecipeIds } from '@/lib/promoVisibility'
import { fetchRecipes, storeRecipeCounts } from '@/lib/recipeQuery'
import { COLLECTIONS } from '@/lib/collections'
import { storeColor } from '@/lib/stores'
import { AdSlot } from '@/components/ads/AdSlot'
import { Flame, Store as StoreIcon, LayoutGrid, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import type { Store, Category } from '@/types'

const PAGE_SIZE = 12

type SearchParams = {
  store?: string; category?: string; difficulty?: string; search?: string
  limit?: string; sort?: string; maxPrice?: string
}

interface HomeProps {
  searchParams: Promise<SearchParams>
}

function pluralPrzepis(n: number): string {
  return `${n} przepis${n === 1 ? '' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'y' : 'ów'}`
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

function PlanBanner() {
  return (
    <Link href="/plan" className="flex items-center gap-4 rounded-2xl p-5 mb-10 transition-colors hover:brightness-[0.98]" style={{ background: '#e8f3ff' }}>
      <div className="w-11 h-11 rounded-xl bg-[#1595ff] text-white flex items-center justify-center flex-shrink-0">
        <CalendarDays className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-stone-900">Zaplanuj tydzień → gotowa lista zakupów</div>
        <div className="text-sm text-stone-600">Jedno opakowanie na kilka dań, koszt dzielony między przepisy.</div>
      </div>
      <span className="hidden sm:inline-flex btn-primary flex-shrink-0">Zacznij</span>
    </Link>
  )
}

async function CheapestSection() {
  const supabase = await createClient()
  const { recipes } = await fetchRecipes(supabase, { sort: 'cheap', limit: 6 })
  if (recipes.length === 0) return null
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-[#1595ff]" />
        <h2 className="text-xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>Najtańsze w tym tygodniu</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {recipes.map((r: any, i: number) => <RecipeCard key={r.id} recipe={r} index={i} />)}
      </div>
    </section>
  )
}

async function StoreTiles({ stores }: { stores: Store[] }) {
  const supabase = await createClient()
  const counts = await storeRecipeCounts(supabase)
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <StoreIcon className="w-5 h-5 text-[#1595ff]" />
        <h2 className="text-xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>Promocje wg sklepu</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stores.map((s) => {
          const n = counts.get(s.id) ?? 0
          const color = s.color ?? storeColor(s.slug)
          return (
            <Link key={s.id} href={`/sklep/${s.slug}`} className="flex items-center gap-3 bg-white rounded-2xl border border-stone-100 p-4 hover:border-stone-300 transition-colors">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <div className="min-w-0">
                <div className="font-semibold text-stone-800 text-sm truncate">{s.name}</div>
                <div className="text-xs text-stone-400">{pluralPrzepis(n)}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function CollectionsSection() {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <LayoutGrid className="w-5 h-5 text-[#1595ff]" />
        <h2 className="text-xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>Kolekcje</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {COLLECTIONS.map((c) => (
          <Link key={c.slug} href={`/kolekcja/${c.slug}`} className="bg-white rounded-2xl border border-stone-100 p-4 hover:border-[#1595ff] transition-colors">
            <div className="font-semibold text-stone-800">{c.title}</div>
            <div className="text-xs text-stone-500 mt-0.5 line-clamp-2">{c.description}</div>
          </Link>
        ))}
      </div>
    </section>
  )
}

async function Results({ params, stores, categories }: { params: SearchParams; stores: Store[]; categories: Category[] }) {
  const supabase = await createClient()
  const hidden = await expiredRecipeIds(supabase)

  const parsedLimit = parseInt(params.limit ?? '', 10)
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 120) : PAGE_SIZE
  const sort = params.sort ?? 'new'
  const maxPrice = params.maxPrice ? parseInt(params.maxPrice, 10) : undefined
  const noMatch = ['00000000-0000-0000-0000-000000000000']

  let query = supabase
    .from('recipes')
    .select(`*, store:stores(*), categories:recipe_categories(category:categories(*)), promo_products(*)`, { count: 'exact' })
    .eq('is_published', true)

  if (hidden.length > 0) query = query.not('id', 'in', `(${hidden.join(',')})`)

  if (sort === 'cheap') query = query.order('price_total', { ascending: true, nullsFirst: false })
  else if (sort === 'fast') query = query.order('prep_time_min', { ascending: true, nullsFirst: false })
  else query = query.order('created_at', { ascending: false })

  if (maxPrice) query = query.lte('price_total', maxPrice)
  if (params.store) {
    const store = stores.find((s) => s.slug === params.store)
    if (store) query = query.eq('store_id', store.id)
  }
  if (params.difficulty) query = query.eq('difficulty', params.difficulty)

  if (params.search) {
    const q = params.search.trim().replace(/[,()]/g, ' ').trim()
    if (q) {
      const { data: ingMatch } = await supabase.from('ingredients').select('recipe_id').ilike('name', `%${q}%`)
      const ingIds = Array.from(new Set((ingMatch ?? []).map((r: any) => r.recipe_id).filter(Boolean)))
      const orParts = [`title.ilike.*${q}*`, `description.ilike.*${q}*`]
      if (ingIds.length > 0) orParts.push(`id.in.(${ingIds.join(',')})`)
      query = query.or(orParts.join(','))
    }
  }

  if (params.category) {
    const cat = categories.find((c) => c.slug === params.category)
    if (cat) {
      const { data: rc } = await supabase.from('recipe_categories').select('recipe_id').eq('category_id', cat.id)
      const ids = (rc ?? []).map((r: any) => r.recipe_id)
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
  for (const k of ['store', 'category', 'difficulty', 'search', 'sort', 'maxPrice'] as const) {
    if (params[k]) moreParams.set(k, params[k]!)
  }
  moreParams.set('limit', String(limit + PAGE_SIZE))

  if (recipes.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#44403c' }}>Brak wyników</h2>
        <p style={{ color: '#78716c' }}>Spróbuj zmienić filtry lub podnieść limit ceny.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: '#78716c' }}>
          {pluralPrzepis(total)}
          {maxPrice && <span> do {maxPrice} zł</span>}
          {params.search && <span style={{ color: '#1c1917', fontWeight: 600 }}> dla „{params.search}"</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {recipes.map((recipe: any, i: number) => <RecipeCard key={recipe.id} recipe={recipe} index={i} />)}
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

  const noFilters =
    !params.store && !params.category && !params.difficulty && !params.search &&
    !params.sort && !params.maxPrice && !params.limit

  const resultsKey = `${params.store ?? ''}|${params.category ?? ''}|${params.difficulty ?? ''}|${params.search ?? ''}|${params.sort ?? ''}|${params.maxPrice ?? ''}|${params.limit ?? ''}`

  return (
    <div>
      {/* Hero: wyszukiwarka + szybkie chipy cenowe */}
      <section style={{ background: 'linear-gradient(135deg, #e8f3ff 0%, #d0e8ff 50%, #faf9f6 100%)' }} className="py-6">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-2xl">
            <Suspense>
              <SearchBar />
            </Suspense>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Sekcje kuratorskie — tylko na widoku domyślnym */}
        {noFilters && (
          <>
            <PlanBanner />
            <Suspense><CheapestSection /></Suspense>
            <Suspense><StoreTiles stores={stores ?? []} /></Suspense>
            <CollectionsSection />
          </>
        )}

        {/* Filtry */}
        <Suspense>
          <div className="mb-8 bg-white/95 backdrop-blur rounded-2xl p-5 border border-stone-100 md:sticky md:top-16 md:z-30">
            <RecipeFilters stores={stores ?? []} categories={categories ?? []} />
          </div>
        </Suspense>

        {noFilters && (
          <h2 className="text-xl font-bold text-stone-900 mb-5" style={{ fontFamily: 'var(--font-serif)' }}>Wszystkie przepisy</h2>
        )}

        {/* Wyniki */}
        <Suspense key={resultsKey} fallback={<GridSkeleton />}>
          <Results params={params} stores={stores ?? []} categories={categories ?? []} />
        </Suspense>

        <AdSlot className="mt-10" />

        {/* Linki SEO — kategorie i kolekcje */}
        <section className="mt-14 pt-8 border-t border-stone-100">
          <h2 className="text-lg font-bold text-stone-800 mb-3" style={{ fontFamily: 'var(--font-serif)' }}>Przepisy według kategorii</h2>
          <div className="flex flex-wrap gap-2 mb-6">
            {(categories ?? []).map((c) => (
              <Link key={c.id} href={`/kategoria/${c.slug}`} className="category-pill">
                <CategoryIcon slug={c.slug} className="w-3.5 h-3.5 text-[#1595ff]" />
                {c.name}
              </Link>
            ))}
          </div>
          <h2 className="text-lg font-bold text-stone-800 mb-3" style={{ fontFamily: 'var(--font-serif)' }}>Kolekcje</h2>
          <div className="flex flex-wrap gap-2">
            {COLLECTIONS.map((c) => (
              <Link key={c.slug} href={`/kolekcja/${c.slug}`} className="category-pill">{c.title}</Link>
            ))}
          </div>
        </section>

        <RecentlyViewed />
      </div>
    </div>
  )
}
