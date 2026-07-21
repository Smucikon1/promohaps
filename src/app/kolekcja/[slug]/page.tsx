import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import { fetchRecipes } from '@/lib/recipeQuery'
import { getCollection, COLLECTIONS } from '@/lib/collections'

interface Props {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const col = getCollection(slug)
  if (!col) return {}
  return {
    title: `${col.title} — tanie przepisy z promocji`,
    description: col.description,
    robots: { index: true, follow: true },
  }
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params
  const col = getCollection(slug)
  if (!col) notFound()

  const supabase = await createClient()
  const { recipes } = await fetchRecipes(supabase, {
    categorySlug: col.categorySlug,
    maxPrice: col.maxPrice,
    maxTime: col.maxTime,
    difficulty: col.difficulty,
    sort: 'cheap',
    limit: 48,
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-amber-600 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Wszystkie przepisy
      </Link>

      <h1 className="text-3xl font-bold text-stone-900 mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
        {col.title}
      </h1>
      <p className="text-stone-500 mb-8">{col.description}</p>

      {recipes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recipes.map((r: any, i: number) => (
            <RecipeCard key={r.id} recipe={r} index={i} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-100">
          <p className="text-stone-500">W tej kolekcji nie ma jeszcze przepisów. Zajrzyj wkrótce.</p>
        </div>
      )}

      {/* Inne kolekcje */}
      <section className="mt-14 pt-8 border-t border-stone-100">
        <h2 className="text-lg font-bold text-stone-800 mb-3" style={{ fontFamily: 'var(--font-serif)' }}>Inne kolekcje</h2>
        <div className="flex flex-wrap gap-2">
          {COLLECTIONS.filter((c) => c.slug !== col.slug).map((c) => (
            <Link key={c.slug} href={`/kolekcja/${c.slug}`} className="category-pill">{c.title}</Link>
          ))}
        </div>
      </section>
    </div>
  )
}
