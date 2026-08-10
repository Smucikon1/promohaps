import type { Metadata } from 'next'
import Link from 'next/link'
import { PiggyBank, Recycle, Users, ShoppingBasket } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { expiredRecipeIds } from '@/lib/promoVisibility'
import { dedupeRecipes } from '@/lib/recipeDedupe'
import { hasActivePromo, formatPrice } from '@/lib/utils'
import { buildWeeklySet, type SetRecipe } from '@/lib/weeklySet'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import { AddSetToList } from '@/components/recipe/AddSetToList'
import { StoreLogo } from '@/components/recipe/StoreLogo'

export const metadata: Metadata = {
  title: 'Zestaw na tydzień — 5 obiadów z jednych zakupów',
  description:
    'Pięć obiadów z jednej listy zakupów. Przepisy dobrane tak, żeby dzielić opakowania — jeden twaróg starcza na dwa dania, więc płacisz raz.',
  robots: { index: true, follow: true },
}

// Zestaw zależy od aktualnych gazetek — odświeżamy co godzinę zamiast przy każdym wejściu.
export const revalidate = 3600

const SET_SIZE = 5

export default async function WeeklySetPage() {
  const supabase = await createClient()
  const hidden = await expiredRecipeIds()

  let query = supabase
    .from('recipes')
    .select(
      `id, title, slug, image_url, price_total, servings, store_id,
       store:stores(*), categories:recipe_categories(category:categories(*)),
       ingredients(id, name, amount, unit, price, is_promo_product),
       promo_products(*)`
    )
    .eq('is_published', true)
    .gt('price_total', 0)
    .order('price_total', { ascending: true })

  if (hidden.length > 0) query = query.not('id', 'in', `(${hidden.join(',')})`)

  const { data } = await query.range(0, 199)

  const usable = dedupeRecipes(
    (data ?? [])
      .filter((r: any) => hasActivePromo(r.promo_products))
      .map((r: any) => ({
        ...r,
        categories: r.categories?.map((rc: any) => rc.category).filter(Boolean) ?? [],
      }))
  )

  // Zakupy robi się w jednym sklepie, więc zestaw też budujemy w obrębie sklepu.
  const byStore = new Map<string, SetRecipe[]>()
  for (const r of usable as any[]) {
    const key = r.store_id ?? ''
    if (!byStore.has(key)) byStore.set(key, [])
    byStore.get(key)!.push(r)
  }

  // Z każdego sklepu bierzemy najlepszy zestaw, pokazujemy ten o najniższym koszcie zakupów
  const sets = [...byStore.values()]
    .map((list) => buildWeeklySet(list, SET_SIZE))
    .filter((s): s is NonNullable<typeof s> => s != null && s.recipes.length >= 3)
    .sort((a, b) => a.cost - b.cost)

  const set = sets[0]

  if (!set) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
          Zestaw jest w przygotowaniu
        </h1>
        <p className="text-stone-500 mb-6">
          Potrzebujemy kilku przepisów z trwających promocji, żeby ułożyć sensowny tydzień.
          Zajrzyj po najbliższej aktualizacji gazetek.
        </p>
        <Link href="/" className="btn-primary inline-flex items-center gap-2">
          Przeglądaj przepisy
        </Link>
      </div>
    )
  }

  const store = (set.recipes[0] as any)?.store

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f9f0] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#12b76a]">
          <ShoppingBasket className="w-3.5 h-3.5" />
          Zestaw na tydzień
        </span>
        <h1
          className="mt-3 text-2xl md:text-4xl font-bold leading-tight text-stone-900"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {set.recipes.length} obiadów za {formatPrice(set.cost)}
        </h1>
        <p className="mt-3 text-stone-600 max-w-2xl leading-relaxed">
          Jedna lista zakupów, {set.portions} porcji. Przepisy dobrane tak, żeby dzielić opakowania —
          produkt użyty w dwóch daniach kupujesz raz.
        </p>
        {/* Bez tego zdania suma cen z kafelków niżej nie zgadza się z kwotą w nagłówku
            i wygląda jak błąd rachunkowy. */}
        <p className="mt-2 text-sm text-stone-500 max-w-2xl leading-relaxed">
          Ceny przy poszczególnych przepisach dotyczą ugotowania każdego z osobna. W zestawie
          są niższe, bo wspólne produkty kupujesz tylko raz.
        </p>
      </header>

      {/* Rozbicie kwoty — pokazujemy skąd bierze się oszczędność */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="bg-white rounded-2xl border border-stone-100 p-4">
          <div className="text-xs text-stone-500 mb-1">Zapłacisz</div>
          <div className="text-2xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>
            {formatPrice(set.cost)}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-100 p-4">
          <div className="text-xs text-stone-500 mb-1">Obiadów</div>
          <div className="text-2xl font-bold text-[#12b76a]" style={{ fontFamily: 'var(--font-serif)' }}>
            {set.recipes.length}
          </div>
        </div>
        {/* Liczba, nie kwota. Wyliczanie „oszczędności" ze współdzielenia zakładałoby,
            że bez zestawu kupiłbyś osobną paczkę jajek i masła do każdego obiadu —
            czego nikt nie robi. Sama liczba wspólnych produktów jest sprawdzalna. */}
        {set.sharedProducts.length > 0 && (
          <div className="bg-green-50 rounded-2xl border border-green-200 p-4">
            <div className="text-xs text-green-700 mb-1 flex items-center gap-1">
              <Recycle className="w-3.5 h-3.5" />
              Wspólne produkty
            </div>
            <div className="text-2xl font-bold text-green-800" style={{ fontFamily: 'var(--font-serif)' }}>
              {set.sharedProducts.length}
            </div>
          </div>
        )}
        {set.promoSavings >= 0.5 && (
          <div className="bg-green-50 rounded-2xl border border-green-200 p-4">
            <div className="text-xs text-green-700 mb-1 flex items-center gap-1">
              <PiggyBank className="w-3.5 h-3.5" />
              Z gazetki
            </div>
            <div className="text-2xl font-bold text-green-800" style={{ fontFamily: 'var(--font-serif)' }}>
              −{formatPrice(set.promoSavings)}
            </div>
          </div>
        )}
      </div>

      {/* Sklep + akcja */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-stone-100 p-5 mb-8">
        <div className="flex items-center gap-3 min-w-0">
          {store && <StoreLogo slug={store.slug} name={store.name} className="h-8 w-auto max-w-[7rem] object-contain" />}
          <div className="min-w-0">
            <div className="font-semibold text-stone-800">Wszystko z jednego sklepu</div>
            <div className="text-sm text-stone-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {set.portions} porcji łącznie
            </div>
          </div>
        </div>
        <AddSetToList recipes={set.recipes as any} />
      </div>

      {/* Tylko oszczędność z gazetki — ta jest sprawdzalna, bo porównuje cenę promocyjną
          z regularną tych samych produktów, które faktycznie wkładasz do koszyka. */}
      {set.promoSavings >= 1 && (
        <div className="mb-8 flex items-center gap-3 rounded-2xl bg-green-100 border border-green-200 px-4 py-3">
          <PiggyBank className="w-6 h-6 text-green-700 flex-shrink-0" />
          <p className="text-sm text-green-900">
            Dzięki promocjom z gazetki te zakupy są o{' '}
            <span className="font-extrabold">{formatPrice(set.promoSavings)}</span> tańsze
            niż przy cenach regularnych.
          </p>
        </div>
      )}

      {set.sharedProducts.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-stone-700 mb-2 flex items-center gap-1.5">
            <Recycle className="w-4 h-4 text-[#12b76a]" />
            Kupujesz raz, gotujesz kilka razy
          </h2>
          <div className="flex flex-wrap gap-2">
            {set.sharedProducts.slice(0, 8).map((name) => (
              <span
                key={name}
                className="inline-flex items-center rounded-full bg-[#e6f9f0] px-3 py-1 text-sm text-[#0c7d49]"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-xl font-bold text-stone-900 mb-5" style={{ fontFamily: 'var(--font-serif)' }}>
        Co ugotujesz
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {set.recipes.map((r: any, i: number) => (
          <RecipeCard key={r.id} recipe={r} index={i} />
        ))}
      </div>

      <p className="mt-8 text-[11px] text-stone-400 leading-relaxed">
        Ceny są <strong>orientacyjne</strong> — obliczone na podstawie cen z gazetek promocyjnych i typowych
        cen w polskich sklepach. Nie stanowią oferty handlowej; rzeczywista cena i dostępność mogą się różnić.
      </p>
    </div>
  )
}
