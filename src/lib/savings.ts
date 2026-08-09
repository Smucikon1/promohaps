import { isPromoActive } from '@/lib/utils'
import type { PromoProduct } from '@/types'

// Poniżej tej ceny promocja jest niewiarygodna (błąd odczytu) — nie pokazujemy jej
export const MIN_PLAUSIBLE_PRICE = 0.3

// Zwraca tylko aktualnie obowiązujące i wiarygodne cenowo promocje
export function activePromos(promos?: PromoProduct[] | null): PromoProduct[] {
  return (promos ?? []).filter(
    (p) => isPromoActive(p.valid_from, p.valid_to) && (p.price_promo ?? 0) >= MIN_PLAUSIBLE_PRICE
  )
}

// Łączna oszczędność = suma (cena regularna − cena promocyjna) po aktywnych promocjach
export function totalSavings(promos?: PromoProduct[] | null): number {
  return activePromos(promos).reduce((sum, p) => {
    if (p.price_regular != null && p.price_regular > p.price_promo) {
      return sum + (p.price_regular - p.price_promo)
    }
    return sum
  }, 0)
}

// Cena przepisu w cenach zwykłych — pokazywana, gdy promocje już wygasły.
// price_total jest policzone po cenach promocyjnych, więc doliczamy z powrotem
// różnicę do ceny regularnej. Bierzemy WSZYSTKIE promocje (także wygasłe),
// bo pytanie brzmi „ile to kosztuje bez promocji", a nie „ile oszczędzasz dziś".
export function regularPrice(
  priceTotal: number | null | undefined,
  promos?: PromoProduct[] | null
): number | null {
  if (!priceTotal) return null
  const uplift = (promos ?? [])
    .filter((p) => (p.price_promo ?? 0) >= MIN_PLAUSIBLE_PRICE)
    .reduce((sum, p) => {
      if (p.price_regular != null && p.price_regular > p.price_promo) {
        return sum + (p.price_regular - p.price_promo)
      }
      return sum
    }, 0)
  return Math.round((priceTotal + uplift) * 100) / 100
}

// Data najwcześniej wygasającej aktywnej promocji — wyznacza, jak długo przepis
// jest jeszcze aktualny (wygaśnięcie choćby jednej promocji ukrywa cały przepis).
export function soonestPromoEnd(promos?: PromoProduct[] | null): string | null {
  const active = activePromos(promos)
  if (active.length === 0) return null
  return active.reduce((min, p) => (p.valid_to < min ? p.valid_to : min), active[0].valid_to)
}

// Procent oszczędności względem ceny bez promocji (price_total już jest po obniżce,
// więc bazą jest price_total + oszczędność). Poniżej 0,5 zł nie pokazujemy —
// zaokrąglenia dawałyby mylące „−1%".
export function savingsPercent(
  priceTotal: number | null | undefined,
  promos?: PromoProduct[] | null
): number {
  const saved = totalSavings(promos)
  if (saved < 0.5) return 0
  const base = (priceTotal ?? 0) + saved
  return base > 0 ? Math.round((saved / base) * 100) : 0
}
