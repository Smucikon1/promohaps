'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ShoppingCart, RotateCcw, Check, Tag, Plus, PiggyBank } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import { useShoppingList } from '@/hooks/useShoppingList'
import type { ShoppingItem } from '@/lib/shopping'
import type { Ingredient, PromoProduct } from '@/types'

interface ShoppingListProps {
  recipeId: string
  ingredients: Ingredient[]
  promoProducts?: PromoProduct[]
  // false = promocje wygasły; ceny promocyjne przestają obowiązywać
  promoLive?: boolean
  /** Oszczędność z gazetki w procentach — pokazujemy ją nad sumą, bo tam pada decyzja zakupowa */
  savingsPercent?: number
}

export function ShoppingList({ recipeId, ingredients, promoProducts = [], promoLive = true, savingsPercent = 0 }: ShoppingListProps) {
  const { items, loaded, exists, addAll, removeAll, syncMeta, toggleItem, resetList, checkedCount } =
    useShoppingList(recipeId)
  const [justAdded, setJustAdded] = useState(false)

  // Definicja składników: produkty z gazetki (wyróżnione) + zwykłe składniki
  const defs = useMemo<Omit<ShoppingItem, 'checked'>[]>(() => {
    // Po wygaśnięciu promocji cena promocyjna jest nieosiągalna — pokazujemy regularną
    // i zdejmujemy oznaczenia „z gazetki" wraz z warunkami (karta, wielosztuka),
    // bo dotyczyły tamtej, już nieobowiązującej oferty.
    const promos = promoProducts.map((p) => ({
      id: p.id, name: p.name, amount: null, unit: null,
      isPromo: promoLive,
      price: promoLive ? p.price_promo : (p.price_regular ?? null),
      priceRegular: promoLive ? p.price_regular : null,
      fixedPrice: true,
      conditionType: promoLive ? (p.condition_type ?? null) : null,
      conditionNote: promoLive ? (p.condition_note ?? null) : null,
      minQuantity: promoLive ? (p.min_quantity ?? null) : null,
    }))
    // Ceny składników są policzone po cenach promocyjnych, a cen regularnych na tym
    // poziomie nie znamy. Po wygaśnięciu ukrywamy je zamiast zgadywać — orientacyjną
    // sumę bez promocji użytkownik widzi w pasku wartości nad listą.
    const regular = ingredients.map((i) => ({
      id: i.id, name: i.name, amount: i.amount, unit: i.unit,
      isPromo: promoLive && !!i.is_promo_product,
      price: promoLive ? (i.price ?? null) : null,
      priceRegular: null,
      fixedPrice: false,
    }))
    return [...promos, ...regular]
  }, [ingredients, promoProducts, promoLive])

  // syncMeta wywoływane raz na mount (nie na każdy re-render defs — nowa referencja
  // za każdym renderem parent'a powodowała setItems w loop-e nawet gdy dane były te same,
  // co blokowało React handler-y klik).
  const syncedRef = useRef(false)
  useEffect(() => {
    if (loaded && !syncedRef.current) {
      syncedRef.current = true
      syncMeta(defs)
    }
  }, [loaded, defs, syncMeta])

  if (!loaded) {
    return (
      <div className="bg-white rounded-2xl border border-stone-100 p-5" aria-hidden="true">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-stone-100" />
          <div className="h-4 w-28 rounded bg-stone-100" />
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-stone-100" />
              <div className="h-3 flex-1 rounded bg-stone-100" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Na liście pokazujemy zapisane pozycje (ze stanem odhaczenia); poza listą — podgląd z definicji
  const rows: ShoppingItem[] = exists ? items : defs.map((d) => ({ ...d, checked: false }))
  const total = rows.length
  const progress = exists && total > 0 ? (checkedCount / total) * 100 : 0
  const totalPrice = rows.reduce((sum, it) => sum + (it.price != null ? it.price : 0), 0)

  const rowContent = (item: ShoppingItem) => (
    <>
      <span className="flex-1 min-w-0">
        <span
          className={cn(
            'text-sm transition-all flex items-start gap-1.5',
            item.checked ? 'line-through text-stone-400' : item.isPromo ? 'text-amber-900 font-medium' : 'text-stone-700'
          )}
        >
          {item.isPromo && <Tag className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" />}
          {/* Bez truncate: nazwa produktu to jedyna informacja, po której poznajesz,
              co masz kupić — ucięta „Polska ..." nie mówi nic. */}
          <span className="break-words">{item.name}</span>
        </span>

        {/* Gramatura zeszła tu spod ceny. Po prawej stronie siedziała w kolumnie
            z flex-shrink-0, więc długi opis („1 kg (1 opakowanie, użyta 1 szt.)")
            zabierał całą szerokość i ściskał nazwę do kilku znaków. */}
        {(item.amount || item.unit) && (
          <span className="block text-xs text-stone-500">
            {item.amount} {item.unit}
          </span>
        )}
        {item.isPromo && (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-amber-600 font-semibold">z gazetki</span>
            {item.conditionType === 'karta' && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                tylko z kartą
              </span>
            )}
            {item.conditionType === 'wielosztuka' && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                {item.minQuantity ? `przy ${item.minQuantity} szt.` : 'wielosztuka'}
              </span>
            )}
          </span>
        )}
      </span>

      <span className="text-right flex-shrink-0 leading-tight">
        {item.price != null && (
          <span className={cn('block text-sm font-semibold', item.isPromo ? 'text-amber-600' : 'text-stone-700')}>
            {formatPrice(item.price)}
          </span>
        )}
        {item.priceRegular != null && (
          <span className="block text-[11px] text-stone-400 line-through">{formatPrice(item.priceRegular)}</span>
        )}
      </span>
    </>
  )

  return (
    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
      {/* Nagłówek */}
      <div className="px-5 py-4 border-b border-stone-50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-stone-800">Składniki</h3>
          {exists && <span className="text-xs text-stone-400 ml-1">{checkedCount}/{total}</span>}
        </div>
        {exists && checkedCount > 0 && (
          <button
            onClick={resetList}
            className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Resetuj
          </button>
        )}
      </div>

      {/* Pasek postępu (tylko gdy na liście) */}
      {exists && total > 0 && (
        <div className="h-1 bg-stone-50">
          <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Pozycje */}
      <ul className="divide-y divide-stone-50">
        {rows.map((item) =>
          exists ? (
            <li key={item.id}>
              <button
                onClick={() => toggleItem(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-5 py-3 transition-colors text-left',
                  item.isPromo ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-stone-50'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                    item.checked ? 'bg-green-500 border-green-500' : item.isPromo ? 'border-amber-400' : 'border-stone-300'
                  )}
                >
                  {item.checked && <Check className="w-3 h-3 text-white" />}
                </div>
                {rowContent(item)}
              </button>
            </li>
          ) : (
            <li key={item.id}>
              <div className={cn('w-full flex items-center gap-3 px-5 py-3', item.isPromo && 'bg-amber-50/60')}>
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                    item.isPromo ? 'bg-amber-400' : 'bg-stone-300'
                  )}
                />
                {rowContent(item)}
              </div>
            </li>
          )
        )}
      </ul>

      {/* Cena całości (suma cen składników i produktów z gazetki).
          Oszczędność stoi nad sumą, a nie w pasku statystyk na górze strony:
          liczba mówi coś dopiero w zestawieniu z kwotą, której dotyczy, a pasek
          i tak był przeładowany pięcioma kafelkami. */}
      {totalPrice > 0 && (
        <div className="px-5 py-3.5 border-t border-stone-100">
          {savingsPercent > 0 && (
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500">
                <PiggyBank className="w-4 h-4 text-green-600" />
                taniej z gazetki
              </span>
              <span className="text-sm font-extrabold text-green-700">−{savingsPercent}%</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-stone-700">Razem</span>
            <span className="text-lg font-bold text-amber-600">{formatPrice(totalPrice)}</span>
          </div>
        </div>
      )}

      {/* Akcja: dodaj / status na liście — bez animacji transform, żeby nie psuć hit-testingu klikalnych elementów pod spodem */}
      {total > 0 && (
        exists ? (
          <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between bg-green-50/50">
            <span className="text-sm font-medium text-green-700 inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white">
                <Check className="w-3 h-3" />
              </span>
              {justAdded ? 'Dodano do listy zakupów!' : 'Na liście zakupów'}
            </span>
            <button
              onClick={removeAll}
              className="text-xs text-stone-500 hover:text-red-500 transition-colors"
            >
              Usuń z listy
            </button>
          </div>
        ) : (
          <div className="px-5 py-4 border-t border-stone-100">
            <button
              onClick={() => {
                addAll(defs)
                setJustAdded(true)
                setTimeout(() => setJustAdded(false), 1800)
              }}
              className="w-full btn-primary flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Plus className="w-4 h-4" />
              Dodaj do listy zakupów
            </button>
          </div>
        )
      )}

      {exists && progress === 100 && (
        <div className="px-5 py-4 bg-green-50 text-center">
          <p className="text-sm text-green-700 font-medium">🎉 Wszystko kupione! Czas gotować!</p>
        </div>
      )}
    </div>
  )
}
