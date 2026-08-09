'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Plus } from 'lucide-react'
import { SHOPPING_PREFIX, notifyShoppingUpdated, type ShoppingItem } from '@/lib/shopping'
import { track } from '@/lib/analytics'

interface SetRecipeInput {
  id: string
  ingredients?: { id: string; name: string; amount: string | null; unit: string | null; price: number | null; is_promo_product?: boolean }[]
  promo_products?: any[]
}

// Dodaje cały zestaw do listy zakupów. Zapisujemy per przepis (ten sam format,
// co przycisk na stronie przepisu), więc lista grupuje pozycje jak zwykle
// i pojedynczy przepis da się z niej usunąć osobno.
export function AddSetToList({ recipes }: { recipes: SetRecipeInput[] }) {
  const router = useRouter()
  const [added, setAdded] = useState(false)

  const addAll = () => {
    for (const recipe of recipes) {
      const promos: ShoppingItem[] = (recipe.promo_products ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        amount: null,
        unit: null,
        checked: false,
        isPromo: true,
        price: p.price_promo,
        priceRegular: p.price_regular,
        fixedPrice: true,
        conditionType: p.condition_type ?? null,
        conditionNote: p.condition_note ?? null,
        minQuantity: p.min_quantity ?? null,
      }))
      const regular: ShoppingItem[] = (recipe.ingredients ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        amount: i.amount,
        unit: i.unit,
        checked: false,
        isPromo: !!i.is_promo_product,
        price: i.price ?? null,
        priceRegular: null,
        fixedPrice: false,
      }))
      localStorage.setItem(`${SHOPPING_PREFIX}${recipe.id}`, JSON.stringify([...promos, ...regular]))
      track.shoppingListAdd(recipe.id)
    }
    notifyShoppingUpdated()
    setAdded(true)
  }

  if (added) {
    return (
      <button
        onClick={() => router.push('/lista-zakupow')}
        className="inline-flex items-center gap-2 rounded-full bg-green-100 text-green-800 border border-green-200 px-5 py-2.5 text-sm font-semibold hover:bg-green-200 transition-colors"
      >
        <Check className="w-4 h-4" />
        Dodano — zobacz listę
      </button>
    )
  }

  return (
    <button onClick={addAll} className="btn-primary inline-flex items-center gap-2 flex-shrink-0">
      <Plus className="w-4 h-4" />
      Dodaj cały zestaw do listy
    </button>
  )
}
