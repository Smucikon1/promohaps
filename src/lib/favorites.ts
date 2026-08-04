// Ulubione przepisy — zapisywane w localStorage (bez logowania)

export const FAVORITES_KEY = 'przepisnik_favorites'
export const FAVORITES_EVENT = 'przepisnik:favorites-updated'

export interface FavoriteRecipe {
  id: string
  slug: string
  title: string
  image_url: string | null
  store_name: string | null
}

export function readFavorites(): FavoriteRecipe[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeFavorites(list: FavoriteRecipe[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(list))
  window.dispatchEvent(new Event(FAVORITES_EVENT))
}

export function isFavorite(id: string): boolean {
  return readFavorites().some((f) => f.id === id)
}

export function toggleFavorite(fav: FavoriteRecipe): boolean {
  const list = readFavorites()
  const exists = list.some((f) => f.id === fav.id)
  const next = exists ? list.filter((f) => f.id !== fav.id) : [fav, ...list]
  writeFavorites(next)
  return !exists
}

export function removeFavorite(id: string) {
  writeFavorites(readFavorites().filter((f) => f.id !== id))
}

// Usuwa z ulubionych to, czego nie ma w zbiorze `valid` (przeterminowane/wyłączone/usunięte).
// Zapisuje tylko gdy coś się zmieniło, żeby nie emitować zbędnych eventów.
export function pruneFavorites(valid: Set<string>) {
  const list = readFavorites()
  const kept = list.filter((f) => valid.has(f.id))
  if (kept.length !== list.length) writeFavorites(kept)
}

export function countFavorites(): number {
  return readFavorites().length
}
