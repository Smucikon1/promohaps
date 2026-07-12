'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Upload } from 'lucide-react'
import type { Store } from '@/types'

export function PromoImport({ stores }: { stores: Store[] }) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    setLoading(true)
    setError('')
    setResult('')
    const supabase = createClient()
    const today = new Date().toISOString().slice(0, 10)
    const in14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const rows = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [name, pp, pr, vf, vt] = l.split(';').map((x) => (x ?? '').trim())
        return {
          store_id: storeId,
          name,
          price_promo: pp ? parseFloat(pp.replace(',', '.')) : null,
          price_regular: pr ? parseFloat(pr.replace(',', '.')) : null,
          valid_from: vf || today,
          valid_to: vt || in14,
          recipe_id: null,
        }
      })
      .filter((r) => r.name && r.price_promo != null && !Number.isNaN(r.price_promo))

    if (rows.length === 0) {
      setError('Brak poprawnych wierszy. Format: nazwa;cena_promo;cena_regularna;data_od;data_do')
      setLoading(false)
      return
    }

    const { error: insErr } = await supabase.from('promo_products').insert(rows)
    if (insErr) {
      setError(`Nie udało się zapisać: ${insErr.message}`)
      setLoading(false)
      return
    }
    setResult(`✅ Dodano ${rows.length} produktów z gazetki.`)
    setText('')
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-6 space-y-4">
      <div>
        <label htmlFor="promo-store" className="block text-sm font-medium text-stone-700 mb-1.5">Sklep</label>
        <select
          id="promo-store"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="w-full sm:w-64 px-4 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:border-amber-400"
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="promo-csv" className="block text-sm font-medium text-stone-700 mb-1.5">
          Produkty (jeden na wiersz)
        </label>
        <p className="text-xs text-stone-500 mb-2">
          Format: <code className="bg-stone-100 px-1 rounded">nazwa;cena_promo;cena_regularna;data_od;data_do</code> —
          daty (RRRR-MM-DD) opcjonalne (domyślnie dziś + 14 dni).
        </p>
        <textarea
          id="promo-csv"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={'Filet z kurczaka 1kg;13,99;19,99\nMasło Extra 200g;5,49;7,99;2026-07-01;2026-07-14'}
          className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm font-mono focus:outline-none focus:border-amber-400"
        />
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
      {result && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl">{result}</div>}

      <button onClick={submit} disabled={loading || !storeId} className="btn-primary flex items-center gap-2 disabled:opacity-50">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        Zaimportuj promocje
      </button>
    </div>
  )
}
