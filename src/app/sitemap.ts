import { createClient } from '@/lib/supabase/server'

export default async function Sitemap() {
  const supabase = await createClient()

  const [{ data: recipes }, { data: stores }, { data: categories }] = await Promise.all([
    supabase.from('recipes').select('slug, updated_at').eq('is_published', true),
    supabase.from('stores').select('slug').eq('is_active', true),
    supabase.from('categories').select('slug').eq('is_active', true),
  ])

  const base = 'https://przepisnik-z-gazetek.pl'

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

  const recipePages = (recipes ?? []).map((r) => ({
    url: `${base}/przepis/${r.slug}`,
    lastModified: new Date(r.updated_at),
  }))

  return [...staticPages, ...storePages, ...categoryPages, ...recipePages]
}
