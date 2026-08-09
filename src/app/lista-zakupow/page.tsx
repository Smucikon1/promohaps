'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, Check, Trash2, ArrowLeft, Tag, UtensilsCrossed, Recycle, ChevronDown, X, Share2, PiggyBank } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { hasActivePromo } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  SHOPPING_PREFIX,
  notifyShoppingUpdated,
  type ShoppingItem,
} from '@/lib/shopping'
import { decodeShareList, encodeShareList, mergeShareIntoStorage, type ShareGroup } from '@/lib/shoppingShare'
import { SuggestedRecipes } from '@/components/shopping/SuggestedRecipes'

type FlatItem = ShoppingItem & { _key: string }
type RecipeMeta = { slug: string; title: string; image_url: string | null }

// `useSearchParams` musi być wewnątrz Suspense — bez tego prerender wywala się na tej trasie.
export default function ShoppingListPage() {
  return (
    <Suspense>
      <ShoppingListInner />
    </Suspense>
  )
}

function ShoppingListInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<FlatItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [recipeMeta, setRecipeMeta] = useState<Record<string, RecipeMeta>>({})
  // Grupy zwinięte (tylko gdy mamy > 1 przepis) — składniki są wtedy schowane
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // „Skopiowano" jako fallback dla przeglądarek bez natywnego share sheeta
  const [copied, setCopied] = useState(false)
  // Udostępniona lista przyszła w URL — pokaż ekran importu
  const [incoming, setIncoming] = useState<ShareGroup[] | null>(null)
  const [importDone, setImportDone] = useState<number | null>(null)

  const load = useCallback(() => {
    const result: FlatItem[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(SHOPPING_PREFIX)) continue
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]') as ShoppingItem[]
        if (Array.isArray(parsed)) parsed.forEach((it) => result.push({ ...it, _key: key }))
      } catch {}
    }
    // Promocje na górze (w obrębie każdego przepisu kolejność zostaje zachowana)
    result.sort((a, b) => Number(!!b.isPromo) - Number(!!a.isPromo))
    setItems(result)
    setLoaded(true)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Wykryj udostępnioną listę w URL (?share=…). Token, który już został zaimportowany
  // lub odrzucony w tej sesji, ignorujemy — dzięki temu klik „wstecz" ani powrót do
  // zakładki nie pytają drugi raz. Dependency = sam token (nie cały searchParams),
  // żeby efekt nie strzelał przy każdym re-renderze.
  const shareToken = searchParams.get('share') ?? ''
  useEffect(() => {
    if (!shareToken) {
      setIncoming(null)
      return
    }
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(`shareSeen:${shareToken}`)) return
    const decoded = decodeShareList(shareToken)
    if (decoded && decoded.length > 0) setIncoming(decoded)
  }, [shareToken])

  const markTokenSeen = () => {
    if (shareToken && typeof sessionStorage !== 'undefined') {
      try { sessionStorage.setItem(`shareSeen:${shareToken}`, '1') } catch {}
    }
  }

  const importIncoming = () => {
    if (!incoming) return
    const added = mergeShareIntoStorage(incoming, SHOPPING_PREFIX)
    notifyShoppingUpdated()
    load()
    setImportDone(added)
    setIncoming(null)
    markTokenSeen()
    router.replace('/lista-zakupow')
    setTimeout(() => setImportDone(null), 4000)
  }

  const rejectIncoming = () => {
    setIncoming(null)
    markTokenSeen()
    router.replace('/lista-zakupow')
  }

  // Dane przepisów, z których pochodzą składniki (do nagłówków grup)
  const keySig = [...new Set(items.map((i) => i._key))].sort().join('|')
  useEffect(() => {
    const keyById = new Map<string, string>()
    for (const it of items) {
      const suffix = it._key.slice(SHOPPING_PREFIX.length)
      if (suffix && suffix !== 'plan') keyById.set(suffix, it._key)
    }
    if (keyById.size === 0) return
    let alive = true
    createClient()
      .from('recipes')
      .select('id, slug, title, image_url, promo_products(valid_to)')
      .in('id', [...keyById.keys()])
      .eq('is_published', true)
      .then(({ data }) => {
        if (!alive) return
        // Przepis „ważny" = opublikowany + z trwającą promocją. Wygasłe / wyłączone przez
        // admina / skasowane usuwamy z listy zakupów (i z localStorage) — spójnie z resztą serwisu.
        const valid = new Set<string>()
        const map: Record<string, RecipeMeta> = {}
        for (const r of (data ?? []) as any[]) {
          if (!hasActivePromo(r.promo_products)) continue
          valid.add(r.id)
          map[r.id] = { slug: r.slug, title: r.title, image_url: r.image_url }
        }
        setRecipeMeta(map)

        let removed = 0
        for (const [id, storageKey] of keyById) {
          if (!valid.has(id)) {
            localStorage.removeItem(storageKey)
            removed++
          }
        }
        if (removed > 0) {
          load()
          notifyShoppingUpdated()
        }
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keySig])

  const persistKey = (key: string, next: FlatItem[]) => {
    const forKey: ShoppingItem[] = next.filter((it) => it._key === key).map(({ _key, ...rest }) => rest)
    localStorage.setItem(key, JSON.stringify(forKey))
    notifyShoppingUpdated()
  }

  const toggle = (item: FlatItem) => {
    const next = items.map((it) =>
      it._key === item._key && it.id === item.id ? { ...it, checked: !it.checked } : it
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

  // Usuwa całą grupę (listę jednego przepisu / plan)
  const removeGroup = (key: string) => {
    localStorage.removeItem(key)
    setItems((prev) => prev.filter((it) => it._key !== key))
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
    notifyShoppingUpdated()
  }

  const toggleCollapsed = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!loaded) return null

  const checkedCount = items.filter((i) => i.checked).length
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0

  // Ile ta lista kosztuje i ile na niej zaoszczędzisz względem cen regularnych.
  // Liczone z pozycji, które mają obie ceny — reszta nie wnosi oszczędności.
  const listCost = items.reduce((s, i) => s + (i.price ?? 0), 0)
  const listSaved = items.reduce(
    (s, i) =>
      i.priceRegular != null && i.price != null && i.priceRegular > i.price
        ? s + (i.priceRegular - i.price)
        : s,
    0
  )
  const currentMonth = new Date().toLocaleDateString('pl-PL', { month: 'long' })

  // Grupowanie składników per przepis (klucz listy = przepis albo „plan")
  const groupsMap = new Map<string, FlatItem[]>()
  for (const it of items) {
    if (!groupsMap.has(it._key)) groupsMap.set(it._key, [])
    groupsMap.get(it._key)!.push(it)
  }
  const groups = [...groupsMap.entries()].map(([key, its]) => {
    const suffix = key.slice(SHOPPING_PREFIX.length)
    return {
      key,
      recipe: recipeMeta[suffix] ?? null,
      items: its,
      subtotal: its.reduce((s, i) => s + (i.price ?? 0), 0),
      bought: its.filter((i) => i.checked).length,
    }
  })
  groups.sort((a, b) => (a.recipe?.title ?? '').localeCompare(b.recipe?.title ?? ''))

  // Link do udostępnienia: cała lista zakodowana w URL (bez backendu).
  // Odbiorca otwiera stronę /lista-zakupow?share=…, widzi podgląd i klika „Dodaj do mojej listy".
  const shareUrl = (() => {
    if (typeof window === 'undefined' || groups.length === 0) return ''
    const payload: ShareGroup[] = groups.map((g) => ({
      key: g.key.slice(SHOPPING_PREFIX.length),
      title: g.recipe?.title ?? 'Pozostałe składniki',
      items: g.items.map((it) => ({
        id: it.id, name: it.name, amount: it.amount, unit: it.unit,
        price: it.price ?? null, priceRegular: it.priceRegular ?? null,
        isPromo: it.isPromo, checked: false,
        conditionType: it.conditionType ?? null,
        conditionNote: it.conditionNote ?? null,
        minQuantity: it.minQuantity ?? null,
        fixedPrice: it.fixedPrice,
      })),
    }))
    return `${window.location.origin}/lista-zakupow?share=${encodeShareList(payload)}`
  })()

  const share = async () => {
    if (!shareUrl) return
    const title = 'Moja lista zakupów — Promohaps'
    const text = 'Wysyłam Ci listę zakupów. Kliknij, żeby dodać ją do swojej.'
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text, url: shareUrl })
        return
      } catch {
        // użytkownik anulował lub share niedostępny — fallback do schowka
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ostatnia deska ratunku: prompt z linkiem
      window.prompt('Skopiuj link do listy:', shareUrl)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Modal importu: ktoś udostępnił Ci listę. Na mobile — bottom sheet (bez odstępu
          od krawędzi), na desktopie wyśrodkowany dialog. Trzy pionowe sekcje z osobnym
          scrollowaniem, żeby przyciski były zawsze widoczne. */}
      {incoming && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
          onClick={rejectIncoming}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* uchwyt bottom-sheeta */}
            <div className="sm:hidden mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-stone-200" aria-hidden="true" />

            <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#e6f9f0] flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-5 h-5 text-[#12b76a]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>
                  Udostępniona lista zakupów
                </h2>
                <p className="text-xs text-stone-500">
                  {incoming.reduce((n, g) => n + g.items.length, 0)} pozycji · {incoming.length}{' '}
                  {incoming.length === 1 ? 'grupa' : 'grup'}
                </p>
              </div>
              <button
                onClick={rejectIncoming}
                aria-label="Zamknij"
                className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
              {incoming.map((g, gi) => (
                <div key={gi} className="border border-stone-100 rounded-xl overflow-hidden">
                  {g.title && (
                    <p className="px-3 py-2 text-xs font-semibold text-stone-600 bg-stone-50 border-b border-stone-100 truncate">
                      {g.title}
                    </p>
                  )}
                  <ul className="divide-y divide-stone-50">
                    {g.items.slice(0, 8).map((it, ii) => (
                      <li key={ii} className="px-3 py-1.5 text-sm text-stone-700 flex items-center justify-between gap-2">
                        <span className="truncate">
                          {it.isPromo && <Tag className="inline w-3 h-3 text-amber-500 mr-1" />}
                          {it.name}
                        </span>
                        {it.price != null && (
                          <span className="text-xs font-semibold text-amber-600 flex-shrink-0">
                            {formatPrice(it.price)}
                          </span>
                        )}
                      </li>
                    ))}
                    {g.items.length > 8 && (
                      <li className="px-3 py-1.5 text-xs text-stone-400">+ {g.items.length - 8} więcej</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-stone-100 flex gap-2">
              <button
                onClick={rejectIncoming}
                className="flex-1 rounded-full border border-stone-200 text-stone-600 hover:border-stone-300 text-sm font-semibold py-3 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={importIncoming}
                className="flex-1 rounded-full bg-[#12b76a] hover:bg-[#0f9d5b] text-white text-sm font-semibold py-3 transition-colors"
              >
                Dodaj do mojej listy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast po udanym imporcie */}
      {importDone != null && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-100 px-4 py-3 flex items-center gap-2 text-sm text-green-800">
          <Check className="w-4 h-4 flex-shrink-0" />
          {importDone === 0
            ? 'Wszystkie pozycje już były na Twojej liście.'
            : `Dodano ${importDone} ${importDone === 1 ? 'pozycję' : importDone < 5 ? 'pozycje' : 'pozycji'} do Twojej listy.`}
        </div>
      )}

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
            <h1 className="text-2xl font-bold text-stone-900" style={{ fontFamily: 'var(--font-serif)' }}>
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
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={share}
              aria-label="Udostępnij listę zakupów"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#12b76a] hover:bg-[#0f9d5b] rounded-full px-3.5 py-1.5 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {copied ? 'Skopiowano' : 'Udostępnij'}
            </button>
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-red-500 border border-stone-200 hover:border-red-200 rounded-full px-3.5 py-1.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Wyczyść
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-stone-100">
          <div className="text-5xl mb-4">🛒</div>
          <h2 className="text-xl font-bold mb-2 text-stone-700">Twoja lista jest pusta</h2>
          <p className="text-stone-400 mb-6">Dodaj składniki do listy z poziomu dowolnego przepisu.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors"
          >
            Przeglądaj przepisy
          </Link>
        </div>
      ) : (
        <>
          {/* Pasek postępu (całość) */}
          <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden mb-5">
            <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>

          {/* Efekt oszczędzania na tej liście — konkretna kwota zamiast obietnicy */}
          {listSaved >= 0.5 && (
            <div className="mb-5 rounded-2xl bg-green-50 border border-green-200 px-4 py-3.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <PiggyBank className="w-6 h-6 text-green-700 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-green-900">
                      Oszczędzasz {formatPrice(listSaved)}
                      <span className="font-normal text-green-800"> na tych zakupach</span>
                    </p>
                    <p className="text-xs text-green-700 mt-0.5">
                      Kupując z gazetek w tym miesiącu ({currentMonth})
                    </p>
                  </div>
                </div>
                {listCost > 0 && (
                  <div className="text-right flex-shrink-0">
                    <span className="block text-[11px] text-green-700">Do zapłaty</span>
                    <span className="block text-lg font-bold text-green-900">{formatPrice(listCost)}</span>
                    <span className="block text-[11px] text-stone-400 line-through">
                      {formatPrice(listCost + listSaved)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Składniki pogrupowane per przepis */}
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.key} className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                {/* Pasek akcji grupy — zwiń/rozwiń (gdy >1 grupa) + usuń tę listę */}
                <div className="flex items-center gap-1 px-2 py-1 border-b border-stone-50 bg-stone-50/50">
                  <div className="flex-1" />
                  {groups.length > 1 && (
                    <button
                      onClick={() => toggleCollapsed(g.key)}
                      aria-label={collapsed.has(g.key) ? 'Rozwiń listę' : 'Zwiń listę'}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                    >
                      <ChevronDown className={cn('w-4 h-4 transition-transform', collapsed.has(g.key) && '-rotate-90')} />
                    </button>
                  )}
                  <button
                    onClick={() => { if (confirm('Usunąć tę listę z zakupów?')) removeGroup(g.key) }}
                    aria-label="Usuń tę listę"
                    className="w-7 h-7 flex items-center justify-center rounded-md text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Nagłówek grupy = przepis (klikalny do detalu) */}
                {g.recipe ? (
                  <Link
                    href={`/przepis/${g.recipe.slug}`}
                    className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 hover:bg-stone-50 transition-colors"
                  >
                    <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                      {g.recipe.image_url ? (
                        <Image src={g.recipe.image_url} alt={g.recipe.title} fill className="object-cover" sizes="44px" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-50 to-stone-100">
                          <UtensilsCrossed className="w-5 h-5 text-[#12b76a]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-stone-800 truncate" style={{ fontFamily: 'var(--font-serif)' }}>
                        {g.recipe.title}
                      </p>
                      <p className="text-xs text-stone-400">
                        {g.bought}/{g.items.length} kupionych
                        {g.subtotal > 0 && <> · {formatPrice(g.subtotal)}</>}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
                    <div className="w-11 h-11 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                      <UtensilsCrossed className="w-5 h-5 text-stone-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
                        Pozostałe składniki
                      </p>
                      <p className="text-xs text-stone-400">
                        {g.bought}/{g.items.length} kupionych
                        {g.subtotal > 0 && <> · {formatPrice(g.subtotal)}</>}
                      </p>
                    </div>
                  </div>
                )}

                {/* Składniki przepisu — schowane, gdy grupa zwinięta */}
                {!collapsed.has(g.key) && (
                <ul className="divide-y divide-stone-50">
                  {g.items.map((item) => (
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
                            item.checked ? 'bg-green-500 border-green-500' : item.isPromo ? 'border-amber-400' : 'border-stone-300'
                          )}
                        >
                          {item.checked && <Check className="w-3 h-3 text-white" />}
                        </div>

                        <span className="flex-1 min-w-0">
                          <span
                            className={cn(
                              'text-sm transition-all flex items-center gap-1.5',
                              item.checked ? 'line-through text-stone-400' : item.isPromo ? 'text-amber-900 font-medium' : 'text-stone-700'
                            )}
                          >
                            {item.isPromo && <Tag className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                            <span className="truncate">{item.name}</span>
                          </span>
                          <span className="flex flex-wrap items-center gap-2">
                            {item.isPromo && (
                              <span className="text-[10px] uppercase tracking-wide text-amber-600 font-semibold">z gazetki</span>
                            )}
                            {(item.sharedCount ?? 0) > 1 && (
                              <span
                                title="Jedno opakowanie wykorzystasz w kilku przepisach"
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5"
                              >
                                <Recycle className="w-3 h-3" />
                                starcza na {item.sharedCount} przepisy
                              </span>
                            )}
                          </span>
                        </span>

                        {item.price != null ? (
                          <span className="text-right flex-shrink-0">
                            <span className="block text-sm font-bold text-amber-600">{formatPrice(item.price)}</span>
                            {item.priceRegular != null && (
                              <span className="block text-[11px] text-stone-400 line-through">{formatPrice(item.priceRegular)}</span>
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
                )}
              </div>
            ))}
          </div>

          {progress === 100 && (
            <div className="mt-4 px-5 py-4 bg-green-50 rounded-2xl text-center">
              <p className="text-sm text-green-700 font-medium">🎉 Wszystko kupione! Czas gotować!</p>
            </div>
          )}

          {/* Propozycje przepisów wykorzystujących te same produkty */}
          <SuggestedRecipes
            productNames={items.map((i) => i.name)}
            excludeRecipeIds={groups.map((g) => g.key.slice(SHOPPING_PREFIX.length)).filter(Boolean)}
          />
        </>
      )}
    </div>
  )
}
