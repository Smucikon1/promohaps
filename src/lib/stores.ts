// Jedno źródło prawdy dla kolorów marek sklepów
export const STORE_COLORS: Record<string, string> = {
  biedronka: '#e3000b',
  lidl: '#0050aa',
  auchan: '#cc0000',
  carrefour: '#004a97',
  kaufland: '#e10915',
  dino: '#e30613',
  netto: '#ffd400',
}

export function storeColor(slug?: string | null): string {
  return STORE_COLORS[slug ?? ''] ?? '#78716c'
}

// Kolejność wg popularności sieci w Polsce (najpopularniejsze pierwsze).
// Dino ma bardzo szeroką sieć na wsiach — daję go zaraz za wielką trójką.
const STORE_POPULARITY: Record<string, number> = {
  biedronka: 1,
  lidl: 2,
  kaufland: 3,
  dino: 4,
  auchan: 5,
  carrefour: 6,
  netto: 7,
}

export function sortByPopularity<T extends { slug: string }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => (STORE_POPULARITY[a.slug] ?? 99) - (STORE_POPULARITY[b.slug] ?? 99)
  )
}
