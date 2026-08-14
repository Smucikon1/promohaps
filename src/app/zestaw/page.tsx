import type { Metadata } from 'next'
import Link from 'next/link'
import { PiggyBank, Recycle, Users, ShoppingBasket, RefreshCw } from 'lucide-react'
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

// Kreator w adresie, nie w stanie klienta: gotowy zestaw da się wysłać znajomemu
// albo wrócić do niego z zakładek, a strona zostaje renderowana po stronie serwera.
// `pomin` = lista odrzuconych przepisów. Zamiana dania to po prostu dopisanie go tutaj
// i przebudowanie zestawu bez niego — dzięki temu wynik dalej siedzi w adresie
// i da się go wysłać albo odświeżyć bez utraty wyborów.
type SetParams = { sklep?: string; dieta?: string; pomin?: string }

const DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek']

function WizardShell({
  step,
  title,
  lead,
  back,
  children,
}: {
  step: 1 | 2 | 3
  title: string
  lead: string
  back?: string
  children: React.ReactNode
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2 mb-6">
        {[1, 2].map((n) => (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-[#12b76a]' : 'bg-stone-200'}`}
            aria-hidden="true"
          />
        ))}
        <span className="text-xs font-medium text-stone-400 ml-1">Krok {Math.min(step, 2)} z 2</span>
      </div>

      <h1 className="text-2xl md:text-3xl font-bold text-stone-900 mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
        {title}
      </h1>
      <p className="text-stone-600 mb-7 leading-relaxed">{lead}</p>

      {children}

      {back && (
        <Link href={back} className="inline-block mt-6 text-sm text-stone-500 hover:text-stone-700 transition-colors">
          ← Zmień poprzedni wybór
        </Link>
      )}
    </div>
  )
}

export default async function WeeklySetPage({
  searchParams,
}: {
  searchParams: Promise<SetParams>
}) {
  const { sklep, dieta, pomin } = await searchParams
  const skipped = new Set((pomin ?? '').split(',').filter(Boolean))
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

  const isWege = (r: any) => (r.categories ?? []).some((c: any) => c?.slug === 'wege')

  // Zakupy robi się w jednym sklepie, więc zestaw też budujemy w obrębie sklepu.
  const byStore = new Map<string, { store: any; all: SetRecipe[]; wege: SetRecipe[] }>()
  for (const r of usable as any[]) {
    const slug = r.store?.slug
    if (!slug) continue
    if (!byStore.has(slug)) byStore.set(slug, { store: r.store, all: [], wege: [] })
    const bucket = byStore.get(slug)!
    bucket.all.push(r)
    if (isWege(r)) bucket.wege.push(r)
  }

  // Sklep pokazujemy tylko wtedy, gdy da się z niego złożyć sensowny tydzień —
  // inaczej użytkownik wybiera kafelek i dostaje pustkę.
  const MIN_FOR_SET = 3
  const stores = [...byStore.values()]
    .filter((s) => s.all.length >= MIN_FOR_SET)
    .sort((a, b) => b.all.length - a.all.length)

  // ── Krok 0: nie ma z czego układać ─────────────────────────────────────────
  if (stores.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
          Zestaw jest w przygotowaniu
        </h1>
        <p className="text-stone-500 mb-6">
          Potrzebujemy kilku przepisów z trwających promocji w jednym sklepie, żeby ułożyć sensowny
          tydzień. Zajrzyj po najbliższej aktualizacji gazetek.
        </p>
        <Link href="/" className="btn-primary inline-flex items-center gap-2">
          Przeglądaj przepisy
        </Link>
      </div>
    )
  }

  const picked = sklep ? byStore.get(sklep) : undefined

  // ── Krok 1: wybór sklepu ───────────────────────────────────────────────────
  if (!picked || picked.all.length < MIN_FOR_SET) {
    return (
      <WizardShell step={1} title="W którym sklepie robisz zakupy?" lead="Cały tydzień składamy z jednej gazetki, żebyś nie jeździł po mieście.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stores.map(({ store, all }) => (
            <Link
              key={store.slug}
              href={`/zestaw?sklep=${store.slug}`}
              className="flex flex-col items-center gap-3 bg-white rounded-2xl border border-stone-200 p-5 hover:border-[#12b76a] hover:shadow-sm transition-all"
            >
              <StoreLogo slug={store.slug} name={store.name} className="h-9 w-auto max-w-[7rem] object-contain" />
              <span className="text-xs text-stone-500">{all.length} przepisów w promocji</span>
            </Link>
          ))}
        </div>
      </WizardShell>
    )
  }

  // ── Krok 2: dieta ──────────────────────────────────────────────────────────
  const wegePossible = picked.wege.length >= MIN_FOR_SET
  if (!dieta) {
    return (
      <WizardShell
        step={2}
        title="Jesz mięso?"
        lead={`${picked.store.name} — wybierz, z czego mamy ułożyć pięć obiadów.`}
        back="/zestaw"
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Link
            href={`/zestaw?sklep=${sklep}&dieta=wszystko`}
            className="bg-white rounded-2xl border border-stone-200 p-5 hover:border-[#12b76a] hover:shadow-sm transition-all"
          >
            <div className="text-2xl mb-2">🍗</div>
            <div className="font-semibold text-stone-800">Bez ograniczeń</div>
            <div className="text-sm text-stone-500 mt-0.5">{picked.all.length} przepisów do wyboru</div>
          </Link>

          {/* Kafelek nieaktywny, gdy wege przepisów jest za mało na tydzień —
              lepiej powiedzieć to wprost niż pokazać pusty wynik po kliknięciu. */}
          {wegePossible ? (
            <Link
              href={`/zestaw?sklep=${sklep}&dieta=wege`}
              className="bg-white rounded-2xl border border-stone-200 p-5 hover:border-[#12b76a] hover:shadow-sm transition-all"
            >
              <div className="text-2xl mb-2">🥦</div>
              <div className="font-semibold text-stone-800">Wegetariańskie</div>
              <div className="text-sm text-stone-500 mt-0.5">{picked.wege.length} przepisów do wyboru</div>
            </Link>
          ) : (
            <div className="bg-stone-50 rounded-2xl border border-stone-200 p-5 opacity-70">
              <div className="text-2xl mb-2 grayscale">🥦</div>
              <div className="font-semibold text-stone-500">Wegetariańskie</div>
              <div className="text-sm text-stone-400 mt-0.5">
                {picked.wege.length === 0
                  ? 'Brak dań wege w tej gazetce'
                  : `Tylko ${picked.wege.length} — za mało na tydzień`}
              </div>
            </div>
          )}
        </div>
      </WizardShell>
    )
  }

  // ── Krok 3: zestaw ─────────────────────────────────────────────────────────
  const fullPool = dieta === 'wege' ? picked.wege : picked.all
  // Odrzucone dania wypadają z puli. Gdyby przez to zabrakło przepisów na zestaw,
  // ignorujemy odrzucenia zamiast pokazywać pustą stronę — użytkownik zobaczy
  // wtedy podpowiedź, że wrócił do pełnej puli.
  const trimmed = fullPool.filter((r: any) => !skipped.has(r.id))
  const poolExhausted = skipped.size > 0 && trimmed.length < MIN_FOR_SET
  const pool = poolExhausted ? fullPool : trimmed
  const set = buildWeeklySet(pool, SET_SIZE)

  // Adres bazowy do budowania linków „Zamień"
  const baseParams = `sklep=${sklep}&dieta=${dieta}`
  const swapHref = (id: string) =>
    `/zestaw?${baseParams}&pomin=${[...skipped, id].join(',')}`

  if (!set || set.recipes.length < MIN_FOR_SET) {
    return (
      <WizardShell
        step={3}
        title="Nie ma z czego złożyć tygodnia"
        lead={`W ${picked.store.name} jest za mało pasujących przepisów z trwających promocji.`}
        back={`/zestaw?sklep=${sklep}`}
      >
        <Link href="/zestaw" className="btn-primary inline-flex items-center gap-2">
          Wybierz inny sklep
        </Link>
      </WizardShell>
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
        <p className="mt-2 text-sm text-stone-500">
          {picked.store.name}
          {dieta === 'wege' && ' · wegetariańskie'}
          {' · '}
          <Link href={`/zestaw?sklep=${sklep}`} className="text-[#12b76a] font-medium hover:underline">
            zmień
          </Link>
        </p>
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
          <div className="text-[10px] text-stone-400 -mt-1 mb-1">cena orientacyjna</div>
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
        Plan na tydzień
      </h2>
      {/* Dni to tylko podpowiedź kolejności — nic nie stoi na przeszkodzie, żeby
          ugotować je w innym porządku, więc nie obiecujemy nic ponad to. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {set.recipes.map((r: any, i: number) => (
          <div key={r.id}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                {DAYS[i] ?? `Dzień ${i + 1}`}
              </span>
              {/* Odrzucenie dania dopisuje je do „pomin" i przelicza cały zestaw —
                  reszta dni może się przy tym zmienić, bo dobór szuka wspólnych produktów. */}
              <Link
                href={swapHref(r.id)}
                scroll={false}
                aria-label={`Zamień danie: ${r.title}`}
                className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-500 hover:border-[#12b76a] hover:text-[#12b76a] transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Zamień
              </Link>
            </div>
            <RecipeCard recipe={r} index={i} />
          </div>
        ))}
      </div>

      {skipped.size > 0 && (
        <p className="mt-5 text-sm text-stone-500">
          {poolExhausted
            ? 'Skończyły się dania do podmiany — wróciliśmy do pełnej puli.'
            : `Odrzucone dania: ${skipped.size}.`}{' '}
          <Link href={`/zestaw?${baseParams}`} className="text-[#12b76a] font-medium hover:underline">
            Zacznij od nowa
          </Link>
        </p>
      )}

      <p className="mt-8 text-[11px] text-stone-400 leading-relaxed">
        Ceny są <strong>orientacyjne</strong> — obliczone na podstawie cen z gazetek promocyjnych i typowych
        cen w polskich sklepach. Nie stanowią oferty handlowej; rzeczywista cena i dostępność mogą się różnić.
      </p>
    </div>
  )
}
