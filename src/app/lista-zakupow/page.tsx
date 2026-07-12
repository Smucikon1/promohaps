'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ShoppingCart, Check, Trash2, ArrowLeft, Tag } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import {
  SHOPPING_PREFIX,
  notifyShoppingUpdated,
  type ShoppingItem,
} from '@/lib/shopping'

type FlatItem = ShoppingItem & { _key: string }

export default function ShoppingListPage() {
  const [items, setItems] = useState<FlatItem[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(() => {
    const result: FlatItem[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(SHOPPING_PREFIX)) continue
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]') as ShoppingItem[]
        if (Array.isArray(parsed)) {
          parsed.forEach((it) => result.push({ ...it, _key: key }))
        }
      } catch {}
    }
    // Promocje na górze
    result.sort((a, b) => Number(!!b.isPromo) - Number(!!a.isPromo))
    setItems(result)
    setLoaded(true)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Zapisuje z powrotem do właściwego klucza per-przepis
  const persistKey = (key: string, next: FlatItem[]) => {
    const forKey: ShoppingItem[] = next
      .filter((it) => it._key === key)
      .map(({ _key, ...rest }) => rest)
    localStorage.setItem(key, JSON.stringify(forKey))
    notifyShoppingUpdated()
  }

  const toggle = (item: FlatItem) => {
    const next = items.map((it) =>
      it._key === item._key && it.id === item.id
        ? { ...it, checked: !it.checked }
        : it
    )
    setItems(next)
    persistKey(item._key, next)
  }

  const clearAll = () => {
    if (!confirm('Wyczyścić całą listę zakupów?')) return
    const keys = new Set(items.map((it) => it._key))
    keys.forEach((k) => localStorage.removeItem(k))
    setItems([])
    notifyShoppingUpdated()
  }

  if (!loaded) return null

  const checkedCount = items.filter((i) => i.checked).length
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-amber-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Wróć do przepisów
      </Link>

      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1
              className="text-2xl font-bold text-stone-900"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Lista zakupów
            </h1>
            {items.length > 0 && (
              <p className="text-sm text-stone-500">
                {checkedCount}/{items.length} kupionych
              </p>
            )}
          </div>
        </div>
        {items.length > 0 && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-red-500 border border-stone-200 hover:border-red-200 rounded-full px-3.5 py-1.5 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            Wyczyść
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-stone-100">
          <div className="text-5xl mb-4">🛒</div>
          <h2 className="text-xl font-bold mb-2 text-stone-700">
            Twoja lista jest pusta
          </h2>
          <p className="text-stone-400 mb-6">
            Dodaj składniki do listy z poziomu dowolnego przepisu.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors"
          >
            Przeglądaj przepisy
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          {/* Pasek postępu */}
          <div className="h-1 bg-stone-50">
            <div
              className="h-full bg-amber-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <ul className="divide-y divide-stone-50">
            {items.map((item) => (
              <li key={`${item._key}:${item.id}`}>
                <button
                  onClick={() => toggle(item)}
                  className={cn(
                    'w-full flex items-center gap-3 px-5 py-3 transition-colors text-left',
                    item.isPromo ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-stone-50'
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                      item.checked
                        ? 'bg-green-500 border-green-500'
                        : item.isPromo
                        ? 'border-amber-400'
                        : 'border-stone-300'
                    )}
                  >
                    {item.checked && <Check className="w-3 h-3 text-white" />}
                  </div>

                  <span className="flex-1 min-w-0">
                    <span
                      className={cn(
                        'text-sm transition-all flex items-center gap-1.5',
                        item.checked
                          ? 'line-through text-stone-400'
                          : item.isPromo
                          ? 'text-amber-900 font-medium'
                          : 'text-stone-700'
                      )}
                    >
                      {item.isPromo && <Tag className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                      <span className="truncate">{item.name}</span>
                    </span>
                    {item.isPromo && (
                      <span className="text-[10px] uppercase tracking-wide text-amber-600 font-semibold">
                        z gazetki
                      </span>
                    )}
                  </span>

                  {item.price != null ? (
                    <span className="text-right flex-shrink-0">
                      <span className="block text-sm font-bold text-amber-600">
                        {formatPrice(item.price)}
                      </span>
                      {item.priceRegular != null && (
                        <span className="block text-[11px] text-stone-400 line-through">
                          {formatPrice(item.priceRegular)}
                        </span>
                      )}
                    </span>
                  ) : (
                    (item.amount || item.unit) && (
                      <span className="text-xs text-stone-400 flex-shrink-0">
                        {item.amount} {item.unit}
                      </span>
                    )
                  )}
                </button>
              </li>
            ))}
          </ul>

          {progress === 100 && (
            <div className="px-5 py-4 bg-green-50 text-center">
              <p className="text-sm text-green-700 font-medium">
                🎉 Wszystko kupione! Czas gotować!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
