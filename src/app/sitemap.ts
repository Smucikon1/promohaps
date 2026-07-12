import { createClient } from '@/lib/supabase/server'

export default async function Sitemap() {
  const supabase = await createClient()
  const { data: recipes } = await supabase
    .from('recipes')
    .select('slug, updated_at')
    .eq('is_published', true)

  const base = 'https://przepisnik-z-gazetek.pl'

  const staticPages = [
    { url: base, lastModified: new Date() },
    { url: `${base}/?store=biedronka`, lastModified: new Date() },
    { url: `${base}/?store=lidl`, lastModified: new Date() },
    { url: `${base}/?store=auchan`, lastModified: new Date() },
    { url: `${base}/?store=carrefour`, lastModified: new Date() },
  ]

  const recipePages = (recipes ?? []).map((r) => ({
    url: `${base}/przepis/${r.slug}`,
    lastModified: new Date(r.updated_at),
  }))

  return [...staticPages, ...recipePages]
}
