import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import { CategoryIcon } from '@/components/recipe/CategoryIcon'
import { hasActivePromo } from '@/lib/utils'
import { dedupeRecipes } from '@/lib/recipeDedupe'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: cat } = await supabase.from('categories').select('name').eq('slug', slug).single()
  if (!cat) return {}
  return {
    title: `${cat.name} — tanie przepisy z promocji`,
    description: `Przepisy z kategorii ${cat.name} oparte na aktualnych promocjach w Biedronce, Lidlu, Auchan i Carrefour. Gotuj taniej z gazetek.`,
    alternates: { canonical: `/kategoria/${slug}` },
    robots: { index: true, follow: true },
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: cat } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!cat) notFound()

  const { data: rc } = await supabase.from('recipe_categories').select('recipe_id').eq('category_id', cat.id)
  const ids = (rc ?? []).map((r) => r.recipe_id)

  const { data: rawRecipes } = ids.length
    ? await supabase
        .from('recipes')
        .select(`*, store:stores(*), categories:recipe_categories(category:categories(*)), promo_products(*)`)
        .eq('is_published', true)
        .gt('price_total', 0)
        .in('id', ids)
        .order('created_at', { ascending: false })
        .limit(48)
    : { data: [] as any[] }

  const recipes = dedupeRecipes(
    (rawRecipes ?? [])
      // Tylko przepisy z trwającą promocją (wygasłe i te bez gazetki znikają)
      .filter((r: any) => hasActivePromo(r.promo_products))
      .map((r: any) => ({
        ...r,
        categories: r.categories?.map((rc2: any) => rc2.category).filter(Boolean) ?? [],
      }))
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="flex items-center gap-2.5 text-3xl md:text-4xl font-bold text-stone-900 mb-3" style={{ fontFamily: 'var(--font-serif)' }}>
        <CategoryIcon slug={cat.slug} className="w-7 h-7 text-[#12b76a]" />
        {cat.name}
      </h1>
      <p className="text-stone-600 mb-8 max-w-2xl">
        Tanie przepisy z kategorii „{cat.name}" oparte na aktualnych promocjach.
        {recipes.length > 0 ? ` ${recipes.length} przepisów.` : ''}
      </p>

      {recipes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recipes.map((recipe: any, i: number) => (
            <RecipeCard key={recipe.id} recipe={recipe} index={i} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-100">
          <div className="text-4xl mb-3">🍽️</div>
          <p className="text-stone-500">Brak przepisów w tej kategorii. Zajrzyj wkrótce!</p>
        </div>
      )}
    </div>
  )
}
