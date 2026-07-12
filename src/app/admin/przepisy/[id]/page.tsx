import { createClient } from '@/lib/supabase/server'
import { RecipeForm } from '@/components/admin/RecipeForm'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditRecipePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: recipe }, { data: stores }, { data: categories }] = await Promise.all([
    supabase
      .from('recipes')
      .select('*, ingredients(*), steps:recipe_steps(*), promo_products(*), recipe_categories(category_id)')
      .eq('id', id)
      .single(),
    supabase.from('stores').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
  ])

  if (!recipe) notFound()

  const normalized = {
    ...recipe,
    category_ids: recipe.recipe_categories?.map((rc: any) => rc.category_id) ?? [],
    steps: [...(recipe.steps ?? [])].sort((a: any, b: any) => a.step_number - b.step_number),
    ingredients: [...(recipe.ingredients ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order),
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-8" style={{ fontFamily: 'var(--font-serif)' }}>
        Edytuj przepis
      </h1>
      <RecipeForm stores={stores ?? []} categories={categories ?? []} recipe={normalized} />
    </div>
  )
}
