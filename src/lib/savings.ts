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
