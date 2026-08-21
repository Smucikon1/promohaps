'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { POPULAR_DISHES, dishMatchesTitle, type PopularDish } from '@/lib/popularDishes'
import { cn } from '@/lib/utils'
import { Check, Loader2, Sparkles, ExternalLink } from 'lucide-react'
import type { Store } from '@/types'

const dzis = () => new Date().toISOString().slice(0, 10)

type Stan = 'wolne' | 'pracuje' | 'gotowe' | 'blad'

interface Wynik {
  stan: Stan
  komunikat?: string
  editUrl?: string
}

/**
 * Ręczne zamawianie konkretnego klasyka.
 *
 * Automat dobiera dania sam, ważąc rangę przez to, co jest w gazetce — ale czasem
 * po prostu wiadomo, że w katalogu brakuje schabowego. Ten panel pozwala wskazać
 * danie palcem, zamiast czekać, aż losowanie na nie trafi.
 */
export function ClassicRecipes({ stores }: { stores: Store[] }) {
  const [storeSlug, setStoreSlug] = useState(stores[0]?.slug ?? '')
  const [promocje, setPromocje] = useState<any[]>([])
  const [tytuly, setTytuly] = useState<string[]>([])
  const [ladowanie, setLadowanie] = useState(false)
  const [blad, setBlad] = useState('')
  const [wyniki, setWyniki] = useState<Record<string, Wynik>>({})

  const store = stores.find((s) => s.slug === storeSlug)

  // Promocje i istniejące tytuły tego sklepu. Tytuły służą do oznaczenia, czego
  // już nie trzeba zamawiać — generator i tak odrzuciłby duplikat, ale lepiej
  // powiedzieć to przed kliknięciem niż po zużyciu wywołania API.
  const wczytaj = useCallback(async () => {
    if (!store) return
    setLadowanie(true)
    setBlad('')
    const supabase = createClient()
    const [{ data: promo, error: e1 }, { data: przepisy, error: e2 }] = await Promise.all([
      supabase
        .from('promo_products')
        .select('name, price_promo, price_regular, condition_type, condition_note, min_quantity, valid_from, valid_to')
        .eq('store_id', store.id)
        .is('recipe_id', null)
        .gte('valid_to', dzis())
        .order('valid_to', { ascending: true }),
      supabase.from('recipes').select('title').eq('store_id', store.id).limit(200),
    ])
    setLadowanie(false)
    if (e1 || e2) {
      setBlad(`Wczytywanie: ${e1?.message ?? e2?.message}`)
      return
    }
    setPromocje(promo ?? [])
    setTytuly((przepisy ?? []).map((r: any) => r.title).filter(Boolean))
    setWyniki({})
  }, [store])

  useEffect(() => { wczytaj() }, [wczytaj])

  const generuj = async (danie: PopularDish) => {
    if (!store) return
    setWyniki((w) => ({ ...w, [danie.nazwa]: { stan: 'pracuje' } }))
    try {
      const res = await fetch('/api/generate-recipe-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeSlug: store.slug,
          storeName: store.name,
          // Temat nadrzędny — generator pomija wtedy własne losowanie dania
          theme:
            `Klasyk polskiego stołu: ${danie.nazwa} (${danie.opis}). ` +
            'Zrób go tak, jak się go zna z domu — bez udziwnień i bez zamiany na wariację. ' +
            'Tytuł ma być rozpoznawalny od pierwszego spojrzenia.',
          promoProducts: promocje,
        }),
      })
      // Vercel przy timeoucie zwraca HTML, więc bez tej kontroli res.json()
      // wywalałby się na „unexpected character" zamiast pokazać powód
      const typ = res.headers.get('content-type') ?? ''
      if (!typ.includes('application/json')) {
        throw new Error(`Serwer zwrócił ${res.status} — najpewniej przekroczony limit czasu.`)
      }
      const dane = await res.json()
      if (!res.ok) throw new Error(dane?.error ?? `Błąd ${res.status}`)

      setWyniki((w) => ({ ...w, [danie.nazwa]: { stan: 'gotowe', editUrl: dane.editUrl } }))
      setTytuly((t) => [...t, dane.title])
    } catch (e: any) {
      setWyniki((w) => ({ ...w, [danie.nazwa]: { stan: 'blad', komunikat: e?.message ?? 'Nie udało się.' } }))
    }
  }

  const maszJuz = (d: PopularDish) => tytuly.some((t) => dishMatchesTitle(d, t))
  const brakujace = POPULAR_DISHES.filter((d) => !maszJuz(d))

  return (
    <section className="bg-white rounded-2xl border border-stone-100 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="text-lg font-bold text-stone-800" style={{ fontFamily: 'var(--font-serif)' }}>
          Klasyki na zamówienie
        </h2>
        <select
          value={storeSlug}
          onChange={(e) => setStoreSlug(e.target.value)}
          className="rounded-xl border border-stone-200 px-3 py-1.5 text-sm"
        >
          {stores.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
        </select>
      </div>

      <p className="text-sm text-stone-500 mb-4">
        {ladowanie
          ? 'Wczytywanie…'
          : `${promocje.length} aktywnych promocji · brakuje ${brakujace.length} z ${POPULAR_DISHES.length} klasyków`}
      </p>

      {blad && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{blad}</p>}

      {promocje.length === 0 && !ladowanie && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Brak aktywnych promocji dla tego sklepu — przepisy powstaną na zwykłych cenach,
          bez oszczędności z gazetki. Wgraj najpierw gazetkę.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {POPULAR_DISHES.map((d) => {
          const wynik = wyniki[d.nazwa]
          const juzJest = maszJuz(d)
          const pracuje = wynik?.stan === 'pracuje'

          return (
            <div
              key={d.nazwa}
              className={cn(
                'rounded-xl border p-3 transition-colors',
                juzJest ? 'border-stone-100 bg-stone-50' : 'border-stone-200 bg-white'
              )}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-xl leading-none mt-0.5" aria-hidden="true">{d.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-sm font-semibold capitalize', juzJest ? 'text-stone-400' : 'text-stone-800')}>
                      {d.nazwa}
                    </span>
                    {d.typ === 'deser' && (
                      <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-purple-600">
                        deser
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 line-clamp-1">{d.opis}</p>
                </div>
              </div>

              <div className="mt-2.5">
                {wynik?.stan === 'gotowe' ? (
                  <a
                    href={wynik.editUrl}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#12b76a] hover:underline"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Szkic gotowy — otwórz
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : wynik?.stan === 'blad' ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-red-600 line-clamp-2">{wynik.komunikat}</p>
                    <button
                      type="button"
                      onClick={() => generuj(d)}
                      className="text-xs font-semibold text-stone-600 hover:text-stone-900 underline"
                    >
                      Spróbuj ponownie
                    </button>
                  </div>
                ) : juzJest ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400">
                    <Check className="w-3.5 h-3.5" />
                    Masz w katalogu
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => generuj(d)}
                    disabled={pracuje || !store}
                    className={cn(
                      'inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors',
                      pracuje
                        ? 'bg-stone-100 text-stone-400'
                        : 'bg-[#12b76a] text-white hover:bg-[#0ea25d]'
                    )}
                  >
                    {pracuje ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generuję…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Wygeneruj
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
