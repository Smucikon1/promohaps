'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { RecipeForm } from '@/components/admin/RecipeForm'
import type { Store, Category } from '@/types'

interface Props {
  stores: Store[]
  categories: Category[]
}

export function GenerateRecipe({ stores, categories }: Props) {
  const [genStore, setGenStore] = useState(stores[0]?.slug ?? '')
  const [theme, setTheme] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [initialData, setInitialData] = useState<any>(null)
  const [genKey, setGenKey] = useState(0)

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      const store = stores.find((s) => s.slug === genStore)
      const res = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeSlug: store?.slug ?? '',
          storeName: store?.name ?? '',
          theme,
          categorySlugs: categories.map((c) => c.slug),
        }),
      })
      // Serwer bywa zwraca HTML (504 timeout, error page) — parsujemy JSON dopiero po sprawdzeniu content-type
      const isJson = res.headers.get('content-type')?.includes('application/json')
      const data = isJson ? await res.json().catch(() => ({})) : {}
      if (!res.ok) {
        setError(data.error ?? (res.status === 504 ? 'Serwer nie zdążył odpowiedzieć (timeout). Spróbuj ponownie.' : `Błąd serwera (${res.status}).`))
        return
      }
      const r = data.recipe
      const storeMatch = stores.find((s) => s.slug === r.store_slug) ?? store
      const categoryIds = (r.category_slugs ?? [])
        .map((cs: string) => categories.find((c) => c.slug === cs)?.id)
        .filter(Boolean)

      setInitialData({
        title: r.title ?? '',
        slug: r.slug ?? '',
        description: r.description ?? '',
        store_id: storeMatch?.id ?? '',
        category_ids: categoryIds,
        prep_time_min: r.prep_time_min ?? null,
        difficulty: r.difficulty ?? 'latwy',
        servings: r.servings ?? 4,
        price_total: r.price_total ?? null,
        meta_title: r.meta_title ?? '',
        meta_description: r.meta_description ?? '',
        ingredients: (r.ingredients ?? []).map((i: any) => ({
          id: crypto.randomUUID(),
          name: i.name ?? '',
          amount: i.amount ?? '',
          unit: i.unit ?? '',
          price: i.price != null ? String(i.price) : '',
          is_promo_product: !!i.is_promo_product,
        })),
        steps: (r.steps ?? []).map((d: string, idx: number) => ({
          id: crypto.randomUUID(),
          description: d,
          step_number: idx + 1,
          image_url: '',
        })),
        promo_products: (r.promos ?? []).map((p: any) => ({
          id: crypto.randomUUID(),
          name: p.name ?? '',
          price_promo: p.price_promo != null ? String(p.price_promo) : '',
          price_regular: p.price_regular != null ? String(p.price_regular) : '',
          valid_from: '',
          valid_to: '',
        })),
      })
      setGenKey((k) => k + 1)
    } catch (e: any) {
      setError(`Błąd: ${e?.message ?? 'nieznany'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Panel generatora */}
      <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="font-bold text-stone-800">Generuj z AI</h2>
        </div>
        <div className="grid sm:grid-cols-[180px_1fr_auto] gap-3 items-end">
          <div>
            <label htmlFor="gen-store" className="block text-xs font-medium text-stone-600 mb-1">Sklep</label>
            <select
              id="gen-store"
              value={genStore}
              onChange={(e) => setGenStore(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-amber-400"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.slug}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gen-theme" className="block text-xs font-medium text-stone-600 mb-1">Temat / składniki (opcjonalnie)</label>
            <input
              id="gen-theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="np. szybki obiad z kurczaka, danie jednogarnkowe..."
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Generuję...' : 'Generuj'}
          </button>
        </div>
        {error && <div className="mt-3 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-xl">{error}</div>}
        {initialData && !error && (
          <p className="mt-3 text-sm text-green-700">✅ Przepis wygenerowany — sprawdź, popraw i zapisz poniżej.</p>
        )}
      </div>

      {/* Formularz (remontowany po wygenerowaniu) */}
      <RecipeForm key={genKey} stores={stores} categories={categories} initialData={initialData ?? undefined} />
    </div>
  )
}
