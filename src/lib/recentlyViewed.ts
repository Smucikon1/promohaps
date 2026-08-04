// Ostatnio oglądane przepisy — localStorage, lokalna personalizacja (bez wysyłki danych)

export const RECENT_KEY = 'przepisnik_recently_viewed'
export const RECENT_EVENT = 'przepisnik:recent-updated'
const MAX = 12

export interface RecentRecipe {
  id: string
  slug: string
  title: string
  image_url: string | null
  store_name: string | null
}

export function readRecent(): RecentRecipe[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// Usuwa z historii przepisy, których już nie ma (usunięte, ukryte, bez ceny).
// Bez emitowania zdarzenia — inaczej powstałaby pętla odświeżeń.
export function pruneRecent(validIds: Set<string>) {
  if (typeof window === 'undefined') return
  const kept = readRecent().filter((r) => validIds.has(r.id))
  localStorage.setItem(RECENT_KEY, JSON.stringify(kept))
}

export function recordView(r: RecentRecipe) {
  if (typeof window === 'undefined') return
  const list = readRecent().filter((x) => x.id !== r.id)
  const next = [r, ...list].slice(0, MAX)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(RECENT_EVENT))
}
