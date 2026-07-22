'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import type { Store, Category } from '@/types'
import { CategoryIcon } from '@/components/recipe/CategoryIcon'
import { cn } from '@/lib/utils'

interface Props {
  stores: Store[]
  categories: Category[]
  recipe?: any
  // Wstępne dane (np. z generatora AI) — wypełniają NOWY przepis, nie włączają trybu edycji
  initialData?: any
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
    .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
    .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function RecipeForm({ stores, categories, recipe, initialData }: Props) {
  const router = useRouter()
  const isEdit = !!recipe
  const seed = recipe ?? initialData

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const mounted = useRef(false)

  // Pola podstawowe
  const [title, setTitle] = useState(seed?.title ?? '')
  const [slug, setSlug] = useState(seed?.slug ?? '')
  const [description, setDescription] = useState(seed?.description ?? '')
  const [imageUrl, setImageUrl] = useState(seed?.image_url ?? '')
  const [storeId, setStoreId] = useState(seed?.store_id ?? '')
  const [selectedCategories, setSelectedCategories] = useState<string[]>(seed?.category_ids ?? [])
  const [prepTime, setPrepTime] = useState(seed?.prep_time_min?.toString() ?? '')
  const [difficulty, setDifficulty] = useState(seed?.difficulty ?? 'latwy')
  const [servings] = useState(seed?.servings?.toString() ?? '4')
  const [priceTotal, setPriceTotal] = useState(seed?.price_total?.toString() ?? '')
  const [isPublished, setIsPublished] = useState(seed?.is_published ?? false)
  const [metaTitle, setMetaTitle] = useState(seed?.meta_title ?? '')
  const [metaDesc, setMetaDesc] = useState(seed?.meta_description ?? '')

  // Składniki
  const [ingredients, setIngredients] = useState<any[]>(
    seed?.ingredients ?? [{ id: crypto.randomUUID(), name: '', amount: '', unit: '', price: '', is_promo_product: false, sort_order: 0 }]
  )

  // Kroki
  const [steps, setSteps] = useState<any[]>(
    seed?.steps ?? [{ id: crypto.randomUUID(), description: '', step_number: 1, image_url: '' }]
  )

  // Produkty promocyjne
  const [promos, setPromos] = useState<any[]>(
    seed?.promo_products ?? []
  )

  // Oznacz formularz jako zmieniony przy dowolnej edycji pól
  useEffect(() => {
    if (mounted.current) setDirty(true)
    else mounted.current = true
  }, [title, slug, description, imageUrl, storeId, selectedCategories, prepTime,
      difficulty, servings, priceTotal, isPublished, metaTitle, metaDesc, ingredients, steps, promos])

  // Ostrzeżenie o niezapisanych zmianach przy zamykaniu/odświeżaniu karty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty && !saving) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty, saving])

  const handleTitleChange = (v: string) => {
    setTitle(v)
    if (!isEdit) setSlug(slugify(v))
  }

  const uploadImage = async (file: File, bucket: string) => {
    setImageUploading(true)
    setError('')
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file)
    if (error) {
      setImageUploading(false)
      setError(`Nie udało się wgrać zdjęcia: ${error.message}`)
      return null
    }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
    setImageUploading(false)
    return publicUrl
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Wybierz plik graficzny (PNG, JPG, WEBP).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Zdjęcie jest za duże (maks. 5 MB).')
      return
    }
    const url = await uploadImage(file, 'recipe-images')
    if (url) setImageUrl(url)
  }

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    if (!title || !storeId) { setError('Wypełnij nazwę przepisu i wybierz sklep.'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()

    const payload = {
      title, slug, description, image_url: imageUrl,
      store_id: storeId,
      prep_time_min: prepTime ? parseInt(prepTime) : null,
      difficulty,
      servings: servings ? parseInt(servings) : null,
      price_total: priceTotal ? parseFloat(priceTotal) : null,
      is_published: isPublished,
      meta_title: metaTitle || null,
      meta_description: metaDesc || null,
    }

    let recipeId = recipe?.id

    if (isEdit) {
      const { error } = await supabase.from('recipes').update(payload).eq('id', recipeId)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('recipes').insert(payload).select().single()
      if (error) { setError(error.message); setSaving(false); return }
      recipeId = data.id
    }

    // Kategorie
    await supabase.from('recipe_categories').delete().eq('recipe_id', recipeId)
    if (selectedCategories.length > 0) {
      await supabase.from('recipe_categories').insert(
        selectedCategories.map((cat_id) => ({ recipe_id: recipeId, category_id: cat_id }))
      )
    }

    // Składniki
    await supabase.from('ingredients').delete().eq('recipe_id', recipeId)
    const validIngredients = ingredients.filter((i) => i.name.trim())
    if (validIngredients.length > 0) {
      const { error: ingErr } = await supabase.from('ingredients').insert(
        validIngredients.map((ing, idx) => ({
          recipe_id: recipeId, name: ing.name, amount: ing.amount || null,
          unit: ing.unit || null, price: ing.price ? parseFloat(ing.price) : null,
          sort_order: idx, is_promo_product: ing.is_promo_product,
        }))
      )
      if (ingErr) { setError(`Nie udało się zapisać składników: ${ingErr.message}`); setSaving(false); return }
    }

    // Kroki
    await supabase.from('recipe_steps').delete().eq('recipe_id', recipeId)
    const validSteps = steps.filter((s) => s.description.trim())
    if (validSteps.length > 0) {
      await supabase.from('recipe_steps').insert(
        validSteps.map((step, idx) => ({
          recipe_id: recipeId, step_number: idx + 1,
          description: step.description, image_url: step.image_url || null,
        }))
      )
    }

    // Produkty promocyjne
    await supabase.from('promo_products').delete().eq('recipe_id', recipeId)
    const validPromos = promos.filter((p) => p.name.trim() && p.price_promo && p.valid_from && p.valid_to)
    if (validPromos.length > 0) {
      await supabase.from('promo_products').insert(
        validPromos.map((p) => ({
          recipe_id: recipeId, store_id: storeId,
          name: p.name, price_promo: parseFloat(p.price_promo),
          price_regular: p.price_regular ? parseFloat(p.price_regular) : null,
          valid_from: p.valid_from, valid_to: p.valid_to,
        }))
      )
    }

    setDirty(false)
    router.push(`/admin/przepisy?saved=${isEdit ? 'edit' : 'new'}`)
    router.refresh()
  }

  const inputClass = 'w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white'
  const labelClass = 'block text-sm font-medium text-stone-700 mb-1.5'
  const sectionClass = 'bg-white rounded-2xl border border-stone-100 p-6 space-y-4'

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Podstawowe info */}
      <div className={sectionClass}>
        <h2 className="font-bold text-stone-800">Podstawowe informacje</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="rf-title" className={labelClass}>Nazwa przepisu *</label>
            <input id="rf-title" className={inputClass} value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Spaghetti bolognese..." />
          </div>
          <div>
            <label htmlFor="rf-slug" className={labelClass}>Slug (URL)</label>
            <input id="rf-slug" className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="spaghetti-bolognese" />
          </div>
        </div>
        <div>
          <label htmlFor="rf-description" className={labelClass}>Opis</label>
          <textarea id="rf-description" className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Krótki opis przepisu..." />
        </div>
        <div>
          <label htmlFor="rf-store" className={labelClass}>Sklep *</label>
          <select id="rf-store" className={inputClass} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">Wybierz sklep</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Zdjęcie */}
      <div className={sectionClass}>
        <h2 className="font-bold text-stone-800">Zdjęcie</h2>
        <div>
          <label htmlFor="rf-image-url" className={labelClass}>URL zdjęcia</label>
          <input id="rf-image-url" className={inputClass} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-500">lub</span>
          <label className="cursor-pointer flex items-center gap-2 btn-outline text-sm">
            <Upload className="w-4 h-4" />
            {imageUploading ? 'Wgrywanie...' : 'Prześlij zdjęcie'}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={imageUploading} />
          </label>
          <span className="text-xs text-stone-400">PNG, JPG, WEBP · maks. 5 MB</span>
        </div>
        {imageUrl && (
          <div className="relative w-full max-w-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Podgląd zdjęcia przepisu" className="w-full rounded-xl object-cover aspect-video" />
            <button
              type="button"
              onClick={() => setImageUrl('')}
              aria-label="Usuń zdjęcie"
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-stone-600 hover:text-red-500 flex items-center justify-center shadow-sm transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Parametry */}
      <div className={sectionClass}>
        <h2 className="font-bold text-stone-800">Parametry</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label htmlFor="rf-prep" className={labelClass}>Czas (min)</label>
            <input id="rf-prep" className={inputClass} type="number" min="0" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="30" />
          </div>
          <div>
            <label htmlFor="rf-price" className={labelClass}>Cena (PLN)</label>
            <input id="rf-price" className={inputClass} type="number" min="0" step="0.01" value={priceTotal} onChange={(e) => setPriceTotal(e.target.value)} placeholder="25.90" />
          </div>
          <div>
            <label htmlFor="rf-difficulty" className={labelClass}>Trudność</label>
            <select id="rf-difficulty" className={inputClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="latwy">Łatwy</option>
              <option value="sredni">Średni</option>
              <option value="trudny">Trudny</option>
            </select>
          </div>
        </div>
      </div>

      {/* Kategorie */}
      <div className={sectionClass}>
        <h2 className="font-bold text-stone-800">Kategorie</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className={cn('category-pill', selectedCategories.includes(cat.id) && 'active')}
            >
              <CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-[#1595ff]" />
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Składniki */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-stone-800">Składniki</h2>
          <button type="button" onClick={() => setIngredients([...ingredients, { id: crypto.randomUUID(), name: '', amount: '', unit: '', price: '', is_promo_product: false }])}
            className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Dodaj
          </button>
        </div>
        <div className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={ing.id} className="flex items-center gap-2">
              <input className={cn(inputClass, 'flex-1')} placeholder="Nazwa składnika" value={ing.name}
                onChange={(e) => { const next = [...ingredients]; next[i].name = e.target.value; setIngredients(next) }} />
              <input className={cn(inputClass, 'w-20')} placeholder="Ilość" value={ing.amount}
                onChange={(e) => { const next = [...ingredients]; next[i].amount = e.target.value; setIngredients(next) }} />
              <input className={cn(inputClass, 'w-20')} placeholder="Jedn." value={ing.unit}
                onChange={(e) => { const next = [...ingredients]; next[i].unit = e.target.value; setIngredients(next) }} />
              <input className={cn(inputClass, 'w-24')} type="number" min="0" step="0.01" placeholder="Cena zł" value={ing.price ?? ''}
                onChange={(e) => { const next = [...ingredients]; next[i].price = e.target.value; setIngredients(next) }} />
              <label className="flex items-center gap-1 text-xs text-stone-500 whitespace-nowrap cursor-pointer">
                <input type="checkbox" checked={ing.is_promo_product}
                  onChange={(e) => { const next = [...ingredients]; next[i].is_promo_product = e.target.checked; setIngredients(next) }} />
                Promo
              </label>
              <button type="button" aria-label="Usuń składnik" onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))}
                className="text-stone-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {(() => {
          const sum = ingredients.reduce((s, ing) => s + (parseFloat(ing.price) || 0), 0)
          if (sum <= 0) return null
          return (
            <div className="flex items-center justify-between pt-1 text-sm border-t border-stone-50 mt-1">
              <span className="text-stone-500">Suma cen składników: <b className="text-stone-700">{sum.toFixed(2)} zł</b></span>
              <button type="button" onClick={() => setPriceTotal(sum.toFixed(2))} className="text-amber-600 hover:text-amber-700 font-medium">
                Ustaw jako cenę całości
              </button>
            </div>
          )
        })()}
      </div>

      {/* Kroki */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-stone-800">Kroki przygotowania</h2>
          <button type="button" onClick={() => setSteps([...steps, { id: crypto.randomUUID(), description: '', step_number: steps.length + 1, image_url: '' }])}
            className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Dodaj krok
          </button>
        </div>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={step.id} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 font-bold text-sm flex items-center justify-center flex-shrink-0 mt-2">
                {i + 1}
              </div>
              <div className="flex-1 space-y-2">
                <textarea className={inputClass} rows={2} placeholder={`Opisz krok ${i + 1}...`} value={step.description}
                  onChange={(e) => { const next = [...steps]; next[i].description = e.target.value; setSteps(next) }} />
                <input className={inputClass} placeholder="URL zdjęcia do kroku (opcjonalnie)" value={step.image_url}
                  onChange={(e) => { const next = [...steps]; next[i].image_url = e.target.value; setSteps(next) }} />
              </div>
              <button type="button" aria-label="Usuń krok" onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                className="text-stone-400 hover:text-red-500 transition-colors mt-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Produkty promocyjne */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-stone-800">Produkty z gazetki</h2>
          <button type="button" onClick={() => setPromos([...promos, { id: crypto.randomUUID(), name: '', price_promo: '', price_regular: '', valid_from: '', valid_to: '' }])}
            className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Dodaj produkt
          </button>
        </div>
        <div className="space-y-3">
          {promos.map((p, i) => (
            <div key={p.id} className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-stone-50 rounded-xl">
              <input className={cn(inputClass, 'col-span-2 sm:col-span-3')} placeholder="Nazwa produktu" value={p.name}
                onChange={(e) => { const next = [...promos]; next[i].name = e.target.value; setPromos(next) }} />
              <input className={inputClass} type="number" step="0.01" placeholder="Cena promo (PLN)" value={p.price_promo}
                onChange={(e) => { const next = [...promos]; next[i].price_promo = e.target.value; setPromos(next) }} />
              <input className={inputClass} type="number" step="0.01" placeholder="Cena regularna" value={p.price_regular}
                onChange={(e) => { const next = [...promos]; next[i].price_regular = e.target.value; setPromos(next) }} />
              <div className="flex gap-2">
                <input className={inputClass} type="date" placeholder="Od" value={p.valid_from}
                  onChange={(e) => { const next = [...promos]; next[i].valid_from = e.target.value; setPromos(next) }} />
                <input className={inputClass} type="date" placeholder="Do" value={p.valid_to}
                  onChange={(e) => { const next = [...promos]; next[i].valid_to = e.target.value; setPromos(next) }} />
              </div>
              <button type="button" aria-label="Usuń produkt" onClick={() => setPromos(promos.filter((_, j) => j !== i))}
                className="text-stone-400 hover:text-red-500 transition-colors justify-self-end">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SEO */}
      <div className={sectionClass}>
        <h2 className="font-bold text-stone-800">SEO</h2>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="rf-meta-title" className="text-sm font-medium text-stone-700">Meta title</label>
            <span className={cn('text-xs', metaTitle.length > 60 ? 'text-red-500' : 'text-stone-400')}>
              {metaTitle.length}/60
            </span>
          </div>
          <input id="rf-meta-title" className={inputClass} value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder={title} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="rf-meta-desc" className="text-sm font-medium text-stone-700">Meta description</label>
            <span className={cn('text-xs', metaDesc.length > 155 ? 'text-red-500' : 'text-stone-400')}>
              {metaDesc.length}/155
            </span>
          </div>
          <textarea id="rf-meta-desc" className={inputClass} rows={2} value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} placeholder={description} />
        </div>
      </div>

      {/* Publikacja */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-stone-100 p-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
            <div className={cn('w-10 h-6 rounded-full transition-colors', isPublished ? 'bg-amber-500' : 'bg-stone-200')} />
            <div className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', isPublished && 'translate-x-4')} />
          </div>
          <span className="font-medium text-stone-700">
            {isPublished ? '✅ Opublikowany' : '📝 Szkic (niewidoczny)'}
          </span>
        </label>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-outline">
            Anuluj
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Zapisz zmiany' : 'Utwórz przepis'}
          </button>
        </div>
      </div>
    </div>
  )
}
