'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ScanLine, Save, Sparkles, Trash2, ExternalLink } from 'lucide-react'
import type { Store } from '@/types'

type ConditionType = 'brak' | 'karta' | 'wielosztuka' | 'inny'

interface Product {
  name: string
  price_promo: number | null
  price_regular: number | null
  condition_type?: ConditionType
  condition_note?: string | null
  min_quantity?: number | null
  // Okres ważności odczytany z gazetki (YYYY-MM-DD) lub null
  valid_from?: string | null
  valid_to?: string | null
}

const CONDITION_LABEL: Record<ConditionType, string> = {
  brak: '',
  karta: 'z kartą',
  wielosztuka: 'wielosztuka',
  inny: 'warunek',
}

const CONDITION_STYLE: Record<ConditionType, string> = {
  brak: '',
  karta: 'bg-purple-100 text-purple-700',
  wielosztuka: 'bg-green-100 text-green-700',
  inny: 'bg-stone-100 text-stone-600',
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Nie udało się odczytać pliku.'))
    r.readAsDataURL(file)
  })
}

type PageImage = { base64: string; mediaType: string }

const MAX_EDGE = 1600 // dłuższy bok strony/obrazu po przeskalowaniu
const PAGES_PER_REQUEST = 3 // partia stron na jedno wywołanie API

function canvasToBase64(canvas: HTMLCanvasElement): PageImage {
  const out = canvas.toDataURL('image/jpeg', 0.85)
  return { base64: out.split(',')[1], mediaType: 'image/jpeg' }
}

// Pojedynczy obraz -> zmniejszony JPEG
async function imageToPage(file: File): Promise<PageImage> {
  const dataUrl = await readDataUrl(file)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Nie udało się wczytać obrazu.'))
    i.src = dataUrl
  })
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvasToBase64(canvas)
}

// PDF -> każda strona zrenderowana do JPEG (omija limit rozmiaru żądania)
async function pdfToPages(file: File, onProgress: (done: number, total: number) => void): Promise<PageImage[]> {
  const pdfjs: any = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const pages: PageImage[] = []

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(2, MAX_EDGE / Math.max(base.width, base.height))
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    pages.push(canvasToBase64(canvas))
    onProgress(n, doc.numPages)
  }
  return pages
}

export function LeafletEngine({ stores }: { stores: Store[] }) {
  const [storeSlug, setStoreSlug] = useState(stores[0]?.slug ?? '')
  const [extracting, setExtracting] = useState(false)
  const [progress, setProgress] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  const [theme, setTheme] = useState('')
  const [generating, setGenerating] = useState(false)
  const [drafts, setDrafts] = useState<{ id: string; title: string; editUrl: string }[]>([])

  const store = stores.find((s) => s.slug === storeSlug)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100 * 1024 * 1024) {
      setError('Plik za duży (maks. 100 MB).')
      e.target.value = ''
      return
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    setExtracting(true)
    setError('')
    setSavedMsg('')
    setProducts([])

    try {
      // 1) Przygotowanie stron (PDF rozkładamy na obrazy w przeglądarce)
      let pages: PageImage[]
      if (isPdf) {
        setProgress('Wczytuję PDF...')
        pages = await pdfToPages(file, (done, total) => setProgress(`Renderuję strony: ${done}/${total}`))
      } else {
        pages = [await imageToPage(file)]
      }
      if (pages.length === 0) throw new Error('PDF nie zawiera stron.')

      // 2) Wysyłka partiami — omija limit rozmiaru żądania
      const merged: Product[] = []
      const seen = new Set<string>()
      const batches = Math.ceil(pages.length / PAGES_PER_REQUEST)

      for (let b = 0; b < batches; b++) {
        const slice = pages.slice(b * PAGES_PER_REQUEST, (b + 1) * PAGES_PER_REQUEST)
        setProgress(`Odczytuję promocje: partia ${b + 1}/${batches} (${pages.length} stron)`)

        const res = await fetch('/api/extract-leaflet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: slice, storeName: store?.name ?? '' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Nie udało się odczytać gazetki.')

        for (const p of data.products ?? []) {
          const key = String(p.name ?? '').trim().toLowerCase()
          if (!key || seen.has(key)) continue
          seen.add(key)
          merged.push(p)
        }
        setProducts([...merged]) // pokazuj wyniki na bieżąco
      }

      // Prefill okresu ważności z odczytanych dat (najczęstsza wartość)
      const mode = (vals: string[]) => {
        const c = new Map<string, number>()
        vals.forEach((v) => c.set(v, (c.get(v) ?? 0) + 1))
        return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
      }
      const froms = merged.map((p) => p.valid_from).filter(Boolean) as string[]
      const tos = merged.map((p) => p.valid_to).filter(Boolean) as string[]
      if (froms.length) setValidFrom(mode(froms))
      if (tos.length) setValidTo(mode(tos))

      if (merged.length === 0) setError('Nie znaleziono produktów spożywczych w tej gazetce.')
    } catch (err: any) {
      setError(`Błąd: ${err?.message ?? 'nieznany'}`)
    } finally {
      setExtracting(false)
      setProgress('')
      e.target.value = ''
    }
  }

  const updateProduct = (i: number, field: keyof Product, value: string) => {
    setProducts((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: field === 'name' ? value : value === '' ? null : parseFloat(value.replace(',', '.')) }
      return next
    })
  }

  // Daty produktu: własne z gazetki -> globalne z formularza -> rozsądny domyślny zakres
  const resolveDates = (p: Product) => {
    const today = new Date().toISOString().slice(0, 10)
    const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return {
      valid_from: p.valid_from || validFrom || today,
      valid_to: p.valid_to || validTo || in7,
    }
  }

  const savePromos = async () => {
    setError('')
    setSavedMsg('')
    const valid = products.filter((p) => p.name && p.price_promo != null)
    if (!store || valid.length === 0) { setError('Brak produktów do zapisu.'); return }
    const supabase = createClient()
    const { error: insErr } = await supabase.from('promo_products').insert(
      valid.map((p) => ({
        store_id: store.id,
        name: p.name,
        price_promo: p.price_promo,
        price_regular: p.price_regular,
        condition_type: p.condition_type ?? 'brak',
        condition_note: p.condition_note ?? null,
        min_quantity: p.min_quantity ?? null,
        ...resolveDates(p),
        recipe_id: null,
      }))
    )
    if (insErr) { setError(`Zapis promocji: ${insErr.message}`); return }
    setSavedMsg(`✅ Zapisano ${valid.length} promocji do bazy.`)
  }

  const generateDraft = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/generate-recipe-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeSlug,
          storeName: store?.name ?? '',
          theme,
          promoProducts: products
            .filter((p) => p.name && p.price_promo != null)
            .map((p) => ({ ...p, ...resolveDates(p) })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Nie udało się wygenerować szkicu.'); return }
      setDrafts((d) => [{ id: data.recipeId, title: data.title, editUrl: data.editUrl }, ...d])
    } catch (err: any) {
      setError(`Błąd: ${err?.message ?? 'nieznany'}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Krok 1 — odczyt gazetki */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">1</span>
          <h2 className="font-bold text-stone-800">Wczytaj gazetkę</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="lf-store" className="block text-xs font-medium text-stone-600 mb-1">Sklep</label>
            <select
              id="lf-store"
              value={storeSlug}
              onChange={(e) => setStoreSlug(e.target.value)}
              className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-amber-400"
            >
              {stores.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
            </select>
          </div>
          <label className="cursor-pointer flex items-center gap-2 btn-outline text-sm">
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
            {extracting ? 'Odczytuję...' : 'Wgraj zdjęcie / PDF gazetki'}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} disabled={extracting} />
          </label>
        </div>
        {progress ? (
          <p className="text-xs text-amber-700 font-medium flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {progress}
          </p>
        ) : (
          <p className="text-xs text-stone-400">
            Claude odczyta produkty spożywcze i ceny. Wielostronicowy PDF jest automatycznie dzielony na strony i analizowany partiami.
          </p>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Krok 2 — weryfikacja + zapis promocji */}
      {products.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">2</span>
            <h2 className="font-bold text-stone-800">Sprawdź i zapisz promocje ({products.length})</h2>
          </div>

          {/* Okres ważności promocji (prefill z gazetki, można poprawić) */}
          <div className="flex flex-wrap items-end gap-3 bg-stone-50 rounded-xl p-3">
            <div>
              <label htmlFor="le-from" className="block text-xs font-medium text-stone-500 mb-1">Ważne od</label>
              <input id="le-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)}
                className="px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm bg-white" />
            </div>
            <div>
              <label htmlFor="le-to" className="block text-xs font-medium text-stone-500 mb-1">Ważne do</label>
              <input id="le-to" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)}
                className="px-2.5 py-1.5 border border-stone-200 rounded-lg text-sm bg-white" />
            </div>
            <p className="text-xs text-stone-400 pb-1.5 flex-1 min-w-[200px]">
              {validFrom || validTo
                ? 'Odczytane z gazetki — sprawdź przed zapisem. Po dacie „do" przepisy z tymi produktami znikną ze strony.'
                : 'Gazetka nie podała dat — ustaw ręcznie (domyślnie 7 dni od dziś).'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-stone-500 border-b border-stone-100">
                <tr><th className="py-2 pr-3">Produkt</th><th className="py-2 px-2 w-24">Promo</th><th className="py-2 px-2 w-24">Regularna</th><th className="w-8" /></tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {products.map((p, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pr-3">
                      <input value={p.name} onChange={(e) => updateProduct(i, 'name', e.target.value)}
                        className="w-full px-2 py-1.5 border border-stone-200 rounded-lg" />
                      {p.condition_type && p.condition_type !== 'brak' && (
                        <span
                          title={p.condition_note ?? ''}
                          className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${CONDITION_STYLE[p.condition_type]}`}
                        >
                          {CONDITION_LABEL[p.condition_type]}
                          {p.min_quantity ? ` · min. ${p.min_quantity} szt.` : ''}
                          {p.condition_note ? ` — ${p.condition_note}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" step="0.01" value={p.price_promo ?? ''} onChange={(e) => updateProduct(i, 'price_promo', e.target.value)}
                        className="w-full px-2 py-1.5 border border-stone-200 rounded-lg" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" step="0.01" value={p.price_regular ?? ''} onChange={(e) => updateProduct(i, 'price_regular', e.target.value)}
                        className="w-full px-2 py-1.5 border border-stone-200 rounded-lg" />
                    </td>
                    <td className="py-1.5">
                      <button onClick={() => setProducts((prev) => prev.filter((_, j) => j !== i))} aria-label="Usuń" className="text-stone-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {savedMsg && <div className="bg-green-50 text-green-700 text-sm px-4 py-2 rounded-xl">{savedMsg}</div>}
          <button onClick={savePromos} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" /> Zapisz promocje do bazy
          </button>
        </div>
      )}

      {/* Krok 3 — generacja przepisu-szkicu */}
      {products.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">3</span>
            <h2 className="font-bold text-stone-800">Wygeneruj przepis (szkic do akceptacji)</h2>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label htmlFor="lf-theme" className="block text-xs font-medium text-stone-600 mb-1">Temat (opcjonalnie)</label>
              <input id="lf-theme" value={theme} onChange={(e) => setTheme(e.target.value)}
                placeholder="np. obiad z kurczaka, danie jednogarnkowe..."
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-amber-400" />
            </div>
            <button onClick={generateDraft} disabled={generating} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Generuję...' : 'Wygeneruj szkic'}
            </button>
          </div>
          <p className="text-xs text-stone-400">Przepis powstaje na bazie produktów z gazetki i zapisuje się jako niepublikowany szkic. Zdjęcie dodasz przy akceptacji.</p>

          {drafts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-stone-50">
              <p className="text-sm font-medium text-stone-700">Wygenerowane szkice do akceptacji:</p>
              {drafts.map((d) => (
                <Link key={d.id} href={d.editUrl ?? `/admin/przepisy/${d.id}`}
                  className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700">
                  <ExternalLink className="w-4 h-4" /> {d.title} — otwórz do akceptacji
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
