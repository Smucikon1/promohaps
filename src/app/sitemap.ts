import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/site'
import { COLLECTIONS } from '@/lib/collections'

export default async function Sitemap() {
  const supabase = await createClient()

  const [{ data: recipes }, { data: stores }, { data: categories }] = await Promise.all([
    // Wszystkie opublikowane przepisy z ceną — także te po wygaśnięciu promocji.
    // Strona przepisu nadal działa (pokazuje cenę bez promocji), więc usuwanie jej
    // z sitemapy tylko kazałoby Google porzucić zaindeksowany, żywy adres.
    supabase
      .from('recipes')
      .select('id, slug, updated_at')
      .eq('is_published', true)
      .gt('price_total', 0),
    supabase.from('stores').select('slug').eq('is_active', true),
    supabase.from('categories').select('slug').eq('is_active', true),
  ])

  const base = SITE_URL

  const staticPages = [
    { url: base, lastModified: new Date() },
    { url: `${base}/zestaw`, lastModified: new Date() },
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
