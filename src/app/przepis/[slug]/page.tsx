import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Clock, Flame, ShoppingBag, ArrowLeft } from 'lucide-react'
import { formatPrice, formatTime, difficultyLabel, difficultyColor, isPromoActive, isPromoExpired, promoDaysLeft } from '@/lib/utils'
import { storeColor } from '@/lib/stores'
import { ShoppingList } from '@/components/recipe/ShoppingList'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import { RecipeActions } from '@/components/recipe/RecipeActions'
import { AddToPlan } from '@/components/recipe/AddToPlan'
import { AdSlot } from '@/components/ads/AdSlot'
import { RecipeTracker } from '@/components/recipe/RecipeTracker'
import { RecordView } from '@/components/recipe/RecordView'
import { RecentlyViewed } from '@/components/recipe/RecentlyViewed'

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

  // Dane do jadłospisu (składniki + promocje potrzebne do listy zakupów)
  const plannedRecipe = {
    id: normalized.id,
    slug: normalized.slug,
    title: normalized.title,
    image_url: normalized.image_url,
    store_name: normalized.store?.name ?? null,
    price_total: normalized.price_total,
    savings: 0,
    ingredients: normalized.ingredients.map((i: any) => ({
      id: i.id, name: i.name, amount: i.amount, unit: i.unit, price: i.price ?? null, isPromo: !!i.is_promo_product,
    })),
    promos: activePromos.map((p: any) => ({
      id: p.id, name: p.name, price_promo: p.price_promo, price_regular: p.price_regular,
    })),
  }

  // Powiązane przepisy z tego samego sklepu
  const { data: relatedRaw } = await supabase
    .from('recipes')
    .select('*, store:stores(*), promo_products(*)')
    .eq('is_published', true)
    .eq('store_id', normalized.store_id)
    .neq('id', normalized.id)
    .order('created_at', { ascending: false })
    .limit(6)
  // Powiązane też znikają, gdy mają wygasłą promocję
  const related = (relatedRaw ?? [])
    .filter((r: any) => !(r.promo_products ?? []).some((p: any) => isPromoExpired(p.valid_to)))
    .slice(0, 3)

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
            ? 'text-xs bg-white/20 text-white backdrop-blur-sm px-2.5 py-1 rounded-full'
            : 'text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full'
        }
      >
        {cat.icon} {cat.name}
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
        {/* Powrót */}
        <Link
          href={normalized.store ? `/?store=${normalized.store.slug}` : '/'}
          className="no-print inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-amber-600 transition-colors mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          {normalized.store ? `Przepisy · ${normalized.store.name}` : 'Wróć do przepisów'}
        </Link>

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

        {/* Akcje + pilność promocji */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <AddToPlan recipe={plannedRecipe} />
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
          {normalized.price_total && (
            <div className="flex-1 min-w-[80px] px-4 text-center">
              <ShoppingBag className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <div className="font-semibold text-stone-800">{formatPrice(normalized.price_total)}</div>
              <div className="text-xs text-stone-500">Koszt</div>
            </div>
          )}
        </div>

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
