import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import { storeColor } from '@/lib/stores'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: store } = await supabase.from('stores').select('name').eq('slug', slug).single()
  if (!store) return {}
  return {
    title: `Przepisy z promocji ${store.name} — tanie gotowanie`,
    description: `Przepisy dopasowane do aktualnych promocji w ${store.name}. Gotuj taniej z gazetki ${store.name} w całej Polsce.`,
    alternates: { canonical: `/sklep/${slug}` },
    robots: { index: true, follow: true },
  }
}

export default async function StorePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!store) notFound()

  const { data: rawRecipes } = await supabase
    .from('recipes')
    .select(`*, store:stores(*), categories:recipe_categories(category:categories(*)), promo_products(*)`)
    .eq('is_published', true)
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(48)

  const recipes = (rawRecipes ?? []).map((r: any) => ({
    ...r,
    categories: r.categories?.map((rc: any) => rc.category).filter(Boolean) ?? [],
  }))

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-amber-600 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Wszystkie przepisy
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <span className="store-badge text-sm" style={{ backgroundColor: storeColor(store.slug) }}>{store.name}</span>
      </div>
      <h1 className="text-3xl md:text-4xl font-bold text-stone-900 mb-3" style={{ fontFamily: 'var(--font-serif)' }}>
        Przepisy z promocji {store.name}
      </h1>
      <p className="text-stone-600 mb-8 max-w-2xl">
        Tanie przepisy dopasowane do aktualnej gazetki {store.name}. {recipes.length > 0 ? `${recipes.length} przepisów` : 'Wkrótce więcej przepisów'}.
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
          <p className="text-stone-500">Brak przepisów dla tego sklepu. Zajrzyj wkrótce!</p>
        </div>
      )}
    </div>
  )
}
