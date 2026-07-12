import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateRecipeJson } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 })
  }

  const [{ data: stores }, { data: categories }] = await Promise.all([
    supabase.from('stores').select('id, slug, name').eq('is_active', true),
    supabase.from('categories').select('id, slug').eq('is_active', true),
  ])

  let recipe: any
  try {
    recipe = await generateRecipeJson({
      storeSlug: body.storeSlug ?? '',
      storeName: body.storeName ?? '',
      theme: (body.theme ?? '').toString().slice(0, 300),
      categorySlugs: (categories ?? []).map((c: any) => c.slug),
      promoProducts: Array.isArray(body.promoProducts) ? body.promoProducts : [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Błąd generowania.' }, { status: 500 })
  }

  const store = (stores ?? []).find((s: any) => s.slug === recipe.store_slug)
    ?? (stores ?? []).find((s: any) => s.slug === body.storeSlug)
  if (!store) return NextResponse.json({ error: 'Nie znaleziono sklepu.' }, { status: 400 })

  const categoryIds = (recipe.category_slugs ?? [])
    .map((cs: string) => (categories ?? []).find((c: any) => c.slug === cs)?.id)
    .filter(Boolean)

  // Unikalny slug (na wypadek kolizji)
  let slug = (recipe.slug || 'przepis').toString()
  const { data: existing } = await supabase.from('recipes').select('id').eq('slug', slug).maybeSingle()
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`

  const payload = {
    title: recipe.title ?? 'Bez tytułu',
    slug,
    description: recipe.description ?? null,
    image_url: '',
    store_id: store.id,
    prep_time_min: recipe.prep_time_min ?? null,
    difficulty: recipe.difficulty ?? 'latwy',
    servings: recipe.servings ?? null,
    price_total: recipe.price_total ?? null,
    is_published: false,
    meta_title: recipe.meta_title ?? null,
    meta_description: recipe.meta_description ?? null,
  }

  const { data: inserted, error: recErr } = await supabase.from('recipes').insert(payload).select().single()
  if (recErr || !inserted) {
    return NextResponse.json({ error: `Zapis przepisu: ${recErr?.message ?? 'nieznany błąd'}` }, { status: 500 })
  }
  const recipeId = inserted.id

  // Składniki (z ceną) — błąd tu = cofamy szkic, żeby nie zostawiać sieroty
  const ingredients = (recipe.ingredients ?? []).filter((i: any) => i?.name)
  if (ingredients.length > 0) {
    const { error: ingErr } = await supabase.from('ingredients').insert(
      ingredients.map((ing: any, idx: number) => ({
        recipe_id: recipeId,
        name: ing.name,
        amount: ing.amount || null,
        unit: ing.unit || null,
        price: ing.price != null ? ing.price : null,
        sort_order: idx,
        is_promo_product: !!ing.is_promo_product,
      }))
    )
    if (ingErr) {
      await supabase.from('recipes').delete().eq('id', recipeId)
      return NextResponse.json(
        { error: `Zapis składników: ${ingErr.message}. Jeśli to kolumna "price" — uruchom migrację: alter table ingredients add column if not exists price numeric;` },
        { status: 500 }
      )
    }
  }

  // Kategorie
  if (categoryIds.length > 0) {
    await supabase.from('recipe_categories').insert(
      categoryIds.map((cid: string) => ({ recipe_id: recipeId, category_id: cid }))
    )
  }

  // Kroki
  const steps = (recipe.steps ?? []).filter((d: any) => typeof d === 'string' && d.trim())
  if (steps.length > 0) {
    await supabase.from('recipe_steps').insert(
      steps.map((d: string, idx: number) => ({ recipe_id: recipeId, step_number: idx + 1, description: d }))
    )
  }

  // Produkty z gazetki (domyślne daty ważności)
  const today = new Date().toISOString().slice(0, 10)
  const in14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const promos = (recipe.promos ?? []).filter((p: any) => p?.name && p?.price_promo != null)
  if (promos.length > 0) {
    await supabase.from('promo_products').insert(
      promos.map((p: any) => ({
        recipe_id: recipeId,
        store_id: store.id,
        name: p.name,
        price_promo: p.price_promo,
        price_regular: p.price_regular ?? null,
        valid_from: today,
        valid_to: in14,
      }))
    )
  }

  return NextResponse.json({ recipeId, title: payload.title, editUrl: `/admin/przepisy/${recipeId}` })
}
