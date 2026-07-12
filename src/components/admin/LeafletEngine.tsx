'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ScanLine, Save, Sparkles, Trash2, ExternalLink } from 'lucide-react'
import type { Store } from '@/types'

interface Product {
  name: string
  price_promo: number | null
  price_regular: number | null
}

// Zmniejsza obraz do maks. ~1600px i zwraca czysty base64 (bez prefiksu data:)
async function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  if (file.type === 'application/pdf') {
    const buf = await file.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return { base64: btoa(binary), mediaType: 'application/pdf' }
  }
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })
  const max = 1600
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  const out = canvas.toDataURL('image/jpeg', 0.85)
  return { base64: out.split(',')[1], mediaType: 'image/jpeg' }
}

export function LeafletEngine({ stores }: { stores: Store[] }) {
  const [storeSlug, setStoreSlug] = useState(stores[0]?.slug ?? '')
  const [extracting, setExtracting] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  const [theme, setTheme] = useState('')
  const [generating, setGenerating] = useState(false)
  const [drafts, setDrafts] = useState<{ id: string; title: string; editUrl: string }[]>([])

  const store = stores.find((s) => s.slug === storeSlug)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    setError('')
    setSavedMsg('')
    try {
      const { base64, mediaType } = await fileToBase64(file)
      const res = await fetch('/api/extract-leaflet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType, storeName: store?.name ?? '' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Nie udało się odczytać gazetki.'); return }
      setProducts(data.products ?? [])
    } catch (err: any) {
      setError(`Błąd: ${err?.message ?? 'nieznany'}`)
    } finally {
      setExtracting(false)
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

  const savePromos = async () => {
    setError('')
    setSavedMsg('')
    const valid = products.filter((p) => p.name && p.price_promo != null)
    if (!store || valid.length === 0) { setError('Brak produktów do zapisu.'); return }
    const supabase = createClient()
    const today = new Date().toISOString().slice(0, 10)
    const in14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { error: insErr } = await supabase.from('promo_products').insert(
      valid.map((p) => ({
        store_id: store.id,
        name: p.name,
        price_promo: p.price_promo,
        price_regular: p.price_regular,
        valid_from: today,
        valid_to: in14,
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
          promoProducts: products.filter((p) => p.name && p.price_promo != null),
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
        <p className="text-xs text-stone-400">Claude odczyta produkty spożywcze i ceny. Duże zdjęcia są automatycznie zmniejszane.</p>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Krok 2 — weryfikacja + zapis promocji */}
      {products.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">2</span>
            <h2 className="font-bold text-stone-800">Sprawdź i zapisz promocje ({products.length})</h2>
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
