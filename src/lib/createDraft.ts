// Tworzenie szkicu przepisu: generacja treści, zdjęcie, zapis do bazy.
//
// Wyciągnięte z trasy API, bo korzystają z tego dwa światy: panel admina (przez
// /api/generate-recipe-draft, z sesją użytkownika) i zadanie cykliczne (bez sesji,
// na kluczu serwisowym). Bez tego cron musiałby albo wołać trasę po HTTP z własnym
// obejściem autoryzacji, albo trasa musiałaby wpuszczać żądania bez użytkownika —
// jedno i drugie osłabiałoby zabezpieczenie, które tam jest z sensem.

import { generateRecipeJson } from '@/lib/ai'
import { generateRecipeImage } from '@/lib/recipeImage'
import { fetchStoreTitles } from '@/lib/recipeTitles'

export interface DraftInput {
  storeSlug: string
  storeName?: string
  theme?: string
  promoProducts?: any[]
  reuseProducts?: string[]
  /**
   * Znacznik czasu (epoch ms), po którym nie zaczynamy już generować zdjęcia.
   * Cron ma 60 s na całe wywołanie razem ze sprzątaniem bazy, a to generacja tekstu
   * zjada większość budżetu — więc decyzja musi zapaść PO niej, tuż przed zdjęciem.
   * Lepiej zapisać przepis bez zdjęcia niż stracić go w całości przy ubiciu funkcji.
   */
  imageDeadline?: number
}

export interface DraftResult {
  recipeId: string
  title: string
  editUrl: string
  /** Produkty użyte w tym przepisie — kolejne przepisy mogą je współdzielić */
  usedProducts: string[]
  hasImage: boolean
  imageWarning: string | null
}

export class DraftError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = 'DraftError'
    this.status = status
  }
}

export async function createRecipeDraft(supabase: any, input: DraftInput): Promise<DraftResult> {
  const [{ data: stores }, { data: categories }] = await Promise.all([
    supabase.from('stores').select('id, slug, name').eq('is_active', true),
    supabase.from('categories').select('id, slug').eq('is_active', true),
  ])

  // Tytuły z TEGO sklepu — model ma ich nie powtarzać, a generator sprawdza to twardo.
  // Sklep musi być znany przed generowaniem, żeby lista „unikaj" była właściwa.
  const targetStore = (stores ?? []).find((s: any) => s.slug === input.storeSlug)
  const existingTitles = await fetchStoreTitles(supabase, targetStore?.id)

  let recipe: any
  try {
    recipe = await generateRecipeJson({
      storeSlug: input.storeSlug ?? '',
      storeName: input.storeName ?? '',
      theme: (input.theme ?? '').toString().slice(0, 300),
      categorySlugs: (categories ?? []).map((c: any) => c.slug),
      promoProducts: Array.isArray(input.promoProducts) ? input.promoProducts : [],
      avoidTitles: existingTitles,
      reuseProducts: Array.isArray(input.reuseProducts) ? input.reuseProducts : [],
    })
  } catch (e: any) {
    throw new DraftError(e?.message ?? 'Błąd generowania.', 500)
  }

  const store =
    (stores ?? []).find((s: any) => s.slug === recipe.store_slug) ??
    (stores ?? []).find((s: any) => s.slug === input.storeSlug)
  if (!store) throw new DraftError('Nie znaleziono sklepu.', 400)

  const categoryIds = (recipe.category_slugs ?? [])
    .map((cs: string) => (categories ?? []).find((c: any) => c.slug === cs)?.id)
    .filter(Boolean)

  // Unikalny slug (na wypadek kolizji)
  let slug = (recipe.slug || 'przepis').toString()
  const { data: slugTaken } = await supabase.from('recipes').select('id').eq('slug', slug).maybeSingle()
  if (slugTaken) slug = `${slug}-${Date.now().toString(36).slice(-4)}`

  // Zdjęcie generujemy przed zapisem, żeby przepis od razu trafił do bazy kompletny.
  // Porażka nie przerywa niczego — przepis powstaje bez zdjęcia, a admin dostaje ostrzeżenie.
  const pozaCzasem = input.imageDeadline != null && Date.now() > input.imageDeadline
  const image = pozaCzasem
    ? { url: null as string | null, warning: 'Pominięto zdjęcie — zabrakło czasu w zadaniu cyklicznym.' }
    : await generateRecipeImage(recipe.image_prompt ?? '', slug, supabase)

  const payload = {
    title: recipe.title ?? 'Bez tytułu',
    slug,
    description: recipe.description ?? null,
    image_url: image.url ?? '',
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
    throw new DraftError(`Zapis przepisu: ${recErr?.message ?? 'nieznany błąd'}`, 500)
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
      throw new DraftError(
        `Zapis składników: ${ingErr.message}. Jeśli to kolumna "price" — uruchom migrację: alter table ingredients add column if not exists price numeric;`,
        500
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

  // Produkty z gazetki — daty ważności z gazetki, fallback: dziś + 7 dni
  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const promos = (recipe.promos ?? []).filter((p: any) => p?.name && p?.price_promo != null)
  if (promos.length > 0) {
    await supabase.from('promo_products').insert(
      promos.map((p: any) => ({
        recipe_id: recipeId,
        store_id: store.id,
        name: p.name,
        price_promo: p.price_promo,
        price_regular: p.price_regular ?? null,
        condition_type: p.condition_type ?? 'brak',
        condition_note: p.condition_note ?? null,
        min_quantity: p.min_quantity ?? null,
        valid_from: p.valid_from ?? today,
        valid_to: p.valid_to ?? in7,
      }))
    )
  }

  return {
    recipeId,
    title: payload.title,
    editUrl: `/admin/przepisy/${recipeId}`,
    usedProducts: promos.map((p: any) => p.name).filter(Boolean),
    hasImage: !!image.url,
    imageWarning: image.warning ?? null,
  }
}
