'use client'

import { useState, useEffect, useCallback } from 'react'
import { track } from '@/lib/analytics'
import {
  SHOPPING_PREFIX,
  notifyShoppingUpdated,
  type ShoppingItem,
} from '@/lib/shopping'

export type { ShoppingItem }

export function useShoppingList(recipeId: string) {
  const storageKey = `${SHOPPING_PREFIX}${recipeId}`
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [exists, setExists] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      try {
        setItems(JSON.parse(raw))
        setExists(true)
      } catch {}
    }
    setLoaded(true)
  }, [storageKey])

  const save = useCallback(
    (next: ShoppingItem[]) => {
      setItems(next)
      setExists(true)
      localStorage.setItem(storageKey, JSON.stringify(next))
      notifyShoppingUpdated()
    },
    [storageKey]
  )

  // Dodanie przepisu do listy — jawna akcja użytkownika
  const addAll = useCallback(
    (defs: Omit<ShoppingItem, 'checked'>[]) => {
      save(defs.map((d) => ({ ...d, checked: false })))
      track.shoppingListAdd(recipeId)
    },
    [save, recipeId]
  )

  // Usunięcie przepisu z listy
  const removeAll = useCallback(() => {
    localStorage.removeItem(storageKey)
    setItems([])
    setExists(false)
    notifyShoppingUpdated()
  }, [storageKey])

  // Aktualizuje metadane (nazwy/ceny/promo) TYLKO jeśli lista już istnieje.
  // Samo przeglądanie przepisu niczego nie dodaje.
  const syncMeta = useCallback(
    (defs: Omit<ShoppingItem, 'checked'>[]) => {
      const existingRaw = localStorage.getItem(storageKey)
      if (!existingRaw) return
      let existing: ShoppingItem[] = []
      try {
        existing = JSON.parse(existingRaw)
      } catch {
        return
      }
      const checkedById = new Map(existing.map((i) => [i.id, i.checked]))
      const merged = defs.map((d) => ({ ...d, checked: checkedById.get(d.id) ?? false }))
      // zapisz tylko przy realnej zmianie zestawu pozycji
      const sameIds =
        merged.length === existing.length &&
        merged.every((m, idx) => m.id === existing[idx]?.id)
      if (!sameIds) save(merged)
      else setItems(merged)
    },
    [storageKey, save]
  )

  const toggleItem = useCallback(
    (id: string) => {
      const next = items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))
      save(next)
      track.shoppingListCheck(recipeId)
    },
    [items, save, recipeId]
  )

  const resetList = useCallback(() => {
    save(items.map((i) => ({ ...i, checked: false })))
  }, [items, save])

  const checkedCount = items.filter((i) => i.checked).length

  return { items, loaded, exists, addAll, removeAll, syncMeta, toggleItem, resetList, checkedCount }
}
