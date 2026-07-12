import { isPromoActive } from '@/lib/utils'
import type { PromoProduct } from '@/types'

// Zwraca tylko aktualnie obowiązujące promocje
export function activePromos(promos?: PromoProduct[] | null): PromoProduct[] {
  return (promos ?? []).filter((p) => isPromoActive(p.valid_from, p.valid_to))
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
