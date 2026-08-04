import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/site'
import { COLLECTIONS } from '@/lib/collections'
import { hasActivePromo } from '@/lib/utils'

export default async function Sitemap() {
  const supabase = await createClient()

  const [{ data: allRecipes }, { data: stores }, { data: categories }] = await Promise.all([
    // Do sitemapy trafiają tylko przepisy widoczne dla użytkownika:
    // opublikowane, z ceną i z co najmniej jedną trwającą promocją.
    supabase
      .from('recipes')
      .select('id, slug, updated_at, promo_products(valid_to)')
      .eq('is_published', true)
      .gt('price_total', 0),
    supabase.from('stores').select('slug').eq('is_active', true),
    supabase.from('categories').select('slug').eq('is_active', true),
  ])

  const recipes = (allRecipes ?? []).filter((r: any) => hasActivePromo(r.promo_products))

  const base = SITE_URL

  const staticPages = [
    { url: base, lastModified: new Date() },
    { url: `${base}/polityka-prywatnosci`, lastModified: new Date() },
    { url: `${base}/regulamin`, lastModified: new Date() },
    { url: `${base}/reklama`, lastModified: new Date() },
  ]

  const storePages = (stores ?? []).map((s) => ({
    url: `${base}/sklep/${s.slug}`,
    lastModified: new Date(),
  }))

  const categoryPages = (categories ?? []).map((c) => ({
    url: `${base}/kategoria/${c.slug}`,
    lastModified: new Date(),
  }))

  const collectionPages = COLLECTIONS.map((c) => ({
    url: `${base}/kolekcja/${c.slug}`,
    lastModified: new Date(),
  }))

  const recipePages = (recipes ?? []).map((r) => ({
    url: `${base}/przepis/${r.slug}`,
    lastModified: new Date(r.updated_at),
  }))

  return [...staticPages, ...storePages, ...categoryPages, ...collectionPages, ...recipePages]
}
