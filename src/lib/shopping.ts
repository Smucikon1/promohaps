// Współdzielone stałe i pomocniki listy zakupów (localStorage, per-przepis)

// v2: lista zawiera tylko przepisy dodane świadomie (wcześniej auto-dodawane przy podglądzie)
export const SHOPPING_KEY = 'przepisnik_shopping_list_v2'
export const SHOPPING_PREFIX = `${SHOPPING_KEY}_`
// Emitowane po każdej zmianie listy, żeby licznik w nagłówku odświeżał się na żywo
export const SHOPPING_EVENT = 'przepisnik:shopping-updated'

export interface ShoppingItem {
  id: string
  name: string
  amount: string | null
  unit: string | null
  checked: boolean
  // Pozycje z gazetki — wyróżnione i z ceną
  isPromo?: boolean
  price?: number | null
  priceRegular?: number | null
  // true dla produktów z gazetki (cena stała); false dla składników (cena skaluje się z porcjami)
  fixedPrice?: boolean
  // Ile przepisów na liście używa tego samego produktu (kupujesz go raz)
  sharedCount?: number
  // Warunek promocji z gazetki (np. cena tylko z kartą, oferta 2+1)
  conditionType?: string | null
  conditionNote?: string | null
  minQuantity?: number | null
}

export function notifyShoppingUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SHOPPING_EVENT))
}

/**
 * Ile PRZEPISÓW jest na liście zakupów.
 *
 * Każdy klucz w localStorage to jedna lista jednego przepisu, więc liczymy klucze,
 * a nie pozycje w środku. Plakietka w nawigacji ma mówić „masz 3 przepisy do
 * ugotowania", a nie „masz 27 rzeczy do kupienia" — ta druga liczba rośnie
 * przy każdym dodaniu i przestaje cokolwiek znaczyć.
 */
export function countShoppingRecipes(): number {
  if (typeof window === 'undefined') return 0
  let ile = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(SHOPPING_PREFIX)) continue
    try {
      const items = JSON.parse(localStorage.getItem(key) || '[]')
      if (Array.isArray(items) && items.length > 0) ile++
    } catch {}
  }
  return ile
}

// Łączna liczba pozycji we wszystkich listach (wszystkie przepisy)
export function countShoppingItems(): number {
  if (typeof window === 'undefined') return 0
  let total = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(SHOPPING_PREFIX)) continue
    try {
      const items = JSON.parse(localStorage.getItem(key) || '[]')
      if (Array.isArray(items)) total += items.length
    } catch {}
  }
  return total
}
