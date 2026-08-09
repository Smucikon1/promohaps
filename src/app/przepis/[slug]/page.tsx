import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Clock, Flame, ShoppingBag, PiggyBank, Users, Wallet } from 'lucide-react'
import { formatPrice, formatTime, difficultyLabel, difficultyColor, isPromoActive, isPromoExpired, promoDaysLeft, hasActivePromo, pricePerServing } from '@/lib/utils'
import { totalSavings, savingsPercent } from '@/lib/savings'
import { storeColor } from '@/lib/stores'
import { ShoppingList } from '@/components/recipe/ShoppingList'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import { CategoryIcon } from '@/components/recipe/CategoryIcon'
import { RecipeActions } from '@/components/recipe/RecipeActions'
import { AdSlot } from '@/components/ads/AdSlot'
import { RecipeTracker } from '@/components/recipe/RecipeTracker'
import { RecordView } from '@/components/recipe/RecordView'
import { RecentlyViewed } from '@/components/recipe/RecentlyViewed'
import { dedupeRecipes, dishFingerprint } from '@/lib/recipeDedupe'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('recipes').select('title, meta_title, meta_description, image_url').eq('slug', slug).single()
  if (!data) return {}
  return {
    title: data.meta_title ?? data.title,
    description: data.meta_description,
    openGraph: { images: data.image_url ? [data.image_url] : [] },
  }
}

export default async function RecipePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: recipe } = await supabase
    .from('recipes')
    .select(`
      *,
      store:stores(*),
      categories:recipe_categories(category:categories(*)),
      ingredients(*),
      steps:recipe_steps(*),
      promo_products(*)
    `)
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!recipe) notFound()

  // Wygasła choć jedna promocja => przepis znika ze strony (nieaktualne ceny)
  if ((recipe.promo_products ?? []).some((p: any) => isPromoExpired(p.valid_to))) notFound()

  const normalized = {
    ...recipe,
    categories: recipe.categories?.map((rc: any) => rc.category).filter(Boolean) ?? [],
    steps: [...(recipe.steps ?? [])].sort((a: any, b: any) => a.step_number - b.step_number),
    ingredients: [...(recipe.ingredients ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order),
  }

  const storeBg = storeColor(normalized.store?.slug)
  const activePromos = (normalized.promo_products ?? []).filter((p: any) => isPromoActive(p.valid_from, p.valid_to))

  // Ważność: najbliżej wygasająca promocja + wymóg karty lojalnościowej
  const soonestTo = activePromos.length
    ? activePromos.reduce((min: string, p: any) => (p.valid_to < min ? p.valid_to : min), activePromos[0].valid_to)
    : null
  const daysLeft = soonestTo ? promoDaysLeft(soonestTo) : null
  const urgencyLabel =
    daysLeft == null
      ? null
      : daysLeft === 0 ? 'kończy się dziś' : daysLeft === 1 ? 'kończy się jutro' : `kończy się za ${daysLeft} dni`
  const needsCard = activePromos.some((p: any) => p.condition_type === 'karta')
  const savings = totalSavings(normalized.promo_products)
  const percent = savingsPercent(normalized.price_total, normalized.promo_products)
  const perServing = pricePerServing(normalized.price_total, normalized.servings)

  // Powiązane przepisy z tego samego sklepu
  const { data: relatedRaw } = await supabase
    .from('recipes')
    .select('*, store:stores(*), promo_products(*)')
    .eq('is_published', true)
    // Bez ceny przepis nie ma sensu w tej aplikacji — nie pokazujemy niedokończonych
    .gt('price_total', 0)
    .eq('store_id', normalized.store_id)
    .neq('id', normalized.id)
    .order('created_at', { ascending: false })
    .limit(6)
  // Powiązane: bez wygasłych promocji, bez innego wariantu TEGO dania i bez duplikatów między sobą
  const currentDish = dishFingerprint(normalized.title)
  const related = dedupeRecipes(
    (relatedRaw ?? []).filter(
      (r: any) => hasActivePromo(r.promo_products) && dishFingerprint(r.title) !== currentDish
    )
  ).slice(0, 3)

  // "Podobne, ale taniej" — z tej samej kategorii, tańsze niż bieżący, dowolny sklep.
  // Podnosi PV/session (użytkownik klika dalej) → więcej wyświetleń reklam.
  const currentCatIds: string[] = normalized.categories.map((c: any) => c.id).filter(Boolean)
  const currentPrice = normalized.price_total ?? 999999
  let cheaper: any[] = []
  if (currentCatIds.length > 0 && currentPrice > 0) {
    const { data: cheaperRaw } = await supabase
      .from('recipes')
      .select('*, store:stores(*), categories:recipe_categories!inner(category:categories(*)), promo_products(*)')
      .eq('is_published', true)
      .gt('price_total', 0)
      .lt('price_total', currentPrice)
      .in('recipe_categories.category_id', currentCatIds)
      .neq('id', normalized.id)
      .order('price_total', { ascending: true })
      .limit(8)
    const cheaperNormalized = (cheaperRaw ?? []).map((r: any) => ({
      ...r,
      categories: r.categories?.map((rc: any) => rc.category).filter(Boolean) ?? [],
    }))
    cheaper = dedupeRecipes(
      cheaperNormalized.filter(
        (r: any) => hasActivePromo(r.promo_products) && dishFingerprint(r.title) !== currentDish
      )
    ).slice(0, 3)
  }

  const schemaOrg = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: normalized.title,
    description: normalized.description,
    image: normalized.image_url,
    prepTime: normalized.prep_time_min ? `PT${normalized.prep_time_min}M` : undefined,
    recipeYield: normalized.servings ? `${normalized.servings} porcji` : undefined,
    recipeIngredient: normalized.ingredients.map((i: any) => `${i.amount ?? ''} ${i.unit ?? ''} ${i.name}`.trim()),
    recipeInstructions: normalized.steps.map((s: any) => ({ '@type': 'HowToStep', text: s.description })),
  }

  const categoryChips = (light: boolean) =>
    normalized.categories.map((cat: any) => (
      <span
        key={cat.id}
        className={
          light
            ? 'inline-flex items-center gap-1.5 text-xs bg-white/20 text-white backdrop-blur-sm px-2.5 py-1 rounded-full'
            : 'inline-flex items-center gap-1.5 text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full'
        }
      >
        <CategoryIcon slug={cat.slug} className={light ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5 text-[#12b76a]'} />
        {cat.name}
      </span>
    ))

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }} />
      <RecipeTracker recipeId={normalized.id} storeId={normalized.store_id} />
      <RecordView
        recipe={{
          id: normalized.id,
          slug: normalized.slug,
          title: normalized.title,
          image_url: normalized.image_url,
          store_name: normalized.store?.name ?? null,
        }}
      />

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Hero */}
        {normalized.image_url ? (
          <div className="relative aspect-[16/10] sm:aspect-[16/8] rounded-3xl overflow-hidden bg-stone-100 mb-6">
            <Image src={normalized.image_url} alt={normalized.title} fill className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              {normalized.store && (
                <span className="store-badge" style={{ backgroundColor: storeBg }}>{normalized.store.name}</span>
              )}
            </div>
            {urgencyLabel && (
              <div className="absolute top-4 right-4 bg-amber-500 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow">
                🏷️ Promocja {urgencyLabel}
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
              <div className="flex flex-wrap gap-2 mb-3">{categoryChips(true)}</div>
              <h1 className="text-white text-3xl sm:text-4xl font-bold leading-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                {normalized.title}
              </h1>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {normalized.store && (
                <span className="store-badge" style={{ backgroundColor: storeBg }}>{normalized.store.name}</span>
              )}
              {categoryChips(false)}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-stone-900 leading-tight" style={{ fontFamily: 'var(--font-serif)' }}>
              {normalized.title}
            </h1>
          </div>
        )}

        {normalized.description && (
          <p className="text-stone-600 text-lg leading-relaxed mb-5">{normalized.description}</p>
        )}

        {/* Akcje przepisu (Wróć jest teraz pływający pod logotypem w layout) */}
        <div className="no-print flex flex-wrap items-center gap-3 mb-6">
          <RecipeActions
            recipe={{
              id: normalized.id,
              slug: normalized.slug,
              title: normalized.title,
              image_url: normalized.image_url,
              store_name: normalized.store?.name ?? null,
            }}
          />
          {urgencyLabel && soonestTo && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full">
              ⏳ Promocja {urgencyLabel} (do {new Date(soonestTo).toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' })})
            </span>
          )}
          {needsCard && (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-700 bg-purple-50 px-3 py-1.5 rounded-full">
              🪪 Część cen tylko z kartą sklepu
            </span>
          )}
        </div>

        {/* Pasek wartości */}
        <div className="flex flex-wrap items-stretch gap-y-4 bg-white rounded-2xl border border-stone-100 p-5 mb-8 divide-x divide-stone-100">
          {normalized.prep_time_min && (
            <div className="flex-1 min-w-[80px] px-4 first:pl-0 text-center">
              <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <div className="font-semibold text-stone-800">{formatTime(normalized.prep_time_min)}</div>
              <div className="text-xs text-stone-500">Czas</div>
            </div>
          )}
          {normalized.difficulty && (
            <div className="flex-1 min-w-[80px] px-4 text-center">
              <Flame className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <div className={`font-semibold inline-block px-2 rounded-full text-sm ${difficultyColor(normalized.difficulty)}`}>
                {difficultyLabel(normalized.difficulty)}
              </div>
              <div className="text-xs text-stone-500 mt-0.5">Trudność</div>
            </div>
          )}
          {normalized.servings && (
            <div className="flex-1 min-w-[80px] px-4 text-center">
              <Users className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <div className="font-semibold text-stone-800">{normalized.servings}</div>
              <div className="text-xs text-stone-500">{normalized.servings === 1 ? 'porcja' : normalized.servings < 5 ? 'porcje' : 'porcji'}</div>
            </div>
          )}
          {normalized.price_total && (
            <div className="flex-1 min-w-[80px] px-4 text-center">
              <ShoppingBag className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <div className="font-semibold text-stone-800">{formatPrice(normalized.price_total)}</div>
              <div className="text-xs text-stone-500">Koszt <span className="text-stone-400">(orientacyjny)</span></div>
            </div>
          )}
          {perServing && (
            <div className="flex-1 min-w-[80px] px-4 text-center">
              <Wallet className="w-5 h-5 text-[#12b76a] mx-auto mb-1" />
              <div className="font-bold text-[#12b76a] text-lg leading-tight">{formatPrice(perServing)}</div>
              <div className="text-xs text-stone-500">za porcję</div>
            </div>
          )}
          {percent > 0 && (
            <div className="flex-1 min-w-[80px] px-4 text-center">
              <PiggyBank className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <div className="font-extrabold text-green-700 text-lg leading-tight">−{percent}%</div>
              <div className="text-xs text-stone-500">taniej z gazetki</div>
            </div>
          )}
        </div>

        {percent > 0 && (
          <div className="mb-8 flex items-center gap-3 rounded-2xl bg-green-100 border border-green-200 px-4 py-3 shadow-sm">
            <PiggyBank className="w-6 h-6 text-green-700 flex-shrink-0" />
            <p className="text-sm text-green-900">
              Kupując produkty z gazetki, ten przepis wychodzi Cię o{' '}
              <span className="font-extrabold text-base">−{percent}%</span> taniej niż w standardowej cenie
              {perServing && <> — to <span className="font-extrabold">{formatPrice(perServing)} za porcję</span></>}.
            </p>
          </div>
        )}

        {/* Krótka nota o cenach — brak ryzyka roszczeń */}
        {normalized.price_total && (
          <p className="mb-6 text-[11px] text-stone-400 leading-relaxed">
            Ceny są <strong>orientacyjne</strong> — obliczone na podstawie cen z gazetek promocyjnych i typowych cen w polskich sklepach.
            Nie stanowią oferty handlowej; rzeczywista cena i dostępność mogą się różnić.
          </p>
        )}

        {/* Reklama (nieaktywna do czasu podłączenia AdSense + zgody) */}
        <AdSlot className="no-print mb-8" />

        <div className="grid md:grid-cols-3 gap-8 items-start">
          {/* Lista zakupów — przyklejona na desktopie */}
          <div className="md:col-span-1 md:sticky md:top-20">
            <ShoppingList
              recipeId={normalized.id}
              ingredients={normalized.ingredients}
            />
          </div>

          {/* Kroki */}
          <div className="md:col-span-2">
            <h2 className="text-2xl font-bold text-stone-900 mb-6" style={{ fontFamily: 'var(--font-serif)' }}>
              Przygotowanie
            </h2>
            {normalized.steps.length > 0 ? (
              <ol className="space-y-6">
                {normalized.steps.map((step: any, i: number) => (
                  <li key={step.id} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-sm flex items-center justify-center">
                      {i + 1}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-stone-700 leading-relaxed">{step.description}</p>
                      {step.image_url && (
                        <div className="relative aspect-video rounded-xl overflow-hidden mt-3 bg-stone-100">
                          <Image src={step.image_url} alt={`Krok ${i + 1}`} fill className="object-cover" />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-stone-400">Brak opisu przygotowania.</p>
            )}
          </div>
        </div>

        {/* Podobne, ale taniej — z tej samej kategorii, niższa cena */}
        {cheaper.length > 0 && (
          <section className="no-print mt-16">
            <div className="flex items-baseline justify-between gap-3 mb-6 flex-wrap">
              <h2 className="text-2xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>
                Podobne, ale taniej
              </h2>
              <span className="text-sm text-stone-500">
                Do {formatPrice(currentPrice)} — te są tańsze
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {cheaper.map((r: any, i: number) => (
                <RecipeCard key={r.id} recipe={r} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Powiązane przepisy */}
        {related.length > 0 && (
          <section className="no-print mt-16">
            <h2 className="text-2xl font-bold text-stone-900 mb-6" style={{ fontFamily: 'var(--font-serif)' }}>
              Więcej z {normalized.store?.name ?? 'tego sklepu'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {related.map((r: any, i: number) => (
                <RecipeCard key={r.id} recipe={r} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Ostatnio oglądane */}
        <div className="no-print">
          <RecentlyViewed excludeId={normalized.id} />
        </div>
      </div>
    </>
  )
}
