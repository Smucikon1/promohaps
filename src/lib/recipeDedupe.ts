// Odsiew duplikatów przepisów.
//
// Generator potrafi utworzyć to samo danie kilka razy, zmieniając tylko szyk słów
// w tytule („…z młodymi ziemniakami i pomidorami malinowymi" vs „…z malinowymi
// pomidorami i młodymi ziemniakami"). Dla użytkownika to jeden przepis, więc
// w listingach pokazujemy go raz.

const STOPWORDS = new Set([
  'z', 'ze', 'i', 'w', 'we', 'na', 'do', 'od', 'po', 'za', 'o', 'u', 'a', 'oraz', 'dla', 'bez',
])

// Polskie znaki → ASCII. Jawna mapa zamiast zakresów Unicode: czytelna
// i odporna na kodowanie pliku.
const PL_MAP: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
}

// „Odcisk” dania: znaczące słowa tytułu, bez kolejności, ogonków i końcówek fleksyjnych.
// „ziemniakami"/„ziemniaki" → „ziemni", więc odmiana nie tworzy nowego dania.
export function dishFingerprint(title: string): string {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => PL_MAP[c] ?? c)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map((w) => w.slice(0, 6))
    .sort()
    .join('|')
}

type DedupableRecipe = {
  id: string
  title: string
  store_id?: string | null
  price_total?: number | null
}

// Zostawia jeden przepis na danie (w obrębie sklepu) — ten tańszy, bo cena jest
// tu najważniejsza. Kolejność wejściowa listy zostaje zachowana.
export function dedupeRecipes<T extends DedupableRecipe>(list: T[]): T[] {
  const best = new Map<string, T>()

  for (const r of list) {
    const fp = dishFingerprint(r.title)
    if (!fp) continue
    const key = `${r.store_id ?? ''}::${fp}`
    const current = best.get(key)
    if (!current) {
      best.set(key, r)
      continue
    }
    const candidatePrice = r.price_total ?? Number.POSITIVE_INFINITY
    const currentPrice = current.price_total ?? Number.POSITIVE_INFINITY
    if (candidatePrice < currentPrice) best.set(key, r)
  }

  const keep = new Set([...best.values()].map((r) => r.id))
  return list.filter((r) => keep.has(r.id))
}
