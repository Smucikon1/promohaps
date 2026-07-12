import { createClient } from '@/lib/supabase/server'
import { GenerateRecipe } from '@/components/admin/GenerateRecipe'

export default async function NewRecipePage() {
  const supabase = await createClient()
  const [{ data: stores }, { data: categories }] = await Promise.all([
    supabase.from('stores').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-8" style={{ fontFamily: 'var(--font-serif)' }}>
        Nowy przepis
      </h1>
      <GenerateRecipe stores={stores ?? []} categories={categories ?? []} />
    </div>
  )
}
