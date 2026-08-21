import { createClient } from '@/lib/supabase/server'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import { RecipeFilters } from '@/components/recipe/RecipeFilters'
import { RecentlyViewed } from '@/components/recipe/RecentlyViewed'
import { RecipeCarousel } from '@/components/recipe/RecipeCarousel'
import { FilterTransitionProvider, ResultsPending } from '@/components/recipe/FilterTransition'
import { expiredRecipeIds } from '@/lib/promoVisibility'
import { dedupeRecipes } from '@/lib/recipeDedupe'
import { hasActivePromo, promoDaysLeft } from '@/lib/utils'
import { savingsPercent, soonestPromoEnd } from '@/lib/savings'
import { favoriteCounts } from '@/lib/favoriteCounts'
import { cachedStores, cachedCategories, cachedCheapest, cachedEndingSoon, ENDING_SOON_DAYS, cachedPopularDishes, MIN_POPULAR_DISHES } from '@/lib/catalog'
import { AdSlot } from '@/components/ads/AdSlot'
import { Flame, Hourglass, ChefHat } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import type { Store, Category } from '@/types'

const PAGE_SIZE = 12
// Ile przepisów przejrzeć przy sortowaniu „Największa oszczędność". Pula aktywnych
// promocji jest z natury mała (wygasają), więc jedno okno wystarcza na cały ranking.
const SAVINGS_WINDOW = 200

type SearchParams = {
  store?: string; category?: string; difficulty?: string; search?: string
  limit?: string; sort?: string; maxPrice?: string; airfryer?: string; ending?: string
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

function CarouselSkeleton() {
  return (
    <div className="mb-10" aria-hidden="true">
      <div className="h-6 w-56 rounded bg-stone-100 animate-pulse mb-4" />
      <div className="flex gap-5 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="shrink-0 w-[17rem] sm:w-[19rem] rounded-2xl bg-stone-50 animate-pulse h-[22rem]" />
        ))}
      </div>
    </div>
  )
}

// Rezerwuje wysokość sekcji, żeby treść nie doskakiwała po dociągnięciu danych.
function SectionSkeleton({ height }: { height: number }) {
  return (
    <div className="mb-10" aria-hidden="true">
      <div className="h-6 w-56 rounded bg-stone-100 animate-pulse mb-4" />
      <div className="rounded-2xl bg-stone-50 animate-pulse" style={{ height }} />
    </div>
  )
}


// Karuzela klasyków. Moduł pojawia się dopiero, gdy uda się odtworzyć sensowną
// liczbę popularnych dań — trzy przypadkowe pozycje pod takim nagłówkiem wyglądają
// jak niedokończona strona, a nie jak wybór redakcji.
async function PopularDishesSection() {
  const recipes = await cachedPopularDishes()
  if (recipes.length < MIN_POPULAR_DISHES) return null
  return (
    <RecipeCarousel
      title="Klasyczne dania"
      recipes={recipes}
      icon={<ChefHat className="w-5 h-5 text-[#12b76a]" />}
    />
  )
}

async function CheapestSection() {
  const [all, popular] = await Promise.all([cachedCheapest(), cachedPopularDishes()])
  // Bez powtórek tego, co stoi już w karuzelI wyżej — ale tylko wtedy, gdy karuzela
  // faktycznie się renderuje. Poniżej progu jest ukryta, więc nie ma czego odejmować.
  const wKaruzeli = new Set(
    popular.length >= MIN_POPULAR_DISHES ? popular.map((r: any) => r.id) : []
  )
  const recipes = all.filter((r: any) => !wKaruzeli.has(r.id)).slice(0, 6)
  if (recipes.length === 0) return null
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-[#12b76a]" />
        <h2 className="text-xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>Najtańsze w tym tygodniu</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {recipes.map((r: any, i: number) => <RecipeCard key={r.id} recipe={r} index={i} />)}
      </div>
    </section>
  )
}

// Promocje wygasają i zabierają przepis ze sobą — zamiast to ukrywać, robimy z tego
// argument: „ugotuj dziś, jutro tej ceny już nie będzie".
async function EndingSoonSection() {
  const recipes = await cachedEndingSoon()
  if (recipes.length === 0) return null
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-1">
        <Hourglass className="w-5 h-5 text-orange-500" />
        <h2 className="text-xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>
          Ostatnia szansa
        </h2>
      </div>
      <p className="text-sm text-stone-500 mb-4">
        Promocje kończą się dziś lub jutro — potem te przepisy znikną z serwisu.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {recipes.map((r: any, i: number) => <RecipeCard key={r.id} recipe={r} index={i} />)}
      </div>
    </section>
  )
}

async function Results({ params, stores, categories }: { params: SearchParams; stores: Store[]; categories: Category[] }) {
  const supabase = await createClient()
  const hidden = await expiredRecipeIds()

  const parsedLimit = parseInt(params.limit ?? '', 10)
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 120) : PAGE_SIZE
  const sort = params.sort ?? 'cheap'
  const maxPrice = params.maxPrice ? parseInt(params.maxPrice, 10) : undefined
  const noMatch = ['00000000-0000-0000-0000-000000000000']

  let query = supabase
    .from('recipes')
    .select(`*, store:stores(*), categories:recipe_categories(category:categories(*)), promo_products(*)`, { count: 'exact' })
    .eq('is_published', true)
    // Bez ceny przepis nie ma sensu w tej aplikacji — nie pokazujemy niedokończonych
    .gt('price_total', 0)

  if (hidden.length > 0) query = query.not('id', 'in', `(${hidden.join(',')})`)

  // „Największa oszczędność" liczy się z promo_products, więc nie da się jej posortować
  // w SQL — pobieramy szersze okno i układamy w JS (patrz SAVINGS_WINDOW niżej).
  if (sort === 'cheap') query = query.order('price_total', { ascending: true, nullsFirst: false })
  else if (sort === 'fast') query = query.order('prep_time_min', { ascending: true, nullsFirst: false })
  else query = query.order('created_at', { ascending: false })

  if (maxPrice) query = query.lte('price_total', maxPrice)
  if (params.store) {
    const wanted = new Set(params.store.split(',').filter(Boolean))
    const ids = stores.filter((s) => wanted.has(s.slug)).map((s) => s.id)
    if (ids.length > 0) query = query.in('store_id', ids)
    else query = query.in('id', noMatch)
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

  // Filtr „Airfryer”: przepisy wspominające airfryer / frytkownicę beztłuszczową
  // w tytule, opisie albo krokach. Działa automatycznie, gdy AI wygeneruje takie dania.
  if (params.airfryer) {
    const { data: stepMatch } = await supabase
      .from('recipe_steps')
      .select('recipe_id')
      .or('description.ilike.%airfr%,description.ilike.%air fry%,description.ilike.%frytkownic%,description.ilike.%beztłuszcz%')
    const stepIds = Array.from(new Set((stepMatch ?? []).map((r: any) => r.recipe_id).filter(Boolean)))
    const orParts = [
      'title.ilike.%airfr%',
      'title.ilike.%frytkownic%',
      'description.ilike.%airfr%',
      'description.ilike.%frytkownic%',
      'description.ilike.%beztłuszcz%',
    ]
    if (stepIds.length > 0) orParts.push(`id.in.(${stepIds.join(',')})`)
    query = query.or(orParts.join(','))
  }

  // Sortowanie po oszczędności i filtr „Kończy się" działają na danych z promo_products,
  // więc liczymy je w JS. Wymaga to szerszej puli — inaczej posortowalibyśmy albo
  // odfiltrowali tylko przypadkową pierwszą stronę.
  const needsWideWindow = sort === 'savings' || !!params.ending
  const fetchLimit = needsWideWindow ? Math.max(limit, SAVINGS_WINDOW) : limit

  const [{ data: rawRecipes, count }, favEntries] = await Promise.all([
    query.range(0, fetchLimit - 1),
    favoriteCounts(),
  ])
  const favCounts = new Map(favEntries)
  const mapped = (rawRecipes ?? [])
    // Rdzeń serwisu: pokazujemy tylko przepisy z trwającą promocją
    .filter((r: any) => hasActivePromo(r.promo_products))
    .map((r: any) => ({
      ...r,
      categories: r.categories?.map((rc: any) => rc.category).filter(Boolean) ?? [],
      favorite_count: favCounts.get(r.id) ?? 0,
    }))
  // To samo danie w kilku wariantach tytułu pokazujemy raz
  const dedupedAll = dedupeRecipes(mapped)
  // Filtr „Kończy się" — po stronie JS, bo data wygaśnięcia jest w promo_products
  const deduped = params.ending
    ? dedupedAll.filter((r: any) => {
        const end = soonestPromoEnd(r.promo_products)
        return end != null && promoDaysLeft(end) <= ENDING_SOON_DAYS
      })
    : dedupedAll

  const ordered =
    sort === 'savings'
      ? [...deduped].sort(
          (a: any, b: any) =>
            savingsPercent(b.price_total, b.promo_products) -
            savingsPercent(a.price_total, a.promo_products)
        )
      : deduped
  const recipes = ordered.slice(0, limit)

  // Przy szerokim oknie znamy dokładną liczbę pasujących; inaczej opieramy się
  // na liczniku z bazy skorygowanym o odrzucone duplikaty.
  const total = needsWideWindow
    ? ordered.length
    : Math.max(0, (count ?? mapped.length) - (mapped.length - deduped.length))
  const hasMore = recipes.length < total

  const moreParams = new URLSearchParams()
  for (const k of ['store', 'category', 'difficulty', 'search', 'sort', 'maxPrice', 'airfryer', 'ending'] as const) {
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
  // Sklepy i kategorie nie zależą od filtrów — lecą z cache, nie z bazy przy każdym kliknięciu
  const [stores, categories] = await Promise.all([cachedStores(), cachedCategories()])

  // Po zawężeniu wyników sekcje polecane („Klasyczne dania", „Ostatnia szansa",
  // „Najtańsze") ignorowałyby filtr i mieszały do wyników przepisy, których
  // użytkownik właśnie nie chciał. Przy aktywnym filtrze pokazujemy samą siatkę.
  const filtered = Boolean(
    params.store || params.category || params.difficulty || params.search ||
    params.maxPrice || params.airfryer || params.ending
  )

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Nagłówek zszedł z ekranu na rzecz miejsca na przepisy, ale h1 zostaje
            dla wyszukiwarek i czytników ekranu — sr-only nie zajmuje ani piksela.
            Strona bez h1 traci w Google, a to jedyne źródło ruchu tego serwisu. */}
        <h1 className="sr-only">Przepisy z gazetek promocyjnych — tanie obiady z aktualnych promocji</h1>

        {/* Filtry i wyniki dzielą jeden stan przejścia: klik od razu przygasza
            siatkę i pokazuje spinner, zamiast zostawiać stronę bez reakcji. */}
        <FilterTransitionProvider>
          {/* Sklepy i filtry na samej górze — jako główna nawigacja, nad afiszem */}
          <Suspense>
            <div className="mb-8 bg-white rounded-2xl p-3 sm:p-5 border border-stone-100 sticky top-16 z-40">
              <RecipeFilters stores={stores ?? []} categories={categories ?? []} />
            </div>
          </Suspense>

          {/* Klasyki pod filtrami — moduł znika, gdy nie ma czego pokazać */}
          {!filtered && (
            <Suspense fallback={<CarouselSkeleton />}>
              <PopularDishesSection />
            </Suspense>
          )}

          {/* Pilność ponad siatką — wygasające promocje są najkrócej dostępne */}
          {!filtered && (
            <Suspense fallback={<SectionSkeleton height={320} />}>
              <EndingSoonSection />
            </Suspense>
          )}

          <h2 className="text-xl font-bold text-stone-900 mb-5" style={{ fontFamily: 'var(--font-serif)' }}>
            {filtered ? 'Wyniki' : 'Przepisy z promocji'}
          </h2>

          {/* Bez key: React trzyma poprzednią siatkę do czasu gotowości nowej,
              więc nic nie mruga szkieletem przy każdym kliknięciu. */}
          <ResultsPending>
            <Suspense fallback={<GridSkeleton />}>
              <Results params={params} stores={stores ?? []} categories={categories ?? []} />
            </Suspense>
          </ResultsPending>
        </FilterTransitionProvider>

        <AdSlot className="mt-10" />

        {/* Najtańsze — jedyna sekcja stała pod siatką. Kolekcje i linki kategorii
            usunięte: kategorie są już w filtrach, więc dublowały nawigację. */}
        {!filtered && (
          <div className="mt-14">
            <Suspense fallback={<SectionSkeleton height={320} />}><CheapestSection /></Suspense>
          </div>
        )}

        <RecentlyViewed />
      </div>
    </div>
  )
}
