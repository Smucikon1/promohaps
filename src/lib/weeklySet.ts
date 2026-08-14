// Dobór zestawu przepisów na tydzień.
//
// Sedno: jedno opakowanie ma starczyć na kilka dań. Jeśli dwa przepisy używają tego
// samego twarogu, kupujesz go RAZ — więc realny koszt zestawu jest niższy niż suma
// cen pojedynczych przepisów. Ta różnica to główna wartość, którą pokazujemy.

import { activePromos } from '@/lib/savings'

const PL_MAP: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
}

// Klucz produktu do wykrywania powtórek między przepisami. Celowo zgrubny:
// „Twaróg półtłusty 250g" i „twaróg półtłusty" mają trafić w to samo wiadro.
export function productKey(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => PL_MAP[c] ?? c)
    .replace(/\d+\s*(g|kg|ml|l|szt|dag)\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w.slice(0, 6))
    .join('|')
}

// Podstawy spiżarni — masz je w domu albo kupujesz raz na miesiąc. Pokazywanie
// „kupujesz sól raz zamiast pięć razy" ośmiesza całą listę wspólnych produktów,
// bo nikt nie planuje zakupu soli pod konkretny obiad.
const PANTRY = [
  'sol', 'pieprz', 'cukier', 'maka', 'olej', 'oliwa', 'ocet', 'woda',
  'przyprawa', 'ziola', 'papryka slodka', 'majeranek', 'oregano', 'bazylia',
  'kminek', 'liscie', 'lisc', 'czosnek granulowany', 'soda', 'proszek',
]

function isPantry(name: string): boolean {
  const n = String(name ?? '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => PL_MAP[c] ?? c)
  return PANTRY.some((p) => n.includes(p))
}

export interface SetRecipe {
  id: string
  title: string
  slug: string
  image_url: string | null
  price_total: number | null
  servings: number | null
  store_id?: string | null
  store?: { name: string; slug: string } | null
  ingredients?: { name: string; price: number | null }[]
  promo_products?: any[]
}

export interface WeeklySet {
  recipes: SetRecipe[]
  /** Koszt zakupów po odliczeniu produktów kupowanych raz na kilka dań */
  cost: number
  /** Suma cen przepisów liczonych osobno — punkt odniesienia */
  costSeparately: number
  /** Ile daje samo współdzielenie opakowań */
  sharedSavings: number
  /** Oszczędność wynikająca z promocji w gazetce */
  promoSavings: number
  /** Produkty użyte w więcej niż jednym przepisie zestawu */
  sharedProducts: string[]
  portions: number
}

// Wszystkie kupowane pozycje przepisu (produkty z gazetki + zwykłe składniki)
function itemsOf(recipe: SetRecipe): { key: string; name: string; price: number }[] {
  return (recipe.ingredients ?? [])
    .filter((i) => typeof i.price === 'number' && i.price > 0)
    .map((i) => ({ key: productKey(i.name), name: i.name, price: i.price as number }))
    .filter((i) => i.key.length > 0)
}

// Ile przepisów realnie wyżywi jedno opakowanie produktu pobocznego. Paczka jajek
// czy kostka masła starczy na kilka dań, ale nie na dowolnie wiele — po tylu
// przepisach doliczamy kolejne opakowanie.
const SHARE_LIMIT = 3

// Najdroższy składnik przepisu to praktycznie zawsze jego trzon (mięso, ryba).
// Jedna karkówka NIE wystarczy na pięć obiadów, więc trzon każdego dania kupujemy
// osobno. Dzielimy tylko dodatki. Lepiej pokazać kwotę odrobinę wyższą niż taką,
// przy której zabraknie przy kasie.
function coreKey(recipe: SetRecipe): string | null {
  const items = itemsOf(recipe)
  if (items.length === 0) return null
  return items.reduce((max, i) => (i.price > max.price ? i : max)).key
}

// Ile dołoży do koszyka dorzucenie tego przepisu przy obecnym stanie zakupów.
// `usedBy` mówi, ile przepisów korzysta już z danego produktu jako dodatku.
function marginalCost(recipe: SetRecipe, usedBy: Map<string, number>): number {
  const core = coreKey(recipe)
  return itemsOf(recipe).reduce((sum, i) => {
    if (i.key === core) return sum + i.price // trzon dania — zawsze własne opakowanie
    const used = usedBy.get(i.key) ?? 0
    // Nowe opakowanie potrzebne, gdy poprzednie „się skończyło"
    return used % SHARE_LIMIT === 0 ? sum + i.price : sum
  }, 0)
}

// Zapisuje zużycie dodatków po dołączeniu przepisu do zestawu
function commitUsage(recipe: SetRecipe, usedBy: Map<string, number>) {
  const core = coreKey(recipe)
  for (const i of itemsOf(recipe)) {
    if (i.key === core) continue
    usedBy.set(i.key, (usedBy.get(i.key) ?? 0) + 1)
  }
}

/**
 * Zachłanny dobór: zaczynamy od najtańszego przepisu, potem za każdym razem
 * dokładamy ten, który dokłada NAJMNIEJ do koszyka (czyli najwięcej dzieli
 * z już wybranymi). Zachłannie, bo przy kilkudziesięciu przepisach optymalne
 * przeszukiwanie nie ma jak się opłacić — a wynik i tak jest wyraźnie lepszy
 * niż pięć przypadkowych dań.
 */
export function buildWeeklySet(candidates: SetRecipe[], size = 5): WeeklySet | null {
  const usable = candidates.filter((r) => itemsOf(r).length > 0 && (r.price_total ?? 0) > 0)
  if (usable.length < 2) return null

  const chosen: SetRecipe[] = []
  const usedBy = new Map<string, number>()
  let cost = 0

  // Start: najtańszy przepis — zestaw ma być tani od pierwszego dania
  const first = usable.reduce((min, r) => ((r.price_total ?? 0) < (min.price_total ?? 0) ? r : min))
  chosen.push(first)
  commitUsage(first, usedBy)
  cost = first.price_total ?? 0

  while (chosen.length < size) {
    const taken = new Set(chosen.map((r) => r.id))
    const rest = usable.filter((r) => !taken.has(r.id))
    if (rest.length === 0) break

    let best = rest[0]
    let bestCost = marginalCost(best, usedBy)
    for (const r of rest.slice(1)) {
      const c = marginalCost(r, usedBy)
      if (c < bestCost) {
        best = r
        bestCost = c
      }
    }

    chosen.push(best)
    commitUsage(best, usedBy)
    cost += bestCost
  }

  if (chosen.length < 2) return null

  // Do „kupujesz raz" trafiają tylko dodatki realnie dzielone między dania.
  // Trzon każdego przepisu (najdroższy składnik) jest kupowany osobno, więc
  // nie jest niczym współdzielonym i nie ma go na tej liście.
  const cores = new Set(chosen.map(coreKey).filter(Boolean) as string[])
  const seen = new Map<string, { name: string; count: number }>()
  for (const r of chosen) {
    const core = coreKey(r)
    for (const i of new Map(itemsOf(r).map((x) => [x.key, x])).values()) {
      if (i.key === core) continue
      const entry = seen.get(i.key)
      if (entry) entry.count += 1
      else seen.set(i.key, { name: i.name, count: 1 })
    }
  }
  const sharedProducts = [...seen.values()]
    .filter((x) => x.count > 1 && !isPantry(x.name))
    .map((x) => x.name)
    .filter((name) => !cores.has(productKey(name)))

  const costSeparately = chosen.reduce((s, r) => s + (r.price_total ?? 0), 0)
  const promoSavings = chosen.reduce(
    (s, r) =>
      s +
      activePromos(r.promo_products).reduce(
        (acc, p) =>
          p.price_regular != null && p.price_regular > p.price_promo
            ? acc + (p.price_regular - p.price_promo)
            : acc,
        0
      ),
    0
  )

  return {
    recipes: chosen,
    cost: Math.round(cost * 100) / 100,
    costSeparately: Math.round(costSeparately * 100) / 100,
    sharedSavings: Math.round((costSeparately - cost) * 100) / 100,
    promoSavings: Math.round(promoSavings * 100) / 100,
    sharedProducts,
    portions: chosen.reduce((s, r) => s + (r.servings ?? 0), 0),
  }
}
