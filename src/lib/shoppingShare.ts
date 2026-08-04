'use client'

import type { ShoppingItem } from '@/lib/shopping'

// Kompaktowy zrzut listy do URL. Skracamy nazwy pól (n/a/u/p/pr/is/ch/ct/cn/mq),
// żeby zmieścić więcej pozycji w rozsądnym linku. `groups` niesie klucz źródłowy
// (przepis albo „plan") + tytuł, żeby po imporcie zachować grupowanie i nagłówki.
export interface ShareGroup {
  key: string // np. „51c2159e-…" albo „plan"
  title: string | null
  items: Array<Pick<ShoppingItem,
    | 'id' | 'name' | 'amount' | 'unit' | 'price' | 'priceRegular'
    | 'isPromo' | 'checked' | 'conditionType' | 'conditionNote' | 'minQuantity' | 'fixedPrice'
  >>
}

const KEY_MAP: Record<string, string> = {
  id: 'i', name: 'n', amount: 'a', unit: 'u', price: 'p', priceRegular: 'pr',
  isPromo: 'is', checked: 'ch', conditionType: 'ct', conditionNote: 'cn',
  minQuantity: 'mq', fixedPrice: 'fp',
}
const REV_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_MAP).map(([k, v]) => [v, k])
)

// base64url z obsługą Unicode (btoa/atob wprost padają na polskich znakach)
const b64uEncode = (s: string) => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const b64uDecode = (s: string) => {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function encodeShareList(groups: ShareGroup[]): string {
  const compact = groups.map((g) => ({
    k: g.key,
    t: g.title ?? null,
    i: g.items.map((it) => {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(it)) {
        if (v == null || v === false) continue // wyrzuć puste i falsy
        out[KEY_MAP[k] ?? k] = v
      }
      return out
    }),
  }))
  return b64uEncode(JSON.stringify({ v: 1, g: compact }))
}

export function decodeShareList(token: string): ShareGroup[] | null {
  try {
    const parsed = JSON.parse(b64uDecode(token))
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.g)) return null
    return parsed.g.map((g: any): ShareGroup => ({
      key: String(g.k ?? ''),
      title: g.t ?? null,
      items: (g.i ?? []).map((it: any) => {
        const rebuilt: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(it)) rebuilt[REV_MAP[k] ?? k] = v
        return rebuilt as ShareGroup['items'][number]
      }),
    }))
  } catch {
    return null
  }
}

// Import listy do własnego localStorage. Dokleja tylko brakujące pozycje
// (klucz porównania = name|unit), więc powtórny import nie zdubluje.
// Zwraca liczbę faktycznie dodanych pozycji.
export function mergeShareIntoStorage(groups: ShareGroup[], SHOPPING_PREFIX: string): number {
  let added = 0
  const norm = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase()
  for (const g of groups) {
    if (!g.key) continue
    const storageKey = g.key.startsWith(SHOPPING_PREFIX) ? g.key : `${SHOPPING_PREFIX}${g.key}`
    let existing: ShoppingItem[] = []
    try { existing = JSON.parse(localStorage.getItem(storageKey) || '[]') } catch {}
    if (!Array.isArray(existing)) existing = []
    const seen = new Set(existing.map((it) => `${norm(it.name)}|${norm(it.unit)}`))
    const merged = [...existing]
    for (const it of g.items) {
      const key = `${norm(it.name)}|${norm(it.unit)}`
      if (seen.has(key)) continue
      seen.add(key)
      // Odbiorca zaczyna od zera — checked resetujemy niezależnie od źródła
      merged.push({ ...(it as any), checked: false } as ShoppingItem)
      added++
    }
    localStorage.setItem(storageKey, JSON.stringify(merged))
  }
  return added
}
