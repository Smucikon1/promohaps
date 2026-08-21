import { createClient } from '@/lib/supabase/server'
import { LeafletEngine } from '@/components/admin/LeafletEngine'
import { ClassicRecipes } from '@/components/admin/ClassicRecipes'

export default async function AdminLeafletPage() {
  const supabase = await createClient()
  const { data: stores } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
        Silnik gazetek
      </h1>
      <p className="text-sm text-stone-500 mb-8">
        Wczytaj gazetkę → AI odczyta promocje → wygeneruj przepis‑szkic → zaakceptuj i opublikuj.
      </p>
      <LeafletEngine stores={stores ?? []} />

      {/* Automat dobiera dania sam, ale czasem po prostu wiadomo, ze brakuje schabowego */}
      <div className="mt-10">
        <ClassicRecipes stores={stores ?? []} />
      </div>
    </div>
  )
}
